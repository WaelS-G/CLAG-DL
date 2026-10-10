/**
 * Vercel Serverless Function: /api/stream
 * CORS bypass and HTTP Range proxy for in-browser streaming downloads.
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const targetUrl = req.query?.url;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing target url parameter' });
  }

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    };

    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
    });

    res.status(upstream.status);

    // Forward upstream headers
    ['content-type', 'content-length', 'content-range', 'accept-ranges', 'content-disposition'].forEach((h) => {
      const val = upstream.headers.get(h);
      if (val) res.setHeader(h, val);
    });

    if (req.method === 'HEAD' || !upstream.body) {
      return res.end();
    }

    // Pipe response stream to client
    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (err) {
    return res.status(500).json({ error: 'Stream proxy error: ' + err.message });
  }
}
