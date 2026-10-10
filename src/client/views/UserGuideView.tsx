import React from 'react';
import { 
  BookOpen, 
  Sparkles, 
  Cpu, 
  Smartphone, 
  Puzzle, 
  Terminal, 
  Globe, 
  HelpCircle,
  FileText 
} from 'lucide-react';

export const UserGuideView: React.FC = () => {
  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto pb-10">
      {/* Welcome Banner */}
      <div className="glass-panel rounded-2xl p-6 border border-gray-800 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-lg text-gray-100">CLAG Downloader — Official Manual & Guide</h3>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-950/80 border border-sky-800 text-xs w-fit">
            <span className="text-gray-400">Made by :</span>
            <span className="font-semibold text-cyan-400">Wael Sayed</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          Welcome to CLAG Downloader. This manual guides you through using CLAG across all its forms: 
          desktop application, browser extension, mobile PWA, and command line.
        </p>
      </div>

      {/* Chapters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Chapter 1 */}
        <div className="glass-card rounded-2xl p-5 border border-gray-800 space-y-2.5">
          <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-wider">
            <Cpu className="w-4 h-4" /> 1. Accelerated Chunk Engine
          </div>
          <h4 className="font-semibold text-sm text-gray-200">How 1–32 Multi-Connections Work</h4>
          <p className="text-xs text-gray-400 leading-relaxed">
            Unlike standard browser single-thread downloads, CLAG uses HTTP Range headers to split files into 
            up to 32 parallel segments. If a connection lags, CLAG dynamically sub-partitions the remaining bytes, 
            maximizing your network throughput.
          </p>
        </div>

        {/* Chapter 2 */}
        <div className="glass-card rounded-2xl p-5 border border-gray-800 space-y-2.5">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" /> 2. Universal Media Grabbing
          </div>
          <h4 className="font-semibold text-sm text-gray-200">Grabbing from Social & Video Sites</h4>
          <p className="text-xs text-gray-400 leading-relaxed">
            Paste any link from YouTube, Instagram Reels, Facebook, TikTok, Twitter/X, Reddit, or Twitch. 
            Click <strong>Probe</strong> to preview available qualities (4K, 1080p, 720p) or extract audio as MP3. 
            FFmpeg automatically merges audio and video losslessly.
          </p>
        </div>

        {/* Chapter 2.5 - Subtitles & Transcripts */}
        <div className="glass-card rounded-2xl p-5 border border-gray-800 space-y-2.5">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
            <FileText className="w-4 h-4" /> 3. Subtitles & Clean Text Transcripts
          </div>
          <h4 className="font-semibold text-sm text-gray-200">Rate-Limit Shield & Dedicated Subfolders</h4>
          <p className="text-xs text-gray-400 leading-relaxed">
            CLAG automatically extracts clean plain text transcripts (<code className="text-cyan-300 font-mono">.txt</code>) without timecodes or clutter, alongside standard <code className="text-cyan-300 font-mono">.srt</code> subtitles.
            To eliminate YouTube <strong>HTTP 429 rate limits</strong>, choose up to 3 preferred languages in Settings. Subtitles are automatically organized into an isolated subfolder named after the video.
          </p>
        </div>

        {/* Chapter 3 */}
        <div className="glass-card rounded-2xl p-5 border border-gray-800 space-y-2.5">
          <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase tracking-wider">
            <Puzzle className="w-4 h-4" /> 3. Chrome / Edge Extension
          </div>
          <h4 className="font-semibold text-sm text-gray-200">IDM-Style Floating Video Panel</h4>
          <p className="text-xs text-gray-400 leading-relaxed">
            Load the unpacked extension from <code className="text-cyan-400 font-mono">extension/</code> into Chrome. 
            A floating <strong>"Download with CLAG"</strong> button will automatically appear over video players, 
            allowing 1-click downloads directly from your browser.
          </p>
        </div>

        {/* Chapter 4 */}
        <div className="glass-card rounded-2xl p-5 border border-gray-800 space-y-2.5">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <Smartphone className="w-4 h-4" /> 4. Mobile PWA & Remote Access
          </div>
          <h4 className="font-semibold text-sm text-gray-200">Phone & Tablet Installation</h4>
          <p className="text-xs text-gray-400 leading-relaxed">
            Connect your phone to the same Wi-Fi and open <code className="text-cyan-400 font-mono">http://&lt;computer-ip&gt;:8989</code>. 
            Tap <strong>"Add to Home Screen"</strong> to install CLAG as a native mobile app. You can add and monitor downloads from your phone!
          </p>
        </div>
      </div>

      {/* Chapter 5 - CLI */}
      <div className="glass-panel rounded-2xl p-5 border border-gray-800 space-y-3">
        <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
          <Terminal className="w-4 h-4" /> 5. Python CLI & Terminal Automation
        </div>
        <p className="text-xs text-gray-400">
          Run CLAG from your command prompt or PowerShell with full acceleration:
        </p>
        <div className="bg-gray-950 p-3.5 rounded-xl border border-gray-800 font-mono text-xs text-gray-300 space-y-1 overflow-x-auto">
          <div><span className="text-gray-500"># Direct 16-segment download:</span></div>
          <div><span className="text-cyan-400">python</span> -m src.python.clag_cli https://example.com/file.zip -s 16</div>
          <div className="pt-1"><span className="text-gray-500"># Grab YouTube or Instagram video with FFmpeg:</span></div>
          <div><span className="text-cyan-400">python</span> -m src.python.clag_cli https://youtube.com/watch?v=... -m</div>
        </div>
      </div>
    </div>
  );
};
