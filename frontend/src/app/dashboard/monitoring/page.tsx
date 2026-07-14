"use client";

import { getBackendUrl } from "@/lib/backend";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { io } from "socket.io-client";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatsCard } from "@/components/ui/StatsCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  Server,
  Cpu,
  HardDrive,
  Clock,
  Wifi,
  Database,
  Activity,
  Users,
  Zap,
  Radio,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface WebRTCStats {
  jitter: number;
  packetsLost: number;
  roundTripTime: number;
  bitrate: number;
}

const latencyData = Array.from({ length: 20 }, (_, i) => ({
  time: `${i}s`,
  api: Math.floor(50 + Math.random() * 100),
  ai: Math.floor(200 + Math.random() * 300),
  db: Math.floor(5 + Math.random() * 30),
}));

const activeUsers = [
  { id: "1", name: "John Smith", status: "speaking", duration: "2m 15s" },
  { id: "2", name: "Sarah Wilson", status: "listening", duration: "0m 45s" },
  { id: "3", name: "Mike Johnson", status: "idle", duration: "5m 30s" },
];

export default function MonitoringPage() {
  const [callQuality, setCallQuality] = useState<WebRTCStats | null>(null);

  useEffect(() => {
    const backendUrl = getBackendUrl();
    const socket = io(`${backendUrl}/monitoring`, {
      transports: ["websocket"],
    });

    socket.on("webrtc_stats", (data: WebRTCStats) => {
      setCallQuality(data);
    });

    return () => { socket.disconnect(); };
  }, []);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-[var(--font-poppins)] font-bold text-[#0F172A]">
            System Monitoring
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            Aerospace-grade operational visibility into your AI infrastructure.
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <StatusBadge status="online" label="All Systems Operational" />
        </div>
      </motion.div>

      {/* System Health Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
      >
        <StatsCard label="CPU Usage" value="23%" icon={Cpu} />
        <StatsCard label="Memory" value="4.2 GB" icon={Server} />
        <StatsCard label="Disk" value="67%" icon={HardDrive} />
        <StatsCard label="Uptime" value="14d 6h" icon={Clock} />
        <StatsCard label="WS Clients" value={42} icon={Wifi} />
        <StatsCard label="DB Queries/s" value={128} icon={Database} />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time Latency Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2">
          <GlassCard hover={false}>
            <h3 className="text-sm font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#4F7DF3]" />
              Real-Time Latency (ms)
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={latencyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="time" fontSize={10} stroke="#94A3B8" />
                  <YAxis fontSize={12} stroke="#94A3B8" />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(255,255,255,0.9)",
                      border: "1px solid rgba(79,125,243,0.1)",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                  />
                  <Line type="monotone" dataKey="api" stroke="#4F7DF3" strokeWidth={2} dot={false} name="API" />
                  <Line type="monotone" dataKey="ai" stroke="#A78BFA" strokeWidth={2} dot={false} name="AI Response" />
                  <Line type="monotone" dataKey="db" stroke="#22C55E" strokeWidth={2} dot={false} name="Database" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-6 mt-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-1 rounded-full bg-[#4F7DF3]" />
                <span className="text-xs text-[#64748B]">API</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-1 rounded-full bg-[#A78BFA]" />
                <span className="text-xs text-[#64748B]">AI Response</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-1 rounded-full bg-[#22C55E]" />
                <span className="text-xs text-[#64748B]">Database</span>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Active Sessions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <GlassCard hover={false}>
            <h3 className="text-sm font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#4F7DF3]" />
              Active Sessions
            </h3>
            <div className="space-y-3">
              {activeUsers.map((user) => (
                <div key={user.id} className="p-3 rounded-xl bg-[#F5F9FF] border border-[#4F7DF3]/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-[#0F172A]">{user.name}</span>
                    <StatusBadge
                      status={user.status === "speaking" ? "processing" : user.status === "listening" ? "online" : "offline"}
                      label={user.status}
                    />
                  </div>
                  <p className="text-xs text-[#94A3B8]">Duration: {user.duration}</p>
                </div>
              ))}
            </div>

            {/* AI Response Speed Gauge */}
            <div className="mt-6 pt-4 border-t border-[#4F7DF3]/8">
              <h4 className="text-xs font-semibold text-[#64748B] mb-3 flex items-center gap-2">
                <Zap className="w-3 h-3 text-[#F59E0B]" />
                AI Response Speed
              </h4>
              <div className="relative h-4 bg-[#E2E8F0] rounded-full overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#22C55E] via-[#F59E0B] to-[#EF4444] rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: "35%" }}
                  transition={{ duration: 1, delay: 0.5 }}
                />
                <div
                  className="absolute top-0 w-0.5 h-full bg-white"
                  style={{ left: "35%" }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-emerald-600">Fast (0ms)</span>
                <span className="text-[10px] text-[#4F7DF3] font-bold">350ms</span>
                <span className="text-[10px] text-red-500">Slow (2000ms)</span>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </div>

      {/* Voice Call Quality (RTCP live stats) */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <GlassCard hover={false}>
          <h3 className="text-sm font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#4F7DF3]" />
            Voice Call Quality (RTCP)
          </h3>
          {callQuality ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-[#F5F9FF] border border-[#4F7DF3]/5 text-center">
                <p className="text-2xl font-bold font-[var(--font-poppins)] text-[#0F172A]">
                  {callQuality.jitter.toFixed(1)}
                </p>
                <p className="text-xs text-[#64748B] mt-1 font-medium">Jitter (ms)</p>
                <div className={`w-2 h-2 rounded-full mx-auto mt-2 ${callQuality.jitter < 30 ? "bg-emerald-500" : callQuality.jitter < 80 ? "bg-amber-500" : "bg-red-500"} animate-pulse`} />
              </div>
              <div className="p-4 rounded-xl bg-[#F5F9FF] border border-[#4F7DF3]/5 text-center">
                <p className="text-2xl font-bold font-[var(--font-poppins)] text-[#0F172A]">
                  {callQuality.roundTripTime.toFixed(0)}
                </p>
                <p className="text-xs text-[#64748B] mt-1 font-medium">RTT (ms)</p>
                <div className={`w-2 h-2 rounded-full mx-auto mt-2 ${callQuality.roundTripTime < 150 ? "bg-emerald-500" : callQuality.roundTripTime < 400 ? "bg-amber-500" : "bg-red-500"} animate-pulse`} />
              </div>
              <div className="p-4 rounded-xl bg-[#F5F9FF] border border-[#4F7DF3]/5 text-center">
                <p className="text-2xl font-bold font-[var(--font-poppins)] text-[#0F172A]">
                  {callQuality.packetsLost}
                </p>
                <p className="text-xs text-[#64748B] mt-1 font-medium">Packet Loss</p>
                <div className={`w-2 h-2 rounded-full mx-auto mt-2 ${callQuality.packetsLost === 0 ? "bg-emerald-500" : callQuality.packetsLost < 10 ? "bg-amber-500" : "bg-red-500"} animate-pulse`} />
              </div>
              <div className="p-4 rounded-xl bg-[#F5F9FF] border border-[#4F7DF3]/5 text-center">
                <p className="text-2xl font-bold font-[var(--font-poppins)] text-[#0F172A]">
                  {callQuality.bitrate.toFixed(0)}
                </p>
                <p className="text-xs text-[#64748B] mt-1 font-medium">Bitrate (kbps)</p>
                <div className="w-2 h-2 rounded-full mx-auto mt-2 bg-[#4F7DF3] animate-pulse" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 py-4">
              <div className="w-2 h-2 rounded-full bg-[#94A3B8] animate-pulse" />
              <p className="text-sm text-[#94A3B8]">
                Waiting for an active WebRTC voice session — stats update every 5 s once a call starts.
              </p>
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* Service Health Grid */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <GlassCard hover={false}>
          <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Service Health</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { name: "API Server", status: "online" as const, latency: "45ms" },
              { name: "WebSocket Gateway", status: "online" as const, latency: "12ms" },
              { name: "MongoDB", status: "online" as const, latency: "8ms" },
              { name: "Redis Cache", status: "online" as const, latency: "2ms" },
              { name: "OpenAI API", status: "online" as const, latency: "320ms" },
              { name: "ElevenLabs TTS", status: "online" as const, latency: "180ms" },
              { name: "Pinecone Vector DB", status: "online" as const, latency: "95ms" },
              { name: "Google Calendar", status: "online" as const, latency: "110ms" },
            ].map((service) => (
              <div key={service.name} className="p-3 rounded-xl bg-[#F5F9FF] border border-[#4F7DF3]/5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-[#0F172A]">{service.name}</span>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <p className="text-[10px] text-[#94A3B8]">Latency: {service.latency}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
