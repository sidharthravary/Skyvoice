"use client";

import { getBackendUrl } from "@/lib/backend";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  Search,
  Play,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Minus,
  ChevronRight,
  RefreshCw,
  Clock,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface UIConversation {
  id: string;
  user: string;
  intent: string;
  sentiment: "positive" | "neutral" | "negative";
  resolved: boolean;
  messagesCount: number;
  duration: string;
  date: string;
  confidence: number;
  preview: string;
  messages: UIMessage[];
}

const uiMockConversations: UIConversation[] = [
  {
    id: "mock-1",
    user: "John Smith",
    intent: "booking_request",
    sentiment: "positive",
    resolved: true,
    messagesCount: 11,
    duration: "3m 45s",
    date: "2026-05-27 14:32",
    confidence: 0.95,
    preview: "I'd like to schedule a meeting for next Tuesday...",
    messages: [
      { role: "assistant", content: "Hello, welcome to Skyvion AI Systems. How can I assist you today?" },
      { role: "user", content: "I'd like to schedule a meeting for next Tuesday." },
      { role: "assistant", content: "I can help you book an appointment right now! Let's get started. May I have your full name?" },
      { role: "user", content: "John Smith" },
      { role: "assistant", content: "Got it. What is your email address?" },
      { role: "user", content: "john@example.com" },
      { role: "assistant", content: "Thanks. What date would you like to schedule? (Please mention like YYYY-MM-DD or say tomorrow/next Monday)" },
      { role: "user", content: "next Tuesday" },
      { role: "assistant", content: "We have availability on 2026-06-02 at: 09:00, 10:00, 11:00, 13:00. Which time works for you?" },
      { role: "user", content: "10:00" },
      { role: "assistant", content: "Awesome! I have scheduled your appointment on 2026-06-02 at 10:00. A confirmation email has been sent to john@example.com. What else can I do for you today?" }
    ]
  },
  {
    id: "mock-2",
    user: "Sarah Wilson",
    intent: "project_inquiry",
    sentiment: "neutral",
    resolved: true,
    messagesCount: 9,
    duration: "4m 10s",
    date: "2026-05-27 13:15",
    confidence: 0.88,
    preview: "We're looking for an AI solution for our customer support...",
    messages: [
      { role: "assistant", content: "Hello, welcome to Skyvion AI Systems. How can I assist you today?" },
      { role: "user", content: "We're looking for an AI solution for our customer support." },
      { role: "assistant", content: "Great! I can collect your project requirements and log an inquiry with our engineering team. What is the name of your company?" },
      { role: "user", content: "Wilson Labs" },
      { role: "assistant", content: "Thank you. What is your email address so we can contact you?" },
      { role: "user", content: "sarah@wilsonlabs.com" },
      { role: "assistant", content: "Got it. Tell me a bit about your project requirements (e.g., website, software, mobile app, budget, or timeline)." },
      { role: "user", content: "We want an embeddable AI customer support widget with real-time speech and web fallback." },
      { role: "assistant", content: "Perfect, I've captured your project requirements for Wilson Labs. Our team will review the inquiry and email you at sarah@wilsonlabs.com shortly. Is there anything else I can help you with?" }
    ]
  },
  {
    id: "mock-3",
    user: "Mike Johnson",
    intent: "faq",
    sentiment: "positive",
    resolved: true,
    messagesCount: 4,
    duration: "1m 50s",
    date: "2026-05-27 11:45",
    confidence: 0.97,
    preview: "What services does Skyvion Tech offer?",
    messages: [
      { role: "assistant", content: "Hello, welcome to Skyvion AI Systems. How can I assist you today?" },
      { role: "user", content: "What services does Skyvion Tech offer?" },
      { role: "assistant", content: "Based on our knowledge documents: 'Skyvion Tech provides custom enterprise software solutions, including real-time AI voice agents, web application development, and autonomous data operations platforms.' Does that answer your question?" },
      { role: "user", content: "Yes, thank you. You're very welcome!" }
    ]
  },
  {
    id: "mock-4",
    user: "Emma Davis",
    intent: "escalation",
    sentiment: "negative",
    resolved: false,
    messagesCount: 6,
    duration: "3m 15s",
    date: "2026-05-27 10:20",
    confidence: 0.72,
    preview: "I've been waiting for a response for over a week...",
    messages: [
      { role: "assistant", content: "Hello, welcome to Skyvion AI Systems. How can I assist you today?" },
      { role: "user", content: "I've been waiting for a response for over a week regarding my invoice." },
      { role: "assistant", content: "I'm sorry to hear that you have been waiting. Let me check your account details. What is your name and email address?" },
      { role: "user", content: "Emma Davis, emma@example.com" },
      { role: "assistant", content: "Thank you, Emma. I see your message now. Let me escalate this request directly to our finance team supervisor so they can resolve it. One moment." },
      { role: "user", content: "I need it resolved today because it is blocking our deployment." }
    ]
  },
  {
    id: "mock-5",
    user: "Alex Chen",
    intent: "general_query",
    sentiment: "positive",
    resolved: true,
    messagesCount: 4,
    duration: "1m 30s",
    date: "2026-05-27 09:00",
    confidence: 0.91,
    preview: "Can you tell me about your pricing plans?",
    messages: [
      { role: "assistant", content: "Hello, welcome to Skyvion AI Systems. How can I assist you today?" },
      { role: "user", content: "Can you tell me about your pricing plans?" },
      { role: "assistant", content: "SkyVoice offers three main tiers: Starter (free tier for browser-assisted voice widgets), Pro ($49/mo with ElevenLabs TTS/STT and calendar integrations), and Enterprise (custom quotes with custom RAG, dedicated hosting, and Twilio phone line support). Would you like me to book a sales demo to discuss?" },
      { role: "user", content: "Maybe later, thanks." }
    ]
  }
];

