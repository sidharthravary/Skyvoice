"use client";

import { cn } from "@/lib/utils";
import { Bell, Search, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { getUsername, logout } from "@/lib/auth";

interface NavBarProps {
  className?: string;
}

export function NavBar({ className }: NavBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [username, setUsername] = useState("Admin");

  useEffect(() => {
    setUsername(getUsername() || "Admin");
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 flex items-center justify-between px-6 py-3",
        "bg-white/70 backdrop-blur-xl border-b border-[#4F7DF3]/8",
        className
      )}
    >
      {/* Left: Search */}
      <div className="flex items-center gap-4">
        {searchOpen ? (
          <div className="flex items-center gap-2 bg-[#F5F9FF] rounded-xl px-4 py-2 border border-[#4F7DF3]/10 w-80">
            <Search className="w-4 h-4 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search conversations, analytics…"
              className="bg-transparent text-sm text-[#0F172A] outline-none w-full placeholder:text-[#94A3B8]"
              autoFocus
              onBlur={() => setSearchOpen(false)}
            />
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 text-[#94A3B8] hover:text-[#4F7DF3] transition-colors cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span className="text-sm">Search…</span>
          </button>
        )}
      </div>

      {/* Right: Status + Actions */}
      <div className="flex items-center gap-3">
        {/* AI Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-emerald-700">AI Online</span>
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-xl hover:bg-[#4F7DF3]/5 transition-colors cursor-pointer">
          <Bell className="w-5 h-5 text-[#64748B]" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#4F7DF3]" />
        </button>

        {/* Profile + Logout */}
        <div className="flex items-center gap-2 pl-3 border-l border-[#4F7DF3]/10">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#4F7DF3]/6 border border-[#4F7DF3]/12">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#4F7DF3] to-[#6FAEFF] flex items-center justify-center text-white text-[10px] font-bold">
              {username.slice(0, 1).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-[#0F172A]">{username}</span>
          </div>
          <button
            onClick={logout}
            title="Logout"
            className="p-2 rounded-xl text-[#94A3B8] hover:text-[#EF4444] hover:bg-red-50 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
