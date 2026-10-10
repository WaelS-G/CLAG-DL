import React from 'react';
import { ChunkInfo } from '../../types/index.js';

interface ChunkBarProps {
  chunks: ChunkInfo[];
  connections: number;
}

export const ChunkBar: React.FC<ChunkBarProps> = ({ chunks, connections }) => {
  if (!chunks || chunks.length === 0) {
    return null;
  }

  return (
    <div className="w-full mt-2">
      <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
        <span className="font-mono flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          {connections} Active Segment{connections > 1 ? 's' : ''} (Multi-Connection Acceleration)
        </span>
        <span className="text-[11px] text-gray-400">IDM Chunk Matrix</span>
      </div>
      <div className="w-full h-3 bg-gray-800 rounded flex gap-0.5 p-0.5 overflow-hidden border border-gray-700">
        {chunks.map((chunk) => {
          const pct = chunk.totalBytes > 0 ? Math.min(100, Math.round((chunk.downloadedBytes / chunk.totalBytes) * 100)) : 0;
          const isDone = chunk.status === 'completed' || pct >= 100;
          return (
            <div
              key={chunk.index}
              className="h-full bg-gray-900 rounded-sm relative overflow-hidden flex-1"
              title={`Part ${chunk.index + 1}: ${pct}% (${chunk.downloadedBytes} / ${chunk.totalBytes} bytes)`}
            >
              <div
                className={`h-full transition-all duration-300 ${
                  isDone
                    ? 'bg-emerald-500'
                    : chunk.status === 'downloading'
                    ? 'bg-gradient-to-r from-sky-500 to-cyan-400'
                    : 'bg-gray-700'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
