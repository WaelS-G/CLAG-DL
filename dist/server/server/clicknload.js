import http from 'http';
import { QueueManager } from '../core/queue/QueueManager.js';
import { LinkResolver } from '../core/resolver/LinkResolver.js';
export class ClickNLoadServer {
    server = null;
    port;
    constructor(port = 9666) {
        this.port = port;
    }
    start() {
        this.server = http.createServer((req, res) => {
            // Standard CORS headers for Click'n'Load cross-origin web requests
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }
            const url = req.url || '';
            // Standard Click'n'Load v2 endpoints
            if (url.includes('/flash/add') || url.includes('/flash/addcrypted2')) {
                let body = '';
                req.on('data', chunk => { body += chunk.toString(); });
                req.on('end', () => {
                    try {
                        const params = new URLSearchParams(body);
                        const urlsRaw = params.get('urls') || params.get('package') || '';
                        const urls = LinkResolver.parseBatchUrls(urlsRaw);
                        const queue = QueueManager.getInstance();
                        for (const u of urls) {
                            queue.addTask({ url: u });
                        }
                        res.writeHead(200, { 'Content-Type': 'text/plain' });
                        res.end('success\r\n');
                    }
                    catch (e) {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('failed\r\n');
                    }
                });
                return;
            }
            if (url.includes('/flash/') || url === '/crossdomain.xml') {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('JDownloader\r\n');
                return;
            }
            res.writeHead(404);
            res.end('Not found');
        });
        this.server.listen(this.port, '127.0.0.1', () => {
            console.log(`[Click'n'Load v2] Compatibility server listening on http://127.0.0.1:${this.port}`);
        });
        this.server.on('error', (err) => {
            console.warn(`[Click'n'Load] Could not bind port ${this.port} (may already be in use by JDownloader):`, err.message);
        });
    }
    stop() {
        this.server?.close();
    }
}
