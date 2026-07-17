"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AIOrb } from "@/components/ui/AIOrb";
import { WaveformVisualizer } from "@/components/ui/WaveformVisualizer";
import { GuestNav } from "@/components/ui/GuestNav";
import { useVoiceAI } from "@/hooks/useVoiceAI";
import { Mic, Radio } from "lucide-react";

// Status pill labels/colors — matches the original SkyVoice client UI
const PILL_LABELS: Record<string, string> = {
  idle:      "Ready",
  listening: "Listening...",
  thinking:  "Processing...",
  speaking:  "Speaking...",
};

const PILL_COLORS: Record<string, string> = {
  idle:      "#CBD5E1",
  listening: "#22C55E",
  thinking:  "#F59E0B",
  speaking:  "#818CF8",
};

function useOrbSize(): number {
  const [size, setSize] = useState(150);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setSize(mq.matches ? 240 : 150);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return size;
}

export default function VoicePage() {
  const { orbState, transcript, aiText, isConnected, toggleVoiceSession } = useVoiceAI();
  const orbSize = useOrbSize();

  const pillLabel = PILL_LABELS[orbState] ?? "Ready";
  const pillColor = PILL_COLORS[orbState] ?? "#CBD5E1";
  const sessionActive = orbState !== "idle";

  return (
    <div
      className="relative overflow-hidden"
      style={{
        minHeight: "100dvh",
        background: "radial-gradient(ellipse 90% 55% at 50% -12%, rgba(99,102,241,0.16), transparent 65%), radial-gradient(ellipse 60% 40% at 85% 110%, rgba(124,58,237,0.10), transparent 60%), #090E1C",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        touchAction: "manipulation",
      }}
    >
      {/* Background grid */}
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

      {/* Nav — logo, Voice AI / My Reservations links, username, logout */}
      <div className="relative z-10 w-full">
        <GuestNav />
      </div>

      {/* Connection status — top center, under the nav */}
      <div className="relative z-10 flex items-center gap-1.5" style={{ marginTop: 14 }}>
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
        <span style={{ fontSize: 12, color: "#64748B", fontWeight: 500 }}>
          {isConnected ? "AI Connected" : "Connecting…"}
        </span>
      </div>

      {/* Main content */}
      <main
        className="relative z-10 flex flex-col items-center"
        style={{
          flex: 1,
          width: "100%",
          padding: "8px 20px 24px",
          gap: 18,
        }}
      >
        {/* Orb — AIOrb renders its own state label ("Click to activate AI", etc.) */}
        <div className="animate-fade-in-up flex flex-col items-center">
          <AIOrb state={orbState} size={orbSize} onClick={toggleVoiceSession} />
        </div>

        {/* Status pill */}
        <div
          className="flex items-center gap-2"
          style={{
            padding: "8px 18px",
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
              backgroundColor: pillColor,
              boxShadow: sessionActive ? `0 0 6px ${pillColor}80` : undefined,
              animation: orbState === "listening" ? "pulse 1.2s infinite" : undefined,
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: pillColor }}>
            {pillLabel}
          </span>
        </div>

        {/* Hint */}
        {orbState === "idle" && (
          <p
            className="flex items-center gap-2"
            style={{ color: "#64748B", fontSize: 13 }}
          >
            <Mic size={14} color="#4F7DF3" />
            Click the orb to speak with SkyVoice AI
          </p>
        )}

        {/* Waveform — framed card ("VOICE INPUT FEED" / "AI VOICE SYNTHESIS") */}
        {(orbState === "listening" || orbState === "speaking") && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0.8 }}
            animate={{ opacity: 1, scaleX: 1 }}
            style={{ width: "100%", maxWidth: 300 }}
          >
            <WaveformVisualizer
              isListening={orbState === "listening"}
              isPlaying={orbState === "speaking"}
              color={orbState === "listening" ? "#22C55E" : "#4F7DF3"}
            />
          </motion.div>
        )}

        {/* Transcript / AI response bubbles */}
        {(transcript || aiText) && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              width: "100%",
              maxWidth: "min(460px, 90vw)",
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

        {/* Live indicator */}
        {sessionActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1.5"
            style={{ fontSize: 12, color: "#64748B" }}
          >
            <Radio size={12} color="#4F7DF3" className="animate-pulse" />
            Live Session Active
          </motion.div>
        )}
      </main>

      <footer className="relative z-10 w-full text-center" style={{ padding: "12px 0 16px" }}>
        <p style={{ fontSize: 11, color: "#475569" }}>
          Powered by <span style={{ color: "#64748B" }}>Skyvion Technologies</span>
        </p>
      </footer>
    </div>
  );
}
