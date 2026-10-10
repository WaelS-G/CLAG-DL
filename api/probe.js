/**
 * Vercel Serverless Function: /api/probe
 * Multi-Platform Media Probe, oEmbed Metadata Resolver & Direct File Analyzer.
 * Made by: Wael Sayed
 */

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawUrl = (req.body?.url || req.query?.url || '').trim();
  if (!rawUrl) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  const lowerUrl = rawUrl.toLowerCase();

  // ==============================================================
  // 1. YOUTUBE (Videos, Shorts, Music, Playlists)
  // ==============================================================
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    try {
      const isPlaylist = lowerUrl.includes('list=') || lowerUrl.includes('/playlist');
      const ytMatch = rawUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
      const videoId = ytMatch ? ytMatch[1] : null;

      let title = isPlaylist ? 'YouTube Playlist' : 'YouTube Video';
      let uploader = 'YouTube Creator';
      let thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
      let durationFormatted = 'Stream Video';
      let resolvedFormats = [];

      // Try Invidious API for live stream extraction
      if (videoId) {
        const invidiousInstances = ['invidious.f5.si', 'invidious.nerdvpn.de', 'inv.nadeko.net'];
        for (const host of invidiousInstances) {
          try {
            const invRes = await fetch(`https://${host}/api/v1/videos/${videoId}`, {
              signal: AbortSignal.timeout(3000),
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CLAG/1.0' },
            });
            if (invRes.ok) {
              const invData = await invRes.json();
              if (invData.title) title = invData.title;
              if (invData.author) uploader = invData.author;
              if (invData.lengthSeconds) {
                const s = invData.lengthSeconds;
                durationFormatted = `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
              }

              const streams = [];
              if (invData.formatStreams && invData.formatStreams.length > 0) {
                invData.formatStreams.forEach((st, idx) => {
                  streams.push({
                    formatId: `fmt_${st.resolution || idx}`,
                    ext: 'mp4',
                    resolution: st.resolution || '720p',
                    qualityLabel: `${st.resolution || 'MP4 Video'} (${st.quality || 'HD'})`,
                    hasVideo: true,
                    hasAudio: true,
                    url: st.url,
                    isBest: idx === 0,
                  });
                });
              }

              const audioStream = invData.adaptiveFormats?.find((f) => f.type?.includes('audio'));
              if (audioStream) {
                streams.push({
                  formatId: 'audio',
                  ext: 'mp3',
                  resolution: 'Audio',
                  qualityLabel: `High Quality Audio (${Math.round((audioStream.bitrate || 128000) / 1000)} kbps)`,
                  hasVideo: false,
                  hasAudio: true,
                  url: audioStream.url,
                  filesize: parseInt(audioStream.clen || '0', 10) || undefined,
                });
              }

              if (streams.length > 0) {
                resolvedFormats = streams;
                break;
              }
            }
          } catch (invErr) {}
        }
      }

      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(rawUrl)}&format=json`;
        const oembedRes = await fetch(oembedUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CLAG/1.0' },
        });
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          if (oembedData.title) title = oembedData.title;
          if (oembedData.author_name) uploader = oembedData.author_name;
          if (oembedData.thumbnail_url) thumbnail = oembedData.thumbnail_url;
        }
      } catch (e) {
        // oEmbed failed, fallback to videoId thumbnail
      }

      const standardFormats = [
        {
          formatId: 'best',
          ext: 'mp4',
          resolution: '1080p',
          qualityLabel: '1080p Full HD (MP4)',
          hasVideo: true,
          hasAudio: true,
          isBest: true,
        },
        {
          formatId: '720p',
          ext: 'mp4',
          resolution: '720p',
          qualityLabel: '720p HD (MP4)',
          hasVideo: true,
          hasAudio: true,
        },
        {
          formatId: '480p',
          ext: 'mp4',
          resolution: '480p',
          qualityLabel: '480p SD (MP4)',
          hasVideo: true,
          hasAudio: true,
        },
        {
          formatId: '360p',
          ext: 'mp4',
          resolution: '360p',
          qualityLabel: '360p (MP4)',
          hasVideo: true,
          hasAudio: true,
        },
        {
          formatId: 'audio',
          ext: 'mp3',
          resolution: 'Audio',
          qualityLabel: 'High Quality MP3 Audio (320kbps)',
          hasVideo: false,
          hasAudio: true,
        },
      ];

      const formatsToReturn = resolvedFormats.length > 0 ? resolvedFormats : standardFormats;

      return res.status(200).json({
        type: isPlaylist ? 'playlist' : 'media',
        data: {
          url: rawUrl,
          title,
          uploader,
          thumbnail,
          durationFormatted,
          extractor: 'youtube',
          isStream: true,
          isPlaylist,
          entryCount: isPlaylist ? 10 : 1,
          formats: formatsToReturn,
          hasSubtitles: true,
          subtitlesList: ['en', 'ar', 'es', 'fr', 'de'],
        },
      });
    } catch (ytErr) {
      // Fall through to direct probe
    }
  }

  // ==============================================================
  // 2. TIKTOK
  // ==============================================================
  if (lowerUrl.includes('tiktok.com')) {
    try {
      let title = 'TikTok Video';
      let uploader = 'TikTok Creator';
      let thumbnail = '';

      const oembedRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(rawUrl)}`);
      if (oembedRes.ok) {
        const data = await oembedRes.json();
        if (data.title) title = data.title;
        if (data.author_name) uploader = data.author_name;
        if (data.thumbnail_url) thumbnail = data.thumbnail_url;
      }

      return res.status(200).json({
        type: 'media',
        data: {
          url: rawUrl,
          title,
          uploader,
          thumbnail,
          durationFormatted: 'Short Video',
          extractor: 'tiktok',
          isStream: true,
          formats: [
            { formatId: 'best', ext: 'mp4', qualityLabel: 'Original HD (No Watermark MP4)', hasVideo: true, hasAudio: true, isBest: true },
            { formatId: 'audio', ext: 'mp3', qualityLabel: 'Original Audio (MP3)', hasVideo: false, hasAudio: true },
          ],
        },
      });
    } catch (e) {}
  }

  // ==============================================================
  // 3. VIMEO
  // ==============================================================
  if (lowerUrl.includes('vimeo.com')) {
    try {
      let title = 'Vimeo Video';
      let uploader = 'Vimeo Creator';
      let thumbnail = '';

      const oembedRes = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(rawUrl)}`);
      if (oembedRes.ok) {
        const data = await oembedRes.json();
        if (data.title) title = data.title;
        if (data.author_name) uploader = data.author_name;
        if (data.thumbnail_url) thumbnail = data.thumbnail_url;
      }

      return res.status(200).json({
        type: 'media',
        data: {
          url: rawUrl,
          title,
          uploader,
          thumbnail,
          durationFormatted: 'Video Stream',
          extractor: 'vimeo',
          isStream: true,
          formats: [
            { formatId: 'best', ext: 'mp4', qualityLabel: 'Best 1080p Full HD', hasVideo: true, hasAudio: true, isBest: true },
            { formatId: '720p', ext: 'mp4', qualityLabel: '720p HD', hasVideo: true, hasAudio: true },
            { formatId: 'audio', ext: 'mp3', qualityLabel: 'MP3 Audio', hasVideo: false, hasAudio: true },
          ],
        },
      });
    } catch (e) {}
  }

  // ==============================================================
  // 4. SOUNDCLOUD
  // ==============================================================
  if (lowerUrl.includes('soundcloud.com')) {
    try {
      let title = 'SoundCloud Track';
      let uploader = 'SoundCloud Artist';
      let thumbnail = '';

      const oembedRes = await fetch(`https://soundcloud.com/oembed?url=${encodeURIComponent(rawUrl)}&format=json`);
      if (oembedRes.ok) {
        const data = await oembedRes.json();
        if (data.title) title = data.title;
        if (data.author_name) uploader = data.author_name;
        if (data.thumbnail_url) thumbnail = data.thumbnail_url;
      }

      return res.status(200).json({
        type: 'media',
        data: {
          url: rawUrl,
          title,
          uploader,
          thumbnail,
          durationFormatted: 'Audio Track',
          extractor: 'soundcloud',
          isStream: true,
          formats: [
            { formatId: 'audio', ext: 'mp3', qualityLabel: 'High Quality Audio (320kbps MP3)', hasVideo: false, hasAudio: true, isBest: true },
          ],
        },
      });
    } catch (e) {}
  }

  // ==============================================================
  // 5. INSTAGRAM, TWITTER/X, FACEBOOK (Social Media Hosts)
  // ==============================================================
  if (lowerUrl.includes('instagram.com') || lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com') || lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.watch')) {
    let platform = 'Social Media';
    if (lowerUrl.includes('instagram.com')) platform = 'Instagram';
    else if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) platform = 'Twitter / X';
    else if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.watch')) platform = 'Facebook';

    return res.status(200).json({
      type: 'media',
      data: {
        url: rawUrl,
        title: `${platform} Video / Reel`,
        uploader: `${platform} Media Post`,
        thumbnail: '',
        durationFormatted: 'Social Clip',
        extractor: platform.toLowerCase().replace(/[^a-z]/g, ''),
        isStream: true,
        formats: [
          { formatId: 'best', ext: 'mp4', qualityLabel: 'Best High Definition Video (MP4)', hasVideo: true, hasAudio: true, isBest: true },
          { formatId: 'audio', ext: 'mp3', qualityLabel: 'Extracted Audio (MP3)', hasVideo: false, hasAudio: true },
        ],
      },
    });
  }

  // ==============================================================
  // 6. DIRECT FILE URL / UNKNOWN STREAM (HEAD & Range Probe)
  // ==============================================================
  try {
    const headRes = await fetch(rawUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      },
    });

    const contentLength = parseInt(headRes.headers.get('content-length') || '0', 10);
    const acceptRanges = headRes.headers.get('accept-ranges') || '';
    const contentType = headRes.headers.get('content-type') || 'application/octet-stream';
    const supportsRange = acceptRanges.toLowerCase().includes('bytes');

    let filename = '';
    const disposition = headRes.headers.get('content-disposition');
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
      if (match && match[1]) {
        filename = decodeURIComponent(match[1].trim());
      }
    }

    if (!filename) {
      try {
        const parsed = new URL(rawUrl);
        filename = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || 'download.bin');
      } catch (e) {
        filename = 'download.bin';
      }
    }

    // Determine category
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    let category = 'other';
    if (['mp4', 'mkv', 'webm', 'mov', 'avi', 'flv'].includes(ext)) category = 'video';
    else if (['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg'].includes(ext)) category = 'audio';
    else if (['zip', 'rar', '7z', 'tar', 'gz', 'iso'].includes(ext)) category = 'compressed';
    else if (['exe', 'msi', 'apk', 'dmg', 'pkg'].includes(ext)) category = 'program';
    else if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'].includes(ext)) category = 'document';
    else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) category = 'image';

    return res.status(200).json({
      type: 'direct',
      data: {
        url: rawUrl,
        title: filename,
        filename,
        filesize: contentLength,
        filesizeFormatted: contentLength > 0 ? formatBytes(contentLength) : 'Unknown size',
        supportsRange,
        contentType,
        category,
        isStream: false,
      },
    });
  } catch (err) {
    // If HEAD fails, deduce from URL pathname
    let fallbackName = 'download.bin';
    try {
      const parsed = new URL(rawUrl);
      fallbackName = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || 'download.bin');
    } catch (e) {}

    return res.status(200).json({
      type: 'direct',
      data: {
        url: rawUrl,
        title: fallbackName,
        filename: fallbackName,
        filesize: 0,
        filesizeFormatted: 'Unknown size',
        supportsRange: false,
        contentType: 'application/octet-stream',
        category: 'other',
        isStream: false,
      },
    });
  }
}
