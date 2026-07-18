"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { getUsername, getFullName } from "@/lib/auth";
import { getBackendUrl } from "@/lib/backend";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export interface ChatThread {
  _id: string;
  title: string;
  createdAt: string;
  messageCount: number;
}

let nextId = 0;
const msgId = () => `msg-${Date.now()}-${nextId++}`;

// Text chat over the same Socket.io voice pipeline the orb uses — identical
// brain (knowledge base RAG, appointments, booking flow, Gemini), no audio.
// The server seeds each session with recent history, so the AI remembers
// past conversations; threads give a ChatGPT-style sidebar of old chats.
export function useChatAI() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [viewedThread, setViewedThread] = useState<{ id: string; messages: ChatMessage[] } | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const greetedRef = useRef(false);
  const streamingIdRef = useRef<string | null>(null);

  const refreshThreads = useCallback(() => {
    fetch(`${getBackendUrl()}/api/conversations/mine`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.success && Array.isArray(d.data)) setThreads(d.data);
      })
      .catch(() => {}); // guests simply have no threads
  }, []);

  useEffect(() => {
    refreshThreads();
  }, [refreshThreads]);

  useEffect(() => {
    const socket = io(`${getBackendUrl()}/voice`, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      withCredentials: true, // JWT rides along as an HttpOnly cookie
      auth: {
        username: getUsername() || "Guest",
        fullName: getFullName() || "Guest",
      },
    });
    socketRef.current = socket;

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    socket.on("ready", (data: { greeting: string }) => {
      if (!greetedRef.current && data?.greeting) {
        greetedRef.current = true;
        setMessages((prev) => [...prev, { id: msgId(), role: "assistant", text: data.greeting }]);
      }
    });

    // Streaming: tokens arrive as chunks and grow one assistant bubble live
    socket.on("ai-response-chunk", (chunk: string) => {
      setTyping(false);
      setMessages((prev) => {
        if (streamingIdRef.current) {
          return prev.map((m) =>
            m.id === streamingIdRef.current ? { ...m, text: m.text + chunk } : m
          );
        }
        const id = msgId();
        streamingIdRef.current = id;
        return [...prev, { id, role: "assistant", text: chunk }];
      });
    });

    socket.on("ai-response-text", (text: string) => {
      setTyping(false);
      setMessages((prev) => {
        if (streamingIdRef.current) {
          // Finalize the streamed bubble with the authoritative full text
          const id = streamingIdRef.current;
          streamingIdRef.current = null;
          return prev.map((m) => (m.id === id ? { ...m, text } : m));
        }
        return [...prev, { id: msgId(), role: "assistant", text }];
      });
    });

    socket.on("status", (status: string) => {
      setTyping(status === "thinking");
    });

    socket.on("session-reset", (data: { greeting: string }) => {
      streamingIdRef.current = null;
      setTyping(false);
      setMessages([{ id: msgId(), role: "assistant", text: data.greeting }]);
      refreshThreads(); // the previous thread was just saved
    });

    return () => {
      socket.disconnect();
    };
  }, [refreshThreads]);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !socketRef.current) return;
    setViewedThread(null); // typing always continues the live chat
    setMessages((prev) => [...prev, { id: msgId(), role: "user", text: trimmed }]);
    setTyping(true);
    socketRef.current.emit("text-input", trimmed);
  }, []);

  const newChat = useCallback(() => {
    setViewedThread(null);
    socketRef.current?.emit("reset-session");
  }, []);

  const viewThread = useCallback((id: string) => {
    fetch(`${getBackendUrl()}/api/conversations/mine/${id}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.success && Array.isArray(d.data)) {
          setViewedThread({
            id,
            messages: d.data.map((m: { role: string; content: string }) => ({
              id: msgId(),
              role: m.role === "user" ? "user" : "assistant",
              text: m.content,
            })),
          });
        }
      })
      .catch(() => {});
  }, []);

  const backToLive = useCallback(() => setViewedThread(null), []);

  return {
    messages,
    typing,
    isConnected,
    sendMessage,
    threads,
    viewedThread,
    viewThread,
    backToLive,
    newChat,
  };
}
