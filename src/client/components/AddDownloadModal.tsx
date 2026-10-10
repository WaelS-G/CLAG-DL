import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  Search, 
  Sliders, 
  Film, 
  Music, 
  File, 
  Check, 
  Loader2, 
  Sparkles,
  FileText,
  Layers,
  Languages,
  CheckSquare,
  Square,
  AlertCircle,
  Info
} from 'lucide-react';
import { MediaProbeResult } from '../../types/index.js';

interface AddDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDownload: (params: {
    url: string;
    filename?: string;
    connections: number;
    isMediaStream?: boolean;
    mediaFormatId?: string;
    audioOnly?: boolean;
    thumbnail?: string;
    qualityLabel?: string;
    downloadSubtitles?: boolean;
    subtitleLanguages?: string[];
  }) => void;
}

export const AddDownloadModal: React.FC<AddDownloadModalProps> = ({
  isOpen,
  onClose,
  onAddDownload,
}) => {
  const [url, setUrl] = useState('');
  const [connections, setConnections] = useState(16);
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<MediaProbeResult | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string>('');
  const [audioOnly, setAudioOnly] = useState(false);
  const [customFilename, setCustomFilename] = useState('');
  const [downloadSubtitles, setDownloadSubtitles] = useState(true);
  const [configuredLanguages, setConfiguredLanguages] = useState<string[]>(['en', 'ar']);
  const [probeError, setProbeError] = useState<string | null>(null);

  const [playlistPreset, setPlaylistPreset] = useState<'best' | '1080p' | '720p' | '480p' | 'audio'>('best');
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [entryOverrides, setEntryOverrides] = useState<Record<number, { selected: boolean; quality: string }>>({});

  useEffect(() => {
    if (isOpen) {
      setProbeError(null);
      fetch('/api/settings')
        .then((r) => r.json())
        .then((s) => {
          if (s.subtitleLanguages && Array.isArray(s.subtitleLanguages)) {
            setConfiguredLanguages(s.subtitleLanguages);
          }
          if (typeof s.downloadSubtitles === 'boolean') {
            setDownloadSubtitles(s.downloadSubtitles);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleProbe = async () => {
    const rawUrl = url.trim();
    if (!rawUrl) return;
    setProbing(true);
    setProbeResult(null);
    setProbeError(null);

    try {
      const res = await fetch('/api/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: rawUrl }),
      });
      const json = await res.json();
      if ((json.type === 'media' || json.type === 'playlist') && json.data && !json.data.error) {
        setProbeResult(json.data);
        setCustomFilename(json.data.title);
        // Default to best format (highest quality is at index 0)
        const videoFormats = json.data.formats?.filter((f: any) => f.hasVideo) || [];
        if (videoFormats.length > 0) {
          setSelectedFormat(videoFormats[0].formatId);
        } else {
          setSelectedFormat('');
        }

        if (json.data.isPlaylist && json.data.entries) {
          const initOverrides: Record<number, { selected: boolean; quality: string }> = {};
          json.data.entries.forEach((_: any, idx: number) => {
            initOverrides[idx] = { selected: true, quality: 'inherit' };
          });
          setEntryOverrides(initOverrides);
        }
      } else if (json.type === 'direct' && json.data) {
        setCustomFilename(json.data.filename);
        setProbeResult({
          url: json.data.url || rawUrl,
          title: json.data.title || json.data.filename || 'Direct File',
          uploader: json.data.contentType || 'Direct Download',
          thumbnail: '',
          formats: [],
          isStream: false,
          extractor: 'direct',
          category: json.data.category || 'other',
          filesize: json.data.filesize || 0,
          filesizeFormatted: json.data.filesizeFormatted || 'Direct Stream',
          supportsRange: json.data.supportsRange ?? true,
        } as any);
      } else {
        throw new Error(json.error || 'Server probe returned unhandled format');
      }
    } catch (err: any) {
      console.warn('[CLAG Probe] Server probe fallback triggered:', err);
      // Client-Side Fallback for YouTube or social media
      const lower = rawUrl.toLowerCase();
      const ytMatch = rawUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
      if (ytMatch && ytMatch[1]) {
        const videoId = ytMatch[1];
        try {
          const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(rawUrl)}&format=json`);
          if (oembedRes.ok) {
            const oe = await oembedRes.json();
            const mediaData: MediaProbeResult = {
              url: rawUrl,
              title: oe.title || `YouTube Video (${videoId})`,
              uploader: oe.author_name || 'YouTube',
              thumbnail: oe.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
              extractor: 'youtube',
              isStream: true,
              formats: [
                { formatId: 'best', ext: 'mp4', resolution: '1080p', qualityLabel: '1080p Full HD (MP4)', hasVideo: true, hasAudio: true, isBest: true },
                { formatId: '720p', ext: 'mp4', resolution: '720p', qualityLabel: '720p HD (MP4)', hasVideo: true, hasAudio: true },
                { formatId: '480p', ext: 'mp4', resolution: '480p', qualityLabel: '480p SD (MP4)', hasVideo: true, hasAudio: true },
                { formatId: 'audio', ext: 'mp3', resolution: 'Audio', qualityLabel: 'High Quality MP3 Audio', hasVideo: false, hasAudio: true },
              ],
              hasSubtitles: true,
              subtitlesList: ['en', 'ar', 'es', 'fr', 'de'],
            };
            setProbeResult(mediaData);
            setCustomFilename(mediaData.title);
            setSelectedFormat('best');
            return;
          }
        } catch (oeErr) {}

        // Fallback with videoId thumbnail
        const mediaData: MediaProbeResult = {
          url: rawUrl,
          title: `YouTube Video (${videoId})`,
          uploader: 'YouTube Stream',
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          extractor: 'youtube',
          isStream: true,
          formats: [
            { formatId: 'best', ext: 'mp4', resolution: '1080p', qualityLabel: 'Best Video (MP4)', hasVideo: true, hasAudio: true, isBest: true },
            { formatId: '720p', ext: 'mp4', resolution: '720p', qualityLabel: '720p HD (MP4)', hasVideo: true, hasAudio: true },
            { formatId: 'audio', ext: 'mp3', resolution: 'Audio', qualityLabel: 'MP3 Audio Stream', hasVideo: false, hasAudio: true },
          ],
          hasSubtitles: true,
        };
        setProbeResult(mediaData);
        setCustomFilename(mediaData.title);
        setSelectedFormat('best');
        return;
      }

      // TikTok Fallback
      if (lower.includes('tiktok.com')) {
        let title = 'TikTok Video';
        let uploader = 'TikTok Creator';
        let thumbnail = '';
        try {
          const oe = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(rawUrl)}`);
          if (oe.ok) {
            const d = await oe.json();
            if (d.title) title = d.title;
            if (d.author_name) uploader = d.author_name;
            if (d.thumbnail_url) thumbnail = d.thumbnail_url;
          }
        } catch (e) {}

        const mediaData: MediaProbeResult = {
          url: rawUrl,
          title,
          uploader,
          thumbnail,
          extractor: 'tiktok',
          isStream: true,
          formats: [
            { formatId: 'best', ext: 'mp4', resolution: '1080p', qualityLabel: 'Original HD (No Watermark MP4)', hasVideo: true, hasAudio: true, isBest: true },
            { formatId: 'audio', ext: 'mp3', resolution: 'Audio', qualityLabel: 'Original Audio (MP3)', hasVideo: false, hasAudio: true },
          ],
        };
        setProbeResult(mediaData);
        setCustomFilename(mediaData.title);
        setSelectedFormat('best');
        return;
      }

      // Vimeo Fallback
      if (lower.includes('vimeo.com')) {
        let title = 'Vimeo Video';
        let uploader = 'Vimeo Creator';
        let thumbnail = '';
        try {
          const oe = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(rawUrl)}`);
          if (oe.ok) {
            const d = await oe.json();
            if (d.title) title = d.title;
            if (d.author_name) uploader = d.author_name;
            if (d.thumbnail_url) thumbnail = d.thumbnail_url;
          }
        } catch (e) {}

        const mediaData: MediaProbeResult = {
          url: rawUrl,
          title,
          uploader,
          thumbnail,
          extractor: 'vimeo',
          isStream: true,
          formats: [
            { formatId: 'best', ext: 'mp4', resolution: '1080p', qualityLabel: 'Best 1080p Full HD (MP4)', hasVideo: true, hasAudio: true, isBest: true },
            { formatId: '720p', ext: 'mp4', resolution: '720p', qualityLabel: '720p HD (MP4)', hasVideo: true, hasAudio: true },
            { formatId: 'audio', ext: 'mp3', resolution: 'Audio', qualityLabel: 'Extracted Audio (MP3)', hasVideo: false, hasAudio: true },
          ],
        };
        setProbeResult(mediaData);
        setCustomFilename(mediaData.title);
        setSelectedFormat('best');
        return;
      }

      // Instagram, Twitter/X, Facebook Fallback
      if (lower.includes('instagram.com') || lower.includes('twitter.com') || lower.includes('x.com') || lower.includes('facebook.com') || lower.includes('fb.watch')) {
        let platform = 'Social Media';
        if (lower.includes('instagram.com')) platform = 'Instagram';
        else if (lower.includes('twitter.com') || lower.includes('x.com')) platform = 'Twitter / X';
        else if (lower.includes('facebook.com') || lower.includes('fb.watch')) platform = 'Facebook';

        const mediaData: MediaProbeResult = {
          url: rawUrl,
          title: `${platform} Video / Reel`,
          uploader: `${platform} Post`,
          thumbnail: '',
          extractor: platform.toLowerCase().replace(/[^a-z]/g, ''),
          isStream: true,
          formats: [
            { formatId: 'best', ext: 'mp4', resolution: '1080p', qualityLabel: 'Best HD Video (MP4)', hasVideo: true, hasAudio: true, isBest: true },
            { formatId: 'audio', ext: 'mp3', resolution: 'Audio', qualityLabel: 'Extracted Audio (MP3)', hasVideo: false, hasAudio: true },
          ],
        };
        setProbeResult(mediaData);
        setCustomFilename(mediaData.title);
        setSelectedFormat('best');
        return;
      }

      // Fallback for direct files
      let directName = 'download.bin';
      try {
        const parsed = new URL(rawUrl);
        directName = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || 'download.bin');
      } catch (e) {}
      setCustomFilename(directName);
      setProbeResult({
        url: rawUrl,
        title: directName,
        uploader: 'Direct Resource',
        thumbnail: '',
        formats: [],
        isStream: false,
        extractor: 'direct',
        filesize: 0,
        filesizeFormatted: 'Direct Stream',
        supportsRange: true,
      } as any);
      setProbeError('Stream metadata preview limited. Download will proceed directly.');
    } finally {
      setProbing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    if (probeResult?.isPlaylist && probeResult.entries && probeResult.entries.length > 0) {
      // Enqueue playlist items with selected quality settings
      probeResult.entries.forEach((item, idx) => {
        const override = entryOverrides[idx];
        if (override && override.selected === false) return; // Skipped item

        const effectiveQ = (override?.quality && override.quality !== 'inherit') ? override.quality : playlistPreset;
        const isItemAudio = effectiveQ === 'audio';

        let qLabel = 'Best Video (Auto MP4)';
        let fmtId: string | undefined = undefined;

        if (isItemAudio) {
          qLabel = 'MP3 Audio (Best)';
        } else if (effectiveQ === '1080p') {
          fmtId = '1080p';
          qLabel = '1080p Full HD';
        } else if (effectiveQ === '720p') {
          fmtId = '720p';
          qLabel = '720p HD';
        } else if (effectiveQ === '480p') {
          fmtId = '480p';
          qLabel = '480p SD';
        }

        onAddDownload({
          url: item.url,
          filename: item.title,
          connections,
          isMediaStream: true,
          mediaFormatId: fmtId,
          audioOnly: isItemAudio,
          thumbnail: item.thumbnail || probeResult.thumbnail,
          qualityLabel: qLabel,
          downloadSubtitles,
          subtitleLanguages: configuredLanguages,
        });
      });
    } else {
      let streamUrl: string | undefined = undefined;
      let qLabel: string | undefined = undefined;
      const isDirect = probeResult?.extractor === 'direct';
      if (audioOnly) {
        qLabel = 'MP3 Audio (Best)';
        const audioFmt = probeResult?.formats?.find((f) => f.formatId === 'audio' || (!f.hasVideo && f.hasAudio));
        if (audioFmt?.url) streamUrl = audioFmt.url;
      } else if (selectedFormat && probeResult?.formats) {
        const fmt = probeResult.formats.find((f) => f.formatId === selectedFormat);
        if (fmt) {
          qLabel = fmt.qualityLabel || fmt.resolution || fmt.ext?.toUpperCase();
          if (fmt.url) streamUrl = fmt.url;
        }
      } else if (probeResult && !isDirect) {
        qLabel = 'Best Video (Auto 4K/1080p)';
        const bestFmt = probeResult.formats?.find((f) => f.url);
        if (bestFmt?.url) streamUrl = bestFmt.url;
      }

      onAddDownload({
        url: url.trim(),
        streamUrl,
        filename: customFilename.trim() || undefined,
        connections,
        isMediaStream: !!probeResult && !isDirect,
        mediaFormatId: selectedFormat || undefined,
        audioOnly: !isDirect && audioOnly,
        thumbnail: probeResult?.thumbnail,
        qualityLabel: qLabel,
        downloadSubtitles: !isDirect && downloadSubtitles,
        subtitleLanguages: configuredLanguages,
      });
    }

    // Reset and close
    setUrl('');
    setProbeResult(null);
    setSelectedFormat('');
    setCustomFilename('');
    setAudioOnly(false);
    setIsCustomizeOpen(false);
    setEntryOverrides({});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="glass-panel w-full max-w-lg rounded-2xl shadow-2xl border border-gray-700/80 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base text-gray-100">Add New Download</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* URL Input */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Download or Media URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://... (Direct file, YouTube, Instagram, TikTok, etc.)"
                required
                className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-sky-500 font-mono min-h-[44px]"
              />
              <button
                type="button"
                onClick={handleProbe}
                disabled={probing || !url.trim()}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-cyan-300 font-semibold text-xs rounded-xl flex items-center gap-1.5 border border-gray-700 disabled:opacity-50 transition-colors min-h-[44px] min-w-[80px] justify-center"
              >
                {probing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{probing ? 'Probing...' : 'Probe'}</span>
              </button>
            </div>

            {/* Probe Warning / Fallback Banner */}
            {probeError && (
              <div className="mt-2.5 p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-300 flex items-center justify-between gap-2 animate-fade-in">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
                  <span className="truncate">{probeError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setProbeError(null)}
                  className="p-1 hover:bg-amber-900/40 rounded text-amber-400 flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Playlist / Collection Preview Card */}
          {probeResult && probeResult.isPlaylist && (
            <div className="p-3.5 bg-gray-900/90 rounded-xl border border-indigo-500/40 space-y-3">
              <div className="flex gap-3 items-center">
                {probeResult.thumbnail ? (
                  <img
                    src={probeResult.thumbnail}
                    alt={probeResult.title}
                    className="w-16 h-16 rounded-lg object-cover bg-gray-800 flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-indigo-950/60 border border-indigo-700/50 flex items-center justify-center flex-shrink-0 text-indigo-400">
                    <Layers className="w-8 h-8" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-700">
                      Playlist / Multi-Post Profile
                    </span>
                    <span className="text-[11px] text-cyan-300 font-mono font-bold">
                      {probeResult.entryCount || probeResult.entries?.length || 0} items
                    </span>
                  </div>
                  <h5 className="font-semibold text-xs text-gray-100 truncate mt-1">{probeResult.title}</h5>
                  <p className="text-[11px] text-gray-400 mt-0.5">{probeResult.uploader}</p>
                </div>
              </div>

              {/* Global Quality Category Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-gray-300 flex items-center gap-1">
                    <Sliders className="w-3 h-3 text-cyan-400" /> Playlist Quality Preset
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomizeOpen(!isCustomizeOpen)}
                    className="text-[10px] font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                  >
                    {isCustomizeOpen ? 'Hide Custom List' : '⚙ Customize Per-Video Quality'}
                  </button>
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { id: 'best', label: 'Best 4K/Auto', icon: Film, color: 'text-sky-300' },
                    { id: '1080p', label: '1080p FHD', icon: Film, color: 'text-indigo-300' },
                    { id: '720p', label: '720p HD', icon: Film, color: 'text-cyan-300' },
                    { id: '480p', label: '480p SD', icon: Film, color: 'text-emerald-300' },
                    { id: 'audio', label: 'MP3 Audio', icon: Music, color: 'text-amber-300' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPlaylistPreset(opt.id as any)}
                      className={`py-1.5 px-1 rounded-lg text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 border transition-all ${
                        playlistPreset === opt.id
                          ? 'bg-sky-500/20 border-sky-400 text-white shadow-sm'
                          : 'bg-gray-800/80 border-gray-700/60 text-gray-400 hover:text-gray-200 hover:bg-gray-700/60'
                      }`}
                    >
                      <opt.icon className={`w-3 h-3 ${opt.color}`} />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Per-video customizable list */}
              {isCustomizeOpen && probeResult.entries && probeResult.entries.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-gray-800">
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span>Select videos & per-video quality:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const updated: Record<number, { selected: boolean; quality: string }> = {};
                          probeResult.entries!.forEach((_, idx) => {
                            updated[idx] = { selected: true, quality: entryOverrides[idx]?.quality || 'inherit' };
                          });
                          setEntryOverrides(updated);
                        }}
                        className="text-cyan-400 hover:text-cyan-300 text-[10px] flex items-center gap-0.5"
                      >
                        <CheckSquare className="w-3 h-3" /> All
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated: Record<number, { selected: boolean; quality: string }> = {};
                          probeResult.entries!.forEach((_, idx) => {
                            updated[idx] = { selected: false, quality: entryOverrides[idx]?.quality || 'inherit' };
                          });
                          setEntryOverrides(updated);
                        }}
                        className="text-gray-400 hover:text-gray-300 text-[10px] flex items-center gap-0.5"
                      >
                        <Square className="w-3 h-3" /> None
                      </button>
                    </div>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1.5 bg-black/40 p-2 rounded-xl border border-gray-800 text-xs font-mono">
                    {probeResult.entries.map((entry, idx) => {
                      const isSel = entryOverrides[idx]?.selected !== false;
                      const currentQ = entryOverrides[idx]?.quality || 'inherit';

                      return (
                        <div
                          key={entry.id || idx}
                          className={`p-1.5 rounded-lg border flex items-center justify-between gap-2 transition-colors ${
                            isSel ? 'border-gray-700 bg-gray-900/60' : 'border-gray-800/40 bg-gray-950/40 opacity-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={isSel}
                              onChange={(e) => {
                                setEntryOverrides((prev) => ({
                                  ...prev,
                                  [idx]: { selected: e.target.checked, quality: prev[idx]?.quality || 'inherit' },
                                }));
                              }}
                              className="w-3.5 h-3.5 rounded accent-cyan-400 cursor-pointer flex-shrink-0"
                            />
                            <div className="min-w-0 flex-1 truncate">
                              <span className="text-gray-200 truncate block text-[11px]">{idx + 1}. {entry.title}</span>
                              {entry.durationFormatted && <span className="text-gray-500 text-[10px]">{entry.durationFormatted}</span>}
                            </div>
                          </div>

                          <select
                            disabled={!isSel}
                            value={currentQ}
                            onChange={(e) => {
                              const qVal = e.target.value;
                              setEntryOverrides((prev) => ({
                                ...prev,
                                [idx]: { selected: prev[idx]?.selected !== false, quality: qVal },
                              }));
                            }}
                            className="bg-gray-800 border border-gray-700 text-gray-200 text-[10px] rounded px-1.5 py-1 focus:outline-none focus:border-cyan-400 font-sans"
                          >
                            <option value="inherit">Preset ({playlistPreset.toUpperCase()})</option>
                            <option value="best">⚡ Best</option>
                            <option value="1080p">🌟 1080p FHD</option>
                            <option value="720p">📺 720p HD</option>
                            <option value="480p">📱 480p SD</option>
                            <option value="audio">🎵 MP3 Audio</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Compact summary when not customizing */}
              {!isCustomizeOpen && probeResult.entries && probeResult.entries.length > 0 && (
                <div className="max-h-24 overflow-y-auto space-y-1 bg-black/40 p-2 rounded-lg border border-gray-800 text-[11px] font-mono text-gray-300">
                  {probeResult.entries.slice(0, 5).map((entry, idx) => (
                    <div key={entry.id || idx} className="truncate flex items-center justify-between gap-2">
                      <span className="truncate">{idx + 1}. {entry.title}</span>
                      {entry.durationFormatted && <span className="text-gray-500 flex-shrink-0">{entry.durationFormatted}</span>}
                    </div>
                  ))}
                  {probeResult.entries.length > 5 && (
                    <div className="text-cyan-400 font-semibold pt-1 text-center text-[10px]">
                      + {probeResult.entries.length - 5} more items will be enqueued
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Direct File Probe Preview Card */}
          {probeResult && !probeResult.isPlaylist && probeResult.extractor === 'direct' && (
            <div className="p-3.5 bg-gray-900/90 rounded-xl border border-emerald-800/40 space-y-2.5">
              <div className="flex gap-3 items-center">
                <div className="w-12 h-12 rounded-xl bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center flex-shrink-0 text-emerald-400">
                  <File className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700 uppercase">
                      {(probeResult as any).category || 'Direct File'}
                    </span>
                    {(probeResult as any).filesizeFormatted && (
                      <span className="text-[11px] text-cyan-300 font-mono font-bold">
                        {(probeResult as any).filesizeFormatted}
                      </span>
                    )}
                  </div>
                  <h5 className="font-semibold text-xs text-gray-100 truncate mt-1" title={probeResult.title}>
                    {probeResult.title}
                  </h5>
                  <p className="text-[10px] text-gray-400 truncate mt-0.5 font-mono">
                    {probeResult.uploader || 'Direct HTTP Stream'}
                  </p>
                </div>
              </div>

              {(probeResult as any).supportsRange !== undefined && (
                <div className="text-[11px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/40 border border-gray-800">
                  {(probeResult as any).supportsRange ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                      <span className="text-cyan-300">
                        <strong>Range Resuming Supported:</strong> Multi-segment turbo acceleration active (up to 32 connections).
                      </span>
                    </>
                  ) : (
                    <>
                      <Info className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <span className="text-amber-300">
                        Single-stream direct download (server does not advertise byte ranges).
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Media Probe Preview Card (Single Item) */}
          {probeResult && !probeResult.isPlaylist && probeResult.extractor !== 'direct' && (
            <div className="p-3 bg-gray-900/80 rounded-xl border border-sky-800/40 flex gap-3 items-center">
              {probeResult.thumbnail && (
                <img
                  src={probeResult.thumbnail}
                  alt={probeResult.title}
                  className="w-16 h-16 rounded-lg object-cover bg-gray-800 flex-shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <h5 className="font-semibold text-xs text-gray-200 truncate">{probeResult.title}</h5>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {probeResult.uploader} • {probeResult.durationFormatted || 'Stream'}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setAudioOnly(false)}
                    className={`px-2 py-1 text-[11px] rounded-lg font-medium flex items-center gap-1 ${
                      !audioOnly ? 'bg-sky-500 text-white' : 'bg-gray-800 text-gray-400'
                    }`}
                  >
                    <Film className="w-3 h-3" /> Video
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudioOnly(true)}
                    className={`px-2 py-1 text-[11px] rounded-lg font-medium flex items-center gap-1 ${
                      audioOnly ? 'bg-sky-500 text-white' : 'bg-gray-800 text-gray-400'
                    }`}
                  >
                    <Music className="w-3 h-3" /> Audio (MP3)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quality Picker (if single video options available) */}
          {probeResult && !probeResult.isPlaylist && probeResult.extractor !== 'direct' && !audioOnly && probeResult.formats && probeResult.formats.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Select Stream Quality
              </label>
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-sky-500 font-mono"
              >
                <option value="">
                  ⚡ Best Available Quality (Auto 4K / 1080p MP4)
                </option>
                {probeResult.formats
                  .filter((f) => f.hasVideo)
                  .map((f) => (
                    <option key={f.formatId} value={f.formatId}>
                      {f.qualityLabel} ({f.ext}) {f.filesizeFormatted ? `— ${f.filesizeFormatted}` : ''}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Filename Override (for single downloads) */}
          {(!probeResult || !probeResult.isPlaylist) && (
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Custom File Name (Optional)
              </label>
              <input
                type="text"
                value={customFilename}
                onChange={(e) => setCustomFilename(e.target.value)}
                placeholder="e.g. video_name.mp4"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3.5 py-2 text-sm text-gray-100 focus:outline-none focus:border-sky-500"
              />
            </div>
          )}

          {/* Parallel Segments / Connections Slider (1 - 32) */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-gray-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" /> Parallel Range Connections
              </span>
              <span className="font-mono text-cyan-400 font-bold">{connections} Segments</span>
            </div>
            <input
              type="range"
              min="1"
              max="32"
              value={connections}
              onChange={(e) => setConnections(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-400 bg-gray-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-mono">
              <span>1 (Single)</span>
              <span>8 (Standard)</span>
              <span>16 (Turbo)</span>
              <span>32 (Max Multi-Core)</span>
            </div>
          </div>

          {/* Subtitles & Transcripts Toggle (Only for stream media) */}
          {(!probeResult || probeResult.extractor !== 'direct') && (
          <div className="p-3 bg-gray-900/80 rounded-xl border border-gray-700/80 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <input
                  type="checkbox"
                  id="subtitlesToggle"
                  checked={downloadSubtitles}
                  onChange={(e) => setDownloadSubtitles(e.target.checked)}
                  className="w-4 h-4 rounded accent-cyan-400 cursor-pointer"
                />
                <label htmlFor="subtitlesToggle" className="cursor-pointer min-w-0">
                  <div className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span>Download Subtitles & Clean .txt Transcripts</span>
                  </div>
                  <div className="text-[11px] text-gray-400 truncate">
                    Saved in dedicated video subfolder without timestamp clutter
                  </div>
                </label>
              </div>
              {probeResult?.hasSubtitles && (
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800 whitespace-nowrap flex-shrink-0">
                  Available ({probeResult.subtitlesList?.length || 0})
                </span>
              )}
            </div>

            {/* Active Subtitle Languages Chips */}
            {downloadSubtitles && (
              <div className="flex items-center gap-1.5 pl-6 pt-1 text-[11px] text-gray-400">
                <Languages className="w-3.5 h-3.5 text-cyan-400" />
                <span>Languages:</span>
                <div className="flex items-center gap-1">
                  {configuredLanguages.map((lang) => (
                    <span
                      key={lang}
                      className="px-1.5 py-0.5 rounded bg-sky-950/80 text-cyan-300 border border-sky-800 text-[10px] font-mono font-bold uppercase"
                    >
                      {lang}
                    </span>
                  ))}
                </div>
                <span className="text-[10px] text-gray-500 font-sans">(Max 3 • set in Settings)</span>
              </div>
            )}
          </div>
          )}

          {/* Footer Submit */}
          <div className="pt-3 border-t border-gray-800 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-white font-semibold text-sm shadow-lg shadow-sky-500/20 transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Start Download
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
