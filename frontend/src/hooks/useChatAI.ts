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

let nextId = 0;
const msgId = () => `msg-${Date.now()}-${nextId++}`;

// Text chat over the same Socket.io voice pipeline the orb uses — identical
// brain (knowledge base RAG, appointments, booking flow, Gemini), no audio.
export function useChatAI() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const greetedRef = useRef(false);
  const streamingIdRef = useRef<string | null>(null);

  // Load the user's previous conversations (ChatGPT-style persistence)
  useEffect(() => {
    fetch(`${getBackendUrl()}/api/conversations/mine`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.success && Array.isArray(d.data) && d.data.length > 0) {
          const history: ChatMessage[] = d.data.map(
            (m: { role: string; content: string }) => ({
              id: msgId(),
              role: m.role === "user" ? "user" : "assistant",
              text: m.content,
            })
          );
          setMessages((prev) => [...history, ...prev]);
        }
      })
      .catch(() => {}); // guests simply have no history
  }, []);

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

    return () => {
      socket.disconnect();
    };
  }, []);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !socketRef.current) return;
    setMessages((prev) => [...prev, { id: msgId(), role: "user", text: trimmed }]);
    setTyping(true);
    socketRef.current.emit("text-input", trimmed);
  }, []);

  return { messages, typing, isConnected, sendMessage };
}
