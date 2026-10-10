"""
CLAG Downloader - Multi-threaded Chunk Engine (Python Core)
High-performance HTTP Range-based multi-connection downloader with dynamic chunking.
"""

import os
import sys
import time
import math
import shutil
import urllib.request
import urllib.error
import threading
from typing import Callable, Optional, Dict, List, Any

class ChunkWorker(threading.Thread):
    def __init__(
        self,
        url: str,
        start_byte: int,
        end_byte: int,
        part_file_path: str,
        chunk_index: int,
        headers: Optional[Dict[str, str]] = None,
        progress_callback: Optional[Callable[[int, int], None]] = None,
        speed_limit_bytes_sec: int = 0
    ):
        super().__init__(daemon=True)
        self.url = url
        self.start_byte = start_byte
        self.end_byte = end_byte
        self.part_file_path = part_file_path
        self.chunk_index = chunk_index
        self.headers = headers or {}
        self.progress_callback = progress_callback
        self.speed_limit = speed_limit_bytes_sec
        self.downloaded_bytes = 0
        self.total_bytes = end_byte - start_byte + 1
        self.is_running = True
        self.is_paused = False
        self.is_completed = False
        self.error: Optional[Exception] = None

    def run(self):
        try:
            # Check for existing partial chunk resume
            resume_offset = 0
            if os.path.exists(self.part_file_path):
                resume_offset = os.path.getsize(self.part_file_path)
                if resume_offset >= self.total_bytes:
                    self.downloaded_bytes = self.total_bytes
                    self.is_completed = True
                    if self.progress_callback:
                        self.progress_callback(self.chunk_index, self.downloaded_bytes)
                    return

            actual_start = self.start_byte + resume_offset
            self.downloaded_bytes = resume_offset

            req = urllib.request.Request(self.url)
            for k, v in self.headers.items():
                req.add_header(k, v)
            if 'User-Agent' not in self.headers:
                req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
            
            req.add_header('Accept-Encoding', 'identity')
            req.add_header('Connection', 'keep-alive')
            req.add_header('Range', f'bytes={actual_start}-{self.end_byte}')

            mode = 'ab' if resume_offset > 0 else 'wb'
            with urllib.request.urlopen(req, timeout=30) as response, open(self.part_file_path, mode) as out_f:
                chunk_buffer_size = 512 * 1024 # 512 KB buffer for high-throughput streaming
                last_time = time.time()
                bytes_since_last_limit = 0

                while self.is_running:
                    if self.is_paused:
                        time.sleep(0.1)
                        continue

                    chunk = response.read(chunk_buffer_size)
                    if not chunk:
                        break

                    out_f.write(chunk)
                    chunk_len = len(chunk)
                    self.downloaded_bytes += chunk_len
                    bytes_since_last_limit += chunk_len

                    # Bandwidth throttling
                    if self.speed_limit > 0:
                        now = time.time()
                        elapsed = now - last_time
                        expected_time = bytes_since_last_limit / self.speed_limit
                        if elapsed < expected_time:
                            time.sleep(expected_time - elapsed)
                        if elapsed > 1.0:
                            last_time = time.time()
                            bytes_since_last_limit = 0

                    if self.progress_callback:
                        self.progress_callback(self.chunk_index, self.downloaded_bytes)

            if self.is_running:
                self.is_completed = True

        except Exception as e:
            self.error = e
            self.is_running = False

    def stop(self):
        self.is_running = False

    def pause(self):
        self.is_paused = True

    def resume_work(self):
        self.is_paused = False


