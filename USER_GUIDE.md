# CLAG Downloader — User Guide & Manual
**Made by: Wael Sayed**

Welcome to **CLAG Downloader**, your all-in-one accelerated download manager and universal media grabber.

---

## 1. Features at a Glance
- **Multi-Connection Turbo Acceleration**: Downloads files using up to 32 parallel connections, saturating your internet bandwidth for maximum speed.
- **Universal Media Grabber**: Seamlessly download videos and audio from YouTube (4K/8K, 1080p, 60fps), Instagram Reels, Facebook, TikTok, Twitter/X, Twitch clips, and Vimeo with automatic FFmpeg stream muxing and AAC audio preservation.
- **IDM-Style Floating Sniffer Overlay**: When using the browser extension, an intuitive "Download with CLAG" button floats right over media players, while active network request sniffing catches HLS (`.m3u8`) and DASH (`.mpd`) streams.
- **Direct Extension ZIP in Settings**: Easily download the packaged Chrome/Edge extension ZIP directly from the Settings screen.
- **Smart Clipboard Auto-Sniffer**: When you copy any download or video URL and focus back on the CLAG window, a non-intrusive action bar pops up allowing 1-click downloading.
- **Real-Time Bandwidth Velocity Chart**: A smooth glowing canvas graph displays live network speed fluctuations over time.
- **Synthesized Audio Notifications**: Pleasant Web Audio cues alert you when downloads complete or encounter errors.
- **Keyboard Shortcuts**: `Ctrl+N` / `Cmd+N` (New Download), `Ctrl+V` (Paste & Probe).
- **Automatic Category Folders**: Files automatically save into organized subdirectories (`Videos/`, `Audio/`, `Compressed/`, `Programs/`, `Documents/`, `Images/`).
- **JDownloader-Style Link Grabber**: Paste dozens of links or raw web pages, let CLAG crawl and organize them, choose your preferred formats, and start in one click.
- **Click'n'Load v2 Support**: Click "Download with JDownloader" on file hosts, and CLAG will automatically catch the links via port 9666!
- **Multi-Form Flexibility**:
  - Run as a Windows desktop application (`CLAG_Downloader.exe`).
  - Use in your web browser or deploy to Vercel via `dist/web/`.
  - Install on your smartphone/tablet as a Progressive Web App (PWA).
  - Use from the command line with Python.

---

## 2. Which Version Should I Use? (Form Factors Explained)

CLAG Downloader comes in several formats designed for different workflows:

1. **Standalone Windows Desktop App (`dist/exe/CLAG_Downloader.exe`)**:
   - **Best for**: Day-to-day downloading on your Windows PC.
   - **Why use it**: Single-click launch with **zero setup** (no Node.js, no terminal). Runs as a real native desktop app (using Windows WebView2), downloads files straight to your `Downloads/CLAG` directory, and features 1-click system folder and file openers.

2. **Local Client Frontend (`dist/client/`)**:
   - **Best for**: Running alongside the local Node.js or Python backend server on `http://127.0.0.1:8989`.
   - **Why use it**: Full desktop powers (file reveal, Click'n'Load port 9666, clipboard monitor, 32-chunk assembly) with maximum live WebSocket speed visualization.

3. **Cloud Web App (`dist/web/`)**:
   - **Best for**: Accessing CLAG from any computer, phone, or tablet anywhere in the world without running a local server on that device.
   - **Why use it**: Pre-configured for deployment to **Vercel** or **Netlify**. Provides serverless metadata probing and in-browser download stream processing with Progressive Web App (PWA) installation.

4. **Browser Extension (`dist/extension/clag-downloader-extension.zip`)**:
   - **Best for**: Sniffing media directly as you surf the web in Chrome, Edge, or Brave.
   - **Why use it**: Injects 1-click download buttons on YouTube, Twitter/X, Instagram, and TikTok, and automatically grabs video streams from any player.

5. **Python CLI (`src/python/clag_cli.py`)**:
   - **Best for**: Power users, terminal buffs, and automated shell scripts.

---

## 3. Adding Downloads

### Method A: Via the Web/Desktop UI
1. Click the **"Add Download"** button in the top navigation bar.
2. Paste the link into the URL field.
3. Click **"Probe"**: CLAG will inspect the link and display video qualities (4K, 1080p, 720p, etc.) or audio-only MP3 options.
4. Adjust the **Parallel Range Connections** slider (1 to 32 connections).
5. Click **"Start Download"**.

### Method B: Via the Browser Extension (In-Page Action Buttons & Floating Sniffer)
1. Open CLAG **Settings** and click **"Download Extension (.zip)"** (or use the `extension/` folder).
2. In Chrome or Edge, navigate to `chrome://extensions` and toggle on **Developer mode**.
3. Click **Load unpacked** and select the extracted extension folder.
4. Browse to YouTube, Twitter/X, Instagram, TikTok, or Facebook:
   - A native-styled **"CLAG Download"** button appears right in the page's action toolbar (next to Like / Share on YouTube, in the tweet action bar on Twitter/X, etc.).
   - Click to choose **"Best Video + Audio (MP4)"** or **"Extract Audio Only (MP3)"**.
5. On generic video sites: A floating cyber-neon badge appears directly on the media player for 1-click capture.
6. The download begins instantly in CLAG Downloader at full accelerated speeds with audio track preserved.

### Method C: Batch Link Crawler (LinkGrabber)
1. Open the **Link Grabber** tab in the sidebar.
2. Paste a multi-line list of URLs or page text into the box.
3. Click **"Crawl & Add Links"**.
4. Check or uncheck items as desired, then click **"Start Download"**.

---

## 3. Mobile Usage, PWA & Operating System Permissions

