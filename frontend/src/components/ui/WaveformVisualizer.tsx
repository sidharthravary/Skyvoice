"use client";

import { useEffect, useRef } from "react";

interface WaveformVisualizerProps {
  isPlaying: boolean;
  isListening: boolean;
  color?: string;
}

export function WaveformVisualizer({
  isPlaying,
  isListening,
  color = "#4F7DF3",
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 300;
      canvas.height = 80;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;

      // Draw horizontal baseline
      ctx.strokeStyle = "rgba(79, 125, 243, 0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      if (isListening || isPlaying) {
        phase += isListening ? 0.15 : 0.08;
        const numberOfWaves = 4;
        
        for (let i = 0; i < numberOfWaves; i++) {
          ctx.beginPath();
          ctx.lineWidth = i === 0 ? 2 : 1;
          
          // Generate wave opacity and color properties
          const opacity = (1 - i / numberOfWaves) * (isListening ? 0.6 : 0.4);
          ctx.strokeStyle = color === "#4F7DF3" 
            ? `rgba(79, 125, 243, ${opacity})` 
            : `rgba(34, 197, 94, ${opacity})`;

          // Amplitude changes across waves for visual variety
          const amplitude = (isListening ? 25 : 15) * (1 - i / 3);

          for (let x = 0; x < width; x++) {
            // Apply a bell curve window so waves taper at ends
            const normal = x / width;
            const windowMultiplier = Math.sin(normal * Math.PI);
            
            const y =
              height / 2 +
              Math.sin(x * 0.03 + phase + i * 1.5) *
                amplitude *
                windowMultiplier;

            if (x === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
        }
      } else {
        // Draw standard flat line with micro-noise
        ctx.strokeStyle = "rgba(79, 125, 243, 0.2)";
        ctx.beginPath();
        for (let x = 0; x < width; x++) {
          const y = height / 2 + Math.sin(x * 0.05) * 0.5;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, [isPlaying, isListening, color]);

  return (
    <div className="w-full bg-white/40 backdrop-blur-md border border-white/50 rounded-2xl p-4 shadow-[0_4px_12px_rgba(79,125,243,0.05)]">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-2">
        {isListening ? "Voice Input Feed" : isPlaying ? "AI Voice Synthesis" : "Signal Idle"}
      </div>
      <canvas ref={canvasRef} className="w-full block h-20" />
    </div>
  );
}
