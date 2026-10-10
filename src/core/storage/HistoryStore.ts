import fs from 'fs';
import path from 'path';
import { DownloadTaskData } from '../../types/index.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'clag_history.json');
const LEGACY_HISTORY_FILE = path.join(process.cwd(), 'clag_history.json');

export class HistoryStore {
  private static instance: HistoryStore;
  private tasks: Map<string, DownloadTaskData> = new Map();
  private saveDebounceTimer: NodeJS.Timeout | null = null;
  private isSaving = false;
  private hasPendingSave = false;

  private constructor() {
    this.load();
    // Flush on process exit
    process.on('beforeExit', () => this.flushSync());
  }

  public static getInstance(): HistoryStore {
    if (!HistoryStore.instance) {
      HistoryStore.instance = new HistoryStore();
    }
    return HistoryStore.instance;
  }

  private load(): void {
    try {
      if (!fs.existsSync(HISTORY_FILE) && fs.existsSync(LEGACY_HISTORY_FILE)) {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        try {
          fs.copyFileSync(LEGACY_HISTORY_FILE, HISTORY_FILE);
          fs.unlinkSync(LEGACY_HISTORY_FILE);
        } catch {}
      }

      if (fs.existsSync(HISTORY_FILE)) {
        const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
        const list: DownloadTaskData[] = JSON.parse(raw);
        for (const t of list) {
          // If task was downloading when process died, mark as paused
          if (t.status === 'downloading' || t.status === 'fetching_meta') {
            t.status = 'paused';
          }
          this.tasks.set(t.id, t);
        }
      }
    } catch (e) {
      console.error('Failed to load history store', e);
    }
  }

  public save(immediate = false): void {
    if (immediate) {
      this.flushSync();
      return;
    }

    if (this.saveDebounceTimer) return;

    this.saveDebounceTimer = setTimeout(async () => {
      this.saveDebounceTimer = null;
      await this.saveAsync();
    }, 2500);
  }

  private async saveAsync(): Promise<void> {
    if (this.isSaving) {
      this.hasPendingSave = true;
      return;
    }
    this.isSaving = true;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        await fs.promises.mkdir(DATA_DIR, { recursive: true });
      }
      const list = Array.from(this.tasks.values());
      await fs.promises.writeFile(HISTORY_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save history store asynchronously', e);
    } finally {
      this.isSaving = false;
      if (this.hasPendingSave) {
        this.hasPendingSave = false;
        this.save();
      }
    }
  }

  public flushSync(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const list = Array.from(this.tasks.values());
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to flush history store', e);
    }
  }

  public getTask(id: string): DownloadTaskData | undefined {
    return this.tasks.get(id);
  }

  public getAllTasks(): DownloadTaskData[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public setTask(task: DownloadTaskData, immediate = false): void {
    this.tasks.set(task.id, task);
    this.save(immediate);
  }

  public deleteTask(id: string): void {
    this.tasks.delete(id);
    this.save(true);
  }
}