const sentimentIcons = {
  positive: { icon: ThumbsUp, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
  neutral: { icon: Minus, color: "text-amber-600 bg-amber-50 border-amber-100" },
  negative: { icon: ThumbsDown, color: "text-red-600 bg-red-50 border-red-100" },
};

// Intent Badge helper
const getIntentBadge = (intent: string, resolved: boolean) => {
  if (intent === "booking_request") {
    return resolved 
      ? { text: "Meeting Scheduled", style: "bg-emerald-50 text-emerald-700 border-emerald-100" }
      : { text: "Booking Interrupted", style: "bg-amber-50 text-amber-700 border-amber-100" };
  }
  if (intent === "project_inquiry") {
    return resolved
      ? { text: "Inquiry Captured", style: "bg-purple-50 text-purple-700 border-purple-100" }
      : { text: "Inquiry Interrupted", style: "bg-amber-50 text-amber-700 border-amber-100" };
  }
  if (intent === "faq") {
    return { text: "FAQ support", style: "bg-blue-50 text-blue-700 border-blue-100" };
  }
  if (intent === "escalation") {
    return { text: "Escalation", style: "bg-red-50 text-red-700 border-red-100" };
  }
  if (intent === "greeting") {
    return { text: "Greeting", style: "bg-sky-50 text-sky-700 border-sky-100" };
  }
  return { text: "General Query", style: "bg-gray-50 text-gray-700 border-gray-200" };
};

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<UIConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const backendUrl = getBackendUrl();

  // Helper to parse MongoDB Conversation into UI Conversation format
  const mapDBConversationToUI = (db: any): UIConversation => {
    const messages = db.messages || [];
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    const preview = lastUserMsg ? lastUserMsg.content : (messages[messages.length - 1]?.content || "No message exchange");
    
    const dateObj = new Date(db.createdAt);
    const formattedDate = dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    let durationStr = "0s";
    if (db.duration) {
      const mins = Math.floor(db.duration / 60);
      const secs = db.duration % 60;
      durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    } else if (db.createdAt && db.updatedAt) {
      const diffMs = new Date(db.updatedAt).getTime() - new Date(db.createdAt).getTime();
      const totalSecs = Math.max(0, Math.round(diffMs / 1000));
      const mins = Math.floor(totalSecs / 60);
      const secs = totalSecs % 60;
      durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    }

    // Attempt to extract client name from conversation flow
    let userName = `Visitor (${db.userId.slice(-5)})`;
    const askNameIdx = messages.findIndex((m: any) => m.role === 'assistant' && m.content.toLowerCase().includes('name'));
    if (askNameIdx !== -1 && messages[askNameIdx + 1] && messages[askNameIdx + 1].role === 'user') {
      const parsedName = messages[askNameIdx + 1].content.trim();
      // Filter out conversational details if they said "My name is X"
      const cleanedName = parsedName.replace(/^(my name is|i'm|i am|this is)\s+/gi, "");
      if (cleanedName.length > 0 && cleanedName.length < 30) {
        userName = cleanedName;
      }
    }

    return {
      id: db._id,
      user: userName,
      intent: db.intent || "general_query",
      sentiment: db.sentiment || "neutral",
      resolved: db.resolved ?? true,
      messagesCount: messages.length,
      duration: durationStr,
      date: formattedDate,
      confidence: lastUserMsg?.confidence ?? 0.94,
      preview,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    };
  };

  useEffect(() => {
    setLoading(true);
    fetch(`${backendUrl}/api/conversations?limit=100`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          const dbConvs = data.data.map(mapDBConversationToUI);
          const combined = [...dbConvs, ...uiMockConversations];
          setConversations(combined);
          if (combined.length > 0) {
            setSelectedId(combined[0].id);
          }
        } else {
          setConversations(uiMockConversations);
          setSelectedId("mock-1");
        }
      })
      .catch((err) => {
        console.error("Failed to load DB conversations:", err);
        setConversations(uiMockConversations);
        setSelectedId("mock-1");
      })
      .finally(() => setLoading(false));
  }, [backendUrl, refreshTrigger]);

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Filter conversations
  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch =
      conv.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.preview.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.intent.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const selected = conversations.find((c) => c.id === selectedId);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-[var(--font-poppins)] font-bold text-[#0F172A]">
            Conversation Intelligence
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            Review live speech transcripts, task completions, and sentiment scoring.
          </p>
        </div>
        <button
          onClick={triggerRefresh}
          className="flex items-center justify-center p-2.5 rounded-xl bg-white border border-[#4F7DF3]/10 text-[#64748B] hover:text-[#4F7DF3] transition-colors cursor-pointer"
          title="Refresh logs"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Conversation List */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2"
        >
          <GlassCard className="!p-4 max-h-[680px] flex flex-col" hover={false}>
            {/* Search */}
            <div className="flex items-center gap-2 bg-[#F5F9FF] rounded-xl px-4 py-2.5 mb-4 border border-[#4F7DF3]/8">
              <Search className="w-4 h-4 text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Search transcripts or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-sm text-[#0F172A] outline-none w-full placeholder:text-[#94A3B8]"
              />
            </div>

            {/* List */}
            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {loading && conversations.length === 0 ? (
                <div className="text-center py-12 text-xs text-[#94A3B8]">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#4F7DF3] mx-auto mb-2" />
                  <span>Syncing conversation history...</span>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="text-center py-12 text-xs text-[#94A3B8]">
                  No matching sessions found.
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const badgeInfo = getIntentBadge(conv.intent, conv.resolved);
                  const SentimentIcon = sentimentIcons[conv.sentiment]?.icon || Minus;
                  const sentimentDetails = sentimentIcons[conv.sentiment] || sentimentIcons.neutral;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedId(conv.id)}
                      className={cn(
                        "w-full text-left p-3.5 rounded-xl transition-all duration-200 border cursor-pointer block",
                        selectedId === conv.id
                          ? "bg-white border-[#4F7DF3]/25 shadow-sm"
                          : "hover:bg-[#F5F9FF] border-transparent"
                      )}
                    >
                      <div className="flex items-start justify-between mb-1.5">
                        <span className="font-semibold text-sm text-[#0F172A] truncate max-w-[70%]">
                          {conv.user}
                        </span>
                        <span
                          className={cn(
                            "w-5 h-5 rounded-md flex items-center justify-center border",
                            sentimentDetails.color
                          )}
                          title={`Sentiment: ${conv.sentiment}`}
                        >
                          <SentimentIcon className="w-2.5 h-2.5" />
                        </span>
                      </div>
                      <p className="text-xs text-[#64748B] truncate mb-2 leading-snug">
                        {conv.preview}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("text-[9px] px-2 py-0.5 rounded-md border font-semibold", badgeInfo.style)}>
                          {badgeInfo.text}
                        </span>
                        <span className="text-[9px] text-[#94A3B8] font-mono">
                          {conv.messagesCount} turns · {conv.duration}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </GlassCard>
        </motion.div>

        {/* Transcript Viewer */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-3"
        >
          {selected ? (
            <GlassCard hover={false} className="max-h-[680px] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#4F7DF3]/8 mb-4 shrink-0">
                <div>
                  <h3 className="font-semibold text-[#0F172A]">{selected.user}</h3>
                  <p className="text-xs text-[#94A3B8] mt-0.5 font-mono">{selected.date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F5F9FF] border border-[#4F7DF3]/10 text-xs text-[#64748B] font-mono">
                    <Clock className="w-3.5 h-3.5 text-[#4F7DF3]" />
                    <span>{selected.duration}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F5F9FF] border border-[#4F7DF3]/10 text-xs text-[#64748B]">
                    <Award className="w-3.5 h-3.5 text-[#4F7DF3]" />
                    <span>
                      Confidence:{" "}
                      <span className={cn("font-bold font-mono", selected.confidence > 0.85 ? "text-emerald-600" : "text-amber-600")}>
                        {(selected.confidence * 100).toFixed(0)}%
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Message Transcript */}
              <div className="space-y-4 overflow-y-auto flex-1 pr-1 max-h-[500px]">
                {selected.messages.length === 0 ? (
                  <div className="text-center py-12 text-sm text-[#94A3B8]">
                    No messages recorded.
                  </div>
                ) : (
                  selected.messages.map((msg, index) => {
                    const isAssistant = msg.role === "assistant";
                    return (
                      <div key={index} className={cn("flex gap-3", !isAssistant && "flex-row-reverse")}>
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm border",
                          isAssistant 
                            ? "bg-white border-[#4F7DF3]/10 text-[#4F7DF3]" 
                            : "bg-[#0F172A] border-transparent text-white"
                        )}>
                          {isAssistant ? (
                            <MessageSquare className="w-4 h-4" />
                          ) : (
                            <span className="text-xs font-bold font-mono">U</span>
                          )}
                        </div>
                        <div className={cn("max-w-[75%] space-y-1", !isAssistant && "text-right")}>
                          <p className={cn("text-[10px] font-semibold tracking-wider uppercase", isAssistant ? "text-[#4F7DF3]" : "text-[#64748B]")}>
                            {isAssistant ? "AI Assistant" : "User"}
                          </p>
                          <div className={cn(
                            "rounded-2xl px-4 py-2.5 text-sm shadow-sm leading-relaxed border text-left",
                            isAssistant
                              ? "bg-[#F5F9FF] border-[#4F7DF3]/8 text-[#0F172A]"
                              : "bg-gradient-to-br from-[#4F7DF3] to-[#6FAEFF] border-transparent text-white"
                          )}>
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </GlassCard>
          ) : (
            <GlassCard hover={false} className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <ChevronRight className="w-8 h-8 text-[#94A3B8] mx-auto mb-2 animate-pulse" />
                <p className="text-sm text-[#94A3B8]">Select a conversation session to review</p>
              </div>
            </GlassCard>
          )}
        </motion.div>
      </div>
    </div>
  );
}
