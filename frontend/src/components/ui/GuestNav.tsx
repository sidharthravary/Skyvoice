"use client";

import { Bot, LogOut, Mic, CalendarDays, MessageSquare } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout, getUsername } from "@/lib/auth";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function GuestNav() {
  const pathname = usePathname();
  const [username, setUsername] = useState("");

  useEffect(() => {
    setUsername(getUsername() || "Guest");
  }, []);

  const links = [
    { href: "/voice",        label: "Voice AI",        icon: Mic },
    { href: "/chat",         label: "Chat",            icon: MessageSquare },
    { href: "/reservations", label: "My Reservations", icon: CalendarDays },
  ];

  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between px-8 py-4"
      style={{
        background: "rgba(15,23,42,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(79,125,243,0.12)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4F7DF3] to-[#6FAEFF] flex items-center justify-center shadow-[0_4px_12px_rgba(79,125,243,0.3)]">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="font-[var(--font-poppins)] font-bold text-white text-[15px]">
            SkyVoice
          </span>
          <p className="text-[10px] text-[#475569] leading-none mt-0.5">AI Operations</p>
        </div>
      </div>

      {/* Center nav */}
      <nav className="flex items-center gap-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                active
                  ? "bg-[#4F7DF3]/15 text-[#4F7DF3] border border-[#4F7DF3]/25"
                  : "text-[#64748B] hover:text-[#94A3B8] hover:bg-white/5"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Right: user + logout */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: "rgba(79,125,243,0.08)", border: "1px solid rgba(79,125,243,0.15)" }}>
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#4F7DF3] to-[#6FAEFF] flex items-center justify-center text-white text-[10px] font-bold">
            {username.slice(0, 1).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-[#CBD5E1]">{username}</span>
        </div>
        <button
          onClick={logout}
          title="Logout"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-[#64748B] hover:text-white hover:bg-white/8 transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
