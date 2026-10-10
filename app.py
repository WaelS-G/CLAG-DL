"""
CLAG Downloader - Hugging Face Spaces Cloud Server Entrypoint
Zero-Card Free Deployment with Full Python, yt-dlp, and FFmpeg Engine.
Made by: Wael Sayed
"""

import os
import sys
from http.server import ThreadingHTTPServer

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from src.python.clag_desktop import ClagHttpHandler

def run_server():
    port = int(os.environ.get("PORT", 7860))
    print(f"==================================================")
    print(f"  CLAG Downloader Cloud Engine (Hugging Face Spaces)")
    print(f"  Made by: Wael Sayed")
    print(f"  Listening on: http://0.0.0.0:{port}")
    print(f"==================================================")
    
    server = ThreadingHTTPServer(('0.0.0.0', port), ClagHttpHandler)
    server.serve_forever()

if __name__ == "__main__":
    run_server()
