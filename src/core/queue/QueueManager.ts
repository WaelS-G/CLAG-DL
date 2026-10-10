import fs from 'fs';
import path from 'path';
import { DownloadTaskData, DownloadStatus } from '../../types/index.js';
import { ChunkDownloader } from '../engine/ChunkDownloader.js';
import { MediaGrabber } from '../media/MediaGrabber.js';
import { LinkResolver } from '../resolver/LinkResolver.js';
import { ConfigStore } from '../storage/ConfigStore.js';
import { HistoryStore } from '../storage/HistoryStore.js';

export type QueueEventCallback = (type: string, data: any) => void;

export class QueueManager {
  private static instance: QueueManager;
  private activeDownloaders: Map<string, { downloader?: ChunkDownloader; mediaCancel?: () => void }> = new Map();
  private eventListeners: QueueEventCallback[] = [];

  private constructor() {}

  public static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  public onEvent(callback: QueueEventCallback): void {
    this.eventListeners.push(callback);
  }

  private emit(type: string, data: any): void {
    for (const listener of this.eventListeners) {
      try {
        listener(type, data);
      } catch (e) {
        console.error('Queue event listener error:', e);
      }
    }
  }

  public async addTask(params: {
    url: string;
    originalUrl?: string;
    filename?: string;
    savePath?: string;
    connections?: number;
    headers?: Record<string, string>;
    isMediaStream?: boolean;
    mediaFormatId?: string;
    qualityLabel?: string;
    audioOnly?: boolean;
    thumbnail?: string;
    autoStart?: boolean;
    downloadSubtitles?: boolean;
    subtitleLanguages?: string[];
  }): Promise<DownloadTaskData> {
    const config = ConfigStore.getInstance().getSettings();
    const history = HistoryStore.getInstance();

    const targetUrl = LinkResolver.canonicalizeMediaUrl(params.url, params.originalUrl);
    const isMedia = params.isMediaStream ?? LinkResolver.isMediaHost(targetUrl);
    const rawFilename = params.filename || LinkResolver.extractFilenameFromUrl(targetUrl);

    // Audio vs video category
    const isAudio = !!params.audioOnly;
    let category = isAudio ? 'audio' : LinkResolver.detectCategory(targetUrl, rawFilename);
    if (isAudio) category = 'audio';

    let cleanFilename = LinkResolver.sanitizeFilename(rawFilename);
    if (isAudio && !cleanFilename.toLowerCase().endsWith('.mp3')) {
      cleanFilename = cleanFilename.replace(/\.[a-z0-9]+$/i, '') + '.mp3';
    }

    let categorySubfolder = '';
    switch (category) {
      case 'video': categorySubfolder = 'Videos'; break;
      case 'audio': categorySubfolder = 'Audio'; break;
      case 'compressed': categorySubfolder = 'Compressed'; break;
      case 'program': categorySubfolder = 'Programs'; break;
      case 'document': categorySubfolder = 'Documents'; break;
      case 'image': categorySubfolder = 'Images'; break;
      default: categorySubfolder = ''; break;
    }

    const baseDir = params.savePath ? path.dirname(params.savePath) : config.downloadDir;
    const finalDir = categorySubfolder ? path.join(baseDir, categorySubfolder) : baseDir;

    // Ensure output folder exists
    try {
      if (!fs.existsSync(finalDir)) {
        fs.mkdirSync(finalDir, { recursive: true });
      }
    } catch (e) {}

    // Auto-disambiguate filename if a file with same name already exists in target folder
    let finalSavePath = params.savePath || path.join(finalDir, cleanFilename);
    if (!params.savePath && fs.existsSync(finalSavePath)) {
      const ext = path.extname(cleanFilename);
      const base = path.basename(cleanFilename, ext);
      const qTag = params.qualityLabel ? params.qualityLabel.replace(/[^\w\d]/g, '_').replace(/_+/g, '_').trim() : '';

      if (qTag && !base.includes(qTag)) {
        const candidate = path.join(finalDir, `${base} [${qTag}]${ext}`);
        if (!fs.existsSync(candidate)) {
          finalSavePath = candidate;
          cleanFilename = path.basename(candidate);
        }
      }

      if (fs.existsSync(finalSavePath)) {
        let counter = 1;
        while (true) {
          const candidate = path.join(finalDir, `${base} (${counter})${ext}`);
          if (!fs.existsSync(candidate)) {
            finalSavePath = candidate;
            cleanFilename = path.basename(candidate);
            break;
          }
          counter++;
        }
      }
    }

    const sourceInfo = LinkResolver.detectSource(params.originalUrl || targetUrl);

    const task: DownloadTaskData = {
      id: 'clag_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      url: targetUrl,
      originalUrl: params.originalUrl || params.url,
      filename: cleanFilename,
      savePath: finalSavePath,
      totalBytes: 0,
      downloadedBytes: 0,
      speed: 0,
      status: 'queued',
      category,
      progress: 0,
      eta: 0,
      connections: params.connections || config.defaultConnections,
      chunks: [],
      createdAt: Date.now(),
      headers: params.headers,
      isMediaStream: isMedia,
      mediaFormat: params.mediaFormatId,
      qualityLabel: params.qualityLabel || (isAudio ? 'MP3 Audio' : undefined),
      source: sourceInfo.name,
      audioOnly: isAudio,
      thumbnail: params.thumbnail,
      downloadSubtitles: params.downloadSubtitles ?? (config.downloadSubtitles ?? true),
      subtitleLanguages: params.subtitleLanguages || config.subtitleLanguages || ['en', 'ar'],
    };

    history.setTask(task);
    this.emit('DOWNLOAD_CREATED', task);

    const shouldStart = params.autoStart ?? config.autoStartDownloads;
    if (shouldStart) {
      this.checkQueue();
    }

    return task;
  }

