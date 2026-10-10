import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import dns from 'dns';
import { URL } from 'url';
// Eliminate 10-15s IPv6 timeout on Windows dual-stack network interfaces
dns.setDefaultResultOrder('ipv4first');
// High-throughput HTTP & HTTPS Agents with connection reuse & IPv4 prioritization
const httpAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 60000,
    maxSockets: 64,
    maxFreeSockets: 64,
    timeout: 30000,
    family: 4,
});
const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 60000,
    maxSockets: 64,
    maxFreeSockets: 64,
    timeout: 30000,
    family: 4,
});
export class ChunkDownloader {
    task;
    events;
    activeStreams = [];
    speedCalcInterval = null;
    lastBytesDownloaded = 0;
    isPaused = false;
    isCancelled = false;
    constructor(task, events = {}) {
        this.task = task;
        this.events = events;
    }
    async start() {
        try {
            this.isPaused = false;
            this.isCancelled = false;
            this.task.status = 'fetching_meta';
            this.notifyStatus();
            // Ensure target directory exists
            const targetDir = path.dirname(this.task.savePath);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }
            // Check if session resume state exists (.clag.json)
            const partsDir = this.getPartsDirectory();
            const stateFile = path.join(partsDir, 'session.clag.json');
            if (fs.existsSync(stateFile)) {
                try {
                    const saved = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
                    this.task.totalBytes = saved.totalBytes || this.task.totalBytes;
                    this.task.chunks = saved.chunks || this.task.chunks;
                    this.task.connections = saved.connections || this.task.connections;
                }
                catch (e) { }
            }
            // Probe remote resource if total size is not known or URL not resolved
            if (!this.task.totalBytes || this.task.totalBytes <= 0) {
                const probe = await this.probeUrl(this.task.url, this.task.headers);
                if (probe.finalUrl) {
                    this.task.url = probe.finalUrl;
                }
                if (probe.contentLength > 0) {
                    this.task.totalBytes = probe.contentLength;
                }
                if (probe.filename && !this.task.filename) {
                    this.task.filename = probe.filename;
                    this.task.savePath = path.join(targetDir, probe.filename);
                }
                const supportsRange = probe.supportsRange && this.task.totalBytes > 0;
                const numConnections = supportsRange ? Math.max(1, Math.min(32, this.task.connections)) : 1;
                this.task.connections = numConnections;
            }
            if (!fs.existsSync(partsDir)) {
                fs.mkdirSync(partsDir, { recursive: true });
            }
            if (!this.task.chunks || this.task.chunks.length === 0) {
                this.initChunks(this.task.connections, this.task.totalBytes);
            }
            this.saveSessionState(stateFile);
            this.task.status = 'downloading';
            this.notifyStatus();
            // Start real-time speed & progress monitor
            this.startSpeedMonitor();
            // Launch parallel chunk streams
            const chunkPromises = this.task.chunks.map((chunk, idx) => this.downloadChunk(chunk, idx, partsDir, stateFile));
            await Promise.all(chunkPromises);
            if (this.isCancelled || this.isPaused) {
                return;
            }
            // Verify all chunks completed
            const allDone = this.task.chunks.every(c => c.status === 'completed');
            if (allDone) {
                this.task.status = 'merging';
                this.notifyStatus();
                await this.assembleParts(partsDir);
                this.task.status = 'completed';
                this.task.progress = 100;
                this.task.speed = 0;
                this.task.completedAt = Date.now();
                this.cleanupSpeedMonitor();
                this.notifyStatus();
                this.events.onComplete?.(this.task);
            }
        }
        catch (err) {
            if (this.isCancelled || this.isPaused)
                return;
            this.task.status = 'error';
            this.task.error = err.message || 'Download failed';
            this.cleanupSpeedMonitor();
            this.notifyStatus();
            this.events.onError?.(this.task, this.task.error || 'Download failed');
        }
    }
    saveSessionState(stateFile) {
        try {
            const state = {
                id: this.task.id,
                url: this.task.url,
                filename: this.task.filename,
                totalBytes: this.task.totalBytes,
                connections: this.task.connections,
                chunks: this.task.chunks,
                updatedAt: Date.now(),
            };
            fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf-8');
        }
        catch (e) { }
    }
    initChunks(connections, totalBytes) {
        const chunks = [];
        if (totalBytes <= 0 || connections <= 1) {
            chunks.push({
                index: 0,
                startByte: 0,
                endByte: totalBytes > 0 ? totalBytes - 1 : 0,
                downloadedBytes: 0,
                totalBytes: totalBytes > 0 ? totalBytes : 0,
                status: 'pending',
                speed: 0,
            });
        }
        else {
            const chunkSize = Math.ceil(totalBytes / connections);
            for (let i = 0; i < connections; i++) {
                const start = i * chunkSize;
                const end = i === connections - 1 ? totalBytes - 1 : Math.min(totalBytes - 1, (i + 1) * chunkSize - 1);
                chunks.push({
                    index: i,
                    startByte: start,
                    endByte: end,
                    downloadedBytes: 0,
                    totalBytes: end - start + 1,
                    status: 'pending',
                    speed: 0,
                });
            }
        }
        this.task.chunks = chunks;
    }
    downloadChunk(chunk, index, partsDir, stateFile) {
        return new Promise((resolve, reject) => {
            const partFilePath = path.join(partsDir, `part_${index}.clag`);
            let existingBytes = 0;
            if (fs.existsSync(partFilePath)) {
                existingBytes = fs.statSync(partFilePath).size;
                chunk.downloadedBytes = existingBytes;
            }
            if (chunk.totalBytes > 0 && existingBytes >= chunk.totalBytes) {
                chunk.status = 'completed';
                return resolve();
            }
            const reqStart = chunk.startByte + existingBytes;
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Encoding': 'identity',
                'Connection': 'keep-alive',
                ...this.task.headers,
            };
            if (this.task.connections > 1 || chunk.endByte > 0) {
                headers['Range'] = `bytes=${reqStart}-${chunk.endByte}`;
            }
            chunk.status = 'downloading';
            // 1MB disk buffer for high-throughput sequential writing
            const outStream = fs.createWriteStream(partFilePath, {
                flags: existingBytes > 0 ? 'a' : 'w',
                highWaterMark: 1024 * 1024,
            });
            const executeRequest = (targetUrl, redirectCount = 0) => {
                if (redirectCount > 5) {
                    outStream.close();
                    chunk.status = 'error';
                    return reject(new Error('Too many HTTP redirects'));
                }
                const parsedUrl = new URL(targetUrl);
                const isHttps = parsedUrl.protocol === 'https:';
                const client = isHttps ? https : http;
                const agent = isHttps ? httpsAgent : httpAgent;
                const req = client.get(targetUrl, {
                    headers,
                    agent,
                    timeout: 30000,
                }, (res) => {
                    // Handle HTTP redirects (301, 302, 303, 307, 308)
                    if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                        const nextUrl = new URL(res.headers.location, targetUrl).href;
                        res.resume(); // drain response
                        return executeRequest(nextUrl, redirectCount + 1);
                    }
                    if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 400)) {
                        outStream.close();
                        chunk.status = 'error';
                        return reject(new Error(`Server responded with HTTP ${res.statusCode}`));
                    }
                    // Disable Nagle's algorithm on socket for zero latency
                    if (res.socket) {
                        res.socket.setNoDelay(true);
                    }
                    res.on('data', (dataChunk) => {
                        if (this.isPaused || this.isCancelled) {
                            req.destroy();
                            outStream.close();
                            return;
                        }
                        chunk.downloadedBytes += dataChunk.length;
                        this.task.downloadedBytes += dataChunk.length;
                        // Handle backpressure properly
                        const canWrite = outStream.write(dataChunk);
                        if (!canWrite) {
                            res.pause();
                            outStream.once('drain', () => {
                                res.resume();
                            });
                        }
                    });
                    res.on('end', () => {
                        outStream.end(() => {
                            chunk.status = 'completed';
                            this.saveSessionState(stateFile);
                            resolve();
                        });
                    });
                    res.on('error', (err) => {
                        outStream.close();
                        chunk.status = 'error';
                        reject(err);
                    });
                });
                req.on('error', (err) => {
                    outStream.close();
                    chunk.status = 'error';
                    reject(err);
                });
                req.on('timeout', () => {
                    req.destroy(new Error('Connection timed out'));
                });
                this.activeStreams[index] = req;
            };
            executeRequest(this.task.url);
        });
    }
    async assembleParts(partsDir) {
        const tempFile = this.task.savePath + '.downloading';
        // 4MB write buffer for ultra-fast part assembly
        const writeStream = fs.createWriteStream(tempFile, { highWaterMark: 4 * 1024 * 1024 });
        for (let i = 0; i < this.task.chunks.length; i++) {
            const partFile = path.join(partsDir, `part_${i}.clag`);
            if (fs.existsSync(partFile)) {
                await new Promise((resolve, reject) => {
                    const readStream = fs.createReadStream(partFile, { highWaterMark: 4 * 1024 * 1024 });
                    readStream.pipe(writeStream, { end: false });
                    readStream.on('end', () => resolve());
                    readStream.on('error', (err) => reject(err));
                });
            }
        }
        await new Promise((resolve) => writeStream.end(resolve));
        if (fs.existsSync(this.task.savePath)) {
            fs.unlinkSync(this.task.savePath);
        }
        fs.renameSync(tempFile, this.task.savePath);
        // Clean up parts directory and session state
        try {
            fs.rmSync(partsDir, { recursive: true, force: true });
        }
        catch (e) { }
    }
    pause() {
        this.isPaused = true;
        this.task.status = 'paused';
        this.task.speed = 0;
        this.cleanupStreams();
        this.cleanupSpeedMonitor();
        this.notifyStatus();
    }
    cancel() {
        this.isCancelled = true;
        this.task.status = 'idle';
        this.task.speed = 0;
        this.cleanupStreams();
        this.cleanupSpeedMonitor();
        this.notifyStatus();
    }
    cleanupStreams() {
        for (const s of this.activeStreams) {
            try {
                s?.destroy();
            }
            catch (e) { }
        }
        this.activeStreams = [];
    }
    startSpeedMonitor() {
        this.lastBytesDownloaded = this.task.downloadedBytes;
        this.speedCalcInterval = setInterval(() => {
            const currentBytes = this.task.chunks.reduce((acc, c) => acc + c.downloadedBytes, 0);
            this.task.downloadedBytes = currentBytes;
            const bytesDiff = currentBytes - this.lastBytesDownloaded;
            this.lastBytesDownloaded = currentBytes;
            this.task.speed = Math.max(0, bytesDiff * 2);
            if (this.task.totalBytes > 0) {
                this.task.progress = Math.min(100, Number(((currentBytes / this.task.totalBytes) * 100).toFixed(1)));
                this.task.eta = this.task.speed > 0 ? Math.ceil((this.task.totalBytes - currentBytes) / this.task.speed) : 0;
            }
            this.events.onProgress?.(this.task);
        }, 500);
    }
    cleanupSpeedMonitor() {
        if (this.speedCalcInterval) {
            clearInterval(this.speedCalcInterval);
            this.speedCalcInterval = null;
        }
    }
    getPartsDirectory() {
        return this.task.savePath + `_${this.task.id}.clag_parts`;
    }
    notifyStatus() {
        this.events.onStatusChange?.(this.task);
    }
    probeUrl(initialUrl, headers) {
        return new Promise((resolve) => {
            const probeHeaders = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Encoding': 'identity',
                'Connection': 'keep-alive',
                ...headers,
            };
            const sendProbe = (url, redirectCount = 0) => {
                if (redirectCount > 5) {
                    return resolve({ contentLength: 0, supportsRange: false, finalUrl: url });
                }
                const parsed = new URL(url);
                const isHttps = parsed.protocol === 'https:';
                const client = isHttps ? https : http;
                const agent = isHttps ? httpsAgent : httpAgent;
                const req = client.request(url, {
                    method: 'HEAD',
                    headers: probeHeaders,
                    agent,
                    timeout: 10000,
                }, (res) => {
                    // Handle redirects
                    if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                        const nextUrl = new URL(res.headers.location, url).href;
                        res.resume();
                        return sendProbe(nextUrl, redirectCount + 1);
                    }
                    let contentLength = parseInt(res.headers['content-length'] || '0', 10);
                    const acceptRanges = res.headers['accept-ranges'] || '';
                    let supportsRange = acceptRanges.toLowerCase().includes('bytes');
                    let filename;
                    const disp = res.headers['content-disposition'];
                    if (disp && disp.includes('filename=')) {
                        const match = disp.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
                        if (match && match[1]) {
                            filename = decodeURIComponent(match[1].trim());
                        }
                    }
                    // If HEAD returned 200 but didn't advertise Accept-Ranges or length, verify with 1-byte GET probe
                    if (!supportsRange || contentLength <= 0) {
                        const getProbe = client.request(url, {
                            method: 'GET',
                            headers: { ...probeHeaders, 'Range': 'bytes=0-0' },
                            agent,
                            timeout: 10000,
                        }, (getRes) => {
                            if (getRes.statusCode === 206) {
                                supportsRange = true;
                                const cr = getRes.headers['content-range'] || '';
                                const match = cr.match(/\/(\d+)/);
                                if (match && match[1]) {
                                    contentLength = parseInt(match[1], 10);
                                }
                            }
                            getRes.resume();
                            resolve({ contentLength, supportsRange, filename, finalUrl: url });
                        });
                        getProbe.on('error', () => {
                            resolve({ contentLength, supportsRange, filename, finalUrl: url });
                        });
                        getProbe.setTimeout(8000, () => {
                            getProbe.destroy();
                            resolve({ contentLength, supportsRange, filename, finalUrl: url });
                        });
                        getProbe.end();
                        return;
                    }
                    resolve({ contentLength, supportsRange, filename, finalUrl: url });
                });
                req.on('error', () => {
                    // Fallback to 1-byte GET probe on HEAD failure
                    const getProbe = client.request(url, {
                        method: 'GET',
                        headers: { ...probeHeaders, 'Range': 'bytes=0-0' },
                        agent,
                        timeout: 10000,
                    }, (getRes) => {
                        let contentLength = 0;
                        let supportsRange = false;
                        if (getRes.statusCode === 206) {
                            supportsRange = true;
                            const cr = getRes.headers['content-range'] || '';
                            const match = cr.match(/\/(\d+)/);
                            if (match && match[1])
                                contentLength = parseInt(match[1], 10);
                        }
                        getRes.resume();
                        resolve({ contentLength, supportsRange, finalUrl: url });
                    });
                    getProbe.on('error', () => resolve({ contentLength: 0, supportsRange: false, finalUrl: url }));
                    getProbe.end();
                });
                req.setTimeout(8000, () => {
                    req.destroy();
                    resolve({ contentLength: 0, supportsRange: false, finalUrl: url });
                });
                req.end();
            };
            sendProbe(initialUrl);
        });
    }
}
