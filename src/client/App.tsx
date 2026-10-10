import React, { useState, useEffect, useRef } from 'react';
import { useCLAGSocket } from './hooks/useCLAGSocket';
import { Navbar } from './components/Navbar';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { AddDownloadModal } from './components/AddDownloadModal';
import { TransfersView } from './views/TransfersView';
import { LinkGrabberView } from './views/LinkGrabberView';
import { MediaSnifferView } from './views/MediaSnifferView';
import { SettingsView } from './views/SettingsView';
import { UserGuideView } from './views/UserGuideView';
import { playSuccessChime, playErrorChime } from './utils/audioAlert';
import { DownloadCategory, GrabberLinkItem, DownloadTaskData } from '../types/index.js';
import { Clipboard, ArrowRight, X } from 'lucide-react';
import { MediaPlayerModal } from './components/MediaPlayerModal';
import { MobileFolderModal } from './components/MobileFolderModal';
import { TranscriptViewerModal } from './components/TranscriptViewerModal';

export default function App() {
  const { 
    tasks, 
    isConnected, 
    isWebOnly, 
    totalSpeed, 
    pauseDownload, 
    resumeDownload, 
    deleteDownload, 
    addBrowserDownload 
  } = useCLAGSocket();

  const [activeTab, setActiveTab] = useState<ActiveTab>('transfers');
  const [selectedCategory, setSelectedCategory] = useState<DownloadCategory>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);

  // Mobile & In-Browser Modals
  const [playingMediaTask, setPlayingMediaTask] = useState<DownloadTaskData | null>(null);
  const [mobileFolderTask, setMobileFolderTask] = useState<DownloadTaskData | null>(null);
  const [viewingTranscript, setViewingTranscript] = useState<{ title: string; filename: string; text: string } | null>(null);

  const prevTasksRef = useRef(tasks);

  // Sound cues on status change
  useEffect(() => {
    tasks.forEach((t) => {
      const prev = prevTasksRef.current.find((p) => p.id === t.id);
      if (prev && prev.status === 'downloading' && t.status === 'completed') {
        playSuccessChime();
      } else if (prev && prev.status === 'downloading' && t.status === 'error') {
        playErrorChime();
      }
    });
    prevTasksRef.current = tasks;
  }, [tasks]);

  // Clipboard Auto-Sniffer on Window Focus
  useEffect(() => {
    let lastChecked = '';
    const checkClipboard = async () => {
      try {
        if (navigator.clipboard && document.hasFocus()) {
          const text = await navigator.clipboard.readText();
          if (
            text && 
            text !== lastChecked && 
            (text.startsWith('http://') || text.startsWith('https://')) &&
            !tasks.some((t) => t.url === text.trim())
          ) {
            lastChecked = text;
            setClipboardUrl(text.trim());
          }
        }
      } catch (e) {}
    };

    window.addEventListener('focus', checkClipboard);
    return () => window.removeEventListener('focus', checkClipboard);
  }, [tasks]);

  // Global Keyboard Shortcuts (Ctrl+N, Ctrl+V)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setIsAddModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAddDownload = async (params: any) => {
    if (isWebOnly || !isConnected) {
      addBrowserDownload(params);
    } else {
      try {
        const res = await fetch('/api/downloads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });

        if (!res.ok) {
          throw new Error('API server returned error');
        }
      } catch (e) {
        addBrowserDownload(params);
      }
    }
    setActiveTab('transfers');
  };

  const handleStartGrabberItems = async (items: GrabberLinkItem[]) => {
    for (const item of items) {
      const isMedia = !!(item.category === 'video' || item.category === 'audio' || item.selectedFormatId || item.qualityLabel || item.audioOnly);
      await handleAddDownload({
        url: item.url,
        filename: item.filename,
        connections: 16,
        downloadSubtitles: true,
        mediaFormatId: item.selectedFormatId,
        qualityLabel: item.qualityLabel,
        audioOnly: item.audioOnly,
        isMediaStream: isMedia,
      });
    }
    setActiveTab('transfers');
  };

  const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const handleOpenFolder = async (filePath: string, task?: DownloadTaskData) => {
    // If on desktop connected to local core engine, try opening in OS explorer
    if (!isMobile && !isWebOnly && isConnected && filePath) {
      try {
        const res = await fetch('/api/system/open', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: filePath, action: 'folder' }),
        });
        const json = await res.json();
        if (json.success) return;
      } catch (e) {}
    }

    // On mobile or cloud: show MobileFolderModal with device storage guidance, share sheet, and play!
    if (task) {
      setMobileFolderTask(task);
    }
  };

  const handleOpenFile = async (
    filePath: string,
    task?: DownloadTaskData,
    targetType: 'media' | 'transcript_clean' | 'transcript_timed' = 'media'
  ) => {
    // 1. If subtitles transcript requested:
    if (targetType === 'transcript_clean' || targetType === 'transcript_timed') {
      if (!isMobile && !isWebOnly && isConnected && filePath) {
        try {
          const res = await fetch('/api/system/open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: filePath, action: 'file' }),
          });
          const json = await res.json();
          if (json.success) return;
        } catch (e) {}
      }

      // Read transcript text and open in-app TranscriptViewerModal
      let content = '';
      if (filePath) {
        try {
          const res = await fetch(`/api/system/read?path=${encodeURIComponent(filePath)}`);
          if (res.ok) {
            content = await res.text();
          }
        } catch (e) {}
      }
      if (!content) {
        content = `[CLAG Downloader - Subtitles Transcript]\nFilename: ${task?.filename || 'video.mp4'}\nSource URL: ${task?.originalUrl || task?.url || 'Stream'}\n\n[Transcript file saved on disk: ${filePath || 'subtitles/' + (task?.filename || 'video') + '.txt'}]\n\n(Transcript text is available above. Tap 'Download .txt' to save to your device.)`;
      }

      setViewingTranscript({
        title: targetType === 'transcript_clean' ? 'Clean Subtitles Transcript (.txt)' : 'Timed Subtitles Transcript (.txt)',
        filename: filePath ? filePath.split(/[\\/]/).pop() || `${task?.filename || 'transcript'}.txt` : `${task?.filename || 'transcript'}.txt`,
        text: content,
      });
      return;
    }

    // 2. If media file requested:
    if (!isMobile && !isWebOnly && isConnected && filePath) {
      try {
        const res = await fetch('/api/system/open', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: filePath, action: 'file' }),
        });
        const json = await res.json();
        if (json.success) return;
      } catch (e) {}
    }

    // On mobile or web: open in-app MediaPlayerModal
    if (task) {
      setPlayingMediaTask(task);
    }
  };

  return (
    <div className="h-screen h-[100dvh] flex flex-col bg-darkbg-primary text-gray-100 overflow-hidden">
      {/* Top Navbar */}
      <Navbar
        isConnected={isConnected}
        isWebOnly={isWebOnly}
        totalSpeed={totalSpeed}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      {/* Floating Clipboard Link Toast */}
      {clipboardUrl && (
        <div className="mx-4 my-2 max-w-xl self-center w-full glass-panel border border-cyan-500/50 rounded-2xl p-3 shadow-xl flex items-center justify-between gap-3 animate-bounce-short flex-shrink-0 z-30">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0">
              <Clipboard className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-cyan-300">Link Detected in Clipboard</div>
              <div className="text-xs text-gray-300 font-mono truncate">{clipboardUrl}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                handleAddDownload({ url: clipboardUrl, connections: 16 });
                setClipboardUrl(null);
              }}
              className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs flex items-center gap-1 shadow-sm"
            >
              <span>Download</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setClipboardUrl(null)}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex-1 flex min-h-0 w-full overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Content View */}
        <main className="flex-1 min-w-0 h-full overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-full">
          {activeTab === 'transfers' && (
            <TransfersView
              tasks={tasks}
              totalSpeed={totalSpeed}
              selectedCategory={selectedCategory}
              onPause={pauseDownload}
              onResume={resumeDownload}
              onDelete={deleteDownload}
              onOpenFolder={handleOpenFolder}
              onOpenFile={handleOpenFile}
              onOpenAddModal={() => setIsAddModalOpen(true)}
            />
          )}

          {activeTab === 'linkgrabber' && (
            <LinkGrabberView onStartItems={handleStartGrabberItems} />
          )}

          {activeTab === 'sniffer' && (
            <MediaSnifferView
              onQuickDownload={(url) => {
                handleAddDownload({ url, connections: 16 });
              }}
            />
          )}

          {activeTab === 'settings' && <SettingsView />}

          {activeTab === 'guide' && <UserGuideView />}
        </main>
      </div>

      {/* Add Download Modal */}
      <AddDownloadModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddDownload={handleAddDownload}
      />

      {/* In-App Mobile/Web Media Player */}
      <MediaPlayerModal
        task={playingMediaTask}
        onClose={() => setPlayingMediaTask(null)}
      />

      {/* Mobile Device Storage & Share Guidance Modal */}
      <MobileFolderModal
        task={mobileFolderTask}
        onClose={() => setMobileFolderTask(null)}
        onPlayMedia={(t) => setPlayingMediaTask(t)}
      />

      {/* In-App Subtitles & Transcript Viewer Modal */}
      {viewingTranscript && (
        <TranscriptViewerModal
          title={viewingTranscript.title}
          filename={viewingTranscript.filename}
          transcriptText={viewingTranscript.text}
          onClose={() => setViewingTranscript(null)}
        />
      )}
    </div>
  );
}
