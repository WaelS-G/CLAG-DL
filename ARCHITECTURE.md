# CLAG Downloader — System Architecture Specification
**Made by: Wael Sayed**

## 1. Vision & Purpose
**CLAG Downloader** is a modern, high-performance download manager, media grabber, and stream capture suite engineered to surpass legacy download managers like **Internet Download Manager (IDM)** and **JDownloader**. It bridges ultra-accelerated multi-threaded range chunking, universal media grabbing (1,000+ sites powered by `yt-dlp` and `FFmpeg 8.1`), Manifest V3 browser integration with floating player sniffer overlays, Click'n'Load v2 support, and a responsive glassmorphic PWA that works seamlessly across desktop, tablet, and mobile.

---

## 2. Structural Directory Layout

```
CLAG Downloader/
├── run.bat                         # ASCII Windows batch runner with interactive menu
├── package.json                    # Node dependencies, scripts, and build pipeline
├── tsconfig.json                   # Strict TypeScript compiler options for client
├── tsconfig.server.json            # Strict TypeScript compiler options for server
├── vite.config.ts                  # Vite bundler configuration
├── vercel.json                     # Vercel deployment and serverless route configuration
├── tailwind.config.js              # Tailwind styling configuration
├── postcss.config.js               # PostCSS configuration
├── ARCHITECTURE.md                 # System architecture (this document)
├── TASK_TRACKER.md                 # Milestone tracker and roadmap
├── WALKTHROUGH.md                  # Developer instructions and troubleshooting
├── USER_GUIDE.md                   # End-user manual
├── DOSSIER.md                      # Cumulative user profile and engineering insights
│
├── data/                           # Persistent state storage (Zero Root Clutter)
│   └── clag_history.json           # Download tasks state and history persistence
│
├── extension/                      # Manifest V3 Browser Extension (Chrome/Edge/Brave)
│   ├── manifest.json               # MV3 manifest with permissions and content scripts (Author: Wael Sayed)
│   ├── background.js               # Service worker (download interceptor & context menus)
│   ├── content.js                  # Injected floating video sniffer panel
│   ├── content.css                 # Glassmorphic floating button styles
│   ├── popup/                      # Extension popup UI (status, quick download, media streams)
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   └── icons/                      # Fantastic cyber-neon icons (16, 32, 48, 128)
│
├── api/                            # Vercel Serverless Functions (Cloud Web Mode)
│   ├── resolve.js                  # Rapid stream resolver (loader.to + savenow.to CDN conversion)
│   ├── probe.js                    # Multi-platform media probe (YouTube, TikTok, Vimeo oEmbed)
│   ├── downloads.js                # Serverless download task dispatcher
│   ├── stream.js                   # CORS bypass and HTTP Range proxy
│   ├── settings.js                 # Cloud settings persistence
│   ├── batch/                      # Batch link parsing
│   └── system/                     # Cloud system actions
│
├── src/
│   ├── core/                       # Core engine subsystems
│   │   ├── engine/
│   │   │   └── ChunkDownloader.ts  # Multi-connection segmented downloader (1-32 connections)
│   │   ├── media/
│   │   │   └── MediaGrabber.ts     # yt-dlp & FFmpeg 8.1 media probe and muxer
│   │   ├── resolver/
│   │   │   └── LinkResolver.ts     # URL analyzer, batch crawler, category detector
│   │   ├── queue/
│   │   │   └── QueueManager.ts     # Concurrent download scheduler & task delegator
│   │   └── storage/
│   │       ├── ConfigStore.ts      # Persistent JSON configuration store
│   │       └── HistoryStore.ts     # Download task state and history persistence
│   │
│   ├── server/                     # Local API & Bridge servers
│   │   ├── server.ts               # Express REST server (port 8989)
│   │   ├── websocket.ts            # WebSocket manager for real-time state broadcast
│   │   └── clicknload.ts           # Click'n'Load v2 compatibility server (port 9666)
│   │
│   ├── client/                     # Modern UIX Dashboard (React 19 + Tailwind CSS)
│   │   ├── index.html              # Frontend HTML root with PWA tags
│   │   ├── main.tsx                # React entry point
│   │   ├── App.tsx                 # Main layout and view router
│   │   ├── components/             # Reusable UI widgets
│   │   │   ├── Navbar.tsx          # Top bar with speedometer and status badge
│   │   │   ├── Sidebar.tsx         # Workspace navigation and category filter
│   │   │   ├── ChunkBar.tsx        # Segmented connection visualizer (IDM-style)
│   │   │   ├── DownloadItem.tsx    # Single download card with progress & actions
│   │   │   ├── AddDownloadModal.tsx# URL probe and quality selection modal
│   │   │   ├── MediaPlayerModal.tsx# In-app HTML5 media player for mobile/web
│   │   │   ├── MobileFolderModal.tsx# Native mobile file explorer & sharing launcher
│   │   │   └── TranscriptViewerModal.tsx# In-app subtitles transcript reader
│   │   ├── views/                  # Primary workspace views
│   │   │   ├── TransfersView.tsx   # Active / Completed downloads list
│   │   │   ├── LinkGrabberView.tsx # JDownloader-style link crawler workspace
│   │   │   ├── MediaSnifferView.tsx# Captured browser streams and extension guide
│   │   │   ├── SettingsView.tsx    # Connection settings and backup import/export
│   │   │   └── UserGuideView.tsx   # Embedded user documentation
│   │   ├── hooks/
│   │   │   └── useCLAGSocket.ts    # Reconnecting WebSocket & In-Browser Streaming Downloader
│   │   └── styles/
│   │       └── index.css           # Tailwind base styles, safe area insets, viewport containment
│   │
│   ├── python/                     # Pure Python Engine & Desktop Edition
│   │   ├── engine.py               # Multi-threaded range downloader in Python
│   │   ├── media_grabber.py        # yt-dlp & FFmpeg Python integration
│   │   ├── clag_cli.py             # Command line interface with progress visuals
│   │   └── clag_desktop.py         # Standalone desktop application launcher
│   │
│   └── types/
│       └── index.ts                # Shared TypeScript models and protocols
│
├── public/                         # Static assets and PWA files
│   ├── favicon.ico                 # Multi-resolution icon (16, 32, 48, 64, 128, 256)
│   ├── manifest.webmanifest        # Progressive Web App manifest
│   ├── service-worker.js           # Offline caching service worker
│   ├── clag-downloader-extension.zip# Direct download extension bundle
│   └── icons/                      # High-res PWA cyber-neon icons (192, 512)
│
├── scripts/                        # Automation and packaging utilities
│   ├── generate_icons.py           # Cyber-neon icon generator script
│   ├── package_extension.js        # Browser extension zip bundler
│   ├── sync_web_dist.js            # Web distribution mirror synchronizer
│   └── build_exe.py                # Standalone Windows .exe PyInstaller builder
│
└── dist/                           # Production builds
    ├── web/                        # Complete Web Distribution (Vercel / Netlify ready)
    │   ├── api/                    # Mirrored serverless functions for direct cloud deploys
    │   ├── assets/                 # Compiled CSS and JavaScript chunks
    │   ├── vercel.json             # Tailored Vercel deployment routing
    │   └── index.html              # Static frontend HTML
    ├── client/                     # Compiled React PWA bundle
    ├── server/                     # Compiled TypeScript server
    ├── extension/                  # Packaged Chrome/Edge extension zip
    └── exe/                        # Standalone Windows executable (.exe)
```

