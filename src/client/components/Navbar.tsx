import React from 'react';
import { 
  ArrowDownToLine, 
  Plus, 
  Wifi, 
  WifiOff, 
  Gauge, 
  Menu,
  Globe
} from 'lucide-react';

interface NavbarProps {
  isConnected: boolean;
  isWebOnly?: boolean;
  totalSpeed: number;
  onOpenAddModal: () => void;
  onToggleMobileMenu: () => void;
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec >= 1024 * 1024 * 1024) {
    return `${(bytesPerSec / (1024 ** 3)).toFixed(2)} GB/s`;
  }
  if (bytesPerSec >= 1024 * 1024) {
    return `${(bytesPerSec / (1024 ** 2)).toFixed(1)} MB/s`;
  }
  if (bytesPerSec >= 1024) {
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  }
  return `${bytesPerSec} B/s`;
}

export const Navbar: React.FC<NavbarProps> = ({
  isConnected,
  isWebOnly,
  totalSpeed,
  onOpenAddModal,
  onToggleMobileMenu,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-gray-800 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 text-gray-400 hover:text-white rounded-lg focus:outline-none min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Toggle Menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <ArrowDownToLine className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
                CLAG
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-sky-950/80 text-sky-400 border border-sky-800/60 font-mono font-medium">
                v1.0 Pro
              </span>
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-sky-500/10 via-cyan-500/10 to-indigo-500/10 border border-sky-500/30 text-[11px]">
                <span className="text-gray-400">Made by :</span>
                <span className="font-semibold bg-gradient-to-r from-sky-400 to-cyan-300 bg-clip-text text-transparent">Wael Sayed</span>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 hidden sm:block">Next-Gen Accelerated Downloader & Media Grabber</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Total Bandwidth Meter */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-900/90 border border-gray-800 text-xs shadow-inner">
          <Gauge className={`w-4 h-4 ${totalSpeed > 0 ? 'text-cyan-400 animate-spin-slow' : 'text-gray-500'}`} />
          <div className="flex flex-col sm:flex-row sm:gap-1.5 text-right sm:text-left">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Speed</span>
            <span className="font-mono font-semibold text-cyan-300">
              {formatSpeed(totalSpeed)}
            </span>
          </div>
        </div>

        {/* Engine Link Status */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-900/60 border border-gray-800 text-xs">
          {isConnected ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Core Active</span>
            </>
          ) : isWebOnly ? (
            <>
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-cyan-400 font-medium">Web Mode (Vercel)</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-400 font-medium">Connecting...</span>
            </>
          )}
        </div>

        {/* Add Download Button */}
        <button
          onClick={onOpenAddModal}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-white font-medium text-sm shadow-lg shadow-sky-500/25 transition-all transform active:scale-95 min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Download</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>
    </header>
  );
};
