"""
CLAG Downloader - Universal Media Grabber (Python Core)
Integrates yt-dlp and FFmpeg 8.1 for grabbing video/audio from 1,000+ sites.
"""

import os
import sys
import json
import shutil
import subprocess
from typing import Dict, Any, List, Optional, Callable

try:
    import yt_dlp
except ImportError:
    yt_dlp = None

class MediaDownloadResult(dict):
    """Result dictionary that evaluates to bool(self.get('success', False)) for backward compatibility."""
    def __bool__(self):
        return bool(self.get('success', False))

def get_ytdlp_cmd() -> List[str]:
    """Returns the executable command prefix for invoking yt-dlp safely."""
    if not getattr(sys, 'frozen', False):
        return [sys.executable, "-m", "yt_dlp"]

    # When frozen inside PyInstaller EXE, locate system python or standalone yt-dlp
    py = shutil.which("python") or shutil.which("python3")
    if py:
        return [py, "-m", "yt_dlp"]

    local_app = os.environ.get("LOCALAPPDATA", "")
    candidates = [
        os.path.join(local_app, "Programs", "Python", "Python310", "python.exe"),
        os.path.join(local_app, "Programs", "Python", "Python311", "python.exe"),
        os.path.join(local_app, "Programs", "Python", "Python312", "python.exe"),
        r"C:\Python310\python.exe",
        r"C:\Python311\python.exe",
        r"C:\Python312\python.exe",
    ]
    for cand in candidates:
        if cand and os.path.exists(cand):
            return [cand, "-m", "yt_dlp"]

    yt_bin = shutil.which("yt-dlp")
    if yt_bin:
        return [yt_bin]

    return [sys.executable, "-m", "yt_dlp"]

