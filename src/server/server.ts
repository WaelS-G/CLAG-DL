import express from 'express';
import cors from 'cors';
import http from 'http';
import dns from 'dns';
import path from 'path';

// Force IPv4 first to eliminate 10-15s blackhole delay on Windows dual-stack networks
dns.setDefaultResultOrder('ipv4first');
import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';
import { ConfigStore } from '../core/storage/ConfigStore.js';
import { HistoryStore } from '../core/storage/HistoryStore.js';
import { QueueManager } from '../core/queue/QueueManager.js';
import { MediaGrabber } from '../core/media/MediaGrabber.js';
import { LinkResolver } from '../core/resolver/LinkResolver.js';
import { ClickNLoadServer } from './clicknload.js';
import { WebSocketManager } from './websocket.js';

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const configStore = ConfigStore.getInstance();
const historyStore = HistoryStore.getInstance();
const queueManager = QueueManager.getInstance();

// Initialize WebSocket & Click'n'Load
const wsManager = new WebSocketManager(server);
let clickNLoad: ClickNLoadServer | null = null;
if (configStore.getSettings().clickNLoadEnabled) {
  clickNLoad = new ClickNLoadServer(configStore.getSettings().clickNLoadPort);
  clickNLoad.start();
}

// REST Endpoints
app.get('/api/downloads', (_req, res) => {
  res.json(historyStore.getAllTasks());
});

app.post('/api/downloads', async (req, res) => {
  try {
    const { url, originalUrl, filename, savePath, connections, headers, isMediaStream, mediaFormatId, qualityLabel, audioOnly, thumbnail, downloadSubtitles, subtitleLanguages } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const task = await queueManager.addTask({
      url,
      originalUrl,
      filename,
      savePath,
      connections,
      headers,
      isMediaStream,
      mediaFormatId,
      qualityLabel,
      audioOnly,
      thumbnail,
      downloadSubtitles,
      subtitleLanguages,
      autoStart: true,
    });

    res.status(201).json(task);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to add download' });
  }
});

app.post('/api/downloads/:id/pause', (req, res) => {
  queueManager.pauseTask(req.params.id);
  res.json({ success: true });
});

app.post('/api/downloads/:id/resume', (req, res) => {
  queueManager.resumeTask(req.params.id);
  res.json({ success: true });
});

app.delete('/api/downloads/:id', (req, res) => {
  queueManager.deleteTask(req.params.id);
  res.json({ success: true });
});

app.get('/api/downloads/:id/file', (req, res) => {
  const task = historyStore.getTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Download task not found' });
  }

  const fileType = (req.query.type as string) || 'media';
  let targetPath = task.savePath;

  if (fileType === 'subtitles-text' && task.subtitlesTextPath) {
    targetPath = task.subtitlesTextPath;
  } else if (fileType === 'subtitles-timestamps' && task.subtitlesTimestampsPath) {
    targetPath = task.subtitlesTimestampsPath;
  } else if (fileType === 'subtitles-srt' && task.subtitlesPath) {
    if (fs.existsSync(task.subtitlesPath) && fs.statSync(task.subtitlesPath).isFile()) {
      targetPath = task.subtitlesPath;
    } else if (fs.existsSync(task.subtitlesPath) && fs.statSync(task.subtitlesPath).isDirectory()) {
      const srt = fs.readdirSync(task.subtitlesPath).find(f => f.endsWith('.srt'));
      if (srt) targetPath = path.join(task.subtitlesPath, srt);
    }
  }

  // If path doesn't exist directly, check candidate media extensions
  if (!targetPath || !fs.existsSync(targetPath)) {
    const dir = path.dirname(task.savePath || '');
    const base = path.basename(task.savePath || '', path.extname(task.savePath || ''));
    let found = false;
    for (const ext of ['.mp4', '.mp3', '.mkv', '.webm']) {
      const cand = path.join(dir, `${base}${ext}`);
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        targetPath = cand;
        found = true;
        break;
      }
    }
    if (!found) {
      return res.status(404).json({ error: 'File not found on disk', path: targetPath });
    }
  }

  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    const files = fs.readdirSync(targetPath);
    const media = files.find(f => /\.(mp4|mp3|mkv|webm|avi|mov|flv)$/i.test(f));
    if (media) {
      targetPath = path.join(targetPath, media);
    } else {
      return res.status(400).json({ error: 'Directory contains no media file' });
    }
  }

  const filename = path.basename(targetPath);
  res.download(targetPath, filename);
});

