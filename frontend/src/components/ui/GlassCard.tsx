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
          ? "bg-white/65 backdrop-blur-xl border border-white/18"
          : "bg-[#0F172A]/65 backdrop-blur-xl border border-[#4F7DF3]/15",
        hover &&
          "hover:shadow-[0_4px_20px_rgba(79,125,243,0.12)] hover:translate-y-[-2px] hover:border-[#4F7DF3]/25 cursor-pointer",
        glow && "shadow-[0_0_30px_rgba(79,125,243,0.25)]",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
}
