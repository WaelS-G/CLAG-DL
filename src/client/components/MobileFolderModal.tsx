import React, { useState } from 'react';
import {
  X,
  Folder,
  Smartphone,
  Share2,
  PlayCircle,
  Download,
  Check,
  ShieldCheck,
  FolderOpen,
  Apple,
  ExternalLink,
} from 'lucide-react';
import { DownloadTaskData } from '../../types/index.js';

interface MobileFolderModalProps {
  task: DownloadTaskData | null;
  onClose: () => void;
  onPlayMedia?: (task: DownloadTaskData) => void;
}

export const MobileFolderModal: React.FC<MobileFolderModalProps> = ({ task, onClose, onPlayMedia }) => {
  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!task) return null;

  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const fileUrl = task.blobUrl || task.originalUrl || task.url;

  // Open native Android file manager / Downloads app via Android Intent
  const handleOpenAndroidDownloads = () => {
    try {
      setStatusMsg('Opening Android Downloads app...');
      window.location.href = 'intent:#Intent;action=android.intent.action.VIEW_DOWNLOADS;end';
    } catch (e) {
      window.open('content://com.android.providers.downloads.documents/root/downloads', '_blank');
    }
  };

  // Open native Apple Files app on iOS via system URL scheme
  const handleOpenIOSFiles = () => {
    try {
      setStatusMsg('Opening Apple Files app...');
      window.location.href = 'shareddocuments://';
    } catch (e) {
      setStatusMsg('Unable to trigger shareddocuments:// URL scheme');
    }
  };

  // Trigger File System Access API picker if supported
  const handleBrowseDeviceFolders = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        setStatusMsg('Select device folder to explore...');
        await (window as any).showDirectoryPicker();
      } else if ('showOpenFilePicker' in window) {
        await (window as any).showOpenFilePicker();
      } else {
        setStatusMsg('System folder picker not supported in this browser. Use native buttons below.');
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setStatusMsg('Device folder permission dismissed.');
      }
    }
  };

  // Auto-detect and open appropriate native explorer
  const handleOpenNativeExplorer = () => {
    if (isAndroid) {
      handleOpenAndroidDownloads();
    } else if (isIOS) {
      handleOpenIOSFiles();
    } else {
      handleBrowseDeviceFolders();
    }
  };

  // Share file to system sheet (on iOS triggers native "Save to Files" dialog!)
  const handleShareFile = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        if (task.blobUrl) {
          const res = await fetch(task.blobUrl);
          const blob = await res.blob();
          const file = new File([blob], task.filename, { type: blob.type || 'application/octet-stream' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: task.filename,
              text: `File downloaded with CLAG: ${task.filename}`,
            });
            return;
          }
        }
        await navigator.share({
          title: task.filename,
          text: `File downloaded with CLAG: ${task.filename}`,
          url: fileUrl,
        });
      } catch (e) {}
    } else {
      navigator.clipboard.writeText(fileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadAgain = () => {
    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = task.filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-md rounded-2xl shadow-2xl border border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Folder className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-gray-100">Device File Explorer & Storage</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs text-gray-300 overflow-y-auto">
          {/* File Card */}
          <div className="p-3 bg-gray-900/90 rounded-xl border border-gray-800 space-y-1.5">
            <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">File Name:</div>
            <div className="font-bold text-sm text-cyan-300 truncate font-mono">{task.filename}</div>
            <div className="text-[11px] text-gray-400">
              Category: <span className="text-gray-200 capitalize font-medium">{task.category}</span>
              {task.totalBytes > 0 && ` • Size: ${(task.totalBytes / (1024 * 1024)).toFixed(1)} MB`}
            </div>
          </div>

          {statusMsg && (
            <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-800/60 text-cyan-300 text-xs text-center font-medium">
              {statusMsg}
            </div>
          )}

          {/* Primary Action: Direct File Explorer Launch */}
          <div className="space-y-2">
            <button
              onClick={handleOpenNativeExplorer}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all min-h-[46px]"
            >
              <FolderOpen className="w-4 h-4" />
              <span>
                {isAndroid
                  ? 'Open Android Downloads App'
                  : isIOS
                  ? 'Open iOS Files App'
                  : 'Open Device File Explorer'}
              </span>
            </button>
          </div>

          {/* Individual OS Launchers */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleOpenAndroidDownloads}
              className="py-2.5 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors min-h-[42px]"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Android Files</span>
            </button>

            <button
              onClick={handleOpenIOSFiles}
              className="py-2.5 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors min-h-[42px]"
            >
              <Apple className="w-3.5 h-3.5 text-gray-200" />
              <span>iOS Files App</span>
            </button>
          </div>

          {/* Browse device folders via Web File System API */}
          {typeof window !== 'undefined' && 'showDirectoryPicker' in window && (
            <button
              onClick={handleBrowseDeviceFolders}
              className="w-full py-2.5 px-3 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-sky-300 border border-sky-800/40 text-xs font-medium flex items-center justify-center gap-2 transition-colors min-h-[42px]"
            >
              <Folder className="w-3.5 h-3.5 text-sky-400" />
              <span>Browse Device Folders (System Picker)</span>
            </button>
          )}

          {/* Quick Actions */}
          <div className="space-y-2 pt-1 border-t border-gray-800">
            {onPlayMedia && (
              <button
                onClick={() => {
                  onClose();
                  onPlayMedia(task);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md transition-all min-h-[44px]"
              >
                <PlayCircle className="w-4 h-4" />
                <span>Play / Preview Media in CLAG</span>
              </button>
            )}

            <button
              onClick={handleShareFile}
              className="w-full py-2.5 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 font-medium text-xs flex items-center justify-center gap-2 transition-colors min-h-[44px]"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-cyan-400" />}
              <span>Share / Send to VLC, Gallery, or Files</span>
            </button>

            <button
              onClick={handleDownloadAgain}
              className="w-full py-2 px-4 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-800 text-xs flex items-center justify-center gap-2 transition-colors min-h-[40px]"
            >
              <Download className="w-3.5 h-3.5 text-gray-400" />
              <span>Save / Download File Again</span>
            </button>
          </div>

          {/* OS Location Guide */}
          <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-3 space-y-1.5 text-[11px] text-gray-300">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Standard Mobile Save Location</span>
            </div>
            <ul className="space-y-1 text-gray-400 list-disc list-inside">
              <li>
                <strong className="text-gray-300">Android:</strong> Stored in <em>Internal Storage &gt; Download</em> (accessible in Google Files or Samsung My Files).
              </li>
              <li>
                <strong className="text-gray-300">iOS:</strong> Stored in <em>Files App &gt; On My iPhone &gt; Downloads</em>.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
