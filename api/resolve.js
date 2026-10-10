/**
 * Vercel Serverless Function: /api/resolve
 * Fast Multi-Platform Media Stream & Conversion Resolver.
 * Resolves YouTube, TikTok, Instagram, Twitter/X, and social media links
 * into direct, downloadable MP4 and MP3 URLs via loader.to & savenow.to CDN.
 * Made by: Wael Sayed
 */

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {}
  }

  const pollId = req.query?.pollId || body?.pollId;
  if (pollId) {
    try {
      const pollRes = await fetch(`https://lto2.affadaffa.com/api/progress?id=${pollId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CLAG/1.0' },
        signal: AbortSignal.timeout(6000),
      });
      const p = await pollRes.json();
      return res.status(200).json(p);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to poll stream progress: ' + err.message });
    }
  }

  const url = (body?.url || req.query?.url || '').trim();
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  const format = body?.format || req.query?.format || '1080p';
  const audioOnly = body?.audioOnly === true || req.query?.audioOnly === 'true' || format === 'audio' || format === 'mp3';

  const fmt = audioOnly ? 'mp3' : (format === '720p' || format === '720' ? '720' : format === '480p' || format === '480' ? '480' : format === '360p' || format === '360' ? '360' : '1080');

  try {
    const initRes = await fetch(`https://loader.to/ajax/download.php?format=${fmt}&url=${encodeURIComponent(url)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CLAG/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    const init = await initRes.json();

    if (!init || !init.id) {
      return res.status(422).json({ error: 'Stream resolver could not initialize download for this URL', raw: init });
    }

    const pollUrl = init.progress_url || `https://lto2.affadaffa.com/api/progress?id=${init.id}`;

    // Fast check: check if already converted / cached
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const pRes = await fetch(pollUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CLAG/1.0' },
          signal: AbortSignal.timeout(3000),
        });
        const p = await pRes.json();
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

    // Still converting: return pending status with pollUrl
    return res.status(200).json({
      success: true,
      ready: false,
      id: init.id,
      progressUrl: pollUrl,
      title: init.title,
      format: fmt,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Resolver service error: ' + err.message });
  }
}