### A. Connecting Phone to PC (Local Wi-Fi Remote Mode)
1. Ensure your phone and PC are connected to the same Wi-Fi network.
2. In CLAG Downloader on PC, open **Settings** and look at **Phone & LAN Remote Access**.
3. Click **"Copy Phone URL"** or note the address (e.g. `http://192.168.1.15:8989`).
4. In your phone's browser (Safari or Chrome), open that address.
5. In the browser menu, tap **"Add to Home Screen"** or **"Install App"**.
6. CLAG Downloader will launch in fullscreen like a native phone application. You can monitor progress, pause/resume, and queue downloads from your couch!

### B. Cloud & Persistent Backend Mode (Render.com Free Web Service)
- **100% Free 24/7 Cloud Backend**: Deploying to Render.com via the root `Dockerfile` and `render.yaml` Blueprint provides a persistent container with Node.js 20, Python 3, `yt-dlp`, and `FFmpeg` on the free tier (750 free hours/month, 512 MB RAM, free SSL).
- **Direct Device File Delivery (📥)**: Every completed download card features a direct **"Save / Download File to Device"** button (`/api/downloads/:id/file`). Tapping this button on your phone or computer immediately triggers a direct browser download into your device's native Downloads directory.
- **In-App Streaming (▶)**: Tapping the Play button streams the completed video or audio directly in your browser with seekable HTTP 206 range streaming.

### C. Serverless Cloud Mode (Vercel / Netlify)
- When using a serverless deployment, URL probing works across YouTube, TikTok, Vimeo, SoundCloud, Twitter/X, Instagram, and direct links via smart serverless oEmbed discovery and client-side stream resolution.
- Direct file downloads can be initiated immediately with parallel range chunking.

### D. Opening Files & Folders on Mobile (Native File Explorer & Permissions)
- **Open File Explorer on Android (📱)**: Tapping "Show in Folder" on Android gives you a 1-tap **"Open Android Downloads App"** button powered by native Android Intents (`android.intent.action.VIEW_DOWNLOADS`), immediately opening your phone's native Google Files or Downloads app!
- **Open Files App on iOS (🍏)**: On iPhone and iPad, tapping "Show in Folder" triggers the Apple Files app directly via the system URL scheme (`shareddocuments://`), launching you straight into your iOS Files browser!
- **Browse Device Folders (📂)**: On supported mobile and desktop browsers, you can tap "Browse Device Folders" to use the modern File System Access API (`showDirectoryPicker`), selecting and browsing folders on your phone.
- **Play Media File (▶)**: On mobile, tapping play opens the built-in **In-App Media Player**, streaming video or audio right inside the app with full controls, or letting you send it to external apps.
- **Save / Share to Files (📤)**: Uses the Web Share API (`navigator.share`) with actual file binaries, allowing iOS users to tap the native "Save to Files" dialog into any folder or send to VLC, MX Player, Photos, or Google Drive!
- **Subtitle Transcripts (📝 / ⏱)**: Tapping transcript buttons on mobile opens the **In-App Transcript Viewer**, allowing you to read dialogue, search keywords, copy text to clipboard with 1 tap, or download the `.txt` file directly.
- **Subtitles & Transcripts**:
  - **Untouched Original `.srt`**: Original `.srt` files are downloaded and preserved with full timing cues.
  - **Two Formatted `.txt` Transcripts (Zero Duplicates)**:
    1. **With Timestamps (`.timestamps.txt`)**: Preserves timing cue brackets (e.g. `[00:01:23 --> 00:01:26]`) alongside dialogue, perfect for quick reference and timecode navigation.
    2. **Without Timestamps (`.txt`)**: Clean transcript preserving the exact line-by-line sentence structure of the SRT file (one sentence/cue per line) with cue numbers, timecodes, and tags stripped.
  - **Fail-Safe Video Resiliency**: If subtitle extraction encounters an error or YouTube rate limits (`HTTP 429`), CLAG Downloader automatically retries without subtitles so your video or audio download NEVER stops or fails.
  - **Subtitles Subfolder Isolation**: Automatically saves subtitles into a dedicated folder (`Videos/Video_Title [Subtitles]/`), preventing any filename collision with the video file.
  - **Direct Actions on Download Card**:
    - **Play Media File**: Instantly plays the `.mp4` video or `.mp3` audio in your system media player.
    - **Show in Folder**: Opens Windows Explorer and selects the video/audio file.
    - **Open Clean Transcript**: Opens the clean `.txt` transcript in your text editor.
    - **Open Timed Transcript**: Opens the `.timestamps.txt` transcript in your text editor.
    - **Open Subtitles Folder**: Directly opens the subtitle folder containing all `.srt` and `.txt` files.
  - **Preferred Languages (Max 3)**: Select up to 3 preferred languages (e.g. English, Arabic). Capping requests to 3 languages prevents YouTube `HTTP Error 429: Too Many Requests`.
- **Playlists & Multi-Item Crawlers**:
  - **Global Quality Presets**: Select quality categories across entire playlists with 1 click: Best 4K / Auto, 1080p Full HD, 720p HD, 480p SD, or MP3 Audio.
  - **Per-Video Customization**: Toggle "Customize Per-Video Quality" to select or exclude individual videos and assign custom quality resolutions per video.
- **Download Browser Extension**: Download `clag-downloader-extension.zip` directly to your machine.
- **Default Download Folder**: Set where files are saved.
- **Default Connections**: Adjust the default segment count (recommended: 16).
- **Max Concurrent Downloads**: Limit how many files download simultaneously.
- **Speed Limiter**: Cap total bandwidth consumption (useful if gaming or streaming).
- **Backup & Restore**: Export all settings and download history to JSON, or import on another device.
- **Author Credits**: Made by **Wael Sayed**.
