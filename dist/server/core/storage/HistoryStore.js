import fs from 'fs';
import path from 'path';
const DATA_DIR = path.join(process.cwd(), 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'clag_history.json');
const LEGACY_HISTORY_FILE = path.join(process.cwd(), 'clag_history.json');
export class HistoryStore {
    static instance;
    tasks = new Map();
    saveDebounceTimer = null;
    isSaving = false;
    hasPendingSave = false;
    constructor() {
        this.load();
        // Flush on process exit
        process.on('beforeExit', () => this.flushSync());
    }
    static getInstance() {
        if (!HistoryStore.instance) {
            HistoryStore.instance = new HistoryStore();
        }
        return HistoryStore.instance;
    }
    load() {
        try {
            if (!fs.existsSync(HISTORY_FILE) && fs.existsSync(LEGACY_HISTORY_FILE)) {
                if (!fs.existsSync(DATA_DIR)) {
                    fs.mkdirSync(DATA_DIR, { recursive: true });
                }
                try {
                    fs.copyFileSync(LEGACY_HISTORY_FILE, HISTORY_FILE);
                    fs.unlinkSync(LEGACY_HISTORY_FILE);
                }
                catch { }
            }
            if (fs.existsSync(HISTORY_FILE)) {
                const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
                const list = JSON.parse(raw);
                for (const t of list) {
                    // If task was downloading when process died, mark as paused
                    if (t.status === 'downloading' || t.status === 'fetching_meta') {
                        t.status = 'paused';
                    }
                    this.tasks.set(t.id, t);
                }
            }
        }
        catch (e) {
            console.error('Failed to load history store', e);
        }
    }
    save(immediate = false) {
        if (immediate) {
            this.flushSync();
            return;
        }
        if (this.saveDebounceTimer)
            return;
        this.saveDebounceTimer = setTimeout(async () => {
            this.saveDebounceTimer = null;
            await this.saveAsync();
        }, 2500);
    }
    async saveAsync() {
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
        }
        catch (e) {
            console.error('Failed to save history store asynchronously', e);
        }
        finally {
            this.isSaving = false;
            if (this.hasPendingSave) {
                this.hasPendingSave = false;
                this.save();
            }
        }
    }
    flushSync() {
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
        }
        catch (e) {
            console.error('Failed to flush history store', e);
        }
    }
    getTask(id) {
        return this.tasks.get(id);
    }
    getAllTasks() {
        return Array.from(this.tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
    }
    setTask(task, immediate = false) {
        this.tasks.set(task.id, task);
        this.save(immediate);
    }
    deleteTask(id) {
        this.tasks.delete(id);
        this.save(true);
    }
}
