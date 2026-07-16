"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  BarChart3,
  MessageSquare,
  BookOpen,
  CalendarDays,
  Settings,
  Activity,
  ChevronLeft,
  ChevronRight,
  Bot,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Command Center", icon: LayoutDashboard },
  { href: "/dashboard/chat", label: "Chat", icon: Sparkles },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/conversations", label: "Conversations", icon: MessageSquare },
  { href: "/dashboard/knowledge", label: "Knowledge Base", icon: BookOpen },
  { href: "/dashboard/scheduling", label: "Scheduling", icon: CalendarDays },
  { href: "/dashboard/settings", label: "AI Config", icon: Settings },
  { href: "/dashboard/monitoring", label: "Monitoring", icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      animate={{ width: collapsed ? 80 : 260 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "sticky top-0 h-screen flex flex-col",
        "bg-white/80 backdrop-blur-xl border-r border-[#4F7DF3]/8",
        "py-6 z-40"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4F7DF3] to-[#6FAEFF] flex items-center justify-center flex-shrink-0 shadow-[0_4px_12px_rgba(79,125,243,0.3)]">
          <Bot className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <h1 className="font-[var(--font-poppins)] font-bold text-lg text-[#0F172A] leading-tight">
              SkyVoice
            </h1>
            <p className="text-[10px] text-[#64748B] font-medium tracking-wider uppercase">
              AI Operations
            </p>
          </motion.div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative",
                isActive
                  ? "bg-gradient-to-r from-[#4F7DF3]/10 to-[#6FAEFF]/5 text-[#4F7DF3]"
                  : "text-[#64748B] hover:text-[#4F7DF3] hover:bg-[#4F7DF3]/5"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-gradient-to-b from-[#4F7DF3] to-[#6FAEFF]"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <item.icon
                className={cn(
                  "w-5 h-5 flex-shrink-0 transition-colors",
                  isActive ? "text-[#4F7DF3]" : "text-[#94A3B8] group-hover:text-[#4F7DF3]"
                )}
              />
              {!collapsed && (
                <span className="text-sm font-medium truncate">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="px-3 mt-4">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[#94A3B8] hover:text-[#4F7DF3] hover:bg-[#4F7DF3]/5 transition-all text-sm cursor-pointer"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
}