---

## 3. Data Flows & Execution Pipelines

### A. Accelerated Multi-Connection HTTP Download
1. **Network Stack Acceleration**: Node.js and Python network layers enforce IPv4 priority (`dns.setDefaultResultOrder('ipv4first')` and `family: 4`), completely eliminating the 10-15s Windows IPv6 blackhole timeout.
2. **Persistent Connection Pooling**: High-throughput `http.Agent` and `https.Agent` pools maintain keep-alive sockets (up to 64 sockets), disabling Nagle's algorithm (`setNoDelay(true)`) for instantaneous packet dispatch.
3. **Smart Range Probing**: Issues `HEAD` with `Accept-Encoding: identity`. If `Accept-Ranges` is unadvertised or `HEAD` is blocked, automatically executes a 1-byte GET probe (`Range: bytes=0-0`). HTTP 206 responses confirm multi-segment support, ensuring full 16-32 connection acceleration.
4. **Buffered Streaming & Backpressure**: Streams write into part files with 1MB disk buffers (`highWaterMark: 1024 * 1024`), actively managing socket backpressure to prevent buffer bloat and packet drops.
5. **High-Speed Reassembly**: Merges chunks using 4MB streaming buffers (`highWaterMark: 4 * 1024 * 1024`), assembling multi-gigabyte files within seconds.

