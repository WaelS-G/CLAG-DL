"""
CLAG Downloader - Interactive Command Line Interface (CLI)
Provides multi-segmented downloads, media grabbing, and batch downloads in console.
"""

import os
import sys
import argparse
import time
from src.python.engine import PythonMultiChunkDownloader
from src.python.media_grabber import PythonMediaGrabber

def format_bytes(b: int) -> str:
    if b >= 1024 * 1024 * 1024:
        return f"{b / (1024**3):.2f} GB"
    elif b >= 1024 * 1024:
        return f"{b / (1024**2):.1f} MB"
    elif b >= 1024:
        return f"{b / 1024:.0f} KB"
    return f"{b} B"

def main():
    parser = argparse.ArgumentParser(description="CLAG Downloader - High Performance Multi-Segment & Media Grabber")
    parser.add_argument("url", nargs="?", help="URL of the file or media to download")
    parser.add_argument("-o", "--output", help="Output file path or directory", default=os.path.expanduser("~/Downloads"))
    parser.add_argument("-s", "--segments", type=int, default=16, help="Number of parallel segments (1-32, default: 16)")
    parser.add_argument("-l", "--limit", type=int, default=0, help="Speed limit in KB/s (0 = unlimited)")
    parser.add_argument("-m", "--media", action="store_true", help="Force media grabber mode (YouTube, Instagram, etc.)")
    parser.add_argument("-a", "--audio", action="store_true", help="Extract audio only (MP3)")
    parser.add_argument("-p", "--probe", action="store_true", help="Probe URL metadata and available formats only")

    args = parser.parse_args()

    print("=" * 65)
    print("           CLAG Downloader - Modern Power Suite")
    print("                   Made by: Wael Sayed")
    print("=" * 65)

    url = args.url
    if not url:
        try:
            url = input("\nEnter Download or Media URL: ").strip()
        except KeyboardInterrupt:
            print("\nAborted.")
            return

    if not url:
        print("Error: No URL provided.")
        return

    # Probe media first if requested or if domain matches known media hosts
    is_media_host = any(domain in url.lower() for domain in [
        "youtube.com", "youtu.be", "instagram.com", "facebook.com", "fb.watch",
        "tiktok.com", "twitter.com", "x.com", "reddit.com", "twitch.tv", "vimeo.com"
    ])

    if args.probe or (args.media or is_media_host):
        print(f"\n[Media Grabber] Probing stream metadata for: {url}")
        info = PythonMediaGrabber.probe_url(url)
        if "error" not in info:
            print(f"Title:    {info.get('title')}")
            print(f"Uploader: {info.get('uploader')}")
            print(f"Duration: {info.get('durationFormatted')}")
            print(f"Platform: {info.get('extractor')}")
            formats = info.get("formats", [])
            print(f"\nAvailable Formats ({len(formats)} streams found):")
            for f in formats[-8:]: # Show top 8
                print(f"  [{f['formatId']}] {f['ext']} - {f['qualityLabel']} ({f.get('filesizeFormatted', 'stream')})")

            if args.probe:
                return

            # Ask user format or auto best
            dest_dir = args.output if os.path.isdir(args.output) else os.path.dirname(args.output) or "."
            safe_title = "".join(c for c in info.get('title', 'media') if c.isalnum() or c in (' ', '-', '_')).strip()
            out_file = os.path.join(dest_dir, f"{safe_title}.%(ext)s")

            print(f"\nStarting media download with FFmpeg muxer...")
            success = PythonMediaGrabber.download_media(
                url=url,
                output_path=out_file,
                audio_only=args.audio,
                progress_hook=lambda p: print(f"\r{p.get('raw_line')}", end="")
            )
            print("\nDownload complete!" if success else "\nDownload failed.")
            return

    # Direct chunked download
    dest = args.output
    if os.path.isdir(dest):
        url_filename = os.path.basename(url.split("?")[0]) or "download.bin"
        dest = os.path.join(dest, url_filename)

    print(f"\n[HTTP Chunk Engine] Initializing {args.segments} parallel segments...")
    downloader = PythonMultiChunkDownloader(
        url=url,
        destination_path=dest,
        connections=args.segments,
        speed_limit_kbps=args.limit
    )

    info = downloader.probe()
    if info.get("total_size", 0) > 0:
        print(f"File Size:       {format_bytes(info['total_size'])}")
        print(f"Range Support:   {'Yes (Multi-threaded active)' if info['supports_range'] else 'No (Single stream fallback)'}")
    print(f"Destination:     {dest}\n")

    def progress_callback(data):
        pct = data['progress']
        spd = format_bytes(int(data['speed'])) + "/s"
        downloaded = format_bytes(data['downloaded'])
        total = format_bytes(data['total'])
        eta_sec = int(data['eta'])
        eta_str = f"{eta_sec // 60}m {eta_sec % 60}s" if eta_sec > 0 else "--"

        # Chunk progress visualizer (compact IDM-style bar)
        chunk_bar = "".join("#" if c['completed'] else "-" for c in data['chunks'])

        sys.stdout.write(
            f"\r[{chunk_bar}] {pct:5.1f}% | {downloaded}/{total} | {spd} | ETA: {eta_str}   "
        )
        sys.stdout.flush()

    downloader.on_progress = progress_callback
    downloader.start()

    try:
        while downloader.is_running:
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nStopping download...")
        downloader.stop()

    print("\nDownload finished successfully!" if not downloader.is_running else "\nStopped.")

if __name__ == "__main__":
    main()
