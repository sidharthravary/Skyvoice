"use client";

import { GuestNav } from "@/components/ui/GuestNav";
import { ChatPanel } from "@/components/ChatPanel";

export default function GuestChatPage() {
  return (
    <div
      className="relative overflow-hidden flex flex-col items-center"
      style={{ minHeight: "100dvh", background: "#0F172A" }}
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.025,
          backgroundImage:
            "linear-gradient(#4F7DF3 1px, transparent 1px), linear-gradient(90deg, #4F7DF3 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative z-10 w-full">
        <GuestNav />
      </div>

      <main className="relative z-10 flex flex-col w-full flex-1 min-h-0 max-w-2xl px-4 pt-4 pb-5">
        <ChatPanel dark />
      </main>

      <footer className="relative z-10 w-full text-center pb-3">
        <p style={{ fontSize: 11, color: "#475569" }}>
          Powered by <span style={{ color: "#64748B" }}>Skyvion Technologies</span>
        </p>
      </footer>
    </div>
  );
}