class PythonMultiChunkDownloader:
    """Multi-connection accelerated downloader in Python."""
    def __init__(
        self,
        url: str,
        destination_path: str,
        connections: int = 8,
        headers: Optional[Dict[str, str]] = None,
        speed_limit_kbps: int = 0
    ):
        self.url = url
        self.destination_path = os.path.abspath(destination_path)
        self.connections = max(1, min(32, connections))
        self.headers = headers or {}
        self.speed_limit_bytes = speed_limit_kbps * 1024
        self.workers: List[ChunkWorker] = []
        self.total_size = 0
        self.supports_range = False
        self.is_running = False
        self.is_paused = False
        self.start_time = 0.0
        self.last_downloaded = 0
        self.current_speed = 0.0
        self.on_progress: Optional[Callable[[Dict[str, Any]], None]] = None

    def probe(self) -> Dict[str, Any]:
        """Probes file size and range request capability."""
        req = urllib.request.Request(self.url, method='HEAD')
        for k, v in self.headers.items():
            req.add_header(k, v)
        if 'User-Agent' not in self.headers:
            req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

        try:
            with urllib.request.urlopen(req, timeout=15) as res:
                self.total_size = int(res.headers.get('Content-Length', 0))
                accept_ranges = res.headers.get('Accept-Ranges', '')
                self.supports_range = ('bytes' in accept_ranges.lower()) and (self.total_size > 0)
                
                # Check suggested filename if destination is a directory
                content_disp = res.headers.get('Content-Disposition', '')
                suggested_filename = None
                if 'filename=' in content_disp:
                    parts = content_disp.split('filename=')
                    if len(parts) > 1:
                        suggested_filename = parts[1].strip(' ";\'')

                return {
                    'total_size': self.total_size,
                    'supports_range': self.supports_range,
                    'suggested_filename': suggested_filename,
                    'content_type': res.headers.get('Content-Type', '')
                }
        except Exception:
            # Fallback to GET with Range 0-0
            req = urllib.request.Request(self.url)
            req.add_header('Range', 'bytes=0-0')
            for k, v in self.headers.items():
                req.add_header(k, v)
            if 'User-Agent' not in self.headers:
                req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
            try:
                with urllib.request.urlopen(req, timeout=15) as res:
                    crange = res.headers.get('Content-Range', '')
                    if '/' in crange:
                        self.total_size = int(crange.split('/')[-1])
                        self.supports_range = True
                    return {
                        'total_size': self.total_size,
                        'supports_range': self.supports_range,
                        'suggested_filename': None,
                        'content_type': res.headers.get('Content-Type', '')
                    }
            except Exception as e:
                return {
                    'total_size': 0,
                    'supports_range': False,
                    'error': str(e)
                }

    def start(self):
        """Starts multi-segmented download."""
        info = self.probe()
        os.makedirs(os.path.dirname(self.destination_path), exist_ok=True)
        self.is_running = True
        self.start_time = time.time()

        # If server does not support ranges or size is unknown, fallback to single connection
        if not self.supports_range or self.total_size <= 0:
            self.connections = 1

        part_dir = self.destination_path + '.clag_parts'
        os.makedirs(part_dir, exist_ok=True)

        chunk_size = math.ceil(self.total_size / self.connections) if self.total_size > 0 else 0
        per_worker_limit = int(self.speed_limit_bytes / self.connections) if self.speed_limit_bytes > 0 else 0

        self.workers = []
        for i in range(self.connections):
            start = i * chunk_size
            end = min(self.total_size - 1, (i + 1) * chunk_size - 1) if self.total_size > 0 else 0
            if i == self.connections - 1 and self.total_size > 0:
                end = self.total_size - 1

            part_path = os.path.join(part_dir, f'part_{i}.clag')
            worker = ChunkWorker(
                url=self.url,
                start_byte=start,
                end_byte=end,
                part_file_path=part_path,
                chunk_index=i,
                headers=self.headers,
                speed_limit_bytes_sec=per_worker_limit
            )
            self.workers.append(worker)
            worker.start()

        # Monitoring loop in background thread
        monitor_thread = threading.Thread(target=self._monitor_progress, daemon=True)
        monitor_thread.start()

    def _monitor_progress(self):
        last_calc_time = time.time()
        last_bytes = 0

        while self.is_running:
            time.sleep(0.3)
            now = time.time()
            current_downloaded = sum(w.downloaded_bytes for w in self.workers)

            time_diff = now - last_calc_time
            if time_diff >= 0.5:
                bytes_diff = current_downloaded - last_bytes
                self.current_speed = bytes_diff / time_diff
                last_calc_time = now
                last_bytes = current_downloaded

            progress_pct = (current_downloaded / self.total_size * 100) if self.total_size > 0 else 0
            eta = ((self.total_size - current_downloaded) / self.current_speed) if (self.current_speed > 0 and self.total_size > 0) else 0

            chunk_states = [
                {
                    'index': w.chunk_index,
                    'downloaded': w.downloaded_bytes,
                    'total': w.total_bytes,
                    'progress': (w.downloaded_bytes / w.total_bytes * 100) if w.total_bytes > 0 else 0,
                    'completed': w.is_completed
                }
                for w in self.workers
            ]

            if self.on_progress:
                self.on_progress({
                    'downloaded': current_downloaded,
                    'total': self.total_size,
                    'progress': progress_pct,
                    'speed': self.current_speed,
                    'eta': eta,
                    'chunks': chunk_states,
                    'is_completed': all(w.is_completed for w in self.workers)
                })

            if all(w.is_completed for w in self.workers):
                self._assemble_file()
                break

    def _assemble_file(self):
        """Assembles all partial chunks into final output file."""
        part_dir = self.destination_path + '.clag_parts'
        temp_final = self.destination_path + '.downloading'

        with open(temp_final, 'wb') as outfile:
            for i in range(len(self.workers)):
                part_path = os.path.join(part_dir, f'part_{i}.clag')
                if os.path.exists(part_path):
                    with open(part_path, 'rb') as infile:
                        shutil.copyfileobj(infile, outfile, length=1024 * 1024)

        # Move to destination
        if os.path.exists(self.destination_path):
            os.remove(self.destination_path)
        os.rename(temp_final, self.destination_path)

        # Clean up parts
        shutil.rmtree(part_dir, ignore_errors=True)
        self.is_running = False

    def pause(self):
        for w in self.workers:
            w.pause()
        self.is_paused = True

    def resume(self):
        for w in self.workers:
            w.resume_work()
        self.is_paused = False

    def stop(self):
        self.is_running = False
        for w in self.workers:
            w.stop()
