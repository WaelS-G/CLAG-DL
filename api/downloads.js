/**
 * Vercel Serverless Function: /api/downloads
 * Manages download task dispatch and media stream resolution in cloud deployments.
 * Made by: Wael Sayed
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json([]);
  }

  if (req.method === 'POST') {
    const {
      url,
      filename,
      connections = 16,
      isMediaStream,
      mediaFormatId,
      audioOnly,
      thumbnail,
      qualityLabel,
    } = req.body || {};

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const taskId = 'cloud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const cleanFilename = filename || (audioOnly ? 'audio.mp3' : 'download.bin');

    let streamUrl = null;
    let resolvedTitle = null;
    const lower = url.toLowerCase();
    const isSocial = lower.includes('youtube.com') || lower.includes('youtu.be') || lower.includes('tiktok.com') || lower.includes('instagram.com') || lower.includes('twitter.com') || lower.includes('x.com');

    if (isSocial) {
      try {
        const fmt = audioOnly ? 'mp3' : (mediaFormatId === '720p' ? '720' : mediaFormatId === '480p' ? '480' : mediaFormatId === '360p' ? '360' : '1080');
        const initRes = await fetch(`https://loader.to/ajax/download.php?format=${fmt}&url=${encodeURIComponent(url)}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(4000),
        });
        const init = await initRes.json();
        if (init?.success && init?.id) {
          if (init.title) resolvedTitle = init.title;
          const pollUrl = init.progress_url || `https://lto2.affadaffa.com/api/progress?id=${init.id}`;
          for (let i = 0; i < 6; i++) {
            await new Promise((r) => setTimeout(r, 1200));
            const pRes = await fetch(pollUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0' },
              signal: AbortSignal.timeout(3000),
            });
            const p = await pRes.json();
            if (p?.success === 1 && p?.download_url) {
              streamUrl = p.download_url;
              if (p.title) resolvedTitle = p.title;
              break;
            }
          }
        }
      } catch (e) {}
    }

    const finalFilename = resolvedTitle ? (resolvedTitle + (audioOnly ? '.mp3' : '.mp4')) : cleanFilename;

    const newTask = {
      id: taskId,
      url,
      streamUrl: streamUrl || undefined,
      originalUrl: url,
      filename: finalFilename,
      savePath: finalFilename,
      totalBytes: 0,
      downloadedBytes: 0,
      speed: 0,
      status: 'downloading',
      category: audioOnly ? 'audio' : (isMediaStream ? 'video' : 'other'),
      progress: 0,
      eta: 0,
      connections,
      chunks: [],
      createdAt: Date.now(),
      thumbnail,
      qualityLabel,
      audioOnly,
      isMediaStream,
      mediaFormatId,
      isCloudEngine: true,
    };

    return res.status(201).json(newTask);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
