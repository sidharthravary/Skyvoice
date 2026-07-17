"use client";

import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { useCallback, useEffect, useRef, useState } from "react";
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
  Loader2,
  X,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getBackendUrl } from "@/lib/backend";

interface KnowledgeEntry {
  _id: string;
  title: string;
  content: string;
  sourceType: "pdf" | "docx" | "url" | "faq" | "manual" | "seed";
  fileName?: string;
  indexStatus: "pending" | "indexed" | "error";
  createdAt: string;
}

interface SearchResult {
  title: string;
  content: string;
  score: number;
}

const statusConfig = {
  indexed: { icon: CheckCircle, color: "text-emerald-600 bg-emerald-50", label: "Indexed" },
  pending: { icon: Clock, color: "text-amber-600 bg-amber-50", label: "Pending" },
  error: { icon: AlertCircle, color: "text-red-600 bg-red-50", label: "Error" },
};

export default function KnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"documents" | "faqs">("documents");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [actionError, setActionError] = useState("");
  const [retraining, setRetraining] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [showFaqForm, setShowFaqForm] = useState(false);
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [faqSubmitting, setFaqSubmitting] = useState(false);

  const [showUrlForm, setShowUrlForm] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [urlSubmitting, setUrlSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const BACKEND = getBackendUrl();

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/api/knowledge?limit=100`, { credentials: "include" });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setEntries(data.data);
      }
    } catch (err) {
      console.error("[Knowledge] Failed to fetch entries:", err);
    } finally {
      setLoading(false);
    }
  }, [BACKEND]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Keep refreshing while anything is still being indexed
  useEffect(() => {
    if (!entries.some((e) => e.indexStatus === "pending")) return;
    const timer = setTimeout(fetchEntries, 3000);
    return () => clearTimeout(timer);
  }, [entries, fetchEntries]);

  // ── Upload ────────────────────────────────────────────────────────────────

  async function uploadFile(file: File) {
    setActionError("");
    const okTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!okTypes.includes(file.type)) {
      setActionError("Only PDF and DOCX files are supported.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setActionError("File is larger than the 10MB limit.");
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${BACKEND}/api/knowledge/upload`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data?.error?.message || data?.message || "Upload failed.");
        return;
      }
      setActiveTab("documents");
      await fetchEntries();
    } catch {
      setActionError("Upload failed — could not reach the server.");
    } finally {
      setUploading(false);
    }
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = ""; // allow re-selecting the same file
  }

  // ── FAQ ───────────────────────────────────────────────────────────────────

  async function submitFaq(e: React.FormEvent) {
    e.preventDefault();
    if (!faqQuestion.trim() || !faqAnswer.trim()) return;
    setFaqSubmitting(true);
    setActionError("");
    try {
      const res = await fetch(`${BACKEND}/api/knowledge/faq`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: faqQuestion.trim(), content: faqAnswer.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data?.error?.message || data?.message || "Could not save FAQ.");
        return;
      }
      setFaqQuestion("");
      setFaqAnswer("");
      setShowFaqForm(false);
      setActiveTab("faqs");
      await fetchEntries();
    } catch {
      setActionError("Could not save FAQ — server unreachable.");
    } finally {
      setFaqSubmitting(false);
    }
  }

  // ── URL ingestion ─────────────────────────────────────────────────────────

  async function submitUrl(e: React.FormEvent) {
    e.preventDefault();
    const url = urlValue.trim();
    if (!url) return;
    setUrlSubmitting(true);
    setActionError("");
    try {
      const res = await fetch(`${BACKEND}/api/knowledge/url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data?.error || data?.message || "Could not add URL.");
        return;
      }
      setUrlValue("");
      setShowUrlForm(false);
      setActiveTab("documents");
      await fetchEntries();
    } catch {
      setActionError("Could not add URL — server unreachable.");
    } finally {
      setUrlSubmitting(false);
    }
  }

  // ── Search / retrain / delete ─────────────────────────────────────────────

  async function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`${BACKEND}/api/knowledge/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      setSearchResults(data.success && Array.isArray(data.data) ? data.data : []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function retrain() {
    setRetraining(true);
    setActionError("");
    try {
      await fetch(`${BACKEND}/api/knowledge/retrain`, {
        method: "POST",
        credentials: "include",
      });
      // Re-embedding runs in the background — refresh shortly after
      setTimeout(fetchEntries, 2500);
    } catch {
      setActionError("Retrain request failed.");
    } finally {
      setTimeout(() => setRetraining(false), 2500);
    }
  }

  async function deleteEntry(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`${BACKEND}/api/knowledge/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) setEntries((prev) => prev.filter((e) => e._id !== id));
    } catch {
      setActionError("Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  // ── Derived lists ─────────────────────────────────────────────────────────

  const documents = entries.filter((e) => e.sourceType !== "faq");
  const faqs = entries.filter((e) => e.sourceType === "faq");
  const pendingCount = entries.filter((e) => e.indexStatus === "pending").length;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-[var(--font-poppins)] font-bold text-[#0F172A]">
          Knowledge Base Hub
        </h1>
        <p className="text-sm text-[#64748B] mt-1">
          Documents, FAQs, and training data the AI answers from.
        </p>
      </motion.div>

      {/* Upload Area */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard hover={false}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={onFileChosen}
          />
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file && !uploading) uploadFile(file);
            }}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer",
              dragOver
                ? "border-[#4F7DF3] bg-[#4F7DF3]/8"
                : "border-[#4F7DF3]/20 hover:border-[#4F7DF3]/40 hover:bg-[#4F7DF3]/3"
            )}
          >
            {uploading ? (
              <>
                <Loader2 className="w-10 h-10 text-[#4F7DF3] mx-auto mb-3 animate-spin" />
                <p className="text-sm font-semibold text-[#0F172A]">Uploading & indexing…</p>
                <p className="text-xs text-[#94A3B8] mt-1">Parsing text and generating embeddings</p>
              </>
            ) : (
              <>
                <Upload className="w-10 h-10 text-[#4F7DF3]/50 mx-auto mb-3" />
                <p className="text-sm font-semibold text-[#0F172A]">
                  Drop files here or click to upload
                </p>
                <p className="text-xs text-[#94A3B8] mt-1">
                  Supports PDF and DOCX · Max 10MB per file
                </p>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <button
              onClick={() => { setShowFaqForm((v) => !v); setShowUrlForm(false); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#4F7DF3]/8 text-[#4F7DF3] text-sm font-medium hover:bg-[#4F7DF3]/15 transition-colors cursor-pointer"
            >
              {showFaqForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showFaqForm ? "Close FAQ form" : "Add FAQ"}
            </button>
            <button
              onClick={() => { setShowUrlForm((v) => !v); setShowFaqForm(false); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#4F7DF3]/8 text-[#4F7DF3] text-sm font-medium hover:bg-[#4F7DF3]/15 transition-colors cursor-pointer"
            >
              {showUrlForm ? <X className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
              {showUrlForm ? "Close URL form" : "Add URL"}
            </button>
            <div className="flex-1" />
            {pendingCount > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {pendingCount} indexing…
              </span>
            )}
            <button
              onClick={retrain}
              disabled={retraining}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#4F7DF3] to-[#6FAEFF] text-white text-sm font-semibold hover:shadow-[0_4px_16px_rgba(79,125,243,0.35)] transition-all cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={cn("w-4 h-4", retraining && "animate-spin")} />
              {retraining ? "Re-embedding…" : "Retrain Embeddings"}
            </button>
          </div>

          {/* Inline URL form */}
          <AnimatePresence>
            {showUrlForm && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={submitUrl}
                className="overflow-hidden"
              >
                <div className="mt-4 p-4 rounded-xl bg-[#F5F9FF] border border-[#4F7DF3]/10 flex gap-3">
                  <input
                    type="url"
                    placeholder="https://example.com/page-to-learn-from"
                    value={urlValue}
                    onChange={(e) => setUrlValue(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-white border border-[#4F7DF3]/15 text-sm text-[#0F172A] outline-none focus:border-[#4F7DF3]"
                  />
                  <button
                    type="submit"
                    disabled={urlSubmitting || !urlValue.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#4F7DF3] to-[#6FAEFF] text-white text-sm font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    {urlSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                    Ingest Page
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Inline FAQ form */}
          <AnimatePresence>
            {showFaqForm && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={submitFaq}
                className="overflow-hidden"
              >
                <div className="mt-4 p-4 rounded-xl bg-[#F5F9FF] border border-[#4F7DF3]/10 space-y-3">
                  <input
                    type="text"
                    placeholder="Question — e.g. What are your business hours?"
                    value={faqQuestion}
                    onChange={(e) => setFaqQuestion(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-[#4F7DF3]/15 text-sm text-[#0F172A] outline-none focus:border-[#4F7DF3]"
                  />
                  <textarea
                    placeholder="Answer the AI should give…"
                    value={faqAnswer}
                    onChange={(e) => setFaqAnswer(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-[#4F7DF3]/15 text-sm text-[#0F172A] outline-none focus:border-[#4F7DF3] resize-y"
                  />
                  <button
                    type="submit"
                    disabled={faqSubmitting || !faqQuestion.trim() || !faqAnswer.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#4F7DF3] to-[#6FAEFF] text-white text-sm font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    {faqSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Save FAQ
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {actionError && (
            <p className="mt-3 text-sm text-red-500 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {actionError}
            </p>
          )}
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
            {tab === "documents" ? `Documents (${documents.length})` : `FAQs (${faqs.length})`}
          </button>
        ))}
      </div>

      {/* Semantic search */}
      <GlassCard hover={false} className="!p-4">
        <form onSubmit={runSearch} className="flex items-center gap-2 bg-[#F5F9FF] rounded-xl px-4 py-2.5 border border-[#4F7DF3]/8">
          {searching
            ? <Loader2 className="w-4 h-4 text-[#4F7DF3] animate-spin" />
            : <Search className="w-4 h-4 text-[#94A3B8]" />}
          <input
            type="text"
            placeholder="Semantic search across knowledge base… (press Enter)"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!e.target.value.trim()) setSearchResults(null);
            }}
            className="bg-transparent text-sm text-[#0F172A] outline-none w-full placeholder:text-[#94A3B8]"
          />
          {searchResults !== null && (
            <button
              type="button"
              onClick={() => { setSearchQuery(""); setSearchResults(null); }}
              className="text-[#94A3B8] hover:text-[#4F7DF3] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>
      </GlassCard>

      {/* Content */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        {searchResults !== null ? (
          /* ── Search results ── */
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#4F7DF3]" />
              {searchResults.length} result{searchResults.length === 1 ? "" : "s"} for “{searchQuery.trim()}”
            </p>
            {searchResults.length === 0 && (
              <GlassCard className="!p-6 text-center text-sm text-[#64748B]">
                Nothing relevant found in the knowledge base.
              </GlassCard>
            )}
            {searchResults.map((r, i) => (
              <GlassCard key={i} className="!p-4">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <p className="text-sm font-semibold text-[#0F172A]">{r.title}</p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#4F7DF3]/10 text-[#4F7DF3]">
                    {(r.score * 100).toFixed(0)}% match
                  </span>
                </div>
                <p className="text-sm text-[#64748B] line-clamp-3">{r.content}</p>
              </GlassCard>
            ))}
          </div>
        ) : loading ? (
          <GlassCard className="!p-8 text-center">
            <Loader2 className="w-6 h-6 text-[#4F7DF3] animate-spin mx-auto" />
          </GlassCard>
        ) : activeTab === "documents" ? (
          /* ── Documents ── */
          <div className="space-y-3">
            {documents.length === 0 && (
              <GlassCard className="!p-6 text-center text-sm text-[#64748B]">
                No documents yet — upload a PDF or DOCX above to teach the AI.
              </GlassCard>
            )}
            {documents.map((doc) => {
              const status = statusConfig[doc.indexStatus];
              const StatusIcon = status.icon;
              return (
                <GlassCard key={doc._id} className="!p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#4F7DF3]/8 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-[#4F7DF3]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0F172A] truncate">{doc.title}</p>
                    <p className="text-xs text-[#94A3B8]">
                      {doc.sourceType.toUpperCase()} · added {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={cn("flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium", status.color)}>
                    <StatusIcon className={cn("w-3 h-3", doc.indexStatus === "pending" && "animate-pulse")} />
                    {status.label}
                  </span>
                  <button
                    onClick={() => deleteEntry(doc._id)}
                    disabled={deletingId === doc._id}
                    className="p-2 rounded-lg hover:bg-red-50 text-[#94A3B8] hover:text-red-500 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {deletingId === doc._id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />}
                  </button>
                </GlassCard>
              );
            })}
          </div>
        ) : (
          /* ── FAQs ── */
          <div className="space-y-3">
            {faqs.length === 0 && (
              <GlassCard className="!p-6 text-center text-sm text-[#64748B]">
                No FAQs yet — use “Add FAQ” above to give the AI canned answers.
              </GlassCard>
            )}
            {faqs.map((faq) => (
              <GlassCard key={faq._id} className="!p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#4F7DF3]/8 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <HelpCircle className="w-4 h-4 text-[#4F7DF3]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0F172A] mb-1">{faq.title}</p>
                    <p className="text-sm text-[#64748B]">{faq.content}</p>
                  </div>
                  <button
                    onClick={() => deleteEntry(faq._id)}
                    disabled={deletingId === faq._id}
                    className="p-2 rounded-lg hover:bg-red-50 text-[#94A3B8] hover:text-red-500 transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0"
                  >
                    {deletingId === faq._id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
