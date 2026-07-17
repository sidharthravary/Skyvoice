"use client";

import { getBackendUrl } from "@/lib/backend";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Volume2,
  User,
  MessageSquare,
  Clock,
  Sliders,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function SettingsPage() {
  const [greeting, setGreeting] = useState(
    "Hello, welcome to Skyvion AI Systems. How can I assist you today?"
  );
  const [tone, setTone] = useState("professional");
  const [formality, setFormality] = useState(7);
  const [creativity, setCreativity] = useState(5);
  const [responseLength, setResponseLength] = useState("moderate");
  const [confidenceThreshold, setConfidenceThreshold] = useState(70);
  const [interruptions, setInterruptions] = useState(true);

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const [operatingHours, setOperatingHours] = useState(
    days.map((day, i) => ({
      day,
      startTime: "09:00",
      endTime: "17:00",
      enabled: i < 5,
    }))
  );

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>("Default");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load config and voices
  useEffect(() => {
    const backendUrl = getBackendUrl();
    
    // Load config from backend
    fetch(`${backendUrl}/api/config`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          const config = data.data;
          setGreeting(config.greeting || "");
          setTone(config.personality?.tone || "professional");
          setFormality(config.personality?.formality || 7);
          setCreativity(config.personality?.creativity || 5);
          setResponseLength(config.personality?.responseLength || "moderate");
          setConfidenceThreshold(Math.round((config.confidenceThreshold || 0.7) * 100));
          setInterruptions(config.enableInterruptions ?? true);
          setSelectedVoiceName(config.voiceName || "Default");
          if (config.operatingHours && config.operatingHours.length > 0) {
            setOperatingHours(config.operatingHours);
          }
        }
      })
      .catch((err) => console.error("Failed to load AI config:", err));

    // Load browser speech synthesis voices
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const updateVoices = () => {
        const list = window.speechSynthesis.getVoices();
        if (list.length > 0) {
          setVoices(list);
        }
      };
      
      updateVoices();
      
      // Retry loading voices because speech synthesis voices load asynchronously in some browsers
      let retries = 0;
      const interval = setInterval(() => {
        const list = window.speechSynthesis.getVoices();
        if (list.length > 0) {
          setVoices(list);
          clearInterval(interval);
        } else if (retries > 12) {
          clearInterval(interval);
        }
        retries++;
      }, 250);

      window.speechSynthesis.onvoiceschanged = () => {
        updateVoices();
      };
      
      return () => {
        clearInterval(interval);
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  const playPreview = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    
    // Add small delay to allow speech synthesis engine to cancel properly before queuing new utterance
    setTimeout(() => {
      window.speechSynthesis.resume(); // Ensure speech synthesis is unpaused
      
      const text = greeting || "Hello, welcome to Skyvion AI Systems.";
      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance; // Keep active reference to prevent garbage collection
      
      const voice = voices.find((v) => v.name === selectedVoiceName);
      if (voice) {
        utterance.voice = voice;
      }
      
      utterance.rate = 1.05;
      
      utterance.onerror = (err) => {
        console.error("Speech synthesis preview error:", err);
        // Fallback to system default if the selected voice fails (e.g. cloud voice network error)
        if (voice) {
          console.warn("Retrying preview with default system voice due to error...");
          const fallbackUtterance = new SpeechSynthesisUtterance(text);
          utteranceRef.current = fallbackUtterance;
          fallbackUtterance.rate = 1.05;
          window.speechSynthesis.speak(fallbackUtterance);
        }
      };

      window.speechSynthesis.speak(utterance);
    }, 100);
  };

  const saveChanges = async () => {
    setIsSaving(true);
    setSaveStatus("idle");
    const backendUrl = getBackendUrl();
    
    try {
      const res = await fetch(`${backendUrl}/api/config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          voiceName: selectedVoiceName,
          greeting,
          personality: {
            tone,
            formality,
            creativity,
            responseLength,
          },
          confidenceThreshold: confidenceThreshold / 100,
          enableInterruptions: interruptions,
          operatingHours,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSaveStatus("success");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("error");
      }
    } catch (err) {
      console.error("Failed to save AI config:", err);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setGreeting("Hello, welcome to Skyvion AI Systems. How can I assist you today?");
    setTone("professional");
    setFormality(7);
    setCreativity(5);
    setResponseLength("moderate");
    setConfidenceThreshold(70);
    setInterruptions(true);
    setSelectedVoiceName("Default");
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-[var(--font-poppins)] font-bold text-[#0F172A]">
            AI Configuration
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            Customize voice, personality, and behavior settings.
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#4F7DF3]/10 text-[#64748B] text-sm font-medium hover:text-[#4F7DF3] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button 
            onClick={saveChanges}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#4F7DF3] to-[#6FAEFF] text-white text-sm font-semibold shadow-[0_4px_12px_rgba(79,125,243,0.3)] hover:shadow-[0_8px_24px_rgba(79,125,243,0.4)] transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </motion.div>

      {/* Save Status Notification */}
      {saveStatus === "success" && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          AI settings saved successfully and updated in main database!
        </motion.div>
      )}
      {saveStatus === "error" && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm font-medium">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          Failed to save changes. Please make sure backend is connected.
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Voice Selection */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <GlassCard hover={false}>
            <h3 className="text-sm font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-[#4F7DF3]" />
              Voice Selection
            </h3>
            <div className="space-y-4">
              <select 
                value={selectedVoiceName}
                onChange={(e) => setSelectedVoiceName(e.target.value)}
                className="w-full p-3 rounded-xl bg-[#F5F9FF] border border-[#4F7DF3]/10 text-sm text-[#0F172A] outline-none focus:border-[#4F7DF3]/30 transition-colors"
              >
                <option value="Default">System Default Voice</option>
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
              <button 
                onClick={playPreview}
                className="px-4 py-2 rounded-lg border border-[#4F7DF3]/15 text-[#4F7DF3] hover:bg-[#4F7DF3]/5 text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
              >
                ▶ Preview Selected Voice
              </button>
            </div>
          </GlassCard>
        </motion.div>

        {/* AI Personality */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <GlassCard hover={false}>
            <h3 className="text-sm font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-[#4F7DF3]" />
              AI Personality
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1.5 block">Tone</label>
                <div className="flex gap-2">
                  {["professional", "friendly", "casual", "formal"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-semibold transition-all capitalize cursor-pointer",
                        tone === t
                          ? "bg-gradient-to-r from-[#4F7DF3] to-[#6FAEFF] text-white shadow-[0_2px_8px_rgba(79,125,243,0.3)]"
                          : "bg-[#F5F9FF] text-[#64748B] hover:text-[#4F7DF3] border border-[#4F7DF3]/8"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1.5 flex justify-between">
                  Formality <span className="text-[#4F7DF3]">{formality}/10</span>
                </label>
                <input
                  type="range" min={1} max={10} value={formality}
                  onChange={(e) => setFormality(parseInt(e.target.value))}
                  className="w-full accent-[#4F7DF3]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1.5 flex justify-between">
                  Creativity <span className="text-[#4F7DF3]">{creativity}/10</span>
                </label>
                <input
                  type="range" min={1} max={10} value={creativity}
                  onChange={(e) => setCreativity(parseInt(e.target.value))}
                  className="w-full accent-[#4F7DF3]"
                />
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Greeting */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <GlassCard hover={false}>
            <h3 className="text-sm font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#4F7DF3]" />
              Greeting Message
            </h3>
            <textarea
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              rows={3}
              className="w-full p-3 rounded-xl bg-[#F5F9FF] border border-[#4F7DF3]/10 text-sm text-[#0F172A] outline-none focus:border-[#4F7DF3]/30 transition-colors resize-none"
            />
            <p className="text-xs text-[#94A3B8] mt-2">{greeting.length} characters</p>
          </GlassCard>
        </motion.div>

        {/* Behavior Tuning */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <GlassCard hover={false}>
            <h3 className="text-sm font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#4F7DF3]" />
              Behavior Settings
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1.5 block">Response Length</label>
                <div className="flex gap-2">
                  {(["brief", "moderate", "detailed"] as const).map((len) => (
                    <button
                      key={len}
                      onClick={() => setResponseLength(len)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-semibold transition-all capitalize cursor-pointer",
                        responseLength === len
                          ? "bg-gradient-to-r from-[#4F7DF3] to-[#6FAEFF] text-white"
                          : "bg-[#F5F9FF] text-[#64748B] border border-[#4F7DF3]/8"
                      )}
                    >
                      {len}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1.5 flex justify-between">
                  Confidence Threshold <span className="text-[#4F7DF3]">{confidenceThreshold}%</span>
                </label>
                <input
                  type="range" min={0} max={100} value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(parseInt(e.target.value))}
                  className="w-full accent-[#4F7DF3]"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#64748B]">Allow Interruptions</span>
                <button
                  onClick={() => setInterruptions(!interruptions)}
                  className={cn(
                    "w-11 h-6 rounded-full transition-all relative cursor-pointer",
                    interruptions ? "bg-[#4F7DF3]" : "bg-[#CBD5E1]"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-all",
                    interruptions ? "left-5.5" : "left-0.5"
                  )} />
                </button>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Operating Hours */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-2">
          <GlassCard hover={false}>
            <h3 className="text-sm font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#4F7DF3]" />
              Operating Hours
            </h3>
            <div className="space-y-2">
              {operatingHours.map((schedule, idx) => (
                <div key={schedule.day} className="flex items-center gap-4 p-2 rounded-xl hover:bg-[#F5F9FF] transition-colors">
                  <button
                    onClick={() => {
                      const updated = [...operatingHours];
                      updated[idx].enabled = !updated[idx].enabled;
                      setOperatingHours(updated);
                    }}
                    className={cn(
                      "w-9 h-5 rounded-full transition-all relative flex-shrink-0 cursor-pointer",
                      schedule.enabled ? "bg-[#4F7DF3]" : "bg-[#CBD5E1]"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded-full bg-white shadow-sm absolute top-0.5 transition-all",
                      schedule.enabled ? "left-4.5" : "left-0.5"
                    )} />
                  </button>
                  <span className={cn(
                    "w-24 text-sm font-medium",
                    schedule.enabled ? "text-[#0F172A]" : "text-[#94A3B8]"
                  )}>
                    {schedule.day}
                  </span>
                  <input
                    type="time" value={schedule.startTime}
                    onChange={(e) => {
                      const updated = [...operatingHours];
                      updated[idx].startTime = e.target.value;
                      setOperatingHours(updated);
                    }}
                    disabled={!schedule.enabled}
                    className="px-3 py-1.5 rounded-lg bg-[#F5F9FF] border border-[#4F7DF3]/8 text-xs text-[#0F172A] outline-none disabled:opacity-40"
                  />
                  <span className="text-xs text-[#94A3B8]">to</span>
                  <input
                    type="time" value={schedule.endTime}
                    onChange={(e) => {
                      const updated = [...operatingHours];
                      updated[idx].endTime = e.target.value;
                      setOperatingHours(updated);
                    }}
                    disabled={!schedule.enabled}
                    className="px-3 py-1.5 rounded-lg bg-[#F5F9FF] border border-[#4F7DF3]/8 text-xs text-[#0F172A] outline-none disabled:opacity-40"
                  />
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}