### B. Universal Media Grabbing (YouTube, Instagram, Facebook, TikTok, etc.)
1. **Uncapped Ratebypass**: Injects `--extractor-args "youtube:player_client=android,web"` so media hosts treat CLAG as a high-throughput client (`ratebypass=yes`), bypassing throttling.
2. **Multi-Fragment Concurrency**: Forces `-N 16` (`--concurrent-fragments 16`), downloading 16 DASH/HLS segments simultaneously in parallel.
3. **10MB Chunk Slicing**: Employs `--http-chunk-size 10M` to defeat bitrate-throttled single-stream connections.
4. **AAC Audio Stream Pairing**: Automatically pairs video with high-bitrate AAC audio (`bestvideo[ext=mp4]+bestaudio[ext=m4a]`) muxed losslessly by FFmpeg 8.1.
5. **Debounced Progress Monitoring**: Throttles progress emission and employs asynchronous non-blocking history storage, preventing CPU and event-loop freezes.

### C. Cloud Stream Resolution & In-Browser Downloading (Web / Mobile Mode)
1. **Universal Stream Resolver (`/api/resolve`)**: When deployed to cloud environments (Vercel, Netlify) or running without a local daemon, media links (YouTube, TikTok, Instagram, Twitter/X, Vimeo) are resolved via `/api/resolve` connecting to the `loader.to` API and `savenow.to` CDN to generate direct, unthrottled MP4 video (1080p, 720p, 480p, 360p) and MP3 audio streams.
2. **Real-Time Conversion Polling**: Tracks stream preparation progress from 10% to 95% via `affadaffa.com` polling endpoint, displaying live status in the UI.
3. **Direct File Streaming & Saving**: Feeds binary chunks through browser `ReadableStream` into Blobs, automatically triggering native device file downloads into the user's Downloads directory.
4. **Zero External Navigation**: Permanently eliminates all `target="_blank"` anchor workarounds. Clicking download never opens the original social media webpage.
5. **Native Mobile File Explorer Navigation**: Android Intent `action.VIEW_DOWNLOADS` opens the native Android Downloads manager; iOS `shareddocuments://` scheme and Web Share API (`navigator.share`) pass files directly to VLC, Files, or cloud drives.

### D. Browser Extension & In-Page Action Buttons
1. **Native In-Page Action Buttons**: Injects native-styled CLAG download buttons directly into action toolbars on YouTube, Twitter/X, Instagram, TikTok, and Facebook.
2. **Action Dropdown**: Clicking an in-page button reveals options for full video (MP4) or audio-only extraction (MP3) with instant toast notifications.
3. **Universal Player Sniffer**: Injects a floating cyber-neon sniffer badge over HTML5 `<video>` players on all other websites.
4. **Network Stream Sniffer**: Background service worker captures active `.m3u8` / `.mpd` streams and updates extension badges in real time.
5. **Click'n'Load v2**: `clicknload.ts` on port 9666 catches link packages from file hoster download buttons.

---

## 4. Multi-Form Deployment Model
1. **Web App / PWA**: Accessible locally or over LAN at `http://<ip>:8989`, installable as an app on Android, iOS, Windows, macOS with offline caching.
2. **Standalone Windows Desktop EXE**: Double-clickable `dist/exe/CLAG_Downloader.exe` launching an app-mode window.
3. **Python Interactive CLI**: Terminal tool for power users (`python -m src.python.clag_cli`).
4. **Browser Extension**: Manifest V3 extension in `extension/` or `dist/extension/clag-downloader-extension.zip`.
5. **Cloud Deployment (Vercel)**: 1-click cloud deployment via `run.bat` option `[8]` (`npx vercel --prod`) or by uploading `dist/web/`.
6. **Cloud Container Backend (Render.com Free Web Service)**: Full-compute persistent backend container (`Dockerfile` + `render.yaml`) bundling Node.js 20, Python 3, `yt-dlp`, and `FFmpeg` on Debian Bookworm:
   - **Render Free Tier Benefits**: 750 free instance hours/month, 512 MB RAM, free SSL certificate, persistent WebSockets, 100 GB/month egress bandwidth.
   - **Server Endpoints**: Exposes `GET /api/downloads/:id/file` for 1-tap browser/phone attachment downloading and `GET /api/downloads/:id/stream` for HTTP 206 partial content streaming directly in the UI.
   - **Infrastructure as Code**: 1-click provisioning via root `render.yaml` Blueprint.
