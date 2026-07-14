"use client";

import { getBackendUrl } from "@/lib/backend";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GuestNav } from "@/components/ui/GuestNav";
import { getToken } from "@/lib/auth";
import {
  CalendarDays, Clock, CheckCircle, XCircle, AlertCircle,
  Bot, Mic, RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const BACKEND = getBackendUrl();

interface Appointment {
  _id: string;
  name: string;
  visitorName?: string;
  date: string;
  time: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no-show";
  notes?: string;
}

type TabKey = "upcoming" | "past";

const STATUS_STYLES = {
  confirmed: { bar: "#22C55E", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: CheckCircle, label: "Confirmed" },
  pending:   { bar: "#F59E0B", badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",   icon: AlertCircle, label: "Pending"   },
  cancelled: { bar: "#EF4444", badge: "bg-red-500/15 text-red-400 border-red-500/30",         icon: XCircle,     label: "Cancelled" },
  completed: { bar: "#4F7DF3", badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",      icon: CheckCircle, label: "Completed" },
  "no-show": { bar: "#64748B", badge: "bg-slate-500/15 text-slate-400 border-slate-500/30",   icon: XCircle,     label: "No Show"   },
};

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function groupByDate(appts: Appointment[]): Record<string, Appointment[]> {
  const map: Record<string, Appointment[]> = {};
  for (const a of appts) {
    const key = new Date(a.date).toISOString().slice(0, 10);
    if (!map[key]) map[key] = [];
    map[key].push(a);
  }
  return map;
}

export default function ReservationsPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("upcoming");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    const token = getToken();
    if (!token) { router.replace("/login"); return; }
    try {
      const res = await fetch(`${BACKEND}/api/appointments?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setAppointments(data.data);
        setLastUpdated(new Date());
        setSecondsAgo(0);
      }
    } catch (err) {
      console.error("Failed to fetch appointments:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchAppointments();
    const interval = setInterval(fetchAppointments, 30_000);
    return () => clearInterval(interval);
  }, [fetchAppointments]);

  // "Last updated X seconds ago" ticker
  useEffect(() => {
    const tick = setInterval(() => setSecondsAgo(s => s + 1), 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  async function cancelAppointment(id: string) {
    setCancellingId(id);
    setConfirmId(null);
    try {
      const token = getToken();
      const res = await fetch(`${BACKEND}/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (res.ok) {
        setAppointments(prev =>
          prev.map(a => a._id === id ? { ...a, status: "cancelled" } : a)
        );
      }
    } catch (err) {
      console.error("Cancel failed:", err);
    } finally {
      setCancellingId(null);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = appointments.filter(a => {
    const d = new Date(a.date);
    d.setHours(0, 0, 0, 0);
    return d >= today && a.status !== "cancelled";
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const past = appointments.filter(a => {
    const d = new Date(a.date);
    d.setHours(0, 0, 0, 0);
    return d < today || a.status === "cancelled";
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const displayed = tab === "upcoming" ? upcoming : past;
  const groups = groupByDate(displayed);

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col relative overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#4F7DF3 1px, transparent 1px), linear-gradient(90deg, #4F7DF3 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(79,125,243,0.06),transparent_60%)] pointer-events-none" />

      <GuestNav />

      <main className="relative z-10 flex-1 max-w-2xl mx-auto w-full px-4 py-10">
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="font-[var(--font-poppins)] font-bold text-2xl text-white">
            My Reservations
          </h1>
          <p className="text-[#64748B] text-sm mt-1">
            Your upcoming and past appointments with Skyvion Technologies
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          {(["upcoming", "past"] as TabKey[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-5 py-2 rounded-xl text-sm font-semibold transition-all",
                tab === t
                  ? "bg-[#4F7DF3] text-white shadow-[0_4px_12px_rgba(79,125,243,0.35)]"
                  : "text-[#64748B] hover:text-[#94A3B8]",
              )}
              style={
                tab !== t
                  ? { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }
                  : undefined
              }
            >
              {t === "upcoming" ? "Upcoming" : "Past"}
              <span className={cn(
                "ml-2 px-1.5 py-0.5 rounded-md text-xs",
                tab === t ? "bg-white/20" : "bg-white/5 text-[#475569]"
              )}>
                {t === "upcoming" ? upcoming.length : past.length}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-20 text-[#64748B]">
            <RefreshCw className="w-6 h-6 text-[#4F7DF3] animate-spin" />
            <span className="text-sm">Loading your reservations…</span>
          </div>
        ) : displayed.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <div className="space-y-8">
            {Object.entries(groups).map(([dateKey, items]) => (
              <div key={dateKey}>
                {/* Date group header */}
                <div className="flex items-center gap-4 mb-4">
                  <span className="font-[var(--font-poppins)] font-semibold text-[#475569] text-sm">
                    {formatDateHeader(dateKey + "T12:00:00")}
                  </span>
                  <div className="flex-1 h-px bg-[rgba(79,125,243,0.12)]" />
                </div>

                {/* Cards */}
                <div className="space-y-3">
                  {items.map((appt) => (
                    <AppointmentCard
                      key={appt._id}
                      appt={appt}
                      tab={tab}
                      confirmId={confirmId}
                      cancellingId={cancellingId}
                      onRequestCancel={(id) => setConfirmId(id)}
                      onConfirmCancel={cancelAppointment}
                      onDismissCancel={() => setConfirmId(null)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Last updated footer */}
      {lastUpdated && (
        <div className="relative z-10 text-center pb-6">
          <p className="text-xs text-[#334155]">
            Last updated {secondsAgo}s ago · auto-refreshes every 30s
          </p>
        </div>
      )}

      {/* Cancel confirmation modal */}
      <AnimatePresence>
        {confirmId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmId(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-2xl p-8 max-w-sm w-full mx-4 text-center"
              style={{
                background: "rgba(15,23,42,0.95)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <XCircle className="w-7 h-7 text-red-400" />
              </div>
              <h3 className="font-[var(--font-poppins)] font-bold text-white text-lg mb-2">
                Cancel Appointment?
              </h3>
              <p className="text-[#64748B] text-sm mb-6">
                This will permanently cancel the appointment. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmId(null)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-[#64748B] transition-all"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  Keep it
                </button>
                <button
                  onClick={() => cancelAppointment(confirmId)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{ background: "linear-gradient(135deg, #EF4444, #DC2626)" }}
                >
                  {cancellingId === confirmId ? "Cancelling…" : "Yes, Cancel"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AppointmentCard({
  appt, tab, confirmId, cancellingId, onRequestCancel, onConfirmCancel, onDismissCancel,
}: {
  appt: Appointment;
  tab: TabKey;
  confirmId: string | null;
  cancellingId: string | null;
  onRequestCancel: (id: string) => void;
  onConfirmCancel: (id: string) => void;
  onDismissCancel: () => void;
}) {
  const st = STATUS_STYLES[appt.status] || STATUS_STYLES.confirmed;
  const StatusIcon = st.icon;
  const displayName = appt.visitorName || appt.name;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-0 rounded-2xl overflow-hidden"
      style={{ border: "1px solid rgba(79,125,243,0.15)" }}
    >
      {/* Left accent bar */}
      <div className="w-1 flex-shrink-0" style={{ background: st.bar }} />

      <div
        className="flex-1 px-5 py-4"
        style={{ background: "rgba(255,255,255,0.03)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3.5 h-3.5 text-[#4F7DF3] flex-shrink-0" />
              <span className="text-[#4F7DF3] font-semibold text-sm font-[var(--font-inter)]">
                {appt.time}
              </span>
            </div>
            <p className="text-white font-semibold text-[15px] truncate">{displayName}</p>
            {appt.notes && (
              <p className="text-[#64748B] text-xs mt-1 line-clamp-2">{appt.notes}</p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <span className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border", st.badge)}>
              <StatusIcon className="w-3 h-3" />
              {st.label}
            </span>

            {tab === "upcoming" && appt.status === "confirmed" && (
              <button
                onClick={() => onRequestCancel(appt._id)}
                disabled={cancellingId === appt._id}
                className="text-xs text-[#EF4444] hover:text-red-300 font-medium transition-colors disabled:opacity-50"
              >
                {cancellingId === appt._id ? "Cancelling…" : "Cancel"}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({ tab }: { tab: TabKey }) {
  const router = useRouter();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-5 py-20 text-center"
    >
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: "rgba(79,125,243,0.1)", border: "1px solid rgba(79,125,243,0.2)" }}
      >
        {tab === "upcoming" ? (
          <CalendarDays className="w-7 h-7 text-[#4F7DF3]" />
        ) : (
          <Bot className="w-7 h-7 text-[#4F7DF3]" />
        )}
      </div>
      <div>
        <p className="font-[var(--font-poppins)] font-semibold text-white text-lg">
          {tab === "upcoming" ? "No upcoming reservations" : "No past reservations"}
        </p>
        <p className="text-[#64748B] text-sm mt-1">
          {tab === "upcoming"
            ? "Your voice AI appointments will appear here"
            : "Completed appointments will show up here"}
        </p>
      </div>
      {tab === "upcoming" && (
        <button
          onClick={() => router.push("/voice")}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: "linear-gradient(135deg, #4F7DF3, #6FAEFF)", boxShadow: "0 4px 12px rgba(79,125,243,0.3)" }}
        >
          <Mic className="w-4 h-4" />
          Talk to SkyVoice
        </button>
      )}
    </motion.div>
  );
}
