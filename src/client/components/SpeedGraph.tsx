import React, { useEffect, useRef } from 'react';

interface SpeedGraphProps {
  currentSpeed: number; // bytes/sec
}

export const SpeedGraph: React.FC<SpeedGraphProps> = ({ currentSpeed }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<number[]>(new Array(40).fill(0));

  useEffect(() => {
    // Append current speed to history
    historyRef.current.shift();
    historyRef.current.push(currentSpeed);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const history = historyRef.current;
    const maxSpeed = Math.max(...history, 1024 * 1024); // at least 1 MB/s scale

    // Draw background grid lines
    ctx.strokeStyle = 'rgba(55, 65, 81, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.25);
    ctx.lineTo(width, height * 0.25);
    ctx.moveTo(0, height * 0.5);
    ctx.lineTo(width, height * 0.5);
    ctx.moveTo(0, height * 0.75);
    ctx.lineTo(width, height * 0.75);
    ctx.stroke();

    // Create line path
    ctx.beginPath();
    const step = width / (history.length - 1);

    for (let i = 0; i < history.length; i++) {
      const val = history[i];
      const y = height - (val / maxSpeed) * (height - 8) - 4;
      const x = i * step;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    // Glow line stroke
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
    ctx.shadowBlur = 6;
    ctx.stroke();

    // Fill area gradient
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
    gradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Reset shadow
    ctx.shadowBlur = 0;
  }, [currentSpeed]);

  return (
    <div className="w-full glass-card rounded-2xl p-3 border border-gray-800">
      <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono mb-1.5">
        <span>Real-Time Bandwidth Velocity</span>
        <span className="text-cyan-400 font-semibold">
          {currentSpeed >= 1024 * 1024
            ? `${(currentSpeed / 1024 / 1024).toFixed(1)} MB/s`
            : `${(currentSpeed / 1024).toFixed(0)} KB/s`}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={360}
        height={65}
        className="w-full h-16 rounded-lg bg-gray-950/60"
      />
    </div>
  );
};
