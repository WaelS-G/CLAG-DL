# CLAG Downloader — Developer & Operations Walkthrough
**Made by: Wael Sayed**

## Prerequisites & Environment
- **Node.js**: v20+ (Verified on v24.14.1)
- **Python**: 3.10+ with `yt-dlp`, `pillow`, `pyinstaller`
- **FFmpeg**: FFmpeg 8.1+ installed and globally available in PATH
- **OS**: Windows 10/11 (or macOS / Linux for server/CLI modes)

---

## Quick Start via Windows Batch Runner (`run.bat`)
Run the interactive automation script by double-clicking or executing in `cmd.exe`:
```bat
run.bat
```
Select:
- `1` to launch the development engine on `http://localhost:8989`.
- `2` to build the production client and server bundles.
- `3` to start the standalone desktop application window.
- `4` to launch the Python interactive CLI.
- `5` to package the browser extension into `.zip`.
- `6` to recompile the standalone Windows `CLAG_Downloader.exe`.

---

## Distribution Matrix & Build Outputs Explained

CLAG Downloader provides several tailored distribution formats located in `dist/`. Here is the exact breakdown of what each build is for:

| Output Directory / File | Type & Target Environment | Description & Intended Purpose |
| :--- | :--- | :--- |
| **`dist/exe/CLAG_Downloader.exe`** | **Standalone Windows Desktop App** | Completely self-contained native executable for Windows. Bundles the frontend, an embedded Python API/HTTP server, and native WebView2 window (`pywebview`). Requires **no Node.js**, no external browser, and no terminal. Double-click to run! |
| **`dist/client/`** | **Local Frontend Bundle (Desktop & Node)** | The compiled SPA client assets served locally by `CLAG_Downloader.exe` and `node dist/server/server.js` on `http://127.0.0.1:8989`. Interfaces with local file paths, system explorer reveals, and Click'n'Load port 9666. |
| **`dist/web/`** | **Cloud Web Distribution (Vercel / Netlify)** | Production bundle tailored for cloud static hosting (Vercel, Netlify, or self-hosted static servers). Uses serverless functions (`api/probe.js`, `api/stream.js`, `api/batch/parse.js`) and client-side streaming to run on phones, tablets, or remote browsers without a local daemon. |
| **`dist/extension/` & `.zip`** | **Browser Extension (Manifest V3)** | Chrome/Edge/Brave extension providing in-page download buttons on YouTube, Twitter, Instagram, TikTok, network sniffing, and Click'n'Load interception. |
| **`dist/server/`** | **Node.js Production Server** | Compiled Node.js backend (`server.js`) with 32-connection chunk downloader, WebSocket telemetry, and Click'n'Load v2 server. |
| **`src/python/clag_cli.py`** | **Terminal Power CLI** | Python command-line utility for script automation and terminal-only downloads. |

---

## Form Factors & Execution Modes

### 1. Standalone Windows Executable (.exe)
Double-click:
```
dist\exe\CLAG_Downloader.exe
```
This boots the embedded CLAG engine and launches a native, dark-themed WebView2 desktop application window with full system integration and zero configuration.

### 2. Modern Web App & Mobile PWA (Vercel Ready)
1. **Local Run**:
   ```bash
   npm run start
   # or for development:
   npm run server:dev
   ```
2. **Deploying to Vercel (Root or Web Distribution)**:
   - **Method 1 (Fastest via run.bat CLI)**: Double-click `run.bat` and select `[8]` (`Deploy to Vercel via CLI`). It runs `npx vercel --prod` and uploads the complete codebase including frontend assets and serverless functions (`api/resolve.js`, `api/probe.js`, `api/downloads.js`, `api/stream.js`).
   - **Method 2 (Pre-built Web Distribution dist/web)**: `dist/web/` is pre-synchronized with all static client files, `api/` serverless functions, lightweight `package.json`, and tailored `vercel.json`. You can deploy the `dist/web/` folder directly to Vercel with zero build step.
   - **Method 3 (GitHub / GitLab Integration)**: When pushing to GitHub for Vercel auto-deployments, **ensure the `api/` directory is committed**! The serverless function `/api/resolve` handles CORS-free stream extraction from YouTube, TikTok, Instagram, Twitter/X, and Vimeo. Without the `api/` folder, Vercel will serve only static files and `/api/resolve` will return 404.
   - When opened on Vercel (`https://your-project.vercel.app` or `https://clag-dl.vercel.app`), CLAG automatically operates in **In-Browser Web Mode**, allowing users on phones, tablets, or computers to resolve YouTube, TikTok, Instagram, Twitter/X, and direct streams into MP4/MP3 files saved directly to their device without opening external tabs!

### 2.5 Deploying to Render.com (100% Free Persistent Cloud Docker Backend)
Render.com offers a **100% Free Web Service tier** (750 free instance hours/month, 512 MB RAM, free TLS/SSL, native Docker support, persistent WebSockets, 100 GB/month bandwidth). This gives you a dedicated cloud backend with full `yt-dlp` and `FFmpeg` 24/7!

**How to Deploy on Render in 3 Steps:**
1. **Push your code to GitHub / GitLab**. (Ensure `Dockerfile` and `render.yaml` are at the repository root).
2. Go to **[dashboard.render.com](https://dashboard.render.com/)**, click **"New +"** → **"Blueprint"** (or **"Web Service"**).
3. Connect your repository. Render automatically reads `render.yaml`, detects the `Dockerfile`, and starts building your container with Node.js 20 + Python 3 + `yt-dlp` + `FFmpeg`.
4. Your service will be live at `https://clag-downloader-xxxx.onrender.com`.
   - On completed downloads, tap **"Save to Device"** to download the merged MP4/MP3 directly to your mobile phone or laptop.
   - Tap **"Play"** to stream video directly in your browser.
1. In your browser, open `chrome://extensions` (or `edge://extensions`).
2. Toggle on **Developer mode** in the top right.
3. Click **"Load unpacked"** and select the `extension/` folder inside this project.
4. When watching any video online (YouTube, Instagram, Facebook, TikTok, Vimeo, Twitch), a floating **"Download with CLAG"** overlay button will appear over the media player.

### 4. Standalone Python CLI
Download directly from command prompt:
```bash
# 16-segment accelerated HTTP download:
python -m src.python.clag_cli https://example.com/largefile.zip -s 16

# Probe YouTube or Instagram video formats:
python -m src.python.clag_cli https://youtube.com/watch?v=... -p

# Download and mux best video + audio with FFmpeg:
python -m src.python.clag_cli https://youtube.com/watch?v=... -m
```

---

## Verification & Testing
To run integrity tests:
```bash
npm run build
```
Verify that:
- `dist/web/index.html` is generated (complete web distribution bundle).
- `dist/client/index.html` is mirrored.
- `dist/server/server.js` is generated.
- `dist/exe/CLAG_Downloader.exe` exists and launches.
- `dist/extension/clag-downloader-extension.zip` is created.
- `public/clag-downloader-extension.zip` is available for Settings web download.