app.get('/api/downloads/:id/stream', (req, res) => {
  const task = historyStore.getTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Download task not found' });
  }

  let targetPath = task.savePath;
  if (!targetPath || !fs.existsSync(targetPath)) {
    const dir = path.dirname(task.savePath || '');
    const base = path.basename(task.savePath || '', path.extname(task.savePath || ''));
    for (const ext of ['.mp4', '.mp3', '.mkv', '.webm']) {
      const cand = path.join(dir, `${base}${ext}`);
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        targetPath = cand;
        break;
      }
    }
  }

  if (!targetPath || !fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
    return res.status(404).json({ error: 'Media file not found for streaming' });
  }

  const stat = fs.statSync(targetPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  const ext = path.extname(targetPath).toLowerCase();
  let contentType = 'video/mp4';
  if (ext === '.mp3') contentType = 'audio/mpeg';
  else if (ext === '.webm') contentType = 'video/webm';
  else if (ext === '.mkv') contentType = 'video/x-matroska';
  else if (ext === '.m4a') contentType = 'audio/mp4';

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(targetPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    };
    res.writeHead(200, head);
    fs.createReadStream(targetPath).pipe(res);
  }
});

app.post('/api/probe', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const isMedia = LinkResolver.isMediaHost(url);
    if (isMedia) {
      try {
        const probeData = await MediaGrabber.probeUrl(url);
        if (probeData.isPlaylist) {
          return res.json({ type: 'playlist', data: probeData });
        }
        return res.json({ type: 'media', data: probeData });
      } catch (grabberErr: any) {
        console.warn('MediaGrabber probe failed, using smart oEmbed fallback:', grabberErr?.message);
        const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
        if (ytMatch) {
          try {
            const oeRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
            if (oeRes.ok) {
              const oe = (await oeRes.json()) as any;
              return res.json({
                type: 'media',
                data: {
                  url,
                  title: oe.title || 'YouTube Video',
                  uploader: oe.author_name || 'YouTube',
                  thumbnail: oe.thumbnail_url || `https://i.ytimg.com/vi/${ytMatch[1]}/hqdefault.jpg`,
                  formats: [
                    { formatId: 'best', qualityLabel: 'Best Quality (Auto 1080p/4K)', resolution: '1080p', hasVideo: true, hasAudio: true, isDirect: false },
                    { formatId: '720p', qualityLabel: '720p HD (MP4)', resolution: '720p', hasVideo: true, hasAudio: true, isDirect: false },
                    { formatId: '480p', qualityLabel: '480p SD (MP4)', resolution: '480p', hasVideo: true, hasAudio: true, isDirect: false },
                    { formatId: 'mp3', qualityLabel: 'Audio Only (MP3)', resolution: 'audio', hasVideo: false, hasAudio: true, isDirect: false },
                  ],
                  isStream: true,
                  extractor: 'youtube',
                  category: 'video',
                }
              });
            }
          } catch (_) {}
        }

        // Generic fallback for any media stream
        return res.json({
          type: 'media',
          data: {
            url,
            title: LinkResolver.extractFilenameFromUrl(url) || 'Media Stream',
            uploader: 'Universal Media Grabber',
            thumbnail: '',
            formats: [
              { formatId: 'best', qualityLabel: 'Best Quality (Auto)', resolution: 'best', hasVideo: true, hasAudio: true, isDirect: false },
              { formatId: 'mp3', qualityLabel: 'Audio Only (MP3)', resolution: 'audio', hasVideo: false, hasAudio: true, isDirect: false },
            ],
            isStream: true,
            extractor: 'media',
            category: 'video',
          }
        });
      }
    }

    // Direct file link detection
    const category = LinkResolver.detectCategory(url);
    const filename = LinkResolver.extractFilenameFromUrl(url);
    return res.json({
      type: 'direct',
      data: {
        url,
        title: filename,
        filename,
        category,
        isStream: false,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Probe failed' });
  }
});

app.post('/api/batch/parse', (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ urls: [] });
  }
  const urls = LinkResolver.parseBatchUrls(text);
  res.json({ urls });
});

app.all('/api/resolve', async (req, res) => {
  const pollId = (req.query?.pollId as string) || req.body?.pollId;
  if (pollId) {
    try {
      const pollRes = await fetch(`https://lto2.affadaffa.com/api/progress?id=${pollId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CLAG/1.0' },
        signal: AbortSignal.timeout(6000),
      });
      const p = await pollRes.json();
      return res.status(200).json(p);
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to poll stream progress: ' + err.message });
    }
  }

  const url = ((req.body?.url || req.query?.url || '') as string).trim();
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  const format = req.body?.format || req.query?.format || '1080p';
  const audioOnly = req.body?.audioOnly === true || req.query?.audioOnly === 'true' || format === 'audio' || format === 'mp3';
  const fmt = audioOnly ? 'mp3' : (format === '720p' || format === '720' ? '720' : format === '480p' || format === '480' ? '480' : format === '360p' || format === '360' ? '360' : '1080');

  try {
    const initRes = await fetch(`https://loader.to/ajax/download.php?format=${fmt}&url=${encodeURIComponent(url)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CLAG/1.0' },
      signal: AbortSignal.timeout(6000),
    });
    const init = (await initRes.json()) as any;
    if (!init || !init.id) {
      return res.status(422).json({ error: 'Stream resolver could not initialize download for this URL', raw: init });
    }

    const pollUrl = init.progress_url || `https://lto2.affadaffa.com/api/progress?id=${init.id}`;

    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const pRes = await fetch(pollUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CLAG/1.0' },
          signal: AbortSignal.timeout(3000),
        });
        const p = (await pRes.json()) as any;
        if (p?.success === 1 && p?.download_url) {
          return res.status(200).json({
            success: true,
            ready: true,
            id: init.id,
            downloadUrl: p.download_url,
            title: p.title || init.title,
            format: fmt,
          });
        }
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      ready: false,
      id: init.id,
      progressUrl: pollUrl,
      title: init.title,
      format: fmt,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Resolver service error: ' + err.message });
  }
});

