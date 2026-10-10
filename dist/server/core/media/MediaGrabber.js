import { spawn, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { LinkResolver } from '../resolver/LinkResolver.js';
let resolvedYtDlp = null;
let hasFfmpegCache = null;
export function isFfmpegAvailable() {
    if (hasFfmpegCache !== null)
        return hasFfmpegCache;
    try {
        const res = spawnSync('ffmpeg', ['-version'], { timeout: 3000 });
        hasFfmpegCache = res.status === 0;
    }
    catch {
        hasFfmpegCache = false;
    }
    return hasFfmpegCache;
}
export function getYtDlpExecution() {
    if (resolvedYtDlp)
        return resolvedYtDlp;
    // 1. Explicit env var
    if (process.env.YT_DLP_BIN && fs.existsSync(process.env.YT_DLP_BIN)) {
        resolvedYtDlp = { command: process.env.YT_DLP_BIN, baseArgs: [] };
        return resolvedYtDlp;
    }
    // 2. Local bin directory in project or home
    const localBinPaths = [
        path.join(process.cwd(), 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'),
        path.join(os.homedir(), '.local', 'bin', 'yt-dlp'),
        path.join(os.homedir(), 'bin', 'yt-dlp'),
        '/usr/local/bin/yt-dlp',
        '/usr/bin/yt-dlp',
    ];
    for (const binPath of localBinPaths) {
        try {
            if (fs.existsSync(binPath)) {
                const res = spawnSync(binPath, ['--version'], { timeout: 3000 });
                if (res.status === 0) {
                    resolvedYtDlp = { command: binPath, baseArgs: [] };
                    return resolvedYtDlp;
                }
            }
        }
        catch { }
    }
    // 3. System 'yt-dlp' executable in PATH
    try {
        const res = spawnSync('yt-dlp', ['--version'], { timeout: 3000 });
        if (res.status === 0) {
            resolvedYtDlp = { command: 'yt-dlp', baseArgs: [] };
            return resolvedYtDlp;
        }
    }
    catch { }
    // 4. Check python3 -m yt_dlp or python -m yt_dlp
    const pyCandidates = process.platform === 'win32' ? ['python', 'python3', 'py'] : ['python3', 'python'];
    for (const py of pyCandidates) {
        try {
            const res = spawnSync(py, ['-m', 'yt_dlp', '--version'], { timeout: 3000 });
            if (res.status === 0) {
                resolvedYtDlp = { command: py, baseArgs: ['-m', 'yt_dlp'] };
                return resolvedYtDlp;
            }
        }
        catch { }
    }
    // Fallback to default python
    const defaultPy = process.platform === 'win32' ? 'python' : 'python3';
    return { command: defaultPy, baseArgs: ['-m', 'yt_dlp'] };
}
export async function autoEnsureYtDlp() {
    const current = getYtDlpExecution();
    try {
        const test = spawnSync(current.command, [...current.baseArgs, '--version'], { timeout: 3000 });
        if (test.status === 0) {
            return current.command;
        }
    }
    catch { }
    // Auto-download standalone binary on Linux
    if (process.platform === 'linux' || process.platform === 'darwin') {
        try {
            const binDir = path.join(process.cwd(), 'bin');
            if (!fs.existsSync(binDir))
                fs.mkdirSync(binDir, { recursive: true });
            const targetBin = path.join(binDir, 'yt-dlp');
            console.log('CLAG: Downloading standalone yt-dlp binary from GitHub Releases...');
            const dlUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
            const res = await fetch(dlUrl, { redirect: 'follow' });
            if (res.ok) {
                const buf = Buffer.from(await res.arrayBuffer());
                fs.writeFileSync(targetBin, buf);
                fs.chmodSync(targetBin, 0o755);
                console.log('CLAG: Successfully installed standalone yt-dlp at:', targetBin);
                resolvedYtDlp = { command: targetBin, baseArgs: [] };
                return targetBin;
            }
        }
        catch (e) {
            console.warn('CLAG: Could not auto-download yt-dlp:', e.message);
        }
    }
    return null;
}
function cleanYtDlpError(raw) {
    if (!raw || !raw.trim())
        return 'Process exited with error';
    const lines = raw
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('Deprecated Feature:') && !l.includes('Please update to Python') && !l.includes('See  https://github.com/yt-dlp'));
    const errorLines = lines.filter((l) => l.startsWith('ERROR:') ||
        l.includes('Error:') ||
        l.includes('No module named') ||
        l.includes('Sign in') ||
        l.includes('confirm you') ||
        l.includes('bot'));
    if (errorLines.length > 0) {
        return errorLines.map(l => l.replace(/^ERROR:\s*/i, '')).join('; ');
    }
    return lines.slice(-2).join('; ') || 'Process exited with error';
}
export class MediaGrabber {
    static async probePlaylist(url, limit = 60) {
        return new Promise((resolve, reject) => {
            const execInfo = getYtDlpExecution();
            const args = [
                ...execInfo.baseArgs,
                '--flat-playlist',
                '--dump-single-json',
                '--playlist-end', limit.toString(),
                '--skip-download',
                '--extractor-args', 'youtube:player_client=android,web',
                '--socket-timeout', '15',
                url,
            ];
            const child = spawn(execInfo.command, args, { windowsHide: true });
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (d) => { stdout += d.toString(); });
            child.stderr.on('data', (d) => { stderr += d.toString(); });
            child.on('close', (code) => {
                if (code !== 0 || !stdout.trim()) {
                    return reject(new Error(cleanYtDlpError(stderr) || 'Failed to extract playlist information'));
                }
                try {
                    const info = JSON.parse(stdout);
                    const rawEntries = info.entries || [];
                    const entries = [];
                    for (const e of rawEntries) {
                        if (!e)
                            continue;
                        let itemUrl = e.url;
                        if (itemUrl && !itemUrl.startsWith('http')) {
                            if (e.id)
                                itemUrl = `https://www.youtube.com/watch?v=${e.id}`;
                        }
                        let durFormatted = '';
                        if (e.duration) {
                            const sec = Math.floor(e.duration % 60);
                            const min = Math.floor((e.duration / 60) % 60);
                            const hrs = Math.floor(e.duration / 3600);
                            durFormatted = hrs > 0
                                ? `${hrs}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
                                : `${min}:${sec.toString().padStart(2, '0')}`;
                        }
                        entries.push({
                            id: e.id,
                            url: itemUrl || url,
                            title: e.title || 'Untitled Video',
                            duration: e.duration,
                            durationFormatted: durFormatted,
                            thumbnail: e.thumbnail || (e.thumbnails && e.thumbnails[0]?.url),
                        });
                    }
                    resolve({
                        url,
                        title: info.title || 'Playlist / Collection',
                        uploader: info.uploader || info.channel || 'Various',
                        formats: [],
                        isStream: false,
                        extractor: info.extractor || 'generic',
                        isPlaylist: true,
                        entryCount: entries.length,
                        entries,
                    });
                }
                catch (err) {
                    reject(new Error(`Failed to parse playlist: ${err.message}`));
                }
            });
        });
    }
    static async probeUrl(url) {
        if (LinkResolver.isPlaylistUrl(url)) {
            try {
                const pl = await MediaGrabber.probePlaylist(url);
                if (pl.entries && pl.entries.length > 0) {
                    return pl;
                }
            }
            catch (e) {
                // Fallback to single media probe if playlist probe fails
            }
        }
        return new Promise((resolve, reject) => {
            const execInfo = getYtDlpExecution();
            const args = [
                ...execInfo.baseArgs,
                '--dump-json',
                '--no-playlist',
                '--no-warnings',
                '--skip-download',
                '--extractor-args', 'youtube:player_client=android,web',
                '--socket-timeout', '15',
                url,
            ];
            const child = spawn(execInfo.command, args, { windowsHide: true });
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (d) => { stdout += d.toString(); });
            child.stderr.on('data', (d) => { stderr += d.toString(); });
            child.on('close', (code) => {
                if (code !== 0 || !stdout.trim()) {
                    return reject(new Error(cleanYtDlpError(stderr) || 'Failed to extract media information'));
                }
                try {
                    const info = JSON.parse(stdout);
                    const rawFormats = info.formats || [];
                    const formats = [];
                    const seen = new Set();
                    for (const f of rawFormats) {
                        // Filter out storyboard image sprites and non-media formats
                        if (f.ext === 'mhtml' || f.format_note === 'storyboard' || f.protocol === 'mhtml') {
                            continue;
                        }
                        const hasVideo = !!(f.vcodec && f.vcodec !== 'none');
                        const hasAudio = !!(f.acodec && f.acodec !== 'none');
                        if (!hasVideo && !hasAudio) {
                            continue;
                        }
                        const resolution = f.resolution || (f.width && f.height ? `${f.width}x${f.height}` : undefined);
                        const filesize = f.filesize || f.filesize_approx || 0;
                        let filesizeFormatted = '';
                        if (filesize > 0) {
                            if (filesize >= 1024 * 1024 * 1024) {
                                filesizeFormatted = `${(filesize / (1024 ** 3)).toFixed(2)} GB`;
                            }
                            else if (filesize >= 1024 * 1024) {
                                filesizeFormatted = `${(filesize / (1024 ** 2)).toFixed(1)} MB`;
                            }
                            else {
                                filesizeFormatted = `${Math.round(filesize / 1024)} KB`;
                            }
                        }
                        let qualityLabel = '';
                        if (hasVideo) {
                            const h = f.height || (resolution ? parseInt(resolution.split('x')[1], 10) : 0);
                            const fpsStr = f.fps && f.fps > 30 ? ` ${Math.round(f.fps)}fps` : '';
                            if (h >= 2160)
                                qualityLabel = `4K Ultra HD (2160p${fpsStr})`;
                            else if (h >= 1440)
                                qualityLabel = `2K Quad HD (1440p${fpsStr})`;
                            else if (h >= 1080)
                                qualityLabel = `1080p Full HD${fpsStr}`;
                            else if (h >= 720)
                                qualityLabel = `720p HD${fpsStr}`;
                            else if (h >= 480)
                                qualityLabel = `480p SD`;
                            else if (h >= 360)
                                qualityLabel = `360p`;
                            else if (h >= 240)
                                qualityLabel = `240p`;
                            else if (h >= 144)
                                qualityLabel = `144p`;
                            else
                                qualityLabel = resolution || f.format_note || 'Standard Video';
                        }
                        else if (hasAudio) {
                            const abr = Math.round(f.abr || 128);
                            qualityLabel = `Audio (${abr} kbps ${f.ext.toUpperCase()})`;
                        }
                        // Deduplicate visually identical formats per resolution, ext and fps
                        const dedupeKey = `${hasVideo ? 'v' : 'a'}_${resolution || f.format_note}_${f.ext}_${f.fps || 0}`;
                        if (seen.has(dedupeKey)) {
                            continue;
                        }
                        seen.add(dedupeKey);
                        formats.push({
                            formatId: f.format_id,
                            ext: f.ext || 'mp4',
                            resolution,
                            fps: f.fps,
                            filesize,
                            filesizeFormatted,
                            vcodec: f.vcodec,
                            acodec: f.acodec,
                            qualityLabel,
                            hasVideo,
                            hasAudio,
                        });
                    }
                    // Sort formats descending: highest resolution videos first (4K, 1440p, 1080p, 720p...), then audio
                    formats.sort((a, b) => {
                        if (a.hasVideo && !b.hasVideo)
                            return -1;
                        if (!a.hasVideo && b.hasVideo)
                            return 1;
                        if (a.hasVideo && b.hasVideo) {
                            const hA = parseInt(a.resolution?.split('x')[1] || '0', 10) || 0;
                            const hB = parseInt(b.resolution?.split('x')[1] || '0', 10) || 0;
                            if (hA !== hB)
                                return hB - hA;
                            if ((b.fps || 0) !== (a.fps || 0))
                                return (b.fps || 0) - (a.fps || 0);
                            if (a.ext === 'mp4' && b.ext !== 'mp4')
                                return -1;
                            if (a.ext !== 'mp4' && b.ext === 'mp4')
                                return 1;
                            return 0;
                        }
                        return (b.filesize || 0) - (a.filesize || 0);
                    });
                    let durationFormatted = '';
                    if (info.duration) {
                        const sec = Math.floor(info.duration % 60);
                        const min = Math.floor((info.duration / 60) % 60);
                        const hrs = Math.floor(info.duration / 3600);
                        durationFormatted = hrs > 0
                            ? `${hrs}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
                            : `${min}:${sec.toString().padStart(2, '0')}`;
                    }
                    const rawSubtitles = info.subtitles || {};
                    const autoCaptions = info.automatic_captions || {};
                    const subLangs = Array.from(new Set([...Object.keys(rawSubtitles), ...Object.keys(autoCaptions)]));
                    const hasSubtitles = subLangs.length > 0;
                    resolve({
                        url,
                        title: info.title || 'Untitled Media',
                        uploader: info.uploader || info.channel || 'Unknown',
                        duration: info.duration,
                        durationFormatted,
                        thumbnail: info.thumbnail,
                        formats,
                        isStream: !!info.is_live,
                        extractor: info.extractor || 'generic',
                        hasSubtitles,
                        subtitlesList: subLangs,
                    });
                }
                catch (e) {
                    reject(new Error(`Failed to parse media metadata: ${e.message}`));
                }
            });
        });
    }
    /**
     * Cleans raw WebVTT or SRT subtitle content into a clean plain-text transcript without timestamps.
     * Preserves the exact structure of the SRT file (one sentence/cue per line) while stripping
     * numeric cue indices, timestamps, and formatting tags.
     */
    static cleanSubtitlesToText(rawContent) {
        if (!rawContent || !rawContent.trim())
            return '';
        // Normalize Unicode NFKC & linebreaks
        const normalized = rawContent.normalize('NFKC').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = normalized.split('\n');
        const cues = [];
        let currentCueLines = [];
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (!line) {
                if (currentCueLines.length > 0) {
                    const textBlock = currentCueLines.join(' ').trim();
                    if (textBlock && (cues.length === 0 || cues[cues.length - 1] !== textBlock)) {
                        cues.push(textBlock);
                    }
                    currentCueLines = [];
                }
                continue;
            }
            // Skip WebVTT headers & metadata
            if (/^(WEBVTT|Kind:|Language:|NOTE|STYLE|REGION)/i.test(line))
                continue;
            // Skip numeric cue indices (e.g. "1", "2")
            if (/^\d+$/.test(line))
                continue;
            // Skip timestamp lines: "00:00:01,000 --> 00:00:04,000" or with positioning
            if (/\d{1,2}:\d{2}(?::\d{2})?[,\.]\d{1,3}\s*-->\s*\d{1,2}:\d{2}(?::\d{2})?[,\.]\d{1,3}/.test(line)) {
                if (currentCueLines.length > 0) {
                    const textBlock = currentCueLines.join(' ').trim();
                    if (textBlock && (cues.length === 0 || cues[cues.length - 1] !== textBlock)) {
                        cues.push(textBlock);
                    }
                    currentCueLines = [];
                }
                continue;
            }
            // Strip HTML tags and WebVTT styling (<c>, <b>, </c>, <v Speaker>, etc.)
            line = line.replace(/<[^>]+>/g, '');
            // Decode HTML entities
            line = line
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&nbsp;/g, ' ')
                .trim();
            if (!line)
                continue;
            // Deduplicate rolling caption lines
            if (currentCueLines.length === 0 || currentCueLines[currentCueLines.length - 1] !== line) {
                currentCueLines.push(line);
            }
        }
        if (currentCueLines.length > 0) {
            const textBlock = currentCueLines.join(' ').trim();
            if (textBlock && (cues.length === 0 || cues[cues.length - 1] !== textBlock)) {
                cues.push(textBlock);
            }
        }
        return cues.join('\n');
    }
    /**
     * Converts raw WebVTT or SRT subtitle content into an organized, readable text transcript with timestamps.
     * Preserves time markers for each dialogue block while stripping numeric cue clutter and HTML tags.
     */
    static convertSubtitlesToTimedText(rawContent) {
        if (!rawContent || !rawContent.trim())
            return '';
        const normalized = rawContent.normalize('NFKC').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = normalized.split('\n');
        const cues = [];
        let currentTime = '';
        let currentTextLines = [];
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (!line) {
                if (currentTime && currentTextLines.length > 0) {
                    const textBlock = currentTextLines.join(' ').trim();
                    if (textBlock) {
                        cues.push(`[${currentTime}]\n${textBlock}`);
                    }
                    currentTime = '';
                    currentTextLines = [];
                }
                continue;
            }
            // Skip WebVTT header
            if (/^(WEBVTT|Kind:|Language:|NOTE|STYLE|REGION)/i.test(line))
                continue;
            // Skip numeric cue index
            if (/^\d+$/.test(line))
                continue;
            // Timestamp line: 00:00:01,000 --> 00:00:04,500
            const timeMatch = line.match(/(\d{1,2}:\d{2}(?::\d{2})?(?:[,\.]\d{1,3})?)\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[,\.]\d{1,3})?)/);
            if (timeMatch) {
                if (currentTime && currentTextLines.length > 0) {
                    const textBlock = currentTextLines.join(' ').trim();
                    if (textBlock) {
                        cues.push(`[${currentTime}]\n${textBlock}`);
                    }
                }
                currentTime = `${timeMatch[1]} --> ${timeMatch[2]}`;
                currentTextLines = [];
                continue;
            }
            // Clean HTML tags and decode entities
            line = line.replace(/<[^>]+>/g, '');
            line = line
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&nbsp;/g, ' ')
                .trim();
            if (line) {
                if (currentTextLines.length === 0 || currentTextLines[currentTextLines.length - 1] !== line) {
                    currentTextLines.push(line);
                }
            }
        }
        if (currentTime && currentTextLines.length > 0) {
            const textBlock = currentTextLines.join(' ').trim();
            if (textBlock) {
                cues.push(`[${currentTime}]\n${textBlock}`);
            }
        }
        return cues.join('\n\n').trim();
    }
    static downloadMedia(url, outputPath, formatId, audioOnly, downloadSubtitles = true, subtitleLanguages, onProgress) {
        let childProcess;
        let isCancelled = false;
        const promise = new Promise((resolve, reject) => {
            // Use template format for yt-dlp to allow extension matching
            const parsedPath = path.parse(outputPath);
            const outputTemplate = path.join(parsedPath.dir, `${parsedPath.name}.%(ext)s`);
            const execInfo = getYtDlpExecution();
            const hasFfmpeg = isFfmpegAvailable();
            const args = [
                ...execInfo.baseArgs,
                '--newline',
                '--no-playlist',
                '--no-warnings',
                '--continue', // Resume partially downloaded files
                '--extractor-args', 'youtube:player_client=android,web',
                '-N', '8', // 8 parallel fragment streams
                '-i', // Ignore download errors on non-essential components
                '--http-chunk-size', '10M', // 10MB chunking bypasses YouTube bandwidth throttle
                '--buffer-size', '1024K', // 1MB disk write buffer
                '--socket-timeout', '15',
                '--retries', '8',
                '--fragment-retries', '8',
                '-o', outputTemplate,
            ];
            if (downloadSubtitles) {
                // Limit to max 3 specific language codes to prevent YouTube HTTP 429 rate limits
                const sanitizedLangs = (subtitleLanguages && subtitleLanguages.length > 0
                    ? subtitleLanguages.slice(0, 3)
                    : ['en', 'ar'])
                    .map((l) => l.trim().toLowerCase())
                    .filter(Boolean);
                const langParam = sanitizedLangs.length > 0 ? sanitizedLangs.join(',') : 'en,ar';
                args.push('--write-subs', '--write-auto-subs', '--sub-lang', langParam, '--sub-format', 'srt/vtt/best', '--sleep-subtitles', '1', '--no-abort-on-error');
                if (hasFfmpeg) {
                    args.push('--convert-subs', 'srt');
                }
            }
            if (audioOnly) {
                if (hasFfmpeg) {
                    args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0');
                }
                else {
                    args.push('-f', 'bestaudio[ext=m4a]/bestaudio/best');
                }
            }
            else {
                if (hasFfmpeg) {
                    args.push('--merge-output-format', 'mp4');
                    if (formatId) {
                        let resolvedFormat = formatId;
                        // Map user-friendly quality aliases across playlists and single downloads
                        if (formatId === '1080p' || formatId === 'high') {
                            resolvedFormat = 'bestvideo[height<=1080]+bestaudio/best[height<=1080]';
                        }
                        else if (formatId === '720p' || formatId === 'medium') {
                            resolvedFormat = 'bestvideo[height<=720]+bestaudio/best[height<=720]';
                        }
                        else if (formatId === '480p' || formatId === 'low') {
                            resolvedFormat = 'bestvideo[height<=480]+bestaudio/best[height<=480]';
                        }
                        else if (formatId === '360p') {
                            resolvedFormat = 'bestvideo[height<=360]+bestaudio/best[height<=360]';
                        }
                        else if (formatId === 'best' || formatId === '4k') {
                            resolvedFormat = 'bestvideo+bestaudio/best';
                        }
                        if (resolvedFormat.includes('+') || resolvedFormat.includes('best') || resolvedFormat.includes('[')) {
                            args.push('-f', resolvedFormat);
                        }
                        else {
                            // Guarantee audio track: prefer AAC M4A for universal player compatibility
                            args.push('-f', `${resolvedFormat}+bestaudio[ext=m4a]/bestaudio/best`);
                        }
                    }
                    else {
                        // Best video + best audio muxed into mp4 (highest resolution available: 4K, 1440p, 1080p)
                        args.push('-f', 'bestvideo+bestaudio/best');
                    }
                }
                else {
                    // Fallback when FFmpeg is not installed: choose pre-muxed single progressive stream containing both audio & video
                    if (formatId === '720p' || formatId === 'medium') {
                        args.push('-f', 'best[height<=720][ext=mp4]/best[height<=720]/best[ext=mp4]/best');
                    }
                    else if (formatId === '480p' || formatId === 'low' || formatId === '360p') {
                        args.push('-f', 'best[height<=480][ext=mp4]/best[height<=480]/best[ext=mp4]/best');
                    }
                    else {
                        args.push('-f', 'best[ext=mp4]/best');
                    }
                }
            }
            args.push(url);
            childProcess = spawn(execInfo.command, args, { windowsHide: true });
            let lastError = '';
            let lastProgressTime = 0;
            childProcess.stdout.on('data', (data) => {
                const line = data.toString().trim();
                // Parse [download]  45.3% of 120.50MiB at 15.20MiB/s ETA 00:04
                if (line.includes('[download]') && line.includes('%')) {
                    const now = Date.now();
                    // Throttle progress events to at most once per 200ms
                    if (now - lastProgressTime < 200 && !line.includes('100%')) {
                        return;
                    }
                    lastProgressTime = now;
                    const pctMatch = line.match(/(\d+\.?\d*)%/);
                    const speedMatch = line.match(/at\s+([\d\.]+)(\w+)\/s/);
                    const etaMatch = line.match(/ETA\s+(\d+):(\d+)/);
                    let progress = 0;
                    if (pctMatch)
                        progress = parseFloat(pctMatch[1]);
                    let speed = 0;
                    if (speedMatch) {
                        const val = parseFloat(speedMatch[1]);
                        const unit = speedMatch[2].toUpperCase();
                        if (unit.includes('M'))
                            speed = val * 1024 * 1024;
                        else if (unit.includes('K'))
                            speed = val * 1024;
                        else if (unit.includes('G'))
                            speed = val * 1024 * 1024 * 1024;
                    }
                    let eta = 0;
                    if (etaMatch) {
                        eta = parseInt(etaMatch[1], 10) * 60 + parseInt(etaMatch[2], 10);
                    }
                    onProgress?.({ progress, speed, eta, line });
                }
            });
            childProcess.stderr.on('data', (data) => {
                lastError += data.toString();
            });
            childProcess.on('close', (code) => {
                if (isCancelled) {
                    return reject(new Error('CANCELED_OR_PAUSED'));
                }
                // Check if media file was actually downloaded on disk even if non-critical subtitle error exited code 1
                const checkMediaExists = () => {
                    const targetExt = audioOnly ? '.mp3' : '.mp4';
                    const candidates = [
                        outputPath,
                        path.join(parsedPath.dir, `${parsedPath.name}${targetExt}`),
                        path.join(parsedPath.dir, `${parsedPath.name}.mkv`),
                        path.join(parsedPath.dir, `${parsedPath.name}.webm`),
                    ];
                    for (const cand of candidates) {
                        try {
                            if (fs.existsSync(cand) && fs.statSync(cand).size > 1024) {
                                return cand;
                            }
                        }
                        catch { }
                    }
                    return null;
                };
                const existingMediaFile = checkMediaExists();
                // Fail-safe: if media download failed because subtitle extraction failed (e.g. 429 Too Many Requests),
                // automatically retry downloading the media file WITHOUT subtitles so video download NEVER stops!
                if (code !== 0 && !existingMediaFile && downloadSubtitles) {
                    const isSubError = /subtitles|429|Too Many Requests/i.test(lastError);
                    if (isSubError) {
                        console.warn('Subtitle extraction failed/rate-limited. Seamlessly retrying media download without subtitles...');
                        const retryInstance = MediaGrabber.downloadMedia(url, outputPath, formatId, audioOnly, false, // Disable subtitles on retry
                        undefined, onProgress);
                        childProcess = null;
                        retryInstance.promise.then(resolve).catch(reject);
                        return;
                    }
                }
                if (code === 0 || existingMediaFile) {
                    const finalOutputPath = existingMediaFile || outputPath;
                    let subtitlesTxtPath;
                    let subtitlesTimestampsPath;
                    let subtitlesSrtPath;
                    let subDirResolved;
                    if (downloadSubtitles) {
                        try {
                            const dir = parsedPath.dir;
                            const subDir = path.join(dir, `${parsedPath.name} [Subtitles]`);
                            if (fs.existsSync(dir)) {
                                const files = fs.readdirSync(dir);
                                const subFiles = files.filter((f) => f.startsWith(parsedPath.name) && (f.endsWith('.srt') || f.endsWith('.vtt')));
                                if (subFiles.length > 0) {
                                    // Prefer .srt over .vtt for each language, deleting redundant .vtt
                                    const preferredFiles = new Map();
                                    for (const subFile of subFiles) {
                                        const matchLang = subFile.slice(parsedPath.name.length).match(/^\.([a-zA-Z-]+)\.(srt|vtt)$/);
                                        const lang = matchLang ? matchLang[1].toLowerCase() : 'default';
                                        const isSrt = subFile.endsWith('.srt');
                                        if (!preferredFiles.has(lang) || isSrt) {
                                            const prevFile = preferredFiles.get(lang);
                                            if (prevFile && prevFile.endsWith('.vtt') && isSrt) {
                                                try {
                                                    fs.unlinkSync(path.join(dir, prevFile));
                                                }
                                                catch { }
                                            }
                                            preferredFiles.set(lang, subFile);
                                        }
                                        else {
                                            try {
                                                fs.unlinkSync(path.join(dir, subFile));
                                            }
                                            catch { }
                                        }
                                    }
                                    const uniqueSubFiles = Array.from(preferredFiles.values());
                                    if (uniqueSubFiles.length > 0) {
                                        if (!fs.existsSync(subDir)) {
                                            fs.mkdirSync(subDir, { recursive: true });
                                        }
                                        subDirResolved = subDir;
                                        const singleLang = uniqueSubFiles.length === 1;
                                        for (const subFile of uniqueSubFiles) {
                                            const subFullPath = path.join(dir, subFile);
                                            if (!fs.existsSync(subFullPath))
                                                continue;
                                            const rawSub = fs.readFileSync(subFullPath, 'utf-8');
                                            const cleanTxt = MediaGrabber.cleanSubtitlesToText(rawSub);
                                            const timedTxt = MediaGrabber.convertSubtitlesToTimedText(rawSub);
                                            const matchLang = subFile.slice(parsedPath.name.length).match(/^\.([a-zA-Z-]+)\.(srt|vtt)$/);
                                            const langCode = matchLang ? matchLang[1] : '';
                                            // Exactly ONE .srt, ONE .timestamps.txt, and ONE .txt per language (NO duplicates)
                                            const baseOutput = singleLang || !langCode
                                                ? parsedPath.name
                                                : `${parsedPath.name}.${langCode}`;
                                            // 1. Move and keep original untouched .srt
                                            const targetSubPath = path.join(subDir, `${baseOutput}.srt`);
                                            try {
                                                fs.renameSync(subFullPath, targetSubPath);
                                            }
                                            catch {
                                                fs.copyFileSync(subFullPath, targetSubPath);
                                                try {
                                                    fs.unlinkSync(subFullPath);
                                                }
                                                catch { }
                                            }
                                            if (!subtitlesSrtPath)
                                                subtitlesSrtPath = targetSubPath;
                                            // 2. Timed transcript WITH timestamps (only 1 file)
                                            if (timedTxt) {
                                                const timedFullPath = path.join(subDir, `${baseOutput}.timestamps.txt`);
                                                fs.writeFileSync(timedFullPath, timedTxt, 'utf-8');
                                                if (!subtitlesTimestampsPath)
                                                    subtitlesTimestampsPath = timedFullPath;
                                            }
                                            // 3. Clean transcript WITHOUT timestamps (only 1 file)
                                            if (cleanTxt) {
                                                const txtFullPath = path.join(subDir, `${baseOutput}.txt`);
                                                fs.writeFileSync(txtFullPath, cleanTxt, 'utf-8');
                                                if (!subtitlesTxtPath)
                                                    subtitlesTxtPath = txtFullPath;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        catch (subErr) {
                            console.error('Failed to post-process subtitles in subfolder:', subErr);
                        }
                    }
                    resolve({
                        filePath: finalOutputPath,
                        subtitlesTxtPath,
                        subtitlesTimestampsPath,
                        subtitlesSrtPath,
                        subtitlesDir: subDirResolved,
                    });
                }
                else {
                    reject(new Error(cleanYtDlpError(lastError) || `Process exited with code ${code}`));
                }
            });
            childProcess.on('error', (err) => {
                if (isCancelled) {
                    return reject(new Error('CANCELED_OR_PAUSED'));
                }
                reject(err);
            });
        });
        return {
            cancel: () => {
                isCancelled = true;
                if (childProcess) {
                    try {
                        if (process.platform === 'win32' && childProcess.pid) {
                            spawn('taskkill', ['/pid', childProcess.pid.toString(), '/f', '/t'], { windowsHide: true });
                        }
                        else {
                            childProcess.kill('SIGTERM');
                        }
                    }
                    catch (e) { }
                }
            },
            promise,
        };
    }
}
