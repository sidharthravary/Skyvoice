"use client";

import { motion } from "framer-motion";
import { ChatPanel } from "@/components/ChatPanel";

export default function AdminChatPage() {
  return (
    <div className="flex flex-col h-[calc(100dvh-140px)] min-h-[420px]">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <h1 className="text-2xl font-[var(--font-poppins)] font-bold text-[#0F172A]">Chat</h1>
        <p className="text-sm text-[#64748B] mt-1">
          Talk to SkyVoice AI in text — same assistant as the voice orb, powered by your knowledge base.
        </p>
      </motion.div>
      <div className="flex-1 min-h-0">
        <ChatPanel />
      </div>
    </div>
  );
}
