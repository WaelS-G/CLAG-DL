/**
 * Vercel Serverless Function: /api/settings
 * Cloud fallback for user preferences and default settings.
 * Made by: Wael Sayed
 */

const DEFAULT_SETTINGS = {
  downloadDir: 'Downloads/CLAG',
  maxConcurrentDownloads: 3,
  defaultConnections: 16,
  speedLimitKBps: 0,
  autoStartDownloads: true,
  clipboardMonitoring: true,
  theme: 'dark',
  enableSoundAlerts: true,
  clickNLoadEnabled: true,
  clickNLoadPort: 9666,
  apiPort: 8989,
  downloadSubtitles: true,
  subtitlesFormat: 'txt',
  subtitleLanguages: ['en', 'ar'],
  subtitlesInSubfolder: true,
  isCloudDeployment: true,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json(DEFAULT_SETTINGS);
  }

  if (req.method === 'PUT') {
    return res.status(200).json({ ...DEFAULT_SETTINGS, ...req.body });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
