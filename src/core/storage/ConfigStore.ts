import fs from 'fs';
import path from 'path';
import os from 'os';
import { AppSettings } from '../../types/index.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'clag_config.json');
const LEGACY_CONFIG_FILE = path.join(process.cwd(), 'clag_config.json');

const DEFAULT_SETTINGS: AppSettings = {
  downloadDir: path.join(os.homedir(), 'Downloads', 'CLAG'),
  maxConcurrentDownloads: 3,
  defaultConnections: 16,
  speedLimitKBps: 0,
  autoStartDownloads: true,
  clipboardMonitoring: true,
  theme: 'dark',
  enableSoundAlerts: true,
  clickNLoadEnabled: true,
  clickNLoadPort: 9666,
  apiPort: 8989,
  downloadSubtitles: true,
  subtitlesFormat: 'txt',
  subtitleLanguages: ['en', 'ar'],
  subtitlesInSubfolder: true,
};

export class ConfigStore {
  private static instance: ConfigStore;
  private settings: AppSettings;

  private constructor() {
    this.settings = this.load();
  }

  public static getInstance(): ConfigStore {
    if (!ConfigStore.instance) {
      ConfigStore.instance = new ConfigStore();
    }
    return ConfigStore.instance;
  }

  private load(): AppSettings {
    try {
      if (!fs.existsSync(CONFIG_FILE) && fs.existsSync(LEGACY_CONFIG_FILE)) {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        try {
          fs.copyFileSync(LEGACY_CONFIG_FILE, CONFIG_FILE);
          fs.unlinkSync(LEGACY_CONFIG_FILE);
        } catch {}
      }

      let loaded = { ...DEFAULT_SETTINGS };
      if (fs.existsSync(CONFIG_FILE)) {
        const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
        loaded = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
      }

      // Cross-platform path sanitization: If running on Linux/macOS and path is a Windows path
      if (process.platform !== 'win32' && /^[a-zA-Z]:[\\/]/.test(loaded.downloadDir)) {
        loaded.downloadDir = path.join(os.homedir(), 'Downloads', 'CLAG');
      }

      return loaded;
    } catch (e) {
      console.error('Failed to load settings from file, using defaults', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  public getSettings(): AppSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<AppSettings>): AppSettings {
    this.settings = { ...this.settings, ...partial };
    this.save();
    return this.getSettings();
  }

  private save(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  }
}
