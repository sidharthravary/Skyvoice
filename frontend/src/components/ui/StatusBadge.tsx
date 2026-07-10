"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface StatusBadgeProps {
  status: "online" | "processing" | "error" | "offline";
  label?: string;
  className?: string;
}

const statusConfig = {
  online: {
    color: "bg-emerald-500",
    bgColor: "bg-emerald-50 border-emerald-100",
    textColor: "text-emerald-700",
    defaultLabel: "Online",
  },
  processing: {
    color: "bg-amber-500",
    bgColor: "bg-amber-50 border-amber-100",
    textColor: "text-amber-700",
    defaultLabel: "Processing",
  },
  error: {
    color: "bg-red-500",
    bgColor: "bg-red-50 border-red-100",
    textColor: "text-red-700",
    defaultLabel: "Error",
  },
  offline: {
    color: "bg-gray-400",
    bgColor: "bg-gray-50 border-gray-200",
    textColor: "text-gray-600",
    defaultLabel: "Offline",
  },
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold",
        config.bgColor,
        config.textColor,
        className
      )}
    >
      <motion.div
        className={cn("w-2 h-2 rounded-full", config.color)}
        animate={
          status === "online" || status === "processing"
            ? { opacity: [1, 0.4, 1] }
            : {}
        }
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      {label || config.defaultLabel}
    </div>
  );
}
