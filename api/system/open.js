/**
 * Vercel Serverless Function: /api/system/open
 * Cloud handler for system open requests (signals client-side handling).
 * Made by: Wael Sayed
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Cloud server cannot open native desktop explorer
  return res.status(200).json({
    success: false,
    isCloud: true,
    message: 'System file opening is only supported in Desktop / LAN mode.',
  });
}
