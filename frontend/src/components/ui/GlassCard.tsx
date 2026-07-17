"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  variant?: "light" | "dark";
  hover?: boolean;
  glow?: boolean;
  onClick?: () => void;
}

export function GlassCard({
  children,
  className,
  variant = "light",
  hover = true,
  glow = false,
  onClick,
}: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-[20px] p-6 transition-all duration-300",
        variant === "light"
          ? "bg-white/75 backdrop-blur-xl border border-white/60 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-12px_rgba(79,125,243,0.14)]"
          : "bg-[#0B1120]/70 backdrop-blur-xl border border-[#4F7DF3]/15 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.5)]",
        hover &&
          "hover:shadow-[0_2px_4px_rgba(15,23,42,0.05),0_20px_44px_-12px_rgba(79,125,243,0.22)] hover:translate-y-[-2px] hover:border-[#4F7DF3]/30 cursor-pointer",
        glow && "shadow-[0_0_30px_rgba(79,125,243,0.25)]",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
}
