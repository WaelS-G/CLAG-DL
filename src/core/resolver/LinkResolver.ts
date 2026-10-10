import { DownloadCategory, GrabberLinkItem } from '../../types/index.js';

export class LinkResolver {
  private static MEDIA_DOMAINS = [
    'youtube.com', 'youtu.be', 'googlevideo.com', 'ytimg.com',
    'instagram.com', 'cdninstagram.com',
    'facebook.com', 'fb.watch', 'fbcdn.net',
    'tiktok.com', 'tiktokcdn.com',
    'twitter.com', 'x.com', 'twimg.com',
    'reddit.com', 'twitch.tv',
    'vimeo.com', 'dailymotion.com', 'soundcloud.com', 'bilibili.com',
    'pinterest.com', 'threads.net'
  ];

  public static isMediaHost(url: string): boolean {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      return this.MEDIA_DOMAINS.some(d => host.includes(d));
    } catch (e) {
      return false;
    }
  }

  public static canonicalizeMediaUrl(url: string, originalUrl?: string): string {
    // If raw stream URL is from YouTube CDN (googlevideo.com), restore canonical YouTube watch URL
    if (url.includes('googlevideo.com') && originalUrl && (originalUrl.includes('youtube.com') || originalUrl.includes('youtu.be'))) {
      return originalUrl;
    }
    return url;
  }

  public static detectCategory(url: string, filename?: string): DownloadCategory {
    const target = (filename || url).split('?')[0].toLowerCase();
    
    if (/\.(mp4|mkv|webm|avi|mov|flv|wmv|m4v|3gp|ts|m3u8|mpd)$/i.test(target)) return 'video';
    if (/\.(mp3|wav|ogg|flac|m4a|aac|wma|opus)$/i.test(target)) return 'audio';
    if (/\.(zip|rar|7z|tar|gz|bz2|xz|iso|cab)$/i.test(target)) return 'compressed';
    if (/\.(exe|msi|dmg|pkg|deb|rpm|apk|appx)$/i.test(target)) return 'program';
    if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|rtf|epub|mobi)$/i.test(target)) return 'document';
    if (/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff)$/i.test(target)) return 'image';

    if (this.isMediaHost(url)) return 'video';
    return 'other';
  }

  public static sanitizeFilename(name: string): string {
    return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
  }

  public static extractFilenameFromUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname;
      const basename = pathname.split('/').filter(Boolean).pop();
      if (basename && basename.includes('.')) {
        return decodeURIComponent(basename);
      }
    } catch (e) {}
    return 'download.bin';
  }

  public static parseBatchUrls(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s"'<>]+)/g;
    const matches = text.match(urlRegex) || [];
    return Array.from(new Set(matches.map(u => u.trim())));
  }

  public static detectSource(url: string): { name: string; color: string; bg: string; border: string } {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();

      if (host.includes('youtube.com') || host.includes('youtu.be') || host.includes('googlevideo.com')) {
        return { name: 'YouTube', color: 'text-red-400', bg: 'bg-red-950/60', border: 'border-red-800/60' };
      }
      if (host.includes('instagram.com') || host.includes('cdninstagram.com')) {
        return { name: 'Instagram', color: 'text-fuchsia-400', bg: 'bg-fuchsia-950/60', border: 'border-fuchsia-800/60' };
      }
      if (host.includes('tiktok.com')) {
        return { name: 'TikTok', color: 'text-cyan-400', bg: 'bg-cyan-950/60', border: 'border-cyan-800/60' };
      }
      if (host.includes('twitter.com') || host.includes('x.com')) {
        return { name: 'Twitter / X', color: 'text-sky-400', bg: 'bg-sky-950/60', border: 'border-sky-800/60' };
      }
      if (host.includes('facebook.com') || host.includes('fb.watch')) {
        return { name: 'Facebook', color: 'text-blue-400', bg: 'bg-blue-950/60', border: 'border-blue-800/60' };
      }
      if (host.includes('soundcloud.com')) {
        return { name: 'SoundCloud', color: 'text-orange-400', bg: 'bg-orange-950/60', border: 'border-orange-800/60' };
      }
      if (host.includes('reddit.com')) {
        return { name: 'Reddit', color: 'text-amber-400', bg: 'bg-amber-950/60', border: 'border-amber-800/60' };
      }
      if (host.includes('vimeo.com')) {
        return { name: 'Vimeo', color: 'text-teal-400', bg: 'bg-teal-950/60', border: 'border-teal-800/60' };
      }
      if (host.includes('twitch.tv')) {
        return { name: 'Twitch', color: 'text-purple-400', bg: 'bg-purple-950/60', border: 'border-purple-800/60' };
      }

      const domain = host.replace(/^www\./, '');
      return { name: domain, color: 'text-emerald-400', bg: 'bg-emerald-950/60', border: 'border-emerald-800/60' };
    } catch (e) {
      return { name: 'Direct', color: 'text-gray-400', bg: 'bg-gray-800', border: 'border-gray-700' };
    }
  }

  public static isPlaylistUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const pathname = parsed.pathname.toLowerCase();
      const search = parsed.search.toLowerCase();

      if (host.includes('youtube.com') || host.includes('youtu.be')) {
        if (search.includes('list=') || pathname.includes('/playlist') || pathname.includes('/videos') || pathname.includes('/shorts')) {
          return true;
        }
      }
      if (host.includes('instagram.com')) {
        // User profile: instagram.com/username/ (not single reel/post)
        if (!pathname.includes('/p/') && !pathname.includes('/reel/') && !pathname.includes('/stories/')) {
          const parts = pathname.split('/').filter(Boolean);
          if (parts.length === 1) return true;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  }
}
