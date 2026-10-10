import { WebSocketServer, WebSocket } from 'ws';
import { QueueManager } from '../core/queue/QueueManager.js';
import { HistoryStore } from '../core/storage/HistoryStore.js';
export class WebSocketManager {
    wss;
    clients = new Set();
    constructor(server) {
        this.wss = new WebSocketServer({ server, path: '/ws' });
        this.setup();
    }
    setup() {
        this.wss.on('connection', (ws) => {
            this.clients.add(ws);
            // Send initial history
            const tasks = HistoryStore.getInstance().getAllTasks();
            for (const t of tasks) {
                this.send(ws, { type: 'DOWNLOAD_CREATED', task: t });
            }
            ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    this.handleClientMessage(msg);
                }
                catch (e) {
                    console.error('Invalid WS message received', e);
                }
            });
            ws.on('close', () => {
                this.clients.delete(ws);
            });
            ws.on('error', () => {
                this.clients.delete(ws);
            });
        });
        // Wire up QueueManager events
        const queue = QueueManager.getInstance();
        queue.onEvent((type, data) => {
            switch (type) {
                case 'DOWNLOAD_CREATED':
                    this.broadcast({ type: 'DOWNLOAD_CREATED', task: data });
                    break;
                case 'DOWNLOAD_PROGRESS':
                    this.broadcast({
                        type: 'DOWNLOAD_PROGRESS',
                        id: data.id,
                        downloadedBytes: data.downloadedBytes,
                        speed: data.speed,
                        progress: data.progress,
                        eta: data.eta,
                        chunks: data.chunks || [],
                    });
                    break;
                case 'DOWNLOAD_STATUS_CHANGED':
                    this.broadcast({
                        type: 'DOWNLOAD_STATUS_CHANGED',
                        id: data.id,
                        status: data.status,
                        error: data.error,
                    });
                    break;
                case 'DOWNLOAD_DELETED':
                    this.broadcast({ type: 'DOWNLOAD_DELETED', id: data.id });
                    break;
            }
        });
    }
    handleClientMessage(msg) {
        const queue = QueueManager.getInstance();
        switch (msg.type) {
            case 'PAUSE_DOWNLOAD':
                queue.pauseTask(msg.id);
                break;
            case 'RESUME_DOWNLOAD':
                queue.resumeTask(msg.id);
                break;
            case 'CANCEL_DOWNLOAD':
                queue.cancelTask(msg.id);
                break;
            case 'RETRY_DOWNLOAD':
                queue.resumeTask(msg.id);
                break;
            case 'DELETE_DOWNLOAD':
                queue.deleteTask(msg.id);
                break;
        }
    }
    broadcast(msg) {
        const raw = JSON.stringify(msg);
        for (const ws of this.clients) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(raw);
            }
        }
    }
    send(ws, msg) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
        }
    }
}
