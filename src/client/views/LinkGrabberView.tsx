import React, { useState } from 'react';
import { 
  Layers, 
  Play, 
  Trash2, 
  CheckSquare, 
  Square, 
  Search, 
  Loader2, 
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Film,
  Music
} from 'lucide-react';
import { GrabberLinkItem } from '../../types/index.js';

interface LinkGrabberViewProps {
  onStartItems: (items: GrabberLinkItem[]) => void;
}

export const LinkGrabberView: React.FC<LinkGrabberViewProps> = ({ onStartItems }) => {
  const [inputText, setInputText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [items, setItems] = useState<GrabberLinkItem[]>([]);
  const [globalQuality, setGlobalQuality] = useState<'best' | '1080p' | '720p' | '480p' | 'audio'>('best');

  const handleParse = async () => {
    if (!inputText.trim()) return;
    setIsParsing(true);

    try {
      const res = await fetch('/api/batch/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      });
      const data = await res.json();
      const urls: string[] = data.urls || [];

      const expandedItems: GrabberLinkItem[] = [];
      let idx = 0;

      for (const u of urls) {
        const isPotentialPlaylist =
          u.includes('list=') ||
          u.includes('/playlist') ||
          u.includes('/videos') ||
          u.includes('instagram.com');

        if (isPotentialPlaylist) {
          try {
            const probeRes = await fetch('/api/probe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: u }),
            });
            const probeJson = await probeRes.json();
            if (probeJson.type === 'playlist' && probeJson.data?.entries?.length > 0) {
              for (const item of probeJson.data.entries) {
                expandedItems.push({
                  id: 'grab_' + Date.now() + '_' + (idx++),
                  url: item.url,
                  title: item.title,
                  filename: `${item.title.replace(/[\\/:*?"<>|]/g, '_')}.mp4`,
                  filesize: 0,
                  category: 'video',
                  selected: true,
                  status: 'ready',
                });
              }
              continue;
            }
          } catch (probeErr) {
            // Fallback to direct item below
          }
        }

        const basename = u.split('/').filter(Boolean).pop()?.split('?')[0] || `Link_${idx + 1}`;
        expandedItems.push({
          id: 'grab_' + Date.now() + '_' + (idx++),
          url: u,
          title: decodeURIComponent(basename),
          filename: decodeURIComponent(basename),
          filesize: 0,
          category: 'other',
          selected: true,
          status: 'ready',
        });
      }

      setItems((prev) => [...prev, ...expandedItems]);
      setInputText('');
    } catch (e) {
      console.error('Failed to parse links', e);
    } finally {
      setIsParsing(false);
    }
  };

  const toggleSelectAll = (select: boolean) => {
    setItems((prev) => prev.map((item) => ({ ...item, selected: select })));
  };

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const setItemQuality = (id: string, q: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selectedFormatId: q } : item))
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearAll = () => {
    setItems([]);
  };

  const handleStartSelected = () => {
    const selected = items.filter((i) => i.selected);
    if (selected.length === 0) return;

    const mapped = selected.map((item) => {
      const q = item.selectedFormatId || globalQuality;
      const isAudio = q === 'audio';
      let qLabel = 'Best Video (Auto MP4)';
      let fmt: string | undefined = undefined;

      if (isAudio) {
        qLabel = 'MP3 Audio (Best)';
      } else if (q === '1080p') {
        fmt = '1080p';
        qLabel = '1080p Full HD';
      } else if (q === '720p') {
        fmt = '720p';
        qLabel = '720p HD';
      } else if (q === '480p') {
        fmt = '480p';
        qLabel = '480p SD';
      }

      return {
        ...item,
        selectedFormatId: fmt,
        qualityLabel: qLabel,
        audioOnly: isAudio,
      };
    });

    onStartItems(mapped);
    // Remove started items
    setItems((prev) => prev.filter((i) => !i.selected));
  };

  const selectedCount = items.filter((i) => i.selected).length;

  return (
    <div className="space-y-4">
      {/* Input area */}
      <div className="glass-panel rounded-2xl p-4 border border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-cyan-400" />
            Paste Batch URLs or Text (JDownloader-Style Crawler)
          </label>
          <span className="text-[11px] text-gray-400">Multiple URLs, one per line or embedded in text</span>
        </div>

        <textarea
          rows={3}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="https://example.com/file1.zip&#10;https://youtube.com/watch?v=...&#10;https://instagram.com/reel/..."
          className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-xs text-gray-200 focus:outline-none focus:border-sky-500 font-mono resize-none"
        />

        <div className="flex justify-end gap-2 mt-2.5">
          <button
            onClick={handleParse}
            disabled={isParsing || !inputText.trim()}
            className="px-4 py-2 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 shadow-md disabled:opacity-50 transition-all"
          >
            {isParsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>Crawl & Add Links</span>
          </button>
        </div>
      </div>

      {/* Action Toolbar */}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 glass-panel p-3 rounded-xl border border-gray-800">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={() => toggleSelectAll(true)}
              className="px-2.5 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:text-white flex items-center gap-1"
            >
              <CheckSquare className="w-3.5 h-3.5 text-cyan-400" /> Select All
            </button>
            <button
              onClick={() => toggleSelectAll(false)}
              className="px-2.5 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:text-white flex items-center gap-1"
            >
              <Square className="w-3.5 h-3.5" /> Deselect
            </button>
            <span className="text-gray-400 font-mono ml-1 text-[11px]">
              {selectedCount} of {items.length} selected
            </span>

            {/* Global Quality Category Selector */}
            <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-gray-700">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] text-gray-300 font-medium">Batch Quality:</span>
              <select
                value={globalQuality}
                onChange={(e) => setGlobalQuality(e.target.value as any)}
                className="bg-gray-800 border border-gray-700 text-cyan-300 font-semibold text-[11px] rounded-lg px-2 py-1 focus:outline-none focus:border-cyan-400"
              >
                <option value="best">⚡ Best 4K / Auto</option>
                <option value="1080p">🌟 1080p Full HD</option>
                <option value="720p">📺 720p HD</option>
                <option value="480p">📱 480p SD</option>
                <option value="audio">🎵 MP3 Audio</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={clearAll}
              className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 text-xs flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
            <button
              onClick={handleStartSelected}
              disabled={selectedCount === 0}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md disabled:opacity-40 transition-all"
            >
              <Play className="w-3.5 h-3.5" /> Start Download ({selectedCount})
            </button>
          </div>
        </div>
      )}

      {/* Discovered Items Table */}
      {items.length === 0 ? (
        <div className="glass-panel rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-2">
          <Layers className="w-10 h-10 text-gray-600 mb-1" />
          <h5 className="font-semibold text-gray-300 text-sm">Link Grabber Workspace is Empty</h5>
          <p className="text-xs text-gray-500 max-w-sm">
            Paste links above or use browser extension / Click'n'Load to stage packages here before starting.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={`glass-card rounded-xl p-3 flex items-center justify-between gap-3 border transition-colors ${
                item.selected ? 'border-sky-500/40 bg-sky-950/20' : 'border-gray-800'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <input
                  type="checkbox"
                  checked={item.selected}
                  onChange={() => toggleItem(item.id)}
                  className="w-4 h-4 rounded accent-cyan-400 cursor-pointer flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-xs text-gray-200 truncate">{item.title}</div>
                  <div className="text-[11px] text-gray-400 font-mono truncate">{item.url}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <select
                  value={item.selectedFormatId || 'inherit'}
                  onChange={(e) => setItemQuality(item.id, e.target.value === 'inherit' ? '' : e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-gray-200 text-[10px] rounded px-2 py-1 focus:outline-none focus:border-cyan-400 font-mono"
                >
                  <option value="inherit">Preset ({globalQuality.toUpperCase()})</option>
                  <option value="best">⚡ Best</option>
                  <option value="1080p">🌟 1080p FHD</option>
                  <option value="720p">📺 720p HD</option>
                  <option value="480p">📱 480p SD</option>
                  <option value="audio">🎵 MP3 Audio</option>
                </select>

                <button
                  onClick={() => removeItem(item.id)}
                  className="p-1.5 text-gray-500 hover:text-rose-400 rounded-lg hover:bg-gray-800"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
