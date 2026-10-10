import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Folder, 
  Sliders, 
  DownloadCloud, 
  Gauge, 
  Save, 
  Download, 
  Upload, 
  Smartphone,
  CheckCircle2,
  Puzzle,
  Sparkles,
  Info,
  FileText,
  Languages,
  Plus,
  X,
  FolderTree,
  AlertCircle,
  Check,
  Copy
} from 'lucide-react';
const FALLBACK_SETTINGS: AppSettings = {
  downloadDir: 'Downloads/CLAG',
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

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const cached = localStorage.getItem('clag_settings');
      if (cached) {
        return { ...FALLBACK_SETTINGS, ...JSON.parse(cached) };
      }
    } catch {}
    return FALLBACK_SETTINGS;
  });
  const [savedNotice, setSavedNotice] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [customLangInput, setCustomLangInput] = useState('');
  const [langLimitWarning, setLangLimitWarning] = useState(false);

  const POPULAR_LANGUAGES = [
    { code: 'en', label: 'English', native: 'English' },
    { code: 'ar', label: 'Arabic', native: 'العربية' },
    { code: 'es', label: 'Spanish', native: 'Español' },
    { code: 'fr', label: 'French', native: 'Français' },
    { code: 'de', label: 'German', native: 'Deutsch' },
    { code: 'tr', label: 'Turkish', native: 'Türkçe' },
    { code: 'ru', label: 'Russian', native: 'Русский' },
    { code: 'ja', label: 'Japanese', native: '日本語' },
    { code: 'zh', label: 'Chinese', native: '中文' },
    { code: 'pt', label: 'Portuguese', native: 'Português' },
    { code: 'it', label: 'Italian', native: 'Italiano' },
    { code: 'ko', label: 'Korean', native: '한국어' },
    { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
    { code: 'id', label: 'Indonesian', native: 'Bahasa' },
  ];

  const toggleLanguage = (code: string) => {
    const current = settings.subtitleLanguages || ['en', 'ar'];
    if (current.includes(code)) {
      if (current.length === 1) return; // Keep at least one
      setSettings({
        ...settings,
        subtitleLanguages: current.filter((c) => c !== code),
      });
      setLangLimitWarning(false);
    } else {
      if (current.length >= 3) {
        setLangLimitWarning(true);
        setTimeout(() => setLangLimitWarning(false), 3500);
        return;
      }
      setSettings({
        ...settings,
        subtitleLanguages: [...current, code],
      });
      setLangLimitWarning(false);
    }
  };

  const addCustomLanguage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customLangInput.trim()) return;
    const cleanCode = customLangInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleanCode) return;
    const current = settings.subtitleLanguages || ['en', 'ar'];
    if (current.includes(cleanCode)) {
      setCustomLangInput('');
      return;
    }
    if (current.length >= 3) {
      setLangLimitWarning(true);
      setTimeout(() => setLangLimitWarning(false), 3500);
      return;
    }
    setSettings({
      ...settings,
      subtitleLanguages: [...current, cleanCode],
    });
    setCustomLangInput('');
    setLangLimitWarning(false);
  };

  const removeLanguage = (code: string) => {
    const current = settings.subtitleLanguages || ['en', 'ar'];
    if (current.length === 1) return;
    setSettings({
      ...settings,
      subtitleLanguages: current.filter((c) => c !== code),
    });
  };

  useEffect(() => {
    fetch('/api/settings')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data && typeof data === 'object') {
          setSettings((prev) => {
            const merged = { ...prev, ...data };
            try {
              localStorage.setItem('clag_settings', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      })
      .catch((e) => {
        console.warn('API settings unavailable, operating with local offline cache:', e.message);
      });

    const handlePrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Persist immediately to browser storage
    try {
      localStorage.setItem('clag_settings', JSON.stringify(settings));
    } catch {}

    // Send to backend server if reachable
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings((prev) => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.warn('Server offline: settings saved to local browser cache');
    }

    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleExport = () => {
    if (!settings) return;
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clag_settings_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const res = await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed),
        });
        const data = await res.json();
        setSettings(data);
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 2500);
      } catch (err) {
        alert('Invalid settings backup JSON');
      }
    };
    reader.readAsText(file);
  };

  const installPWA = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => setDeferredPrompt(null));
    } else {
      alert('To install CLAG on your phone or desktop: open your browser menu and choose "Add to Home Screen" or "Install App"!');
    }
  };


  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-10">
      {/* Top Header Banner with Save Button & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-4 sm:p-5 rounded-2xl border border-gray-800/80 shadow-lg">
        <div>
          <h3 className="font-extrabold text-xl text-gray-100 flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-cyan-400" />
            Preferences & Engine Settings
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Configure multi-connection acceleration, media transcripts, browser hooks, and cloud backups.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {savedNotice && (
            <span className="text-xs text-emerald-400 bg-emerald-950/90 px-3.5 py-1.5 rounded-xl border border-emerald-800 flex items-center gap-1.5 shadow-sm animate-pulse">
              <CheckCircle2 className="w-4 h-4" /> Preferences Saved!
            </span>
          )}

          <button
            type="submit"
            form="settings-form"
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-white font-semibold text-xs shadow-lg shadow-sky-500/20 flex items-center gap-2 transition-all active:scale-95 whitespace-nowrap min-h-[44px]"
          >
            <Save className="w-4 h-4" /> Save Settings
          </button>
        </div>
      </div>

      {/* Main Responsive Grid Layout: 2 Columns on Desktop, 1 Column on Mobile */}
      <form id="settings-form" onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full">
        {/* ================= LEFT COLUMN ================= */}
        <div className="space-y-5 flex flex-col">
          {/* Card 1: Storage Destination */}
          <div className="glass-panel rounded-2xl p-5 border border-gray-800 space-y-3">
            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Folder className="w-4 h-4 text-sky-400" /> Storage Destination
            </h4>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Default Download Folder</label>
              <input
                type="text"
                value={settings.downloadDir}
                onChange={(e) => setSettings({ ...settings, downloadDir: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3.5 py-2 text-xs text-gray-200 font-mono focus:outline-none focus:border-sky-500"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Downloads are automatically routed into dedicated subfolders (Videos, Audio, Images, Documents) or custom directories.
              </p>
            </div>
          </div>

          {/* Card 2: Multi-Connection Acceleration */}
          <div className="glass-panel rounded-2xl p-5 border border-gray-800 space-y-4">
            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-cyan-400" /> Multi-Connection Acceleration
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs text-gray-300 mb-1">
                  <span>Default Parallel Segments (1–32)</span>
                  <span className="font-mono text-cyan-400 font-bold">{settings.defaultConnections}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="32"
                  value={settings.defaultConnections}
                  onChange={(e) => setSettings({ ...settings, defaultConnections: parseInt(e.target.value, 10) })}
                  className="w-full accent-cyan-400 bg-gray-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-gray-300 mb-1">
                  <span>Max Concurrent Active Downloads</span>
                  <span className="font-mono text-cyan-400 font-bold">{settings.maxConcurrentDownloads}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={settings.maxConcurrentDownloads}
                  onChange={(e) => setSettings({ ...settings, maxConcurrentDownloads: parseInt(e.target.value, 10) })}
                  className="w-full accent-cyan-400 bg-gray-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Global Speed Limit (KB/s - 0 for Unlimited)</label>
              <input
                type="number"
                min="0"
                step="100"
                value={settings.speedLimitKBps}
                onChange={(e) => setSettings({ ...settings, speedLimitKBps: parseInt(e.target.value, 10) || 0 })}
                className="w-full max-w-xs bg-gray-900 border border-gray-700 rounded-xl px-3.5 py-2 text-xs text-gray-200 font-mono focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Card 3: Subtitles & Transcripts Suite */}
          <div className="glass-panel rounded-2xl p-5 border border-gray-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-400" /> Subtitles & Transcripts Suite
              </h4>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800/80">
                Clean .txt + .srt
              </span>
            </div>

            {/* Master Toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-900/60 rounded-xl border border-gray-800">
              <div>
                <div className="text-xs font-semibold text-gray-200">Auto-Download Subtitles & Clean Text Transcripts</div>
                <div className="text-[11px] text-gray-400">Extracts subtitles and creates timestamp-free, readable .txt transcripts</div>
              </div>
              <input
                type="checkbox"
                checked={settings.downloadSubtitles ?? true}
                onChange={(e) => setSettings({ ...settings, downloadSubtitles: e.target.checked })}
                className="w-5 h-5 rounded accent-cyan-400 cursor-pointer"
              />
            </div>

            {/* Subfolder Organization Toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-900/60 rounded-xl border border-gray-800">
              <div className="pr-4">
                <div className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                  <FolderTree className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <span>Save Subtitles in Dedicated Video Subfolder</span>
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  Creates an isolated folder named after the video (e.g. <code className="text-cyan-300 font-mono">Videos/Video_Title/</code>) to store all subtitle files and transcripts without cluttering the main directory
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.subtitlesInSubfolder ?? true}
                onChange={(e) => setSettings({ ...settings, subtitlesInSubfolder: e.target.checked })}
                className="w-5 h-5 rounded accent-cyan-400 cursor-pointer"
              />
            </div>

            {/* Subtitles Output Format */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-300">
                Generated File Formats
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, subtitlesFormat: 'txt' })}
                  className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-all text-center ${
                    (settings.subtitlesFormat || 'txt') === 'txt'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                      : 'bg-gray-900/70 text-gray-400 border-gray-800 hover:text-gray-200'
                  }`}
                >
                  📄 Clean .txt
                </button>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, subtitlesFormat: 'srt' })}
                  className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-all text-center ${
                    settings.subtitlesFormat === 'srt'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                      : 'bg-gray-900/70 text-gray-400 border-gray-800 hover:text-gray-200'
                  }`}
                >
                  🎬 Standard .srt
                </button>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, subtitlesFormat: 'both' })}
                  className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-all text-center ${
                    settings.subtitlesFormat === 'both'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                      : 'bg-gray-900/70 text-gray-400 border-gray-800 hover:text-gray-200'
                  }`}
                >
                  ✨ Both Formats
                </button>
              </div>
            </div>

            {/* Subtitle Languages Selector (Max 3) */}
            <div className="space-y-3 pt-2 border-t border-gray-800/80">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                    <Languages className="w-4 h-4 text-cyan-400" />
                    Preferred Languages (Choose up to 3)
                  </label>
                  <p className="text-[11px] text-gray-400">
                    Global language preference for all downloads. Avoids querying 100+ languages per video.
                  </p>
                </div>
                <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                  (settings.subtitleLanguages || ['en', 'ar']).length >= 3
                    ? 'bg-amber-950/80 text-amber-300 border-amber-700'
                    : 'bg-sky-950 text-cyan-300 border-sky-800'
                }`}>
                  {(settings.subtitleLanguages || ['en', 'ar']).length} / 3 selected
                </span>
              </div>

              {/* Warning when trying to add > 3 */}
              {langLimitWarning && (
                <div className="flex items-center gap-2 p-2.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-xs animate-shake">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Maximum 3 languages allowed to prevent YouTube rate-limiting (HTTP Error 429: Too Many Requests).</span>
                </div>
              )}

              {/* Active Selected Language Tags */}
              <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-900/90 rounded-xl border border-gray-700/80 min-h-[46px]">
                <span className="text-[11px] text-gray-400 mr-1 font-medium">Active:</span>
                {(settings.subtitleLanguages || ['en', 'ar']).map((code) => {
                  const popular = POPULAR_LANGUAGES.find((l) => l.code === code);
                  const displayName = popular ? `${popular.label} (${code.toUpperCase()})` : code.toUpperCase();
                  return (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-900/60 to-sky-900/60 text-cyan-200 border border-cyan-700/70 text-xs font-medium shadow-sm"
                    >
                      <span>{displayName}</span>
                      <button
                        type="button"
                        onClick={() => removeLanguage(code)}
                        className="p-0.5 hover:bg-cyan-800/80 rounded text-cyan-300 hover:text-white transition-colors"
                        title={`Remove ${code}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  );
                })}
              </div>

              {/* Quick Toggle Popular Languages */}
              <div>
                <div className="text-[11px] text-gray-400 mb-2 font-medium">Quick Pick Languages:</div>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_LANGUAGES.map((lang) => {
                    const isSelected = (settings.subtitleLanguages || ['en', 'ar']).includes(lang.code);
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => toggleLanguage(lang.code)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-sm'
                            : 'bg-gray-900/80 text-gray-400 border-gray-800 hover:text-gray-200 hover:border-gray-700'
                        }`}
                      >
                        {isSelected ? <Check className="w-3 h-3 text-cyan-400" /> : null}
                        <span>{lang.native}</span>
                        <span className="text-[10px] opacity-60 font-mono">({lang.code})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Language Code Input */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={customLangInput}
                  onChange={(e) => setCustomLangInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomLanguage();
                    }
                  }}
                  placeholder="Custom ISO code (e.g. ur, nl, pl, sv)"
                  maxLength={8}
                  className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-cyan-500 max-w-[220px]"
                />
                <button
                  type="button"
                  onClick={() => addCustomLanguage()}
                  disabled={!customLangInput.trim()}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-cyan-300 border border-gray-700 rounded-xl text-xs font-medium flex items-center gap-1 disabled:opacity-40 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Code</span>
                </button>
              </div>
            </div>

            {/* Explanation Banner */}
            <div className="text-[11px] text-gray-400 bg-gray-900/80 p-3 rounded-xl border border-gray-800 flex items-start gap-2">
              <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Rate-Limit Shield:</strong> Restricting subtitle downloads to up to 3 selected languages completely eliminates <code className="text-amber-300 font-mono">HTTP Error 429: Too Many Requests</code> from YouTube and other video platforms while guaranteeing clean, instantaneous transcript downloads.
              </span>
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN ================= */}
        <div className="space-y-5 flex flex-col">
          {/* Card 4: Browser & JDownloader Compatibility */}
          <div className="glass-panel rounded-2xl p-5 border border-gray-800 space-y-3">
            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <DownloadCloud className="w-4 h-4 text-emerald-400" /> Browser & JDownloader Compatibility
            </h4>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-gray-200">Click'n'Load v2 Compatibility Server</div>
                <div className="text-[11px] text-gray-400">Listens on port {settings.clickNLoadPort} for web Click'n'Load buttons</div>
              </div>
              <input
                type="checkbox"
                checked={settings.clickNLoadEnabled}
                onChange={(e) => setSettings({ ...settings, clickNLoadEnabled: e.target.checked })}
                className="w-5 h-5 rounded accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Card 5: Chrome & Edge Extension Suite */}
          <div className="glass-panel rounded-2xl p-5 border border-sky-900/40 bg-gradient-to-br from-sky-950/20 via-gray-900/60 to-gray-900/90 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Puzzle className="w-4 h-4 text-cyan-400" /> Chrome & Edge Extension
                </h4>
                <p className="text-xs text-gray-300 mt-1">
                  Integrate CLAG directly into Chrome or Edge to intercept downloads and show IDM-style floating grab panels.
                </p>
              </div>

              <a
                href="/clag-downloader-extension.zip"
                download="clag-downloader-extension.zip"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-white font-semibold text-xs shadow-lg shadow-cyan-500/20 transition-transform active:scale-95 whitespace-nowrap min-h-[44px]"
              >
                <Download className="w-4 h-4" /> Download Extension (.zip)
              </a>
            </div>

            <div className="bg-gray-950/80 rounded-xl p-3.5 border border-gray-800 space-y-2 text-xs text-gray-400">
              <div className="font-semibold text-gray-300 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-cyan-400" /> Quick Installation Steps:
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-gray-400 pl-1">
                <li>Download and unzip <code className="text-cyan-300 font-mono">clag-downloader-extension.zip</code>.</li>
                <li>In Chrome or Edge, navigate to <code className="text-cyan-300 font-mono">chrome://extensions</code> (or <code className="text-cyan-300 font-mono">edge://extensions</code>).</li>
                <li>Enable <strong>Developer mode</strong> in the top-right corner.</li>
                <li>Click <strong>Load unpacked</strong> and select the extracted folder.</li>
              </ol>
            </div>
          </div>

          {/* Card 5.5: Phone & LAN Remote Access */}
          <div className="glass-panel rounded-2xl p-5 border border-cyan-900/40 bg-gradient-to-br from-cyan-950/20 to-gray-900/80 space-y-3">
            <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-cyan-400" /> Phone & LAN Remote Access
            </h4>
            <p className="text-xs text-gray-300">
              Connect your smartphone or tablet on the same Wi-Fi network directly to this PC's high-performance download engine:
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              <div className="flex-1 bg-black/60 border border-gray-700 rounded-xl px-3.5 py-2 font-mono text-xs text-cyan-300 truncate select-all">
                {`http://${(settings as any).lanIp || '192.168.1.X'}:${settings.apiPort || 8989}`}
              </div>
              <button
                type="button"
                onClick={() => {
                  const url = `http://${(settings as any).lanIp || '192.168.1.X'}:${settings.apiPort || 8989}`;
                  navigator.clipboard.writeText(url);
                  setSavedNotice(true);
                  setTimeout(() => setSavedNotice(false), 2000);
                }}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors min-h-[40px]"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Phone URL</span>
              </button>
            </div>
            <p className="text-[11px] text-gray-400">
              Type this address into Chrome or Safari on your phone to control downloads remotely from your couch or bed!
            </p>
          </div>

          {/* Card 6: PWA Mobile App & Data Backup */}
          <div className="glass-panel rounded-2xl p-5 border border-gray-800 space-y-4">
            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-purple-400" /> PWA Mobile App & Data Backup
            </h4>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={installPWA}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-xs flex items-center gap-2 shadow-md min-h-[40px]"
              >
                <Smartphone className="w-4 h-4" /> Install as Phone / Desktop App
              </button>

              <button
                type="button"
                onClick={handleExport}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium text-xs flex items-center gap-2 border border-gray-700 min-h-[40px]"
              >
                <Download className="w-4 h-4" /> Export Settings Backup (JSON)
              </button>

              <label className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium text-xs flex items-center gap-2 border border-gray-700 cursor-pointer min-h-[40px]">
                <Upload className="w-4 h-4" /> Import Backup (JSON)
                <input type="file" accept=".json" onChange={handleImport} className="hidden" />
              </label>
            </div>
          </div>

          {/* Card 7: About & Author Attribution */}
          <div className="glass-panel rounded-2xl p-5 border border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto">
            <div className="space-y-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className="font-extrabold text-base bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
                  CLAG Downloader Pro
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-950 text-sky-400 border border-sky-800 font-mono">
                  v1.0 Pro
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Multi-threaded Segmented Engine • Universal Media Grabber • Click'n'Load Compatibility
              </p>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 border border-gray-700 shadow-inner">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <div className="text-xs text-gray-300">
                Made by : <strong className="text-cyan-300 font-bold ml-1">Wael Sayed</strong>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