  public checkQueue(): void {
    const config = ConfigStore.getInstance().getSettings();
    const history = HistoryStore.getInstance();
    const allTasks = history.getAllTasks();

    const activeCount = Array.from(this.activeDownloaders.keys()).length;
    const slotsAvailable = config.maxConcurrentDownloads - activeCount;

    if (slotsAvailable <= 0) return;

    const queuedTasks = allTasks.filter(t => t.status === 'queued');
    for (let i = 0; i < Math.min(slotsAvailable, queuedTasks.length); i++) {
      this.startTask(queuedTasks[i].id);
    }
  }

  public async startTask(taskId: string): Promise<void> {
    const config = ConfigStore.getInstance().getSettings();
    const history = HistoryStore.getInstance();
    const task = history.getTask(taskId);
    if (!task) return;

    if (this.activeDownloaders.has(taskId)) return; // Already active

    task.status = 'downloading';
    history.setTask(task);
    this.emit('DOWNLOAD_STATUS_CHANGED', { id: task.id, status: task.status });

    if (task.isMediaStream) {
      // Use yt-dlp + ffmpeg media engine
      const isAudio = !!(task.audioOnly || task.category === 'audio');
      const downloadSubs = task.downloadSubtitles ?? true;
      const subLangs = task.subtitleLanguages || config.subtitleLanguages || ['en', 'ar'];

      const { cancel, promise } = MediaGrabber.downloadMedia(
        task.url,
        task.savePath,
        task.mediaFormat,
        isAudio,
        downloadSubs,
        subLangs,
        (prog) => {
          task.progress = prog.progress;
          task.speed = prog.speed;
          task.eta = prog.eta;
          history.setTask(task, false);
          this.emit('DOWNLOAD_PROGRESS', {
            id: task.id,
            downloadedBytes: task.downloadedBytes,
            speed: task.speed,
            progress: task.progress,
            eta: task.eta,
            chunks: [],
          });
        }
      );

      this.activeDownloaders.set(task.id, { mediaCancel: cancel });

      promise.then((result) => {
        const currentTask = history.getTask(task.id);
        if (!currentTask || currentTask.status === 'paused') {
          this.activeDownloaders.delete(task.id);
          return;
        }

        const finalPath = typeof result === 'string' ? result : result.filePath;
        if (typeof result === 'object') {
          if (result.subtitlesTxtPath && fs.existsSync(result.subtitlesTxtPath)) {
            task.subtitlesTextPath = result.subtitlesTxtPath;
            task.hasSubtitles = true;
          }
          if (result.subtitlesTimestampsPath && fs.existsSync(result.subtitlesTimestampsPath)) {
            task.subtitlesTimestampsPath = result.subtitlesTimestampsPath;
            task.hasSubtitles = true;
          }
          if (result.subtitlesSrtPath && fs.existsSync(result.subtitlesSrtPath)) {
            task.subtitlesPath = result.subtitlesSrtPath;
            task.hasSubtitles = true;
          }
          if (result.subtitlesDir && fs.existsSync(result.subtitlesDir)) {
            task.subtitlesDir = result.subtitlesDir;
          }
        }

        // Retrieve actual file size and path on disk if available (ensuring it is a FILE, not directory)
        try {
          let actualPath: string | null = null;
          if (finalPath && fs.existsSync(finalPath) && fs.statSync(finalPath).isFile()) {
            actualPath = finalPath;
          } else if (fs.existsSync(task.savePath) && fs.statSync(task.savePath).isFile()) {
            actualPath = task.savePath;
          } else {
            // Check for candidate file with media extensions (.mp4, .mp3, etc.)
            const dir = path.dirname(task.savePath);
            const base = path.basename(task.savePath, path.extname(task.savePath));
            for (const ext of ['.mp4', '.mp3', '.mkv', '.webm']) {
              const cand = path.join(dir, `${base}${ext}`);
              if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
                actualPath = cand;
                break;
              }
            }
          }

          if (actualPath) {
            const stat = fs.statSync(actualPath);
            task.totalBytes = stat.size;
            task.downloadedBytes = stat.size;
            task.savePath = actualPath;
            task.filename = path.basename(actualPath);
          }

          // Scan for generated subtitle .txt files in dedicated subfolder or alongside
          const parsed = path.parse(task.savePath);
          const subDir = task.subtitlesDir || path.join(parsed.dir, `${parsed.name} [Subtitles]`);
          if (fs.existsSync(subDir)) {
            const subFiles = fs.readdirSync(subDir);
            const txtFiles = subFiles.filter(f => f.endsWith('.txt') && !f.includes('timestamps'));
            const timedFiles = subFiles.filter(f => f.includes('timestamps'));
            if (txtFiles.length > 0) {
              task.subtitlesTextPath = path.join(subDir, txtFiles[0]);
              task.hasSubtitles = true;
            }
            if (timedFiles.length > 0) {
              task.subtitlesTimestampsPath = path.join(subDir, timedFiles[0]);
              task.hasSubtitles = true;
            }
            task.subtitlesPath = subDir;
          }
        } catch (e) {}

        task.status = 'completed';
        task.progress = 100;
        task.speed = 0;
        task.completedAt = Date.now();
        this.activeDownloaders.delete(task.id);
        history.setTask(task, true);
        this.emit('DOWNLOAD_STATUS_CHANGED', { id: task.id, status: 'completed' });
        this.checkQueue();
      }).catch((err) => {
        const currentTask = history.getTask(task.id);
        this.activeDownloaders.delete(task.id);
        // If task was paused or canceled intentionally, suppress error
        if (err?.message === 'CANCELED_OR_PAUSED' || (currentTask && currentTask.status === 'paused')) {
          return;
        }
        task.status = 'error';
        task.error = err?.message || 'Media download error';
        task.speed = 0;
        history.setTask(task, true);
        this.emit('DOWNLOAD_STATUS_CHANGED', { id: task.id, status: 'error', error: task.error });
        this.checkQueue();
      });

    } else {
      // Use multi-threaded HTTP Range chunk engine
      const downloader = new ChunkDownloader(task, {
        onProgress: (t) => {
          history.setTask(t, false);
          this.emit('DOWNLOAD_PROGRESS', {
            id: t.id,
            downloadedBytes: t.downloadedBytes,
            speed: t.speed,
            progress: t.progress,
            eta: t.eta,
            chunks: t.chunks,
          });
        },
        onStatusChange: (t) => {
          history.setTask(t, true);
          this.emit('DOWNLOAD_STATUS_CHANGED', { id: t.id, status: t.status, error: t.error });
        },
        onComplete: (t) => {
          this.activeDownloaders.delete(t.id);
          history.setTask(t, true);
          this.emit('DOWNLOAD_STATUS_CHANGED', { id: t.id, status: 'completed' });
          this.checkQueue();
        },
        onError: (t, err) => {
          this.activeDownloaders.delete(t.id);
          history.setTask(t, true);
          this.emit('DOWNLOAD_STATUS_CHANGED', { id: t.id, status: 'error', error: err });
          this.checkQueue();
        },
      });

      this.activeDownloaders.set(task.id, { downloader });
      downloader.start();
    }
  }

  public pauseTask(taskId: string): void {
    const history = HistoryStore.getInstance();
    const task = history.getTask(taskId);
    if (!task) return;

    task.status = 'paused';
    task.speed = 0;
    history.setTask(task, true);

    const active = this.activeDownloaders.get(taskId);
    if (active) {
      this.activeDownloaders.delete(taskId);
      if (active.downloader) active.downloader.pause();
      if (active.mediaCancel) active.mediaCancel();
    }

    this.emit('DOWNLOAD_STATUS_CHANGED', { id: task.id, status: 'paused' });
    this.checkQueue();
  }

  public resumeTask(taskId: string): void {
    const history = HistoryStore.getInstance();
    const task = history.getTask(taskId);
    if (!task) return;

    task.status = 'queued';
    history.setTask(task);
    this.emit('DOWNLOAD_STATUS_CHANGED', { id: task.id, status: 'queued' });
    this.checkQueue();
  }

  public cancelTask(taskId: string): void {
    this.pauseTask(taskId);
  }

  public deleteTask(taskId: string): void {
    this.pauseTask(taskId);
    HistoryStore.getInstance().deleteTask(taskId);
    this.emit('DOWNLOAD_DELETED', { id: taskId });
    this.checkQueue();
  }
}
