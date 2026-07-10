"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { useState } from "react";
import {
  Upload,
  FileText,
  Link2,
  Plus,
  Search,
  RefreshCw,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const mockDocuments = [
  { id: "1", title: "Product Guide v2.pdf", type: "pdf" as const, status: "indexed" as const, date: "2026-05-25" },
  { id: "2", title: "FAQ Database.docx", type: "docx" as const, status: "indexed" as const, date: "2026-05-24" },
  { id: "3", title: "Service Catalog.pdf", type: "pdf" as const, status: "pending" as const, date: "2026-05-27" },
  { id: "4", title: "Pricing Sheet.pdf", type: "pdf" as const, status: "error" as const, date: "2026-05-26" },
];

const mockFaqs = [
  { id: "1", question: "What services does Skyvion Tech offer?", answer: "We offer AI development, voice assistant platforms, and enterprise automation solutions." },
  { id: "2", question: "How do I schedule a meeting?", answer: "Simply ask the AI assistant to schedule a meeting and it will check available slots." },
  { id: "3", question: "What are your business hours?", answer: "We operate Monday through Friday, 9 AM to 5 PM EST." },
];

const statusConfig = {
  indexed: { icon: CheckCircle, color: "text-emerald-600 bg-emerald-50", label: "Indexed" },
  pending: { icon: Clock, color: "text-amber-600 bg-amber-50", label: "Pending" },
  error: { icon: AlertCircle, color: "text-red-600 bg-red-50", label: "Error" },
};

export default function KnowledgePage() {
  const [activeTab, setActiveTab] = useState<"documents" | "faqs">("documents");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-[var(--font-poppins)] font-bold text-[#0F172A]">
          Knowledge Base Hub
        </h1>
        <p className="text-sm text-[#64748B] mt-1">
          Manage documents, FAQs, and AI training data.
        </p>
      </motion.div>

      {/* Upload Area */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard hover={false}>
          <div className="border-2 border-dashed border-[#4F7DF3]/20 rounded-xl p-8 text-center hover:border-[#4F7DF3]/40 hover:bg-[#4F7DF3]/3 transition-all cursor-pointer">
            <Upload className="w-10 h-10 text-[#4F7DF3]/50 mx-auto mb-3" />
            <p className="text-sm font-semibold text-[#0F172A]">
              Drop files here or click to upload
            </p>
            <p className="text-xs text-[#94A3B8] mt-1">
              Supports PDF and DOCX · Max 10MB per file
            </p>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#4F7DF3]/8 text-[#4F7DF3] text-sm font-medium hover:bg-[#4F7DF3]/15 transition-colors cursor-pointer">
              <Link2 className="w-4 h-4" />
              Add URL
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#4F7DF3]/8 text-[#4F7DF3] text-sm font-medium hover:bg-[#4F7DF3]/15 transition-colors cursor-pointer">
              <Plus className="w-4 h-4" />
              Add FAQ
            </button>
            <div className="flex-1" />
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#4F7DF3] to-[#6FAEFF] text-white text-sm font-semibold hover:shadow-[0_4px_16px_rgba(79,125,243,0.35)] transition-all cursor-pointer">
              <RefreshCw className="w-4 h-4" />
              Retrain Embeddings
            </button>
          </div>
        </GlassCard>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["documents", "faqs"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-5 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer",
              activeTab === tab
                ? "bg-gradient-to-r from-[#4F7DF3] to-[#6FAEFF] text-white shadow-[0_4px_12px_rgba(79,125,243,0.3)]"
                : "bg-white text-[#64748B] hover:text-[#4F7DF3] hover:bg-[#4F7DF3]/5 border border-[#4F7DF3]/10"
            )}
          >
            {tab === "documents" ? "Documents" : "FAQs"}
          </button>
        ))}
      </div>

      {/* Search */}
      <GlassCard hover={false} className="!p-4">
        <div className="flex items-center gap-2 bg-[#F5F9FF] rounded-xl px-4 py-2.5 border border-[#4F7DF3]/8">
          <Search className="w-4 h-4 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Semantic search across knowledge base..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-sm text-[#0F172A] outline-none w-full placeholder:text-[#94A3B8]"
          />
        </div>
      </GlassCard>

      {/* Content */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        {activeTab === "documents" ? (
          <div className="space-y-3">
            {mockDocuments.map((doc) => {
              const status = statusConfig[doc.status];
              const StatusIcon = status.icon;
              return (
                <GlassCard key={doc.id} className="!p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#4F7DF3]/8 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-[#4F7DF3]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0F172A] truncate">{doc.title}</p>
                    <p className="text-xs text-[#94A3B8]">Uploaded {doc.date}</p>
                  </div>
                  <span className={cn("flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium", status.color)}>
                    <StatusIcon className="w-3 h-3" />
                    {status.label}
                  </span>
                  <button className="p-2 rounded-lg hover:bg-red-50 text-[#94A3B8] hover:text-red-500 transition-colors cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </GlassCard>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {mockFaqs.map((faq) => (
              <GlassCard key={faq.id} className="!p-4">
                <p className="text-sm font-semibold text-[#0F172A] mb-2">{faq.question}</p>
                <p className="text-sm text-[#64748B]">{faq.answer}</p>
              </GlassCard>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
