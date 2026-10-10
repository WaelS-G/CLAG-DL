export class LinkResolver {
    static MEDIA_DOMAINS = [
        'youtube.com', 'youtu.be', 'googlevideo.com', 'ytimg.com',
        'instagram.com', 'cdninstagram.com',
        'facebook.com', 'fb.watch', 'fbcdn.net',
        'tiktok.com', 'tiktokcdn.com',
        'twitter.com', 'x.com', 'twimg.com',
        'reddit.com', 'twitch.tv',
        'vimeo.com', 'dailymotion.com', 'soundcloud.com', 'bilibili.com',
        'pinterest.com', 'threads.net'
    ];
    static isMediaHost(url) {
        try {
            const parsed = new URL(url);
            const host = parsed.hostname.toLowerCase();
            return this.MEDIA_DOMAINS.some(d => host.includes(d));
        }
        catch (e) {
            return false;
        }
    }
    static canonicalizeMediaUrl(url, originalUrl) {
        // If raw stream URL is from YouTube CDN (googlevideo.com), restore canonical YouTube watch URL
        if (url.includes('googlevideo.com') && originalUrl && (originalUrl.includes('youtube.com') || originalUrl.includes('youtu.be'))) {
            return originalUrl;
        }
        return url;
    }
    static detectCategory(url, filename) {
        const target = (filename || url).split('?')[0].toLowerCase();
        if (/\.(mp4|mkv|webm|avi|mov|flv|wmv|m4v|3gp|ts|m3u8|mpd)$/i.test(target))
            return 'video';
        if (/\.(mp3|wav|ogg|flac|m4a|aac|wma|opus)$/i.test(target))
            return 'audio';
        if (/\.(zip|rar|7z|tar|gz|bz2|xz|iso|cab)$/i.test(target))
            return 'compressed';
        if (/\.(exe|msi|dmg|pkg|deb|rpm|apk|appx)$/i.test(target))
            return 'program';
        if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|rtf|epub|mobi)$/i.test(target))
            return 'document';
        if (/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff)$/i.test(target))
            return 'image';
        if (this.isMediaHost(url))
            return 'video';
        return 'other';
    }
    static sanitizeFilename(name) {
        return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
    }
    static extractFilenameFromUrl(url) {
        try {
            const parsed = new URL(url);
            const pathname = parsed.pathname;
            const basename = pathname.split('/').filter(Boolean).pop();
            if (basename && basename.includes('.')) {
                return decodeURIComponent(basename);
            }
        }
        catch (e) { }
        return 'download.bin';
    }
    static parseBatchUrls(text) {
        const urlRegex = /(https?:\/\/[^\s"'<>]+)/g;
        const matches = text.match(urlRegex) || [];
        return Array.from(new Set(matches.map(u => u.trim())));
    }
    static detectSource(url) {
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
        }
        catch (e) {
            return { name: 'Direct', color: 'text-gray-400', bg: 'bg-gray-800', border: 'border-gray-700' };
        }
    }
    static isPlaylistUrl(url) {
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
                    if (parts.length === 1)
                        return true;
                }
            }
            return false;
        }
        catch (e) {
            return false;
        }
    }
    static async resolveMediaDirectUrl(url, format = '720p', audioOnly = false) {
        try {
            const fmt = audioOnly ? 'mp3' : (format.includes('720') ? '720' : format.includes('480') ? '480' : format.includes('360') ? '360' : '1080');
            const initRes = await fetch(`https://loader.to/ajax/download.php?format=${fmt}&url=${encodeURIComponent(url)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CLAG/1.0' },
                signal: AbortSignal.timeout(8000),
            });
            const init = (await initRes.json());
            if (!init || !init.id)
                return null;
            const pollUrl = init.progress_url || `https://lto2.affadaffa.com/api/progress?id=${init.id}`;
            for (let i = 0; i < 6; i++) {
                await new Promise((r) => setTimeout(r, 1200));
                try {
                    const pRes = await fetch(pollUrl, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CLAG/1.0' },
                        signal: AbortSignal.timeout(4000),
                    });
                    const p = (await pRes.json());
                    if (p?.success === 1 && p?.download_url) {
                        return p.download_url;
                    }
                }
                catch { }
            }
        }
        catch { }
        return null;
    }
}
