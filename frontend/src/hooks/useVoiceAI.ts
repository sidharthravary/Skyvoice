"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { OrbState } from "@/components/ui/AIOrb";
import { getUsername, getFullName } from "@/lib/auth";
import { getBackendUrl } from "@/lib/backend";

// ── Feature flag: set to false to force the existing Socket.io/browser-speech path ──
// Disabled — the original (video-verified) flow uses browser speech + Socket.io.
const WEBRTC_ENABLED = false;

export function useVoiceAI() {
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [isBrowserAssist, setIsBrowserAssist] = useState<boolean>(true);
  const [transcript, setTranscript] = useState<string>("");
  const [aiText, setAiText] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const socketRef = useRef<Socket | null>(null);
  const recognitionRef = useRef<any>(null);

  const isBrowserAssistRef = useRef<boolean>(isBrowserAssist);
  const voiceNameRef = useRef<string>("Default");
  const orbStateRef = useRef<OrbState>(orbState);
  const activeSessionRef = useRef<boolean>(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // WebRTC refs
  const webrtcActiveRef = useRef<boolean>(false);
  const sendTransportRef = useRef<any>(null);

  // Keep refs updated
  useEffect(() => {
    isBrowserAssistRef.current = isBrowserAssist;
  }, [isBrowserAssist]);

  useEffect(() => {
    orbStateRef.current = orbState;
  }, [orbState]);

  // Load config from backend on mount
  useEffect(() => {
    const backendUrl = getBackendUrl();
    fetch(`${backendUrl}/api/config`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          voiceNameRef.current = data.data.voiceName || "Default";
          setAiText(data.data.greeting || "Hello, welcome to Skyvion AI Systems.");
        }
      })
      .catch((err) => console.error("[useVoiceAI] Failed to fetch config on mount:", err));
  }, []);

  // Initialize Socket.io connection
  useEffect(() => {
    const socketUrl = getBackendUrl();
    const socket = io(`${socketUrl}/voice`, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      // The JWT rides along as an HttpOnly cookie on the handshake;
      // only display names are passed explicitly.
      withCredentials: true,
      auth: {
        username: getUsername() || 'Guest',
        fullName: getFullName() || 'Guest',
      },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[useVoiceAI] Socket connected");
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("[useVoiceAI] Socket disconnected");
      setIsConnected(false);
    });

    socket.on("ready", (data: { useBrowserAssist: boolean; greeting: string; voiceName?: string }) => {
      console.log("[useVoiceAI] Voice server ready. Assist:", data.useBrowserAssist);
      setIsBrowserAssist(data.useBrowserAssist);
      voiceNameRef.current = data.voiceName || "Default";
      setAiText(data.greeting);
    });

    socket.on("transcript", (data: { sender: string; text: string }) => {
      if (data.sender === "user") {
        setTranscript(data.text);
        // When the WebRTC STT bridge sends us a transcript, update orb state
        if (webrtcActiveRef.current) setOrbState("thinking");
      }
    });

    socket.on("ai-response-text", (text: string) => {
      console.log("[useVoiceAI] AI text response:", text);
      setAiText(text);

      // Speak via browser TTS (fallback always active; covers the WebRTC path too since
      // ElevenLabs TTS-over-WebRTC is not yet wired — browser TTS is the output path)
      if (isBrowserAssistRef.current || !window.speechSynthesis) {
        speakBrowser(text);
      }
    });

    socket.on("status", (status: OrbState) => {
      setOrbState(status);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // ── Browser Speech Synthesis (fallback TTS, always available) ─────────────────

  function speakBrowser(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    setTimeout(() => {
      window.speechSynthesis.resume();

      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;

      const browserVoices = window.speechSynthesis.getVoices();
      const matchedVoice = browserVoices.find((v) => v.name === voiceNameRef.current);
      if (matchedVoice) utterance.voice = matchedVoice;

      utterance.onstart = () => { setOrbState("speaking"); };

      utterance.onend = () => {
        if (activeSessionRef.current) {
          if (webrtcActiveRef.current) {
            // WebRTC mic is always on — just flip orb to listening
            setOrbState("listening");
          } else {
            startListeningBrowser();
          }
        } else {
          setOrbState("idle");
        }
      };

      utterance.onerror = (e) => {
        console.error("[useVoiceAI] Speech Synthesis error:", e);
        if (matchedVoice) {
          const fallbackUtterance = new SpeechSynthesisUtterance(text);
          utteranceRef.current = fallbackUtterance;
          fallbackUtterance.rate = 1.05;
          fallbackUtterance.onstart = () => { setOrbState("speaking"); };
          fallbackUtterance.onend = () => {
            if (activeSessionRef.current) {
              if (webrtcActiveRef.current) {
                setOrbState("listening");
              } else {
                startListeningBrowser();
              }
            } else {
              setOrbState("idle");
            }
          };
          fallbackUtterance.onerror = () => { setOrbState("idle"); };
          window.speechSynthesis.speak(fallbackUtterance);
        } else {
          if (activeSessionRef.current) {
            if (webrtcActiveRef.current) {
              setOrbState("listening");
            } else {
              startListeningBrowser();
            }
          } else {
            setOrbState("idle");
          }
        }
      };

      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }, 100);
  }

  // ── Browser Speech Recognition (existing Socket.io fallback path) ──────────────

  function startListeningBrowser() {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech Recognition API is not supported in this browser. Please use Chrome/Edge.");
      return;
    }

    if (window.speechSynthesis) window.speechSynthesis.cancel();

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setOrbState("listening");
      setTranscript("");
    };

    recognition.onresult = (event: any) => {
      const resultText = event.results[0][0].transcript;
      console.log("[useVoiceAI] Browser recognition result:", resultText);
      setTranscript(resultText);
      if (socketRef.current) socketRef.current.emit("text-input", resultText);
      setOrbState("thinking");
    };

    recognition.onerror = (err: any) => {
      console.error("[useVoiceAI] Speech Recognition error:", err);
      setOrbState("idle");
    };

    recognition.onend = () => {
      if (orbStateRef.current === "listening") setOrbState("idle");
    };

    recognition.start();
  }

  function stopListeningBrowser() {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {
        console.warn("[useVoiceAI] Error stopping recognition:", e);
      }
    }
  }

  // ── WebRTC initialisation ──────────────────────────────────────────────────────

  async function initWebRTC(socket: Socket): Promise<void> {
    // Dynamically import to keep mediasoup-client browser-only
    const { Device } = await import("mediasoup-client");

    const device = new Device();

    const capabilities = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("webrtc_get_capabilities timeout")), 5000);
      socket.emit("webrtc_get_capabilities", (caps: any) => {
        clearTimeout(timeout);
        if (caps && !caps.error) resolve(caps);
        else reject(new Error(caps?.error || "No capabilities"));
      });
    });

    await device.load({ routerRtpCapabilities: capabilities });

    const transportParams = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("webrtc_create_transport timeout")), 5000);
      socket.emit("webrtc_create_transport", (params: any) => {
        clearTimeout(timeout);
        if (params && !params.error) resolve(params);
        else reject(new Error(params?.error || "Transport creation failed"));
      });
    });

    const sendTransport = device.createSendTransport(transportParams);
    sendTransportRef.current = sendTransport;

    sendTransport.on("connect", ({ dtlsParameters }: any, callback: () => void, errback: (err: Error) => void) => {
      socket.emit("webrtc_connect_transport", { dtlsParameters }, (result: any) => {
        if (result?.error) errback(new Error(result.error));
        else callback();
      });
    });

    sendTransport.on("produce", ({ kind, rtpParameters }: any, callback: (p: { id: string }) => void, errback: (err: Error) => void) => {
      socket.emit("webrtc_produce", { kind, rtpParameters }, (result: any) => {
        if (result?.error) errback(new Error(result.error));
        else callback({ id: result.producerId });
      });
    });

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    await sendTransport.produce({ track: stream.getAudioTracks()[0] });

    webrtcActiveRef.current = true;
    console.log("✅ WebRTC active — RTCP stats enabled");
  }

  // ── Session toggle ─────────────────────────────────────────────────────────────

  const toggleVoiceSession = () => {
    if (orbState === "idle") {
      if (!activeSessionRef.current) {
        activeSessionRef.current = true;
        speakBrowser(aiText || "Hello, welcome to Skyvion AI Systems. How can I assist you today?");

        // Attempt WebRTC in parallel — if it fails, browser speech recognition takes over
        if (WEBRTC_ENABLED && socketRef.current) {
          initWebRTC(socketRef.current).catch((err) => {
            console.warn("⚠️ WebRTC failed, falling back to Socket.io audio:", err);
          });
        }
      } else {
        if (webrtcActiveRef.current) {
          setOrbState("listening"); // mic already on via WebRTC
        } else {
          startListeningBrowser();
        }
      }
    } else {
      // Stop session completely
      activeSessionRef.current = false;
      webrtcActiveRef.current = false;

      if (sendTransportRef.current) {
        try { sendTransportRef.current.close(); } catch { /* ignore */ }
        sendTransportRef.current = null;
      }

      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      stopListeningBrowser();
      setOrbState("idle");
    }
  };

  return {
    orbState,
    transcript,
    aiText,
    isConnected,
    isBrowserAssist,
    toggleVoiceSession,
    speak: speakBrowser,
  };
}
