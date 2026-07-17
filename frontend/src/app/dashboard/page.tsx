"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getBackendUrl } from "@/lib/backend";
import { AIOrb } from "@/components/ui/AIOrb";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatsCard } from "@/components/ui/StatsCard";
import { WaveformVisualizer } from "@/components/ui/WaveformVisualizer";
import { useVoiceAI } from "@/hooks/useVoiceAI";
import Link from "next/link";
import {
  MessageSquare,
  CalendarCheck,
  Smile,
  HelpCircle,
  Timer,
  Users,
  Brain,
  CalendarDays,
  BarChart3,
  Sparkles,
  Zap,
} from "lucide-react";

const floatingFeatures = [
  { label: "AI Powered", icon: Brain },
  { label: "Live Scheduling", icon: CalendarDays },
  { label: "Smart Analytics", icon: BarChart3 },
  { label: "Voice Intelligence", icon: Sparkles },
  { label: "Real-Time AI", icon: Zap },
];

interface AnalyticsSnapshot {
  totalConversations: number;
  totalAppointments: number;
  bookingSuccessRate: number;
  resolutionRate: number;
  averageResponseTime: string;
}

export default function CommandCenter() {
  const {
    orbState,
    transcript,
    aiText,
    toggleVoiceSession,
  } = useVoiceAI();

  const [stats, setStats] = useState<AnalyticsSnapshot | null>(null);
  const [knowledgeCount, setKnowledgeCount] = useState<number | null>(null);

  useEffect(() => {
    const backend = getBackendUrl();
    fetch(`${backend}/api/analytics`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.success) setStats(d.data); })
      .catch(() => {});
    fetch(`${backend}/api/knowledge?limit=1`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.success) setKnowledgeCount(d.pagination?.total ?? null); })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left: Headline */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-6"
        >
          <div>
            <h1 className="text-4xl font-[var(--font-poppins)] font-extrabold text-[#0F172A] leading-tight tracking-tight">
              Intelligent Voice Operations
              <br />
              <span className="bg-gradient-to-r from-[#4F7DF3] to-[#6FAEFF] bg-clip-text text-transparent">
                for Enterprise Systems
              </span>
            </h1>
            <p className="text-[#64748B] mt-3 max-w-lg leading-relaxed">
              AI-powered customer support, autonomous scheduling, and real-time
              voice assistance — all from your command center.
            </p>
          </div>

          {/* Conversation Log UI */}
          {(transcript || aiText) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2 max-w-md p-4 bg-white/40 border border-white/50 backdrop-blur-md rounded-2xl shadow-sm"
            >
              {transcript && (
                <div className="flex gap-2 justify-end">
                  <div className="bg-[#4F7DF3] text-white px-3.5 py-2 rounded-xl rounded-tr-none text-xs font-medium max-w-[85%]">
                    {transcript}
                  </div>
                </div>
              )}
              {aiText && (
                <div className="flex gap-2 justify-start">
                  <div className="bg-white border border-[#4F7DF3]/10 text-slate-700 px-3.5 py-2 rounded-xl rounded-tl-none text-xs max-w-[85%]">
                    {aiText}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Waveform Visualizer */}
          {(orbState === "listening" || orbState === "speaking") && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md"
            >
              <WaveformVisualizer
                isListening={orbState === "listening"}
                isPlaying={orbState === "speaking"}
                color={orbState === "listening" ? "#22C55E" : "#4F7DF3"}
              />
            </motion.div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={toggleVoiceSession}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#4F7DF3] to-[#6FAEFF] text-white font-semibold text-sm shadow-[0_4px_16px_rgba(79,125,243,0.35)] hover:shadow-[0_8px_30px_rgba(79,125,243,0.45)] transition-all hover:translate-y-[-1px] cursor-pointer"
            >
              {orbState === "listening" ? "Stop Listening" : orbState === "speaking" ? "Stop Speaking" : "Launch AI Agent"}
            </button>
            <Link
              href="/dashboard/analytics"
              className="px-6 py-3 rounded-xl bg-white border border-[#4F7DF3]/15 text-[#4F7DF3] font-semibold text-sm hover:bg-[#4F7DF3]/5 transition-all cursor-pointer flex items-center justify-center"
            >
              Analytics
            </Link>
            <Link
              href="/dashboard/settings"
              className="px-6 py-3 rounded-xl text-[#64748B] font-semibold text-sm hover:text-[#4F7DF3] transition-colors cursor-pointer flex items-center justify-center"
            >
              Configure Agent
            </Link>
          </div>
        </motion.div>

        {/* Right: AI Orb with floating feature cards */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative flex items-center justify-center min-h-[400px]"
        >
          {floatingFeatures.map((feature, i) => {
            const radius = 170;
            const angle = (i * 360) / floatingFeatures.length;
            const angleRad = (angle * Math.PI) / 180;
            const x = Math.cos(angleRad) * radius;
            const y = Math.sin(angleRad) * radius;

            return (
              <motion.div
                key={feature.label}
                className="absolute"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1, x, y }}
                transition={{ delay: 0.5 + i * 0.12, duration: 0.4, ease: "backOut" }}
              >
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{
                    duration: 3 + i * 0.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.2,
                  }}
                >
                  <GlassCard className="px-3 py-2 flex items-center gap-2 !rounded-xl" hover={false}>
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#4F7DF3] to-[#6FAEFF] flex items-center justify-center">
                      <feature.icon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-[11px] font-semibold text-[#0F172A] whitespace-nowrap">
                      {feature.label}
                    </span>
                  </GlassCard>
                </motion.div>
              </motion.div>
            );
          })}

          <AIOrb state={orbState} size={130} onClick={toggleVoiceSession} />
        </motion.div>
      </div>

      {/* Stats Grid — live numbers from the platform, not placeholders */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
      >
        <StatsCard
          label="Conversations"
          value={stats ? stats.totalConversations.toLocaleString() : "—"}
          icon={MessageSquare}
        />
        <StatsCard
          label="Appointments"
          value={stats ? stats.totalAppointments.toLocaleString() : "—"}
          icon={CalendarCheck}
        />
        <StatsCard
          label="Booking Success"
          value={stats ? `${stats.bookingSuccessRate}%` : "—"}
          icon={Smile}
        />
        <StatsCard
          label="Resolution Rate"
          value={stats ? `${stats.resolutionRate}%` : "—"}
          icon={HelpCircle}
        />
        <StatsCard
          label="Knowledge Docs"
          value={knowledgeCount ?? "—"}
          icon={Users}
        />
        <StatsCard
          label="Avg Response"
          value={stats ? stats.averageResponseTime : "—"}
          icon={Timer}
        />
      </motion.div>
    </div>
  );
}
