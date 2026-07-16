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
        setMessages((prev) =>
          prev.length === 0 ? [{ id: msgId(), role: "assistant", text: data.greeting }] : prev
        );
      }
    });

    socket.on("ai-response-text", (text: string) => {
      setTyping(false);
      setMessages((prev) => [...prev, { id: msgId(), role: "assistant", text }]);
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
