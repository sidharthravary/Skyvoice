"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AIOrb } from "@/components/ui/AIOrb";
import { WaveformVisualizer } from "@/components/ui/WaveformVisualizer";
import { GuestNav } from "@/components/ui/GuestNav";
import { useVoiceAI } from "@/hooks/useVoiceAI";
import { Mic, Radio } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  idle:      "Tap to speak",
  listening: "Listening…",
  thinking:  "Processing…",
  speaking:  "Speaking…",
};

const STATUS_COLORS: Record<string, string> = {
  idle:      "#475569",
  listening: "#22C55E",
  thinking:  "#F59E0B",
  speaking:  "#4F7DF3",
};

function useOrbSize(): number {
  const [size, setSize] = useState(130);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setSize(mq.matches ? 200 : 130);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return size;
}

export default function VoicePage() {
  const { orbState, transcript, aiText, isConnected, toggleVoiceSession } = useVoiceAI();
  const orbSize = useOrbSize();

  const statusLabel = STATUS_LABELS[orbState] ?? "Tap to speak";
  const statusColor = STATUS_COLORS[orbState] ?? "#475569";

  return (
    <div
      className="relative overflow-hidden"
      style={{
        minHeight: "100dvh",
        background: "#0F172A",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        touchAction: "manipulation",
      }}
    >
      {/* Background grid — pointer-events-none so it never blocks touch */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.025,
          backgroundImage:
            "linear-gradient(#4F7DF3 1px, transparent 1px), linear-gradient(90deg, #4F7DF3 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      {/* Radial glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(700px, 140vw)",
          height: "min(700px, 140vw)",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(79,125,243,0.08), transparent 60%)",
        }}
      />

      {/* Full nav — logo, Voice AI / My Reservations links, username, logout */}
      <div className="relative z-10 w-full">
        <GuestNav />
      </div>

      {/* Main content — centered, takes remaining height */}
      <main
        className="relative z-10 flex flex-col items-center justify-center"
        style={{
          flex: 1,
          width: "100%",
          padding: "32px 20px",
          gap: 24,
        }}
      >
        {/* Orb — responsive size (larger on desktop, compact on mobile) */}
        <div className="animate-fade-in-up flex flex-col items-center" style={{ gap: 16 }}>
          <AIOrb
            state={orbState}
            size={orbSize}
            onClick={toggleVoiceSession}
          />

          {/* Status pill */}
          <div
            className="flex items-center gap-2"
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 7,
                height: 7,
                borderRadius: "50%",
                backgroundColor: statusColor,
                boxShadow: orbState !== "idle" ? `0 0 6px ${statusColor}80` : undefined,
                animation: orbState === "listening" ? "pulse 1.2s infinite" : undefined,
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: statusColor }}>
              {statusLabel}
            </span>
          </div>

          {/* Connection status */}
          <div className="flex items-center gap-1.5">
            <span
              style={{
                display: "inline-block",
                width: 7,
                height: 7,
                borderRadius: "50%",
                backgroundColor: isConnected ? "#22C55E" : "#EF4444",
                boxShadow: isConnected ? "0 0 6px rgba(34,197,94,0.6)" : undefined,
              }}
            />
            <span style={{ fontSize: 11, color: "#475569", fontWeight: 500 }}>
              {isConnected ? "Connected" : "Connecting…"}
            </span>
          </div>
        </div>

        {/* Hint */}
        {orbState === "idle" && (
          <p
            className="flex items-center gap-2"
            style={{ color: "#475569", fontSize: 13 }}
          >
            <Mic size={14} color="#4F7DF3" />
            Tap the orb to start
          </p>
        )}

        {/* Waveform */}
        {(orbState === "listening" || orbState === "speaking") && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0.8 }}
            animate={{ opacity: 1, scaleX: 1 }}
            style={{ width: "100%", maxWidth: 320 }}
          >
            <WaveformVisualizer
              isListening={orbState === "listening"}
              isPlaying={orbState === "speaking"}
              color={orbState === "listening" ? "#22C55E" : "#4F7DF3"}
            />
          </motion.div>
        )}

        {/* Live indicator */}
        {orbState !== "idle" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1.5"
            style={{ fontSize: 11, color: "#475569" }}
          >
            <Radio size={11} color="#4F7DF3" className="animate-pulse" />
            Live Session Active
          </motion.div>
        )}

        {/* Transcript / AI response */}
        {(transcript || aiText) && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              width: "100%",
              maxWidth: "min(480px, 90vw)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {transcript && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div
                  style={{
                    background: "#4F7DF3",
                    color: "white",
                    padding: "10px 14px",
                    borderRadius: "18px 18px 4px 18px",
                    fontSize: 14,
                    lineHeight: 1.5,
                    maxWidth: "85%",
                  }}
                >
                  {transcript}
                </div>
              </div>
            )}
            {aiText && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: "#CBD5E1",
                    padding: "10px 14px",
                    borderRadius: "18px 18px 18px 4px",
                    fontSize: 14,
                    lineHeight: 1.5,
                    maxWidth: "85%",
                  }}
                >
                  {aiText}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </main>

      <footer className="relative z-10 w-full text-center" style={{ padding: "12px 0 16px" }}>
        <p style={{ fontSize: 11, color: "#1E293B" }}>Powered by Skyvion Technologies</p>
      </footer>
    </div>
  );
}
