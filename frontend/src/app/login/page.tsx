"use client";

import { getBackendUrl } from "@/lib/backend";

import { useState, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Bot, Eye, EyeOff, Loader2 } from "lucide-react";
import { setAuth } from "@/lib/auth";

const BACKEND = getBackendUrl();

type Tab = "signin" | "signup";

interface FieldError {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("signin");

  // Sign-in state
  const [siUsername, setSiUsername] = useState("");
  const [siPassword, setSiPassword] = useState("");
  const [siShowPass, setSiShowPass] = useState(false);
  const [siLoading, setSiLoading] = useState(false);
  const [siError, setSiError] = useState("");

  // Sign-up state
  const [suFullName, setSuFullName] = useState("");
  const [suUsername, setSuUsername] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suConfirm, setSuConfirm] = useState("");
  const [suShowPass, setSuShowPass] = useState(false);
  const [suLoading, setSuLoading] = useState(false);
  const [suError, setSuError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldError>({});

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setSiError("");
    setSiLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: siUsername.trim(), password: siPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSiError(data.message || "Login failed. Please try again.");
        return;
      }
      setAuth(data.token, data.role, data.username, data.fullName);
      router.push(data.role === "admin" ? "/dashboard" : "/voice");
    } catch {
      setSiError("Could not reach the server. Please check your connection.");
    } finally {
      setSiLoading(false);
    }
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setSuError("");
    setFieldErrors({});

    const errors: FieldError = {};
    if (suPassword !== suConfirm) errors.confirmPassword = "Passwords do not match";
    if (suPassword.length < 8) errors.password = "Password must be at least 8 characters";
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    setSuLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: suFullName.trim(),
          username: suUsername.trim(),
          email: suEmail.trim(),
          password: suPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        const msg: string = data.message || "Registration failed.";
        if (msg.toLowerCase().includes("username")) setFieldErrors({ username: msg });
        else if (msg.toLowerCase().includes("email")) setFieldErrors({ email: msg });
        else setSuError(msg);
        return;
      }
      setAuth(data.token, data.role, data.username, data.fullName);
      router.push("/voice");
    } catch {
      setSuError("Could not reach the server. Please check your connection.");
    } finally {
      setSuLoading(false);
    }
  }

  const inputStyle = {
    background: "#1E293B",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "none",
    touchAction: "manipulation" as const,
    WebkitTapHighlightColor: "transparent",
  };
  const inputFocusOn  = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.border = "1px solid #4F7DF3";
    e.target.style.boxShadow = "0 0 0 3px rgba(79,125,243,0.15)";
  };
  const inputFocusOff = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.border = "1px solid rgba(255,255,255,0.08)";
    e.target.style.boxShadow = "none";
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center relative overflow-hidden">
      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#4F7DF3 1px, transparent 1px), linear-gradient(90deg, #4F7DF3 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(79,125,243,0.12),transparent_60%)] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(111,174,255,0.08),transparent_60%)] pointer-events-none" />

      <div className="animate-fade-in-up relative z-10 w-full max-w-[440px] mx-4" style={{ touchAction: "manipulation" }}>
        <div
          className="rounded-3xl p-10"
          style={{
            background: "rgba(255,255,255,0.06)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.10)",
            pointerEvents: "auto",
          }}
        >
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <motion.div
              animate={{
                boxShadow: [
                  "0 0 20px rgba(79,125,243,0.4)",
                  "0 0 40px rgba(79,125,243,0.6)",
                  "0 0 20px rgba(79,125,243,0.4)",
                ],
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-[#4F7DF3] to-[#6FAEFF] flex items-center justify-center"
            >
              <Bot className="w-8 h-8 text-white" />
            </motion.div>
          </div>

          {/* Heading */}
          <div className="text-center mb-6">
            <h1 className="font-[var(--font-poppins)] font-bold text-[28px] text-[#4F7DF3]">
              SkyVoice
            </h1>
            <p className="text-[#94A3B8] text-sm mt-1 font-[var(--font-inter)]">
              Intelligent Voice Operations Platform
            </p>
          </div>

          {/* Tab switcher */}
          <div
            className="flex mb-7 relative"
            style={{
              background: "rgba(255,255,255,0.04)",
              borderRadius: "12px",
              padding: "4px",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {(["signin", "signup"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="relative flex-1 py-2 text-sm font-semibold font-[var(--font-poppins)] transition-colors z-10 rounded-[9px]"
                style={{ color: tab === t ? "white" : "#64748B" }}
              >
                {tab === t && (
                  <motion.div
                    layoutId="tab-bg"
                    className="absolute inset-0 rounded-[9px]"
                    style={{ background: "linear-gradient(135deg, #4F7DF3, #6FAEFF)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">
                  {t === "signin" ? "Sign In" : "Create Account"}
                </span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {tab === "signin" ? (
              <motion.form
                key="signin"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSignIn}
                className="space-y-4"
              >
                <input
                  type="text"
                  placeholder="Username"
                  value={siUsername}
                  onChange={(e) => setSiUsername(e.target.value)}
                  required
                  autoComplete="username"
                  className="w-full rounded-xl px-4 py-3.5 text-sm text-white placeholder-[#64748B] outline-none transition-all duration-200"
                  style={inputStyle}
                  onFocus={inputFocusOn}
                  onBlur={inputFocusOff}
                />

                <div className="relative">
                  <input
                    type={siShowPass ? "text" : "password"}
                    placeholder="Password"
                    value={siPassword}
                    onChange={(e) => setSiPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full rounded-xl px-4 py-3.5 pr-12 text-sm text-white placeholder-[#64748B] outline-none transition-all duration-200"
                    style={inputStyle}
                    onFocus={inputFocusOn}
                    onBlur={inputFocusOff}
                  />
                  <button
                    type="button"
                    onClick={() => setSiShowPass(!siShowPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#94A3B8] transition-colors"
                  >
                    {siShowPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {siError && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl px-4 py-2.5 text-sm text-red-300"
                    style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}
                  >
                    {siError}
                  </motion.div>
                )}

                <SubmitButton loading={siLoading} label="Sign In" />

                <p className="text-center text-sm text-[#64748B] pt-1">
                  New here?{" "}
                  <button
                    type="button"
                    onClick={() => setTab("signup")}
                    className="text-[#4F7DF3] hover:text-[#6FAEFF] font-medium transition-colors"
                  >
                    Create Account
                  </button>
                </p>
              </motion.form>
            ) : (
              <motion.form
                key="signup"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSignUp}
                className="space-y-3"
              >
                <input
                  type="text"
                  placeholder="Full Name"
                  value={suFullName}
                  onChange={(e) => setSuFullName(e.target.value)}
                  autoComplete="name"
                  className="w-full rounded-xl px-4 py-3.5 text-sm text-white placeholder-[#64748B] outline-none transition-all duration-200"
                  style={inputStyle}
                  onFocus={inputFocusOn}
                  onBlur={inputFocusOff}
                />

                <div>
                  <input
                    type="text"
                    placeholder="Username"
                    value={suUsername}
                    onChange={(e) => { setSuUsername(e.target.value); setFieldErrors(p => ({ ...p, username: undefined })); }}
                    required
                    autoComplete="username"
                    className="w-full rounded-xl px-4 py-3.5 text-sm text-white placeholder-[#64748B] outline-none transition-all duration-200"
                    style={{
                      ...inputStyle,
                      border: fieldErrors.username ? "1px solid rgba(239,68,68,0.6)" : inputStyle.border,
                    }}
                    onFocus={inputFocusOn}
                    onBlur={inputFocusOff}
                  />
                  {fieldErrors.username && (
                    <p className="text-red-400 text-xs mt-1 pl-1">{fieldErrors.username}</p>
                  )}
                </div>

                <div>
                  <input
                    type="email"
                    placeholder="Email"
                    value={suEmail}
                    onChange={(e) => { setSuEmail(e.target.value); setFieldErrors(p => ({ ...p, email: undefined })); }}
                    required
                    autoComplete="email"
                    className="w-full rounded-xl px-4 py-3.5 text-sm text-white placeholder-[#64748B] outline-none transition-all duration-200"
                    style={{
                      ...inputStyle,
                      border: fieldErrors.email ? "1px solid rgba(239,68,68,0.6)" : inputStyle.border,
                    }}
                    onFocus={inputFocusOn}
                    onBlur={inputFocusOff}
                  />
                  {fieldErrors.email && (
                    <p className="text-red-400 text-xs mt-1 pl-1">{fieldErrors.email}</p>
                  )}
                </div>

                <div>
                  <div className="relative">
                    <input
                      type={suShowPass ? "text" : "password"}
                      placeholder="Password (min 8 chars)"
                      value={suPassword}
                      onChange={(e) => { setSuPassword(e.target.value); setFieldErrors(p => ({ ...p, password: undefined })); }}
                      required
                      autoComplete="new-password"
                      className="w-full rounded-xl px-4 py-3.5 pr-12 text-sm text-white placeholder-[#64748B] outline-none transition-all duration-200"
                      style={{
                        ...inputStyle,
                        border: fieldErrors.password ? "1px solid rgba(239,68,68,0.6)" : inputStyle.border,
                      }}
                      onFocus={inputFocusOn}
                      onBlur={inputFocusOff}
                    />
                    <button
                      type="button"
                      onClick={() => setSuShowPass(!suShowPass)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#94A3B8] transition-colors"
                    >
                      {suShowPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="text-red-400 text-xs mt-1 pl-1">{fieldErrors.password}</p>
                  )}
                </div>

                <div>
                  <input
                    type={suShowPass ? "text" : "password"}
                    placeholder="Confirm Password"
                    value={suConfirm}
                    onChange={(e) => { setSuConfirm(e.target.value); setFieldErrors(p => ({ ...p, confirmPassword: undefined })); }}
                    required
                    autoComplete="new-password"
                    className="w-full rounded-xl px-4 py-3.5 text-sm text-white placeholder-[#64748B] outline-none transition-all duration-200"
                    style={{
                      ...inputStyle,
                      border: fieldErrors.confirmPassword ? "1px solid rgba(239,68,68,0.6)" : inputStyle.border,
                    }}
                    onFocus={inputFocusOn}
                    onBlur={inputFocusOff}
                  />
                  {fieldErrors.confirmPassword && (
                    <p className="text-red-400 text-xs mt-1 pl-1">{fieldErrors.confirmPassword}</p>
                  )}
                </div>

                {suError && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl px-4 py-2.5 text-sm text-red-300"
                    style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}
                  >
                    {suError}
                  </motion.div>
                )}

                <SubmitButton loading={suLoading} label="Create Account" />

                <p className="text-center text-sm text-[#64748B] pt-1">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setTab("signin")}
                    className="text-[#4F7DF3] hover:text-[#6FAEFF] font-medium transition-colors"
                  >
                    Sign In
                  </button>
                </p>
              </motion.form>
            )}
          </AnimatePresence>

          <p className="text-center text-[#475569] text-xs mt-6">
            Powered by <span className="text-[#64748B]">Skyvion Technologies</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <motion.button
      type="submit"
      disabled={loading}
      whileHover={!loading ? { scale: 1.015, y: -1 } : {}}
      whileTap={!loading ? { scale: 0.98 } : {}}
      className="w-full rounded-xl py-3.5 text-white text-sm font-semibold font-[var(--font-poppins)] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
      style={{
        background: "linear-gradient(135deg, #4F7DF3, #6FAEFF)",
        boxShadow: loading ? "none" : "0 4px 20px rgba(79,125,243,0.35)",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      }}
      onMouseEnter={(e) => {
        if (!loading) e.currentTarget.style.boxShadow = "0 8px 30px rgba(79,125,243,0.5)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 20px rgba(79,125,243,0.35)";
      }}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Please wait…
        </>
      ) : (
        label
      )}
    </motion.button>
  );
}
