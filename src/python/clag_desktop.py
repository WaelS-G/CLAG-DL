"""
CLAG Downloader - Standalone Desktop Application
Embeds high-performance Python server, full offline fallback, and native window rendering.
Made by: Wael Sayed
"""

import os
import sys
import time
import json
import shutil
import urllib.request
import urllib.parse
import mimetypes
import subprocess
import threading
import webbrowser
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

# Import media grabber with flexible import path
try:
    from src.python.media_grabber import PythonMediaGrabber
except ImportError:
    try:
        from media_grabber import PythonMediaGrabber
    except ImportError:
        PythonMediaGrabber = None

PORT = 8989
DATA_LOCK = threading.Lock()
TASKS = []
ACTIVE_DOWNLOADS = {}

def get_project_root():
    """Finds root of project whether running from script or PyInstaller."""
    if hasattr(sys, '_MEIPASS'):
        return sys._MEIPASS
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

ACTIVE_PORT = PORT

def get_client_dist_dir():
    """Locates dist/client or dist directory containing compiled web assets."""
    candidates = []
    if hasattr(sys, '_MEIPASS'):
        candidates.extend([
            os.path.join(sys._MEIPASS, 'dist', 'client'),
            os.path.join(sys._MEIPASS, 'dist'),
            os.path.join(sys._MEIPASS, 'client'),
            sys._MEIPASS,
        ])
    root = get_project_root()
    candidates.extend([
        os.path.join(root, 'dist', 'client'),
        os.path.join(root, 'dist'),
        os.path.join(root, 'dist', 'web'),
        os.path.join(root, 'client'),
        os.path.join(os.path.dirname(os.path.abspath(sys.argv[0])), 'dist', 'client'),
        os.path.join(os.path.dirname(os.path.abspath(sys.argv[0])), 'dist'),
        os.path.join(os.path.dirname(sys.executable), 'dist', 'client'),
        os.path.join(os.path.dirname(sys.executable), 'dist'),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'dist', 'client'),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'dist'),
    ])
    for cand in candidates:
        if cand and os.path.exists(os.path.join(cand, 'index.html')):
            return os.path.abspath(cand)
    return None

def get_data_dir():
    """Returns local data storage directory."""
    if hasattr(sys, '_MEIPASS'):
        # In portable EXE, write next to executable or in user home
        exe_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
        d = os.path.join(exe_dir, 'data')
    else:
        root = get_project_root()
        d = os.path.join(root, 'data')
    os.makedirs(d, exist_ok=True)
    return d

def get_config_file():
    return os.path.join(get_data_dir(), 'clag_config.json')

def load_settings():
    cfg_file = get_config_file()
    default_dir = os.path.join(os.path.expanduser('~'), 'Downloads', 'CLAG')
    defaults = {
        "downloadDir": default_dir,
        "maxConcurrentDownloads": 3,
        "defaultConnections": 16,
        "speedLimitKBps": 0,
        "autoStartDownloads": True,
        "clipboardMonitoring": True,
        "theme": "dark",
        "enableSoundAlerts": True,
        "clickNLoadEnabled": True,
        "clickNLoadPort": 9666,
        "apiPort": 8989,
        "downloadSubtitles": True,
        "subtitlesFormat": "txt",
        "subtitleLanguages": ["en", "ar"],
        "subtitlesInSubfolder": True
    }
    if os.path.exists(cfg_file):
        try:
            with open(cfg_file, 'r', encoding='utf-8') as f:
                saved = json.load(f)
                defaults.update(saved)
        except Exception:
            pass
    return defaults

def save_settings(new_settings):
    cfg_file = get_config_file()
    current = load_settings()
    current.update(new_settings)
    try:
        with open(cfg_file, 'w', encoding='utf-8') as f:
            json.dump(current, f, indent=2)
    except Exception as e:
        print(f"Failed to save settings: {e}")
    return current

class ClagHttpHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Quiet logger for clean terminal
        pass

    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == '/api/settings':
            settings = load_settings()
            settings['lanIp'] = get_lan_ip()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(settings).encode('utf-8'))
            return

        if path == '/api/downloads':
            with DATA_LOCK:
                tasks_copy = list(TASKS)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(tasks_copy).encode('utf-8'))
            return

        if path == '/api/system/read':
            query = urllib.parse.parse_qs(parsed.query)
            target_file = query.get('path', [''])[0]
            if target_file and os.path.exists(target_file):
                try:
                    with open(target_file, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/plain; charset=utf-8')
                    self.send_cors_headers()
                    self.end_headers()
                    self.wfile.write(content.encode('utf-8'))
                    return
                except Exception:
                    pass
            self.send_response(404)
            self.end_headers()
            return

        # Serve static assets from dist/client
        client_dir = get_client_dist_dir()
        if client_dir and os.path.exists(client_dir):
            rel_path = path.lstrip('/').replace('/', os.sep)
            file_path = os.path.normpath(os.path.join(client_dir, rel_path))

            # If file doesn't exist or is root, fallback to index.html (SPA routing)
            if not rel_path or not os.path.exists(file_path) or os.path.isdir(file_path):
                file_path = os.path.join(client_dir, 'index.html')

            if os.path.exists(file_path) and os.path.isfile(file_path):
                mime, _ = mimetypes.guess_type(file_path)
                lower_path = file_path.lower()
                if lower_path.endswith('.js') or lower_path.endswith('.mjs'):
                    mime = 'application/javascript; charset=utf-8'
                elif lower_path.endswith('.css'):
                    mime = 'text/css; charset=utf-8'
                elif lower_path.endswith('.html'):
                    mime = 'text/html; charset=utf-8'
                elif lower_path.endswith('.json') or lower_path.endswith('.webmanifest'):
                    mime = 'application/json'
                elif lower_path.endswith('.svg'):
                    mime = 'image/svg+xml'
                elif lower_path.endswith('.png'):
                    mime = 'image/png'
                elif lower_path.endswith('.ico'):
                    mime = 'image/x-icon'
                mime = mime or 'application/octet-stream'

                try:
                    with open(file_path, 'rb') as f:
                        data = f.read()
                    self.send_response(200)
                    self.send_header('Content-Type', mime)
                    self.send_header('Content-Length', str(len(data)))
                    self.send_cors_headers()
                    self.end_headers()
                    self.wfile.write(data)
                    return
                except Exception:
                    pass

        # Diagnostic fallback if static files are not found (prevents white blank screen)
        fallback_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>CLAG Downloader Pro</title>
<style>
body{{margin:0;padding:40px;background:#090d16;color:#e2e8f0;font-family:Segoe UI,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;box-sizing:border-box;}}
.box{{background:#111827;border:1px solid #1f2937;border-radius:16px;padding:32px;max-width:540px;text-align:center;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);}}
h1{{color:#38bdf8;margin:0 0 12px;font-size:24px;}}
p{{color:#94a3b8;font-size:14px;line-height:1.6;}}
.status{{display:inline-block;padding:6px 14px;background:#0284c7;color:#fff;border-radius:9999px;font-size:12px;font-weight:600;margin-top:16px;}}
</style>
</head>
<body>
<div class="box">
<h1>CLAG Downloader Pro</h1>
<p>Standalone Multi-Connection Download Manager & Universal Media Grabber<br>Made by: <strong>Wael Sayed</strong></p>
<div class="status">Desktop Backend Engine Active (Port {ACTIVE_PORT})</div>
</div>
</body>
</html>"""
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(fallback_html.encode('utf-8'))

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8') if length > 0 else '{}'
        try:
            payload = json.loads(body)
        except Exception:
            payload = {}

        if path == '/api/probe':
            url = payload.get('url', '').strip()
            if not url:
                self.send_response(400)
                self.end_headers()
                return

            if PythonMediaGrabber:
                probe_res = PythonMediaGrabber.probe_url(url)
                is_playlist = probe_res.get('isPlaylist', False)
                has_formats = bool(probe_res.get('formats'))
                is_media = has_formats or probe_res.get('isMedia', False) or (probe_res.get('extractor', 'generic') != 'generic')

                resp_data = {
                    'type': 'playlist' if is_playlist else ('media' if is_media else 'direct'),
                    'data': probe_res
                }
            else:
                resp_data = {
                    'type': 'direct',
                    'data': {
                        'url': url,
                        'title': os.path.basename(urllib.parse.urlparse(url).path) or 'download',
                        'filename': os.path.basename(urllib.parse.urlparse(url).path) or 'download',
                        'isStream': False
                    }
                }

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(resp_data).encode('utf-8'))
            return

        if path == '/api/batch/parse':
            text = payload.get('text', '')
            import re
            found_urls = re.findall(r'https?://[^\s<>"]+', text)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'urls': found_urls}).encode('utf-8'))
            return

        if path == '/api/system/open':
            target_path = payload.get('path', '')
            action = payload.get('action', 'folder')
            if not target_path:
                self.send_response(400)
                self.end_headers()
                return

            try:
                norm_target = os.path.normpath(os.path.abspath(target_path))
                if action == 'folder':
                    if os.path.exists(norm_target):
                        if os.path.isdir(norm_target):
                            os.startfile(norm_target)
                        elif os.path.isfile(norm_target):
                            subprocess.Popen(f'explorer /select,"{norm_target}"', shell=True)
                    else:
                        parent = os.path.dirname(norm_target)
                        if os.path.exists(parent):
                            os.startfile(parent)
                        else:
                            cfg = load_settings()
                            fallback_dir = cfg.get('downloadDir', os.path.join(os.path.expanduser('~'), 'Downloads', 'CLAG'))
                            if os.path.exists(fallback_dir):
                                os.startfile(fallback_dir)
                else:
                    # action == 'file': Launch file in default system viewer/player
                    target_to_open = None
                    if os.path.isfile(norm_target):
                        target_to_open = norm_target
                    elif os.path.isdir(norm_target):
                        files = os.listdir(norm_target)
                        media_files = [f for f in files if f.lower().endswith(('.mp4', '.mp3', '.mkv', '.webm', '.avi', '.mov', '.flv', '.txt', '.srt'))]
                        if media_files:
                            target_to_open = os.path.join(norm_target, media_files[0])
                    else:
                        for ext in ['.mp4', '.mp3', '.mkv', '.webm', '.txt', '.srt']:
                            cand = f"{norm_target}{ext}"
                            if os.path.isfile(cand):
                                target_to_open = cand
                                break

                    if target_to_open and os.path.isfile(target_to_open):
                        os.startfile(target_to_open)
                    else:
                        parent = os.path.dirname(norm_target)
                        if os.path.exists(parent):
                            os.startfile(parent)
            except Exception as e:
                print(f"Open error: {e}")

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'success': True}).encode('utf-8'))
            return

        # Pause download route
        if path.startswith('/api/downloads/') and path.endswith('/pause'):
            parts = path.strip('/').split('/')
            task_id = parts[2] if len(parts) >= 3 else ''
            with DATA_LOCK:
                for t in TASKS:
                    if t.get('id') == task_id:
                        t['status'] = 'paused'
                        t['speed'] = 0
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'success': True}).encode('utf-8'))
            return

        # Resume download route
        if path.startswith('/api/downloads/') and path.endswith('/resume'):
            parts = path.strip('/').split('/')
            task_id = parts[2] if len(parts) >= 3 else ''
            with DATA_LOCK:
                for t in TASKS:
                    if t.get('id') == task_id:
                        t['status'] = 'downloading'
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'success': True}).encode('utf-8'))
            return

        if path == '/api/downloads':
            url = payload.get('url', '').strip()
            if not url:
                self.send_response(400)
                self.end_headers()
                return

            cfg = load_settings()
            save_dir = cfg.get('downloadDir', os.path.join(os.path.expanduser('~'), 'Downloads', 'CLAG'))
            os.makedirs(save_dir, exist_ok=True)
            custom_fn = payload.get('filename') or os.path.basename(urllib.parse.urlparse(url).path) or f'download_{int(time.time())}'

            # Guarantee media extensions so savePath never collides with subtitle folder
            if payload.get('isMediaStream'):
                target_ext = '.mp3' if payload.get('audioOnly') else '.mp4'
                if not custom_fn.lower().endswith(target_ext):
                    base = os.path.splitext(custom_fn)[0]
                    custom_fn = f"{base}{target_ext}"

            task_id = f"clag_{int(time.time())}_{os.urandom(3).hex()}"
            task = {
                "id": task_id,
                "url": url,
                "filename": custom_fn,
                "savePath": os.path.join(save_dir, custom_fn),
                "totalBytes": 0,
                "downloadedBytes": 0,
                "speed": 0,
                "status": "downloading",
                "category": "audio" if payload.get('audioOnly') else ("video" if payload.get('isMediaStream') else "other"),
                "progress": 0,
                "eta": 0,
                "connections": payload.get('connections', 16),
                "chunks": [],
                "createdAt": int(time.time() * 1000),
                "isMediaStream": payload.get('isMediaStream', False),
                "qualityLabel": payload.get('qualityLabel', ''),
                "source": "YouTube" if "youtube" in url or "youtu.be" in url else ("Instagram" if "instagram" in url else "Direct"),
                "audioOnly": payload.get('audioOnly', False),
                "downloadSubtitles": payload.get('downloadSubtitles', True),
                "subtitleLanguages": payload.get('subtitleLanguages', cfg.get('subtitleLanguages', ['en', 'ar']))
            }

            with DATA_LOCK:
                TASKS.insert(0, task)

            # Start download in background thread
            def run_dl(t):
                if PythonMediaGrabber and t.get('isMediaStream'):
                    out_path = t['savePath']
                    def on_prog(hook):
                        line = hook.get('raw_line', '')
                        if '%' in line:
                            import re
                            m = re.search(r'(\d+\.?\d*)%', line)
                            if m:
                                t['progress'] = float(m.group(1))

                    res = PythonMediaGrabber.download_media(
                        url=t['url'],
                        output_path=out_path,
                        format_id=payload.get('mediaFormatId'),
                        audio_only=t.get('audioOnly', False),
                        download_subtitles=t.get('downloadSubtitles', True),
                        subtitle_languages=t.get('subtitleLanguages'),
                        progress_hook=on_prog
                    )
                    t['status'] = 'completed' if res else 'error'
                    t['progress'] = 100 if res else t['progress']
                    if res:
                        if res.get('filePath') and os.path.isfile(res['filePath']):
                            t['savePath'] = res['filePath']
                            t['filename'] = os.path.basename(res['filePath'])
                            t['totalBytes'] = os.path.getsize(res['filePath'])
                            t['downloadedBytes'] = t['totalBytes']
                        if res.get('subtitlesTxtPath') and os.path.isfile(res['subtitlesTxtPath']):
                            t['subtitlesTextPath'] = res['subtitlesTxtPath']
                            t['hasSubtitles'] = True
                        if res.get('subtitlesTimestampsPath') and os.path.isfile(res['subtitlesTimestampsPath']):
                            t['subtitlesTimestampsPath'] = res['subtitlesTimestampsPath']
                            t['hasSubtitles'] = True
                        if res.get('subtitlesFolder') and os.path.isdir(res['subtitlesFolder']):
                            t['subtitlesPath'] = res['subtitlesFolder']
                            t['subtitlesDir'] = res['subtitlesFolder']
                else:
                    # Direct file download
                    try:
                        req = urllib.request.Request(t['url'], headers={'User-Agent': 'Mozilla/5.0'})
                        with urllib.request.urlopen(req) as resp, open(t['savePath'], 'wb') as out_f:
                            tot = int(resp.headers.get('Content-Length', 0))
                            t['totalBytes'] = tot
                            cur = 0
                            while True:
                                chunk = resp.read(256 * 1024)
                                if not chunk:
                                    break
                                out_f.write(chunk)
                                cur += len(chunk)
                                t['downloadedBytes'] = cur
                                if tot > 0:
                                    t['progress'] = (cur / tot) * 100
                            t['status'] = 'completed'
                            t['progress'] = 100
                    except Exception as err:
                        t['status'] = 'error'
                        t['error'] = str(err)

            th = threading.Thread(target=run_dl, args=(task,), daemon=True)
            th.start()

            self.send_response(201)
            self.send_header('Content-Type', 'application/json')
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(task).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path == '/api/settings':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8') if length > 0 else '{}'
            try:
                new_cfg = json.loads(body)
            except Exception:
                new_cfg = {}
            saved = save_settings(new_cfg)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(saved).encode('utf-8'))
            return

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path.startswith('/api/downloads/'):
            parts = path.strip('/').split('/')
            task_id = parts[2] if len(parts) >= 3 else ''
            with DATA_LOCK:
                global TASKS
                TASKS = [t for t in TASKS if t.get('id') != task_id]
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'success': True}).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

def is_server_already_running(port=PORT):
    """Checks if a CLAG server is already responding on specified port."""
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/settings", timeout=0.8) as resp:
            return resp.status == 200
    except Exception:
        return False

def get_lan_ip():
    """Detects local LAN IPv4 address for phone and remote access."""
    try:
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def start_embedded_server():
    """Starts the internal ThreadingHTTPServer in a background daemon thread."""
    global ACTIVE_PORT

    # Check if a CLAG instance is already responding on default port 8989
    if is_server_already_running(PORT):
        print(f"[CLAG Desktop] Existing CLAG instance detected on port {PORT}.")
        ACTIVE_PORT = PORT
        return

    # Try binding to 8989, or search sequentially up to port 9010 on 0.0.0.0 (all interfaces)
    for p in range(PORT, PORT + 20):
        try:
            server = ThreadingHTTPServer(('0.0.0.0', p), ClagHttpHandler)
            ACTIVE_PORT = p
            t = threading.Thread(target=server.serve_forever, daemon=True)
            t.start()
            lan_ip = get_lan_ip()
            print(f"[CLAG Desktop] Server started successfully:")
            print(f"  -> Local PC:    http://127.0.0.1:{p}")
            print(f"  -> Phone / LAN: http://{lan_ip}:{p}")
            return
        except OSError:
            continue

    print(f"[CLAG Desktop] Warning: Could not bind embedded server on ports {PORT}-{PORT+20}")

def find_browser_app_executable():
    """Finds Edge or Chrome executable for borderless standalone app mode."""
    candidates = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None

def main():
    print("=" * 60)
    print("  CLAG Downloader Pro - Desktop Edition")
    print("  Made by: Wael Sayed")
    print("=" * 60)

    # 1. Start embedded Python server (serves dist/client and local APIs)
    start_embedded_server()
    time.sleep(0.5)

    target_url = f"http://127.0.0.1:{ACTIVE_PORT}"

    # 2. Try launching with native pywebview window
    try:
        import webview
        print("[CLAG Desktop] Launching native application window...")
        window = webview.create_window(
            title="CLAG Downloader Pro — Made by Wael Sayed",
            url=target_url,
            width=1280,
            height=840,
            min_size=(960, 640),
            background_color='#0a0f1d'
        )
        webview.start()
        return
    except Exception as e:
        print(f"[CLAG Desktop] Native window notice ({e}), launching in app window mode...")

    # 3. Fallback: Edge / Chrome borderless app window
    browser = find_browser_app_executable()
    if browser:
        cmd = [
            browser,
            f"--app={target_url}",
            "--window-size=1280,840",
            "--disable-extensions",
            "--app-auto-launched"
        ]
        try:
            p = subprocess.Popen(cmd)
            p.wait()
            return
        except Exception:
            pass

    # 4. Ultimate fallback: default browser
    webbrowser.open(target_url)

if __name__ == "__main__":
    main()
