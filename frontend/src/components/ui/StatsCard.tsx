"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  className?: string;
}

export function StatsCard({
  label,
  value,
  icon: Icon,
  trend,
  className,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        "group relative rounded-[20px] p-6 transition-all duration-300",
        "bg-white/65 backdrop-blur-xl border border-white/18",
        "hover:shadow-[0_4px_20px_rgba(79,125,243,0.12)] hover:translate-y-[-2px] hover:border-[#4F7DF3]/25",
        className
      )}
    >
      {/* Subtle gradient hover overlay */}
      <div className="absolute inset-0 rounded-[20px] bg-gradient-to-br from-[#4F7DF3]/0 to-[#6FAEFF]/0 group-hover:from-[#4F7DF3]/5 group-hover:to-[#6FAEFF]/5 transition-all duration-300" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#4F7DF3] to-[#6FAEFF] flex items-center justify-center shadow-[0_4px_12px_rgba(79,125,243,0.3)]">
            <Icon className="w-5 h-5 text-white" />
          </div>
          {trend && (
            <span
              className={cn(
                "text-xs font-semibold px-2.5 py-1 rounded-full",
                trend.positive
                  ? "text-emerald-600 bg-emerald-50"
                  : "text-red-600 bg-red-50"
              )}
            >
              {trend.positive ? "↑" : "↓"} {Math.abs(trend.value)}%
            </span>
          )}
        </div>

        <p className="text-3xl font-bold font-[var(--font-poppins)] text-[#0F172A] tracking-tight">
          {value}
        </p>
        <p className="text-sm text-[#64748B] mt-1 font-medium">{label}</p>
      </div>
    </div>
  );
}
