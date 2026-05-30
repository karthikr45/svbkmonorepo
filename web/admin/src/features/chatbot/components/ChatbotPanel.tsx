"use client";

import { useEffect, useRef, useState } from "react";
import { useChatbot } from "../hooks/useChatbot";
import type { ChatbotChip, ChatbotIntent } from "../api/chatbot.api";

interface Props {
  /** Heading shown at the top — e.g. "School Assistant". */
  title?: string;
  /** Hint placeholder shown in the input. */
  placeholder?: string;
  /** Quick-start chips before the first turn. */
  starterChips?: ChatbotChip[];
}

/**
 * Self-contained chatbot panel. Drop it into any admin page:
 *
 *   <ChatbotPanel />
 *
 * Streams assistant tokens from POST /chatbot/ask via the useChatbot
 * hook. No styling lib assumed beyond Tailwind classes already in use
 * throughout the admin app.
 */
export function ChatbotPanel({
  title = "Assistant",
  placeholder = "Ask about fees, defaulters, approvals...",
  starterChips = [
    { label: "Fee defaulters", message: "Show fee defaulters" },
    { label: "Pending approvals", message: "Show pending approvals" },
    { label: "Collection this week", message: "Total collection this week" },
  ],
}: Props) {
  const {
    turns,
    streamingText,
    streamingData,
    streamingChips,
    streamingIntent,
    isStreaming,
    error,
    ask,
  } = useChatbot();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Keep the latest turn in view as it streams.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, streamingText]);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;
    const text = input;
    setInput("");
    void ask(text);
  }

  const showStarters = turns.length === 0 && !isStreaming;

  return (
    <div className="flex h-[640px] flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        <span className="text-xs text-slate-400">
          Answers from your tenant's data only.
        </span>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
      >
        {turns.map((t) => (
          <Turn
            key={t.id}
            role={t.role}
            text={t.text}
            intent={t.intent}
            data={t.data}
            chips={t.chips}
            onChip={(msg) => ask(msg)}
          />
        ))}

        {isStreaming && (
          <Turn
            role="assistant"
            text={streamingText || "…"}
            intent={streamingIntent ?? undefined}
            data={streamingData}
            chips={streamingChips}
            streaming
            onChip={(msg) => ask(msg)}
          />
        )}

        {error && (
          <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        {showStarters && (
          <div className="space-y-2 pt-2">
            <p className="text-xs text-slate-500">Try one of these:</p>
            <Chips chips={starterChips} onPick={(msg) => ask(msg)} />
          </div>
        )}
      </div>

      <form
        className="flex items-center gap-2 border-t border-slate-200 px-3 py-2"
        onSubmit={submit}
      >
        <input
          className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isStreaming}
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="rounded-md bg-slate-800 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {isStreaming ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}

function Turn({
  role,
  text,
  intent,
  data,
  chips,
  streaming,
  onChip,
}: {
  role: "user" | "assistant";
  text: string;
  intent?: ChatbotIntent;
  data?: unknown;
  chips?: ChatbotChip[];
  streaming?: boolean;
  onChip: (message: string) => void;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] ${isUser ? "text-right" : "text-left"}`}>
        <div
          className={`inline-block whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
            isUser
              ? "bg-slate-800 text-white"
              : "border border-slate-200 bg-slate-50 text-slate-800"
          }`}
        >
          {text}
          {streaming && <span className="ml-1 animate-pulse">▍</span>}
        </div>
        {!isUser && intent && (
          <div className="mt-1 text-[11px] text-slate-400">
            via {intent.source === "llm" ? "AI" : "rules"} ·{" "}
            {intent.name === "unknown" ? "no match" : intent.name} ·{" "}
            confidence {(intent.confidence * 100).toFixed(0)}%
          </div>
        )}
        {!isUser && data != null && (
          <details className="mt-2 text-xs text-slate-500">
            <summary className="cursor-pointer">Show source data</summary>
            <pre className="mt-1 overflow-x-auto rounded bg-slate-100 p-2 text-[11px] text-slate-700">
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        )}
        {!isUser && chips && chips.length > 0 && (
          <div className="mt-2">
            <Chips chips={chips} onPick={onChip} />
          </div>
        )}
      </div>
    </div>
  );
}

function Chips({
  chips,
  onPick,
}: {
  chips: ChatbotChip[];
  onPick: (message: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c, i) => (
        <button
          key={`${c.label}-${i}`}
          type="button"
          onClick={() => onPick(c.message)}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:border-slate-400 hover:bg-slate-50"
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
