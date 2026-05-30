"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  streamChatbotAsk,
  type ChatbotChip,
  type ChatbotIntent,
} from "../api/chatbot.api";

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || err.name || "Error";
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
    try {
      return JSON.stringify(err);
    } catch {
      return "Unknown error";
    }
  }
  return String(err ?? "Unknown error");
}
function toErrorName(err: unknown): string {
  if (err instanceof Error) return err.name;
  if (err && typeof err === "object") {
    const n = (err as { name?: unknown }).name;
    if (typeof n === "string") return n;
  }
  return "";
}

export interface ChatbotTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  data?: unknown;
  intent?: ChatbotIntent;
  chips?: ChatbotChip[];
  llmUsed?: boolean;
}

/**
 * Self-contained state for one chatbot conversation. Owns the SSE
 * stream lifecycle so a component that calls `ask()` will get
 * incremental updates and never leak a connection on unmount.
 */
export function useChatbot() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatbotTurn[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [streamingData, setStreamingData] = useState<unknown>(null);
  const [streamingChips, setStreamingChips] = useState<ChatbotChip[]>([]);
  const [streamingIntent, setStreamingIntent] = useState<ChatbotIntent | null>(
    null,
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setConversationId(null);
    setTurns([]);
    setStreamingText("");
    setStreamingData(null);
    setStreamingChips([]);
    setStreamingIntent(null);
    setIsStreaming(false);
    setError(null);
  }, []);

  const ask = useCallback(
    async (message: string) => {
      const text = message.trim();
      if (!text || isStreaming) return;
      setError(null);
      setStreamingText("");
      setStreamingData(null);
      setStreamingChips([]);
      setStreamingIntent(null);
      setIsStreaming(true);

      const userId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `u-${Date.now()}`;
      setTurns((prev) => [
        ...prev,
        { id: userId, role: "user", text },
      ]);

      let acc = "";
      let intent: ChatbotIntent | undefined;
      let data: unknown = undefined;
      let chips: ChatbotChip[] | undefined;
      let llmUsed = false;

      abortRef.current = new AbortController();
      try {
        await streamChatbotAsk(
          { message: text, conversationId },
          {
            onIntent: (i) => {
              intent = i;
              setStreamingIntent(i);
            },
            onData: (d) => {
              data = d;
              setStreamingData(d);
            },
            onToken: (t) => {
              acc += t;
              setStreamingText(acc);
            },
            onChips: (c) => {
              chips = c;
              setStreamingChips(c);
            },
            onError: (msg) => {
              setError(msg);
            },
            onDone: (info) => {
              llmUsed = info.llmUsed;
            },
          },
          abortRef.current.signal,
        );
      } catch (err) {
        if (toErrorName(err) !== "AbortError") {
          // Always coerce to a readable string so React never tries to
          // render `[object Object]` from a thrown plain object.
          // eslint-disable-next-line no-console
          console.error("Chatbot ask failed:", err);
          setError(toErrorMessage(err));
        }
      } finally {
        abortRef.current = null;
        // Flush the accumulated turn into history.
        if (acc) {
          setTurns((prev) => [
            ...prev,
            {
              id:
                typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? crypto.randomUUID()
                  : `a-${Date.now()}`,
              role: "assistant",
              text: acc,
              data,
              intent,
              chips,
              llmUsed,
            },
          ]);
        }
        setStreamingText("");
        setStreamingData(null);
        setStreamingChips([]);
        setStreamingIntent(null);
        setIsStreaming(false);
      }
    },
    [conversationId, isStreaming],
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  return {
    conversationId,
    setConversationId,
    turns,
    streamingText,
    streamingData,
    streamingChips,
    streamingIntent,
    isStreaming,
    error,
    ask,
    reset,
  };
}
