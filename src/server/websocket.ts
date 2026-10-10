import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { QueueManager } from '../core/queue/QueueManager.js';
import { HistoryStore } from '../core/storage/HistoryStore.js';
import { WSServerMessage, WSClientMessage } from '../types/index.js';

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  constructor(server: http.Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.setup();
  }

  private setup(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);

      // Send initial history
      const tasks = HistoryStore.getInstance().getAllTasks();
      for (const t of tasks) {
        this.send(ws, { type: 'DOWNLOAD_CREATED', task: t });
      }

      ws.on('message', (data: string) => {
        try {
          const msg = JSON.parse(data.toString()) as WSClientMessage;
          this.handleClientMessage(msg);
        } catch (e) {
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

  private handleClientMessage(msg: WSClientMessage): void {
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

  public broadcast(msg: WSServerMessage): void {
    const raw = JSON.stringify(msg);
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(raw);
      }
    }
  }

  public send(ws: WebSocket, msg: WSServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}
