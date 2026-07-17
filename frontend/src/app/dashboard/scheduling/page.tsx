"use client";

import { getBackendUrl } from "@/lib/backend";

import React, { useEffect, useState, Fragment } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatsCard } from "@/components/ui/StatsCard";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Globe,
  RefreshCw,
  Trash2,
} from "lucide-react";

interface AppointmentData {
  _id: string;
  name: string;
  email: string;
  date: string | Date;
  time: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no-show";
  calendarEventId?: string;
  notes?: string;
}

const statusBadge = {
  confirmed: { color: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: CheckCircle },
  pending: { color: "bg-amber-50 text-amber-700 border-amber-100", icon: AlertCircle },
  cancelled: { color: "bg-red-50 text-red-700 border-red-100", icon: XCircle },
  completed: { color: "bg-blue-50 text-blue-700 border-blue-100", icon: CheckCircle },
  "no-show": { color: "bg-gray-50 text-gray-600 border-gray-200", icon: XCircle },
};

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const timeSlots = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];

export default function SchedulingPage() {
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const backendUrl = getBackendUrl();

  // Get date strings for the current week (Monday to Sunday)
  const getWeekDates = () => {
    const today = new Date();
    const day = today.getDay(); // 0 is Sunday, 1 is Monday, etc.
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(today.setDate(diff));

    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates();

  // Helper to format date as DD-MM-YYYY in local timezone
  const formatLocalDate = (d: Date) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const weekDateStrings = weekDates.map(d => formatLocalDate(d));

  useEffect(() => {
    setLoading(true);
    fetch(`${backendUrl}/api/appointments?limit=100`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setAppointments(data.data);
        }
      })
      .catch((err) => console.error("Failed to fetch appointments:", err))
      .finally(() => setLoading(false));
  }, [backendUrl, refreshTrigger]);

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;
    try {
      const res = await fetch(`${backendUrl}/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (res.ok) {
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (err) {
      console.error("Failed to cancel appointment:", err);
    }
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Find appointment matching date string and time slot
  const findAppointment = (dateStr: string, slotTime: string) => {
    return appointments.find((apt) => {
      if (apt.status === "cancelled") return false;
      const aptDateObj = new Date(apt.date);
      const aptDateStr = formatLocalDate(aptDateObj);
      return aptDateStr === dateStr && apt.time === slotTime;
    });
  };

  // Stats calculation
  const totalBookings = appointments.filter(a => a.status !== "cancelled").length;
  const activeBookings = appointments.filter(a => a.status === "confirmed").length;
  const pendingBookings = appointments.filter(a => a.status === "pending").length;
  const cancelledBookings = appointments.filter(a => a.status === "cancelled").length;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-[var(--font-poppins)] font-bold text-[#0F172A]">
            Scheduling Dashboard
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            Manage appointments and Google Calendar integration.
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={triggerRefresh}
            className="flex items-center justify-center p-2.5 rounded-xl bg-white border border-[#4F7DF3]/10 text-[#64748B] hover:text-[#4F7DF3] transition-colors cursor-pointer"
            title="Refresh appointments"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#4F7DF3]/10 text-sm text-[#64748B]">
            <Globe className="w-4 h-4 text-[#4F7DF3]" />
            <span>UTC+5:30</span>
          </div>
          <button 
            onClick={() => alert("Try booking an appointment instantly by using our Voice AI Assistant on the landing page!")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#4F7DF3] to-[#6FAEFF] text-white text-sm font-semibold shadow-[0_4px_12px_rgba(79,125,243,0.3)] hover:shadow-[0_8px_24px_rgba(79,125,243,0.4)] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Appointment
          </button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <StatsCard label="Active Bookings" value={activeBookings} icon={CalendarDays} />
        <StatsCard label="Pending Approval" value={pendingBookings} icon={AlertCircle} />
        <StatsCard label="Cancelled Slots" value={cancelledBookings} icon={XCircle} />
        <StatsCard label="Total Saved Lead" value={totalBookings} icon={CheckCircle} />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Calendar Grid */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2">
          <GlassCard hover={false}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#0F172A]">Weekly View (Current Week)</h3>
              <span className="text-xs text-[#94A3B8] font-light">Click cells hover to see slots</span>
            </div>
            <div className="overflow-x-auto">
              <div className="grid grid-cols-8 gap-px min-w-[600px] bg-slate-100/50 p-2 rounded-xl">
                {/* Header */}
                <div className="p-2" />
                {weekDays.map((day, idx) => {
                  const dateObj = weekDates[idx];
                  const formattedDate = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  return (
                    <div key={day} className="p-2 text-center text-xs font-semibold text-[#64748B] flex flex-col items-center justify-center">
                      <span>{day}</span>
                      <span className="text-[9px] font-normal text-[#94A3B8] mt-0.5">{formattedDate}</span>
                    </div>
                  );
                })}
                {/* Time slots */}
                {timeSlots.map((time) => (
                  <Fragment key={`slot-row-${time}`}>
                    <div className="p-2 text-xs text-[#94A3B8] text-right pr-3 flex items-center justify-end font-mono">
                      {time}
                    </div>
                    {weekDateStrings.map((dateStr) => {
                      const apt = findAppointment(dateStr, time);
                      return (
                        <div
                          key={`${dateStr}-${time}`}
                          className={cn(
                            "p-1 min-h-[46px] rounded-lg border border-transparent transition-all flex flex-col justify-center items-center text-center",
                            apt
                              ? "bg-[#4F7DF3]/10 border-[#4F7DF3]/20 hover:bg-[#4F7DF3]/15 shadow-sm"
                              : "hover:bg-white hover:shadow-sm hover:border-[#4F7DF3]/15"
                          )}
                        >
                          {apt ? (
                            <div className="text-[10px] text-[#4F7DF3] font-semibold truncate w-full px-1 flex flex-col leading-tight" title={`${apt.name} (${apt.email})`}>
                              <span className="truncate">{apt.name}</span>
                              <span className="text-[8px] text-[#6FAEFF] truncate">{apt.time}</span>
                            </div>
                          ) : (
                            <span className="text-[9px] text-[#94A3B8]/20 select-none font-light">
                              —
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Appointment List */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <GlassCard hover={false} className="max-h-[560px] flex flex-col">
            <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Upcoming Appointments</h3>
            <div className="space-y-3 overflow-y-auto pr-1 flex-1">
              {loading ? (
                <div className="text-center py-12 text-xs text-[#94A3B8] flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#4F7DF3]" />
                  <span>Loading appointments...</span>
                </div>
              ) : appointments.length === 0 ? (
                <div className="text-center py-12 text-xs text-[#94A3B8]">
                  No upcoming appointments.
                </div>
              ) : (
                appointments.map((apt) => {
                  const badge = statusBadge[apt.status] || statusBadge.confirmed;
                  const BadgeIcon = badge.icon;
                  const aptDateObj = new Date(apt.date);
                  const formattedDate = aptDateObj.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  return (
                    <div key={apt._id} className="p-3 rounded-xl bg-white border border-[#4F7DF3]/5 hover:border-[#4F7DF3]/15 transition-all flex justify-between items-start shadow-sm">
                      <div className="space-y-1 flex-1 min-w-0 pr-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-[#0F172A] truncate block">{apt.name}</span>
                        </div>
                        <p className="text-[10px] text-[#64748B] truncate">{apt.email}</p>
                        <p className="text-[11px] text-[#4F7DF3] font-semibold">
                          {formattedDate} at {apt.time}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-medium border", badge.color)}>
                          <BadgeIcon className="w-2.5 h-2.5" />
                          {apt.status}
                        </span>
                        {apt.status !== "cancelled" && (
                          <button
                            onClick={() => handleCancel(apt._id)}
                            className="p-1 text-[#94A3B8] hover:text-red-500 hover:bg-red-50 rounded transition-all cursor-pointer"
                            title="Cancel appointment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}
