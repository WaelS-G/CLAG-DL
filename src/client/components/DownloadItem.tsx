import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  Trash2, 
  Folder, 
  AlertCircle, 
  CheckCircle2, 
  File, 
  Film, 
  Music, 
  Archive, 
  FileCode, 
  FileText, 
  Image,
  ChevronDown,
  ChevronUp,
  Cpu,
  PlayCircle,
  Clock,
  FolderTree
} from 'lucide-react';
import { DownloadTaskData } from '../../types/index.js';
import { ChunkBar } from './ChunkBar';

interface DownloadItemProps {
  task: DownloadTaskData;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenFolder: (path: string, task?: DownloadTaskData) => void;
  onOpenFile?: (path: string, task?: DownloadTaskData, targetType?: 'media' | 'transcript_clean' | 'transcript_timed') => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 ** 3)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 ** 2)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s';
  if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / (1024 ** 2)).toFixed(1)} MB/s`;
  return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
}

function formatEta(seconds: number): string {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 60) {
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  }
  return `${mins}m ${secs}s`;
}

export const DownloadItem: React.FC<DownloadItemProps> = ({
  task,
  onPause,
  onResume,
  onDelete,
  onOpenFolder,
  onOpenFile,
}) => {
  const [showChunks, setShowChunks] = useState(false);

  const getCategoryIcon = () => {
    switch (task.category) {
      case 'video': return Film;
      case 'audio': return Music;
      case 'compressed': return Archive;
      case 'program': return FileCode;
      case 'document': return FileText;
      case 'image': return Image;
      default: return File;
    }
  };

  const IconComponent = getCategoryIcon();

  const getStatusBadge = () => {
    switch (task.status) {
      case 'downloading':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-950 text-sky-400 border border-sky-800 animate-pulse">Downloading</span>;
      case 'fetching_meta':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-950 text-indigo-400 border border-indigo-800">Probing...</span>;
      case 'merging':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-950 text-purple-400 border border-purple-800">Muxing Audio/Video</span>;
      case 'completed':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Completed</span>;
      case 'paused':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950 text-amber-400 border border-amber-800">Paused</span>;
      case 'error':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-950 text-rose-400 border border-rose-800 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Error</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-800 text-gray-400">Queued</span>;
    }
  };

  const getSourceBadge = () => {
    const src = (task.source || 'Direct').toLowerCase();
    if (src.includes('youtube')) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800/60 shadow-sm flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
          YouTube
        </span>
      );
    }
    if (src.includes('instagram')) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-pink-950/80 text-pink-300 border border-pink-800/60 shadow-sm flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>
          Instagram
        </span>
      );
    }
    if (src.includes('tiktok')) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-950/80 text-teal-300 border border-teal-800/60 shadow-sm flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
          TikTok
        </span>
      );
    }
    if (src.includes('twitter') || src.includes('x')) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-950/80 text-sky-300 border border-sky-800/60 shadow-sm">
          Twitter / X
        </span>
      );
    }
    if (src.includes('facebook')) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-950/80 text-blue-300 border border-blue-800/60 shadow-sm">
          Facebook
        </span>
      );
    }
    if (src.includes('soundcloud')) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/60 shadow-sm">
          SoundCloud
        </span>
      );
    }
    if (src.includes('reddit')) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-950/80 text-orange-300 border border-orange-800/60 shadow-sm">
          Reddit
        </span>
      );
    }
    if (src.includes('vimeo')) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 shadow-sm">
          Vimeo
        </span>
      );
    }
    if (src.includes('twitch')) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-950/80 text-purple-300 border border-purple-800/60 shadow-sm">
          Twitch
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-800/90 text-gray-300 border border-gray-700/60">
        {task.source || 'Direct'}
      </span>
    );
  };

  const getQualityBadge = () => {
    const qLabel = task.qualityLabel || (task.audioOnly || task.category === 'audio' ? 'MP3 Audio' : null);
    if (!qLabel) return null;
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold font-mono bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 shadow-sm flex items-center gap-1">
        {task.audioOnly || task.category === 'audio' ? <Music className="w-2.5 h-2.5 text-indigo-400" /> : <Film className="w-2.5 h-2.5 text-indigo-400" />}
        {qLabel}
      </span>
    );
  };

  const getFileSizeBadge = () => {
    const bytes = task.totalBytes > 0 ? task.totalBytes : task.downloadedBytes;
    if (!bytes || bytes <= 0) return null;
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 shadow-sm">
        {formatBytes(bytes)}
      </span>
    );
  };

  const getSubtitlesBadge = () => {
    if (!task.hasSubtitles && !task.subtitlesTextPath) return null;
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/60 shadow-sm flex items-center gap-1">
        <FileText className="w-2.5 h-2.5 text-amber-400" />
        Subtitles (.txt)
      </span>
    );
  };

  return (
    <div className="glass-card rounded-2xl p-4 transition-all hover:border-gray-600/80 shadow-md">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* File & Metadata */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {task.thumbnail ? (
            <img
              src={task.thumbnail}
              alt={task.filename}
              className="w-12 h-12 rounded-xl object-cover bg-gray-800 border border-gray-700 flex-shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-gray-800/90 border border-gray-700 flex items-center justify-center flex-shrink-0 text-cyan-400">
              <IconComponent className="w-6 h-6" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-sm text-gray-100 truncate max-w-full" title={task.filename}>
                {task.filename}
              </h4>
              {getStatusBadge()}
              {getSourceBadge()}
              {getQualityBadge()}
              {getFileSizeBadge()}
              {getSubtitlesBadge()}
            </div>
            <p className="text-xs text-gray-400 truncate max-w-full font-mono mt-0.5" title={task.originalUrl || task.url}>
              {task.originalUrl || task.url}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 self-end sm:self-center">
          {task.chunks && task.chunks.length > 0 && (
            <button
              onClick={() => setShowChunks(!showChunks)}
              className="p-2 rounded-xl text-gray-400 hover:text-cyan-300 hover:bg-gray-800 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
              title="Toggle Chunk Matrix"
            >
              <Cpu className="w-4 h-4" />
            </button>
          )}

          {task.status === 'downloading' ? (
            <button
              onClick={() => onPause(task.id)}
              className="p-2 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-all min-w-[40px] min-h-[40px] flex items-center justify-center"
              title="Pause"
            >
              <Pause className="w-4 h-4" />
            </button>
          ) : task.status === 'completed' ? (
            <div className="flex items-center gap-1.5">
              {/* Clean text transcript without timestamps */}
              {task.subtitlesTextPath && onOpenFile && (
                <button
                  onClick={() => onOpenFile(task.subtitlesTextPath!, task, 'transcript_clean')}
                  className="p-2 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-all min-w-[40px] min-h-[40px] flex items-center justify-center group"
                  title="Open Clean Transcript (.txt without timestamps)"
                >
                  <FileText className="w-4 h-4 group-hover:scale-110 transition-transform text-amber-300" />
                </button>
              )}
              {/* Timed transcript with timestamps */}
              {task.subtitlesTimestampsPath && onOpenFile && (
                <button
                  onClick={() => onOpenFile(task.subtitlesTimestampsPath!, task, 'transcript_timed')}
                  className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 transition-all min-w-[40px] min-h-[40px] flex items-center justify-center group"
                  title="Open Timed Transcript (.txt with timestamps)"
                >
                  <Clock className="w-4 h-4 group-hover:scale-110 transition-transform text-indigo-300" />
                </button>
              )}
              {/* Subtitles folder (contains untouched .srt and both .txt transcripts) */}
              {task.subtitlesDir && (
                <button
                  onClick={() => onOpenFolder(task.subtitlesDir!, task)}
                  className="p-2 rounded-xl bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 transition-all min-w-[40px] min-h-[40px] flex items-center justify-center group"
                  title="Open Subtitles Folder (.srt & .txt)"
                >
                  <FolderTree className="w-4 h-4 group-hover:scale-110 transition-transform text-purple-300" />
                </button>
              )}
              {/* Play / launch media file with default system player or in-app modal */}
              {onOpenFile && (
                <button
                  onClick={() => onOpenFile(task.savePath, task, 'media')}
                  className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20 transition-all min-w-[40px] min-h-[40px] flex items-center justify-center group"
                  title="Play Media File (Video / Audio)"
                >
                  <PlayCircle className="w-4 h-4 group-hover:scale-110 transition-transform text-cyan-300" />
                </button>
              )}
              {/* Show media file highlighted in folder or show device location modal */}
              <button
                onClick={() => onOpenFolder(task.savePath, task)}
                className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all min-w-[40px] min-h-[40px] flex items-center justify-center group"
                title="Show in Folder"
              >
                <Folder className="w-4 h-4 group-hover:scale-110 transition-transform text-emerald-300" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onResume(task.id)}
              className="p-2 rounded-xl bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/20 transition-all min-w-[40px] min-h-[40px] flex items-center justify-center"
              title="Resume"
            >
              <Play className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => onDelete(task.id)}
            className="p-2 rounded-xl text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress & Speed Stats */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5 font-mono">
          <span>
            {task.status === 'completed'
              ? `${formatBytes(task.downloadedBytes || task.totalBytes || 0)} (100%)`
              : task.totalBytes > 0
              ? `${formatBytes(task.downloadedBytes)} / ${formatBytes(task.totalBytes)} (${task.progress.toFixed(1)}%)`
              : task.downloadedBytes > 0
              ? `${formatBytes(task.downloadedBytes)} downloaded (Stream)`
              : 'Connecting stream...'}
          </span>
          <div className="flex items-center gap-3">
            {task.status === 'downloading' && (
              <>
                <span className="text-cyan-300 font-semibold">{formatSpeed(task.speed)}</span>
                <span>ETA: {formatEta(task.eta)}</span>
              </>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              task.status === 'completed'
                ? 'bg-emerald-500'
                : task.status === 'error'
                ? 'bg-rose-500'
                : 'bg-gradient-to-r from-sky-500 via-cyan-400 to-indigo-500'
            }`}
            style={{ width: `${Math.max(0, Math.min(100, task.progress))}%` }}
          />
        </div>
      </div>

      {/* IDM Segmented Chunk Visualizer */}
      {(showChunks || task.status === 'downloading') && task.chunks && task.chunks.length > 0 && (
        <ChunkBar chunks={task.chunks} connections={task.connections} />
      )}

      {task.error && (
        <div className="mt-2 text-xs text-rose-400 flex items-center gap-1.5 bg-rose-950/40 p-2 rounded-lg border border-rose-900/50">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{task.error}</span>
        </div>
      )}
    </div>
  );
};
