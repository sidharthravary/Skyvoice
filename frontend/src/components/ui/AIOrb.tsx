"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export type OrbState = "idle" | "listening" | "speaking" | "thinking";

interface AIOrbProps {
  state?: OrbState;
  size?: number;
  onClick?: () => void;
  className?: string;
}

const stateAnimations: Record<OrbState, string> = {
  idle: "animate-orb-pulse",
  listening: "animate-orb-listening",
  speaking: "animate-orb-speaking",
  thinking: "animate-spin-slow",
};

const stateColors: Record<OrbState, string> = {
  idle: "from-[#4F7DF3] to-[#6FAEFF]",
  listening: "from-[#22C55E] to-[#4ADE80]",
  speaking: "from-[#4F7DF3] to-[#A78BFA]",
  thinking: "from-[#F59E0B] to-[#FBBF24]",
};

const stateLabels: Record<OrbState, string> = {
  idle: "Click to activate AI",
  listening: "Listening...",
  speaking: "Speaking...",
  thinking: "Thinking...",
};

export function AIOrb({
  state = "idle",
  size = 200,
  onClick,
  className,
}: AIOrbProps) {
  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size * 2, height: size * 2 }}
    >
      {/* Outer pulse rings */}
      {state !== "idle" && (
        <>
          <div
            className="absolute rounded-full border border-[#4F7DF3]/20 animate-ring-pulse"
            style={{ width: size * 1.6, height: size * 1.6 }}
          />
          <div
            className="absolute rounded-full border border-[#4F7DF3]/15 animate-ring-pulse"
            style={{
              width: size * 1.8,
              height: size * 1.8,
              animationDelay: "0.5s",
            }}
          />
          <div
            className="absolute rounded-full border border-[#4F7DF3]/10 animate-ring-pulse"
            style={{
              width: size * 2,
              height: size * 2,
              animationDelay: "1s",
            }}
          />
        </>
      )}

      {/* Glow backdrop */}
      <div
        className="absolute rounded-full blur-3xl opacity-30"
        style={{
          width: size * 1.4,
          height: size * 1.4,
          background:
            "radial-gradient(circle, rgba(79,125,243,0.6), transparent 70%)",
        }}
      />

      {/* Main Orb */}
      <motion.button
        onClick={onClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "relative rounded-full cursor-pointer flex items-center justify-center",
          "bg-gradient-to-br",
          stateColors[state],
          stateAnimations[state],
          "shadow-[0_0_60px_rgba(79,125,243,0.4),0_0_120px_rgba(111,174,255,0.2)]"
        )}
        style={{ width: size, height: size, touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
        aria-label={stateLabels[state]}
      >
        {/* Inner glass shine */}
        <div
          className="absolute top-[10%] left-[15%] rounded-full bg-white/20 blur-sm"
          style={{
            width: size * 0.35,
            height: size * 0.2,
          }}
        />

        {/* Center icon / waveform indicator */}
        <div className="flex flex-col items-center gap-2">
          {state === "idle" && (
            <svg
              width={size * 0.25}
              height={size * 0.25}
              viewBox="0 0 24 24"
              fill="none"
              className="text-white"
            >
              <path
                d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
                fill="currentColor"
              />
              <path
                d="M19 10v2a7 7 0 0 1-14 0v-2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="12"
                y1="19"
                x2="12"
                y2="23"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="8"
                y1="23"
                x2="16"
                y2="23"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          )}
          {state === "listening" && (
            <div className="flex items-end gap-1">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1 bg-white rounded-full"
                  animate={{
                    height: [8, 24, 8],
                  }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    delay: i * 0.1,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
          )}
          {state === "speaking" && (
            <div className="flex items-end gap-1">
              {[...Array(7)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1.5 bg-white rounded-full"
                  animate={{
                    height: [6, 30, 12, 20, 6],
                  }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    delay: i * 0.08,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
          )}
          {state === "thinking" && (
            <div className="flex gap-2">
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-3 h-3 bg-white rounded-full"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </motion.button>

      {/* State label */}
      <motion.p
        key={state}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute -bottom-2 text-sm font-medium text-[#4F7DF3] tracking-wide"
      >
        {stateLabels[state]}
      </motion.p>
    </div>
  );
}
