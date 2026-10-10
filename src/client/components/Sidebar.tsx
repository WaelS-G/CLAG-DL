import React from 'react';
import { 
  DownloadCloud, 
  Layers, 
  Radio, 
  Settings, 
  BookOpen, 
  Film, 
  Music, 
  Archive, 
  FileCode, 
  FileText, 
  Image,
  FolderOpen,
  X
} from 'lucide-react';
import { DownloadCategory } from '../../types/index.js';

export type ActiveTab = 'transfers' | 'linkgrabber' | 'sniffer' | 'settings' | 'guide';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  selectedCategory: DownloadCategory;
  setSelectedCategory: (cat: DownloadCategory) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  selectedCategory,
  setSelectedCategory,
  isOpenMobile,
  onCloseMobile,
}) => {
  const mainNav = [
    { id: 'transfers', label: 'Transfers', icon: DownloadCloud, badge: null },
    { id: 'linkgrabber', label: 'Link Grabber', icon: Layers, badge: 'Pro' },
    { id: 'sniffer', label: 'Media Sniffer', icon: Radio, badge: 'Live' },
    { id: 'settings', label: 'Settings', icon: Settings, badge: null },
    { id: 'guide', label: 'User Guide', icon: BookOpen, badge: null },
  ];

  const categories: { id: DownloadCategory; label: string; icon: any }[] = [
    { id: 'all', label: 'All Files', icon: FolderOpen },
    { id: 'video', label: 'Videos', icon: Film },
    { id: 'audio', label: 'Music & Audio', icon: Music },
    { id: 'compressed', label: 'Compressed', icon: Archive },
    { id: 'program', label: 'Programs', icon: FileCode },
    { id: 'document', label: 'Documents', icon: FileText },
    { id: 'image', label: 'Images', icon: Image },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 md:z-auto h-full w-64 md:w-64 md:flex-shrink-0 glass-panel border-r border-gray-800 flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6">
          {/* Mobile Header Close */}
          <div className="flex items-center justify-between md:hidden pb-2 border-b border-gray-800">
            <span className="font-bold text-gray-200">Navigation</span>
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Views */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2 px-3">
              Workspace
            </div>
            <nav className="space-y-1">
              {mainNav.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as ActiveTab);
                      onCloseMobile();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all min-h-[44px] ${
                      isActive
                        ? 'bg-gradient-to-r from-sky-600/30 to-cyan-600/10 text-cyan-300 border border-sky-500/30 shadow-md shadow-sky-950/40'
                        : 'text-gray-300 hover:bg-gray-800/60 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-gray-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800 font-mono">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Category Filter (Active when in Transfers tab) */}
          {activeTab === 'transfers' && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2 px-3">
                Categories
              </div>
              <div className="space-y-1">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors min-h-[38px] ${
                        isSelected
                          ? 'bg-gray-800 text-white font-semibold'
                          : 'text-gray-400 hover:bg-gray-800/40 hover:text-gray-200'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-cyan-400' : 'text-gray-500'}`} />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom PWA / App info */}
        <div className="flex-shrink-0 p-4 border-t border-gray-800/60 text-center space-y-1.5 bg-gray-950/40">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-sky-500/10 via-cyan-500/10 to-indigo-500/10 border border-sky-500/20 text-gray-300">
            <span className="text-[10px] text-gray-400">Made by :</span>
            <span className="text-[11px] font-semibold bg-gradient-to-r from-sky-400 to-cyan-300 bg-clip-text text-transparent">Wael Sayed</span>
          </div>
          <p className="text-[10px] text-gray-500 font-mono">CLAG Multi-Segment Core v1.0 Pro</p>
          <p className="text-[9px] text-gray-600">IDM & JDownloader Superior Suite</p>
        </div>
      </aside>
    </>
  );
};
