import React from 'react';
import { 
  Radio, 
  Puzzle, 
  ExternalLink, 
  Sparkles, 
  CheckCircle2, 
  Video, 
  Music, 
  Film,
  Download
} from 'lucide-react';

interface MediaSnifferViewProps {
  onQuickDownload: (url: string) => void;
}

export const MediaSnifferView: React.FC<MediaSnifferViewProps> = ({ onQuickDownload }) => {
  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="glass-panel rounded-2xl p-6 border border-gray-800 relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-44 h-44 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div className="space-y-1.5 flex-1">
            <h3 className="font-bold text-base text-gray-100 flex items-center gap-2">
              Browser Media Sniffer (IDM Video Grabber Panel)
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">
                Active
              </span>
            </h3>
            <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
              When the CLAG Browser Extension is installed, a floating <strong>"Download with CLAG"</strong> panel 
              automatically overlays on web video players (YouTube, Instagram Reels, Facebook, TikTok, Vimeo, Twitch, and direct HTML5 players). 
              It sniffs all video resolutions, audio streams, HLS playlists (.m3u8), and DASH manifests in real time.
            </p>
          </div>
        </div>
      </div>

      {/* Extension Setup Guide */}
      <div className="glass-panel rounded-2xl p-6 border border-gray-800 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-200">
          <Puzzle className="w-4 h-4 text-sky-400" />
          How to load the CLAG Browser Extension in Chrome / Edge / Brave:
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900/80 p-4 rounded-xl border border-gray-800 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs">
              1
            </div>
            <h5 className="font-semibold text-xs text-gray-200">Open Extensions Settings</h5>
            <p className="text-xs text-gray-400">
              Open your browser and navigate to <code className="text-cyan-400 font-mono bg-gray-950 px-1 py-0.5 rounded">chrome://extensions</code> (or <code className="text-cyan-400 font-mono bg-gray-950 px-1 py-0.5 rounded">edge://extensions</code>).
            </p>
          </div>

          <div className="bg-gray-900/80 p-4 rounded-xl border border-gray-800 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs">
              2
            </div>
            <h5 className="font-semibold text-xs text-gray-200">Enable Developer Mode</h5>
            <p className="text-xs text-gray-400">
              Turn on the <strong>Developer mode</strong> toggle switch at the top-right corner of the page.
            </p>
          </div>

          <div className="bg-gray-900/80 p-4 rounded-xl border border-gray-800 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs">
              3
            </div>
            <h5 className="font-semibold text-xs text-gray-200">Load Unpacked</h5>
            <p className="text-xs text-gray-400">
              Click <strong>"Load unpacked"</strong> and select the <code className="text-cyan-400 font-mono bg-gray-950 px-1 py-0.5 rounded">extension/</code> folder inside the CLAG project!
            </p>
          </div>
        </div>
      </div>

      {/* Quick Test Demo Streams */}
      <div className="glass-panel rounded-2xl p-6 border border-gray-800 space-y-3">
        <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
          Quick Test Streams (Verify Acceleration Engine)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-gray-900/60 p-3.5 rounded-xl border border-gray-800 flex items-center justify-between">
            <div>
              <div className="font-semibold text-xs text-gray-200">Big Buck Bunny (MP4 1080p)</div>
              <div className="text-[11px] text-gray-500 font-mono">commondatastorage.googleapis.com</div>
            </div>
            <button
              onClick={() => onQuickDownload('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4')}
              className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs flex items-center gap-1 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> Grab
            </button>
          </div>

          <div className="bg-gray-900/60 p-3.5 rounded-xl border border-gray-800 flex items-center justify-between">
            <div>
              <div className="font-semibold text-xs text-gray-200">Sintel 4K Sample Stream</div>
              <div className="text-[11px] text-gray-500 font-mono">commondatastorage.googleapis.com</div>
            </div>
            <button
              onClick={() => onQuickDownload('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4')}
              className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs flex items-center gap-1 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> Grab
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
