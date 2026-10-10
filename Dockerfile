# CLAG Downloader - Production Container for Render.com & Docker
# Embeds Node.js 20, Python 3, yt-dlp, and FFmpeg
FROM node:20-bookworm-slim

# Prevent interactive prompts during apt install
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PORT=10000

# Install system dependencies: Python 3, pip, FFmpeg, curl, ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    python-is-python3 \
    ffmpeg \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install / update yt-dlp to latest version via pip
RUN pip install --no-cache-dir --break-system-packages yt-dlp

# Set working directory
WORKDIR /app

# Copy package manifests first to leverage Docker layer caching
COPY package*.json ./

# Install npm dependencies (including devDependencies needed for build)
RUN npm install

# Copy application source code and configurations
COPY . .

# Build Vite client and TypeScript server bundles
RUN npm run build

# Expose Render default port
EXPOSE 10000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:${PORT:-10000}/api/settings || exit 1

# Start the unified Node.js server engine
CMD ["npm", "start"]
