"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bot, SendHorizonal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatAI } from "@/hooks/useChatAI";

const SUGGESTIONS = [
  "What meetings are scheduled this week?",
  "What does Skyvion Technologies offer?",
  "Book an appointment for me",
];

// ChatGPT-style text chat backed by the SkyVoice AI pipeline.
// `dark` matches the visitor pages; light matches the admin dashboard.
export function ChatPanel({ dark = false }: { dark?: boolean }) {
  const { messages, typing, isConnected, sendMessage } = useChatAI();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  function submit() {
    if (!draft.trim()) return;
    sendMessage(draft);
    setDraft("");
    inputRef.current?.focus();
  }

  const assistantBubble = dark
    ? "bg-white/6 border border-white/10 text-[#CBD5E1]"
    : "bg-white border border-[#4F7DF3]/10 text-[#334155] shadow-sm";
  const subText = dark ? "text-[#64748B]" : "text-[#94A3B8]";

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Connection status */}
      <div className="flex items-center gap-1.5 justify-center pb-3">
        <span
          className="inline-block w-[7px] h-[7px] rounded-full"
          style={{
            backgroundColor: isConnected ? "#22C55E" : "#EF4444",
            boxShadow: isConnected ? "0 0 6px rgba(34,197,94,0.6)" : undefined,
          }}
        />
        <span className={cn("text-xs font-medium", subText)}>
          {isConnected ? "AI Connected" : "Connecting…"}
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-1 space-y-3">
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-md text-sm leading-relaxed bg-gradient-to-r from-[#4F7DF3] to-[#6FAEFF] text-white shadow-[0_2px_8px_rgba(79,125,243,0.3)]">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#4F7DF3] to-[#6FAEFF] flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div
                className={cn(
                  "max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tl-md text-sm leading-relaxed whitespace-pre-wrap",
                  assistantBubble
                )}
              >
                {m.text}
              </div>
            </div>
          )
        )}

        {/* Typing indicator */}
        {typing && (
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#4F7DF3] to-[#6FAEFF] flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className={cn("px-4 py-3 rounded-2xl rounded-tl-md flex gap-1.5", assistantBubble)}>
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-[#4F7DF3]"
                  animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Suggestions when the conversation is fresh */}
        {messages.length <= 1 && !typing && (
          <div className="flex flex-wrap gap-2 pt-2 pl-9">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer",
                  dark
                    ? "border-[#4F7DF3]/30 text-[#94A3B8] hover:text-white hover:bg-[#4F7DF3]/15"
                    : "border-[#4F7DF3]/20 text-[#64748B] hover:text-[#4F7DF3] hover:bg-[#4F7DF3]/5 bg-white"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div
        className={cn(
          "mt-4 flex items-end gap-2 rounded-2xl px-4 py-3 border",
          dark
            ? "bg-white/4 border-white/10 focus-within:border-[#4F7DF3]/50"
            : "bg-white border-[#4F7DF3]/15 shadow-sm focus-within:border-[#4F7DF3]/50"
        )}
      >
        <textarea
          ref={inputRef}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Message SkyVoice AI…"
          className={cn(
            "flex-1 bg-transparent outline-none resize-none text-sm leading-relaxed max-h-32",
            dark ? "text-[#E2E8F0] placeholder:text-[#475569]" : "text-[#0F172A] placeholder:text-[#94A3B8]"
          )}
        />
        <button
          onClick={submit}
          disabled={!draft.trim() || !isConnected}
          aria-label="Send message"
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all cursor-pointer",
            draft.trim() && isConnected
              ? "bg-gradient-to-r from-[#4F7DF3] to-[#6FAEFF] text-white shadow-[0_2px_10px_rgba(79,125,243,0.4)] hover:shadow-[0_4px_14px_rgba(79,125,243,0.5)]"
              : dark
                ? "bg-white/5 text-[#475569]"
                : "bg-[#F1F5F9] text-[#94A3B8]"
          )}
        >
          <SendHorizonal className="w-4 h-4" />
        </button>
      </div>
      <p className={cn("text-[10px] text-center pt-2", subText)}>
        Answers come from the SkyVoice knowledge base and live appointment data.
      </p>
    </div>
  );
}