class PythonMediaGrabber:
    """Probes and downloads video/audio streams using yt-dlp & FFmpeg."""

    @staticmethod
    def probe_url(url: str) -> Dict[str, Any]:
        """Probes video metadata, title, duration, thumbnail, and format variants without terminal popups."""
        data = None

        # 1. Try in-process yt_dlp extraction (fastest, zero subprocess, no cmd popup)
        if yt_dlp:
            try:
                ydl_opts = {
                    'skip_download': True,
                    'quiet': True,
                    'no_warnings': True,
                    'extract_flat': False,
                    'source_address': '0.0.0.0',
                    'socket_timeout': 15,
                }
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    data = ydl.extract_info(url, download=False)
            except Exception as in_err:
                # If in-process raises, fallback to subprocess
                data = None

        # 2. Subprocess fallback with CREATE_NO_WINDOW
        if data is None:
            cmd = get_ytdlp_cmd() + [
                "--dump-json",
                "--no-playlist",
                "--no-warnings",
                "--skip-download",
                "--force-ipv4",
                "--remote-components", "ejs:github",
                "--js-runtimes", "node",
                "--socket-timeout", "15",
                url
            ]

            flags = subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
            try:
                res = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    encoding='utf-8',
                    errors='replace',
                    timeout=25,
                    creationflags=flags
                )
                if res.returncode == 0 and res.stdout.strip():
                    data = json.loads(res.stdout)
                else:
                    return {
                        "error": res.stderr.strip() or "Failed to probe media URL",
                        "isStream": False,
                        "isMedia": False
                    }
            except Exception as e:
                return {
                    "error": str(e),
                    "isStream": False,
                    "isMedia": False
                }

        try:
            raw_formats = data.get("formats", [])
            formats_list = []
            seen = set()

            for f in raw_formats:
                # Filter out storyboard image sprites and non-media formats
                if f.get("ext") == "mhtml" or f.get("format_note") == "storyboard":
                    continue

                fid = f.get("format_id", "")
                ext = f.get("ext", "mp4")
                vcodec = f.get("vcodec", "none")
                acodec = f.get("acodec", "none")
                has_video = vcodec != "none" and vcodec is not None
                has_audio = acodec != "none" and acodec is not None

                if not has_video and not has_audio:
                    continue

                res_str = f.get("resolution") or (f"{f.get('width')}x{f.get('height')}" if f.get('width') else None)
                filesize = f.get("filesize") or f.get("filesize_approx") or 0
                fps = f.get("fps")
                format_note = f.get("format_note", "")

                quality_label = ""
                if has_video:
                    h = f.get("height") or (int(res_str.split("x")[1]) if res_str and "x" in res_str else 0)
                    fps_str = f" {int(fps)}fps" if fps and fps > 30 else ""
                    if h >= 2160:
                        quality_label = f"4K Ultra HD (2160p{fps_str})"
                    elif h >= 1440:
                        quality_label = f"2K Quad HD (1440p{fps_str})"
                    elif h >= 1080:
                        quality_label = f"1080p Full HD{fps_str}"
                    elif h >= 720:
                        quality_label = f"720p HD{fps_str}"
                    elif h >= 480:
                        quality_label = f"480p SD"
                    elif h >= 360:
                        quality_label = f"360p"
                    elif h >= 240:
                        quality_label = f"240p"
                    elif h >= 144:
                        quality_label = f"144p"
                    else:
                        quality_label = res_str or format_note or "Standard Video"
                elif has_audio:
                    abr = int(f.get("abr", 128))
                    quality_label = f"Audio ({abr} kbps {ext.upper()})"

                dedupe_key = f"{'v' if has_video else 'a'}_{res_str or format_note}_{ext}_{fps or 0}"
                if dedupe_key in seen:
                    continue
                seen.add(dedupe_key)

                filesize_formatted = ""
                if filesize > 0:
                    if filesize >= 1024 * 1024 * 1024:
                        filesize_formatted = f"{filesize / (1024**3):.2f} GB"
                    elif filesize >= 1024 * 1024:
                        filesize_formatted = f"{filesize / (1024**2):.1f} MB"
                    else:
                        filesize_formatted = f"{filesize / 1024:.0f} KB"

                formats_list.append({
                    "formatId": fid,
                    "ext": ext,
                    "resolution": res_str,
                    "fps": fps,
                    "filesize": filesize,
                    "filesizeFormatted": filesize_formatted,
                    "vcodec": vcodec,
                    "acodec": acodec,
                    "qualityLabel": quality_label,
                    "hasVideo": has_video,
                    "hasAudio": has_audio,
                    "height": f.get("height") or 0,
                    "url": f.get("url")
                })

            # Sort descending: Highest resolution videos first, then audio
            formats_list.sort(key=lambda x: (not x["hasVideo"], -x.get("height", 0), -(x.get("filesize", 0) or 0)))

            # Format duration
            duration = data.get("duration", 0)
            duration_formatted = ""
            if duration:
                mins, secs = divmod(int(duration), 60)
                hours, mins = divmod(mins, 60)
                if hours > 0:
                    duration_formatted = f"{hours}:{mins:02d}:{secs:02d}"
                else:
                    duration_formatted = f"{mins}:{secs:02d}"

            is_playlist = bool(data.get('_type') == 'playlist' or data.get('entries'))
            entries = []
            if is_playlist and data.get('entries'):
                for item in data['entries']:
                    if item:
                        entries.append({
                            "url": item.get('url') or item.get('webpage_url') or f"https://www.youtube.com/watch?v={item.get('id')}",
                            "title": item.get('title') or "Untitled Video",
                            "thumbnail": item.get('thumbnail')
                        })

            return {
                "url": url,
                "title": data.get("title", "Unknown Title"),
                "uploader": data.get("uploader") or data.get("channel", "Unknown"),
                "duration": duration,
                "durationFormatted": duration_formatted,
                "thumbnail": data.get("thumbnail"),
                "formats": formats_list,
                "isStream": data.get("is_live", False),
                "isMedia": True,
                "isPlaylist": is_playlist,
                "entries": entries,
                "extractor": data.get("extractor", "generic"),
                "hasSubtitles": bool(data.get("subtitles") or data.get("automatic_captions")),
                "subtitlesList": list(set(list((data.get("subtitles") or {}).keys()) + list((data.get("automatic_captions") or {}).keys())))
            }

        except Exception as e:
            return {
                "error": str(e),
                "isStream": False,
                "isMedia": False
            }

    @staticmethod
    def clean_subtitles_to_text(raw_content: str) -> str:
        """Cleans raw WebVTT or SRT subtitles into human-readable plain text without timestamps,
        preserving the exact line-by-line cue structure of the SRT file."""
        import unicodedata
        import re

        if not raw_content or not raw_content.strip():
            return ""

        normalized = unicodedata.normalize('NFKC', raw_content).replace('\r\n', '\n').replace('\r', '\n')
        lines = normalized.split('\n')
        cues = []
        current_cue_lines = []

        for line in lines:
            line = line.strip()
            if not line:
                if current_cue_lines:
                    text_block = " ".join(current_cue_lines).strip()
                    if text_block and (not cues or cues[-1] != text_block):
                        cues.append(text_block)
                    current_cue_lines = []
                continue

            # Skip WebVTT headers
            if re.match(r'^(WEBVTT|Kind:|Language:|NOTE|STYLE|REGION)', line, re.I):
                continue

            # Skip numeric cues
            if line.isdigit():
                continue

            # Skip timestamps: 00:00:01,000 --> 00:00:04,000
            if re.search(r'\d{1,2}:\d{2}(?::\d{2})?[,\.]\d{1,3}\s*-->\s*\d{1,2}:\d{2}(?::\d{2})?[,\.]\d{1,3}', line):
                if current_cue_lines:
                    text_block = " ".join(current_cue_lines).strip()
                    if text_block and (not cues or cues[-1] != text_block):
                        cues.append(text_block)
                    current_cue_lines = []
                continue

            # Strip HTML/VTT tags
            line = re.sub(r'<[^>]+>', '', line)

            # Unescape HTML entities
            line = (line.replace('&amp;', '&')
                        .replace('&lt;', '<')
                        .replace('&gt;', '>')
                        .replace('&quot;', '"')
                        .replace('&#39;', "'")
                        .replace('&nbsp;', ' ')
                        .strip())
            if not line:
                continue

            # Deduplicate rolling lines
            if not current_cue_lines or current_cue_lines[-1] != line:
                current_cue_lines.append(line)

        if current_cue_lines:
            text_block = " ".join(current_cue_lines).strip()
            if text_block and (not cues or cues[-1] != text_block):
                cues.append(text_block)

        return "\n".join(cues)

    @staticmethod
    def convert_subtitles_to_timed_text(raw_content: str) -> str:
        """Converts raw WebVTT or SRT subtitle content into an organized, readable text transcript with timestamps."""
        if not raw_content or not raw_content.strip():
            return ""

        import unicodedata
        import re

        normalized = unicodedata.normalize('NFKC', raw_content).replace('\r\n', '\n').replace('\r', '\n')
        lines = normalized.split('\n')

        cues = []
        current_time = ""
        current_text_lines = []

        for line in lines:
            line = line.strip()
            if not line:
                if current_time and current_text_lines:
                    text_block = " ".join(current_text_lines).strip()
                    if text_block:
                        cues.append(f"[{current_time}]\n{text_block}")
                    current_time = ""
                    current_text_lines = []
                continue

            # Skip WebVTT headers
            if re.match(r'^(WEBVTT|Kind:|Language:|NOTE|STYLE|REGION)', line, re.I):
                continue

            # Skip numeric cue index
            if line.isdigit():
                continue

            # Timestamp line: 00:00:01,000 --> 00:00:04,500
            m_time = re.search(r'(\d{1,2}:\d{2}(?::\d{2})?(?:[,\.]\d{1,3})?)\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[,\.]\d{1,3})?)', line)
            if m_time:
                if current_time and current_text_lines:
                    text_block = " ".join(current_text_lines).strip()
                    if text_block:
                        cues.append(f"[{current_time}]\n{text_block}")
                current_time = f"{m_time.group(1)} --> {m_time.group(2)}"
                current_text_lines = []
                continue

            # Clean tags and entities
            cleaned = re.sub(r'<[^>]+>', '', line)
            cleaned = (cleaned
                       .replace('&amp;', '&')
                       .replace('&lt;', '<')
                       .replace('&gt;', '>')
                       .replace('&quot;', '"')
                       .replace('&#39;', "'")
                       .replace('&nbsp;', ' ')
                       .strip())

            if cleaned:
                if not current_text_lines or current_text_lines[-1] != cleaned:
                    current_text_lines.append(cleaned)

        if current_time and current_text_lines:
            text_block = " ".join(current_text_lines).strip()
            if text_block:
                cues.append(f"[{current_time}]\n{text_block}")

        return "\n\n".join(cues).strip()

    @staticmethod
    def download_media(
        url: str,
        output_path: str,
        format_id: Optional[str] = None,
        audio_only: bool = False,
        download_subtitles: bool = True,
        subtitle_languages: Optional[List[str]] = None,
        progress_hook: Optional[Callable[[Dict[str, Any]], None]] = None
    ) -> MediaDownloadResult:
        """Downloads and muxes media using yt-dlp & FFmpeg, converting subtitles to clean .txt and timed .txt in a dedicated subfolder."""
        output_template = output_path
        if not output_template.endswith(".%(ext)s"):
            base, ext = os.path.splitext(output_path)
            output_template = f"{base}.%(ext)s"

        cmd = get_ytdlp_cmd() + [
            "--newline",
            "--no-playlist",
            "--no-warnings",
            "--continue",
            "--force-ipv4",
            "-i",                               # Ignore non-fatal download errors
            "--remote-components", "ejs:github",
            "--js-runtimes", "node",
            "-N", "16",
            "--http-chunk-size", "10M",
            "--buffer-size", "1024K",
            "--socket-timeout", "15",
            "--retries", "10",
            "--fragment-retries", "10",
            "-o", output_template,
        ]

        if download_subtitles:
            # Limit to max 3 specific language codes to prevent YouTube HTTP 429 rate limits
            langs = [l.strip().lower() for l in (subtitle_languages[:3] if subtitle_languages else ['en', 'ar']) if l.strip()]
            lang_param = ','.join(langs) if langs else 'en,ar'
            cmd.extend([
                "--write-subs",
                "--write-auto-subs",
                "--sub-lang", lang_param,
                "--sub-format", "srt/vtt/best",
                "--convert-subs", "srt",
                "--sleep-subtitles", "2",
                "--no-abort-on-error"
            ])

        if audio_only:
            cmd.extend([
                "-x",
                "--audio-format", "mp3",
                "--audio-quality", "0"
            ])
        else:
            cmd.extend(["--merge-output-format", "mp4"])
            if format_id:
                resolved_fmt = format_id
                if format_id in ('1080p', 'high'):
                    resolved_fmt = 'bestvideo[height<=1080]+bestaudio/best[height<=1080]'
                elif format_id in ('720p', 'medium'):
                    resolved_fmt = 'bestvideo[height<=720]+bestaudio/best[height<=720]'
                elif format_id in ('480p', 'low'):
                    resolved_fmt = 'bestvideo[height<=480]+bestaudio/best[height<=480]'
                elif format_id == '360p':
                    resolved_fmt = 'bestvideo[height<=360]+bestaudio/best[height<=360]'
                elif format_id in ('best', '4k'):
                    resolved_fmt = 'bestvideo+bestaudio/best'

                if "+" in resolved_fmt or "best" in resolved_fmt or "[" in resolved_fmt:
                    cmd.extend(["-f", resolved_fmt])
                else:
                    cmd.extend(["-f", f"{resolved_fmt}+bestaudio[ext=m4a]/bestaudio/best"])
            else:
                cmd.extend(["-f", "bestvideo+bestaudio/best"])

        cmd.append(url)

        try:
            flags = subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding='utf-8',
                errors='replace',
                creationflags=flags
            )

            all_output = []
            for line in process.stdout:
                line = line.strip()
                all_output.append(line)
                if "[download]" in line and "%" in line:
                    if progress_hook:
                        progress_hook({"raw_line": line})

            process.wait()
            out_dir = os.path.dirname(os.path.abspath(output_path))
            base_name = os.path.splitext(os.path.basename(output_path))[0]
            target_ext = '.mp3' if audio_only else '.mp4'
            cand_files = [
                output_path,
                os.path.join(out_dir, f"{base_name}{target_ext}"),
                os.path.join(out_dir, f"{base_name}.mkv"),
                os.path.join(out_dir, f"{base_name}.webm")
            ]
            actual_media_file = None
            for c in cand_files:
                if os.path.exists(c) and os.path.isfile(c) and os.path.getsize(c) > 1024:
                    actual_media_file = os.path.abspath(c)
                    break

            success = (process.returncode == 0) or bool(actual_media_file)

            # Fail-safe: If media download failed and subtitles were requested, retry WITHOUT subtitles
            if not success and download_subtitles:
                combined_err = " ".join(all_output[-20:])
                if any(k in combined_err.lower() for k in ("subtitle", "429", "too many requests")):
                    return PythonMediaGrabber.download_media(
                        url=url,
                        output_path=output_path,
                        format_id=format_id,
                        audio_only=audio_only,
                        download_subtitles=False,
                        subtitle_languages=None,
                        progress_hook=progress_hook
                    )

            sub_txt_path = None
            sub_timed_path = None
            sub_srt_path = None
            sub_dir_path = None

            # Post-process subtitle files into clean .txt and timed .txt in a separate subfolder
            if success and download_subtitles:
                try:
                    out_dir = os.path.dirname(os.path.abspath(output_path))
                    base_name = os.path.splitext(os.path.basename(output_path))[0]
                    sub_dir = os.path.join(out_dir, f"{base_name} [Subtitles]")

                    if os.path.isdir(out_dir):
                        sub_files = [f for f in os.listdir(out_dir) if f.startswith(base_name) and (f.endswith('.srt') or f.endswith('.vtt'))]
                        if sub_files:
                            # Prefer .srt over .vtt for each language, deleting redundant .vtt
                            preferred_files = {}
                            import re
                            for fname in sub_files:
                                m = re.search(r'\.([a-zA-Z-]+)\.(srt|vtt)$', fname[len(base_name):])
                                lang = m.group(1).lower() if m else 'default'
                                is_srt = fname.endswith('.srt')
                                if lang not in preferred_files or is_srt:
                                    prev = preferred_files.get(lang)
                                    if prev and prev.endswith('.vtt') and is_srt:
                                        try: os.remove(os.path.join(out_dir, prev))
                                        except Exception: pass
                                    preferred_files[lang] = fname
                                else:
                                    try: os.remove(os.path.join(out_dir, fname))
                                    except Exception: pass

                            unique_subs = list(preferred_files.values())
                            if unique_subs:
                                os.makedirs(sub_dir, exist_ok=True)
                                sub_dir_path = sub_dir
                                single_lang = (len(unique_subs) == 1)

                                for fname in unique_subs:
                                    src_sub = os.path.join(out_dir, fname)
                                    if not os.path.exists(src_sub):
                                        continue

                                    m = re.search(r'\.([a-zA-Z-]+)\.(srt|vtt)$', fname[len(base_name):])
                                    lang_code = m.group(1) if m else ''
                                    base_out = base_name if (single_lang or not lang_code) else f"{base_name}.{lang_code}"

                                    dst_sub = os.path.join(sub_dir, f"{base_out}.srt")
                                    try:
                                        os.replace(src_sub, dst_sub)
                                    except Exception:
                                        import shutil
                                        shutil.copy2(src_sub, dst_sub)
                                        try: os.remove(src_sub)
                                        except Exception: pass

                                    if not sub_srt_path:
                                        sub_srt_path = dst_sub

                                    with open(dst_sub, 'r', encoding='utf-8', errors='replace') as sf:
                                        raw_content = sf.read()

                                    clean_txt = PythonMediaGrabber.clean_subtitles_to_text(raw_content)
                                    timed_txt = PythonMediaGrabber.convert_subtitles_to_timed_text(raw_content)

                                    # 1. Clean transcript WITHOUT timestamps (only 1 file)
                                    if clean_txt:
                                        txt_full = os.path.join(sub_dir, f"{base_out}.txt")
                                        with open(txt_full, 'w', encoding='utf-8') as tf:
                                            tf.write(clean_txt)
                                        if not sub_txt_path:
                                            sub_txt_path = txt_full

                                    # 2. Timed transcript WITH timestamps (only 1 file)
                                    if timed_txt:
                                        timed_full = os.path.join(sub_dir, f"{base_out}.timestamps.txt")
                                        with open(timed_full, 'w', encoding='utf-8') as tf:
                                            tf.write(timed_txt)
                                        if not sub_timed_path:
                                            sub_timed_path = timed_full
                except Exception:
                    pass

            return MediaDownloadResult({
                "success": success,
                "filePath": actual_media_file or output_path,
                "subtitlesTxtPath": sub_txt_path if (sub_txt_path and os.path.exists(sub_txt_path)) else None,
                "subtitlesTimestampsPath": sub_timed_path if (sub_timed_path and os.path.exists(sub_timed_path)) else None,
                "subtitlesSrtPath": sub_srt_path if (sub_srt_path and os.path.exists(sub_srt_path)) else None,
                "subtitlesFolder": sub_dir_path if (sub_dir_path and os.path.isdir(sub_dir_path)) else None,
            })
        except Exception:
            return MediaDownloadResult({"success": False})
