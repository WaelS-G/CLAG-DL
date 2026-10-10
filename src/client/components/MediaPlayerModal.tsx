import React, { useRef } from 'react';
import { X, Play, Film, Music, Share2, Download, ExternalLink, Check } from 'lucide-react';
import { DownloadTaskData } from '../../types/index.js';

interface MediaPlayerModalProps {
  task: DownloadTaskData | null;
  onClose: () => void;
}

export const MediaPlayerModal: React.FC<MediaPlayerModalProps> = ({ task, onClose }) => {
  const [copied, setCopied] = React.useState(false);
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);

  if (!task) return null;

  const isAudio = task.audioOnly || task.category === 'audio';
  const streamUrl = task.blobUrl || task.originalUrl || task.url;
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  const handleShare = async () => {
    if (canShare) {
      try {
        await navigator.share({
          title: task.filename,
          text: `Playing ${task.filename} via CLAG Downloader`,
          url: streamUrl,
        });
      } catch (e) {}
    } else {
      navigator.clipboard.writeText(streamUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenExternal = () => {
    window.open(streamUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1 pr-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0">
              {isAudio ? <Music className="w-4 h-4" /> : <Film className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-sm text-gray-100 truncate">{task.filename}</h3>
              <p className="text-[11px] text-gray-400 truncate">{task.source || 'Media Stream'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Player Body */}
        <div className="p-4 bg-black/60 flex flex-col items-center justify-center">
          {isAudio ? (
            <div className="w-full py-8 px-4 flex flex-col items-center justify-center space-y-4">
              {task.thumbnail ? (
                <img
                  src={task.thumbnail}
                  alt={task.filename}
                  className="w-32 h-32 rounded-2xl object-cover shadow-2xl border border-gray-700"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-indigo-950/80 border border-indigo-700/60 flex items-center justify-center text-indigo-400">
                  <Music className="w-12 h-12" />
                </div>
              )}
              <audio
                ref={mediaRef as any}
                src={streamUrl}
                controls
                autoPlay
                className="w-full max-w-md accent-cyan-400 mt-4"
              />
            </div>
          ) : (
            <div className="w-full aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center border border-gray-800">
              <video
                ref={mediaRef as any}
                src={streamUrl}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain"
                poster={task.thumbnail}
              >
                Your browser does not support HTML5 video streaming.
              </video>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-800 flex flex-wrap items-center justify-between gap-3 bg-gray-900/60">
          <div className="text-xs text-gray-400">
            Playing directly in-browser on mobile/web.
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 text-xs font-medium flex items-center gap-1.5 transition-colors min-h-[40px]"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-cyan-400" />}
              <span>{canShare ? 'Share / Open in App' : copied ? 'Link Copied' : 'Copy Link'}</span>
            </button>

            <button
              onClick={handleOpenExternal}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-white font-medium text-xs flex items-center gap-1.5 shadow-md transition-all min-h-[40px]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in New Tab</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