app.get('/api/settings', (_req, res) => {
  const current = configStore.getSettings();
  let lanIp = '127.0.0.1';
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          lanIp = iface.address;
          break;
        }
      }
      if (lanIp !== '127.0.0.1') break;
    }
  } catch {}
  res.json({ ...current, lanIp });
});

app.put('/api/settings', (req, res) => {
  const updated = configStore.updateSettings(req.body);
  res.json(updated);
});

app.get('/api/system/stats', (_req, res) => {
  const tasks = historyStore.getAllTasks();
  const active = tasks.filter(t => t.status === 'downloading');
  const totalSpeed = active.reduce((acc, t) => acc + (t.speed || 0), 0);

  res.json({
    activeDownloadsCount: active.length,
    totalSpeed,
    memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    uptime: Math.round(process.uptime()),
  });
});

app.post('/api/system/open', (req, res) => {
  const { path: targetPath, type, action } = req.body;
  if (!targetPath) {
    return res.status(400).json({ error: 'Path required' });
  }

  try {
    const cleanPath = path.resolve(targetPath);
    const isFileAction = action === 'file' || type === 'file';
    let command = '';

    if (isFileAction) {
      let finalFilePath = cleanPath;
      if (fs.existsSync(cleanPath) && fs.statSync(cleanPath).isDirectory()) {
        const files = fs.readdirSync(cleanPath);
        const media = files.find(f => /\.(mp4|mp3|mkv|webm|avi|mov|flv|txt|srt)$/i.test(f));
        if (media) {
          finalFilePath = path.join(cleanPath, media);
        }
      } else if (!fs.existsSync(cleanPath)) {
        let found = false;
        for (const ext of ['.mp4', '.mp3', '.mkv', '.webm']) {
          if (fs.existsSync(cleanPath + ext) && fs.statSync(cleanPath + ext).isFile()) {
            finalFilePath = cleanPath + ext;
            found = true;
            break;
          }
        }
        if (!found) {
          return res.status(404).json({ error: 'File does not exist on disk', path: cleanPath });
        }
      }

      if (process.platform === 'win32') {
        command = `start "" "${finalFilePath}"`;
      } else if (process.platform === 'darwin') {
        command = `open "${finalFilePath}"`;
      } else {
        command = `xdg-open "${finalFilePath}"`;
      }
    } else {
      // Reveal in folder
      if (!fs.existsSync(cleanPath)) {
        return res.status(404).json({ error: 'Target path does not exist on disk', path: cleanPath });
      }

      if (process.platform === 'win32') {
        const isDir = fs.statSync(cleanPath).isDirectory();
        if (isDir) {
          command = `explorer.exe "${cleanPath}"`;
        } else {
          command = `explorer.exe /select,"${cleanPath}"`;
        }
      } else if (process.platform === 'darwin') {
        const isDir = fs.statSync(cleanPath).isDirectory();
        if (isDir) {
          command = `open "${cleanPath}"`;
        } else {
          command = `open -R "${cleanPath}"`;
        }
      } else {
        command = `xdg-open "${cleanPath}"`;
      }
    }

    exec(command, () => {
      // Return success regardless of Windows explorer exit code
      res.json({ success: true });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/system/read', (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }
  try {
    const text = fs.readFileSync(filePath, 'utf-8');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(text);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

// Serve compiled client frontend if present
const clientDist = [
  path.join(process.cwd(), 'dist'),
  path.join(process.cwd(), 'dist', 'client'),
  path.join(process.cwd(), 'dist', 'web'),
].find(d => fs.existsSync(path.join(d, 'index.html')));

if (clientDist) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : (configStore.getSettings().apiPort || 8989);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`  CLAG Downloader Engine running on:`);
  console.log(`  Local UIX:    http://localhost:${PORT}`);
  console.log(`  Network/LAN:  http://0.0.0.0:${PORT}`);
  console.log(`  WebSocket:    ws://localhost:${PORT}/ws`);
  console.log(`====================================================`);
});
