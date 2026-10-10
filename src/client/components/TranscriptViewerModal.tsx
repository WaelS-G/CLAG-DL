import React, { useState } from 'react';
import { X, FileText, Copy, Download, Check, Search } from 'lucide-react';

interface TranscriptViewerModalProps {
  title: string;
  transcriptText: string;
  filename: string;
  onClose: () => void;
}

export const TranscriptViewerModal: React.FC<TranscriptViewerModalProps> = ({
  title,
  transcriptText,
  filename,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleCopy = () => {
    navigator.clipboard.writeText(transcriptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([transcriptText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.txt') ? filename : `${filename}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const lines = transcriptText.split('\n');
  const filteredLines = searchQuery.trim()
    ? lines.filter((l) => l.toLowerCase().includes(searchQuery.toLowerCase()))
    : lines;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-700 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1 pr-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-sm text-gray-100 truncate">{title}</h3>
              <p className="text-[11px] text-gray-400 truncate">{filename}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 bg-gray-900/60 border-b border-gray-800 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search transcript text..."
              className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-amber-400"
            />
          </div>
          <div className="text-[11px] text-gray-400 font-mono flex-shrink-0">
            {filteredLines.length} lines
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-4 overflow-y-auto bg-black/40 font-mono text-xs text-gray-200 space-y-1.5 select-text leading-relaxed">
          {filteredLines.length === 0 ? (
            <div className="text-gray-500 text-center py-8">No matching lines found.</div>
          ) : (
            filteredLines.map((line, idx) => (
              <div key={idx} className="hover:bg-gray-800/40 px-2 py-0.5 rounded break-words">
                {line || <span className="opacity-0">.</span>}
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 border-t border-gray-800 flex items-center justify-between gap-3 bg-gray-900/80">
          <button
            onClick={handleCopy}
            className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 text-xs font-medium flex items-center gap-1.5 transition-colors min-h-[40px]"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy All Text'}</span>
          </button>

          <button
            onClick={handleDownloadTxt}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md transition-all min-h-[40px]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .txt</span>
          </button>
        </div>
      </div>
    </div>
  );
};
