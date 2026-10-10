/**
 * Vercel Serverless Function: /api/batch/parse
 * Extracts all URLs from raw input text.
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const text = req.body?.text || '';
  const urlRegex = /(https?:\/\/[^\s"'<>]+)/g;
  const matches = text.match(urlRegex) || [];
  const urls = Array.from(new Set(matches.map((u) => u.trim())));

  return res.status(200).json({ urls });
}
