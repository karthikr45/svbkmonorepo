"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  streamChatbotAsk,
  type ChatbotChip,
  type ChatbotIntent,
} from "../lib/chatbot";

interface Turn {
  id: string;
  role: "user" | "assistant";
  text: string;
  intent?: ChatbotIntent;
  data?: unknown;
  chips?: ChatbotChip[];
}

const STARTER_CHIPS: ChatbotChip[] = [
  { label: "My children", message: "Who are my children?" },
  { label: "Pending fees", message: "What fees are pending?" },
  { label: "Upcoming events", message: "Any upcoming announcements?" },
];

/**
 * Parent-facing chatbot panel. Same wire format as the admin
 * component, simpler styling for the parent app surface. Mount
 * anywhere — a dedicated page, a floating widget on the dashboard,
 * etc.
 */
export default function ChatbotPanel({ title = "Assistant" }: { title?: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [streamingData, setStreamingData] = useState<unknown>(null);
  const [streamingChips, setStreamingChips] = useState<ChatbotChip[]>([]);
  const [streamingIntent, setStreamingIntent] = useState<ChatbotIntent | null>(
    null,
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, streamingText]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const newId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `t-${Date.now()}`;

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

      setTurns((prev) => [
        ...prev,
        { id: newId(), role: "user", text },
      ]);

      let acc = "";
      let intent: ChatbotIntent | undefined;
      let data: unknown = undefined;
      let chips: ChatbotChip[] | undefined;
      abortRef.current = new AbortController();
      try {
        await streamChatbotAsk(
          { message: text },
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
            onError: (msg) => setError(msg),
          },
          abortRef.current.signal,
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message);
        }
      } finally {
        abortRef.current = null;
        if (acc) {
          setTurns((prev) => [
            ...prev,
            {
              id: newId(),
              role: "assistant",
              text: acc,
              intent,
              data,
              chips,
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
    [isStreaming],
  );

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;
    const text = input;
    setInput("");
    void ask(text);
  }

  return (
    <div className="flex h-[560px] flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
      >
        {turns.length === 0 && !isStreaming && (
          <div className="space-y-2 pt-2 text-sm text-slate-500">
            <p>Hi! Try one of these to get started:</p>
            <Chips chips={STARTER_CHIPS} onPick={(m) => ask(m)} />
          </div>
        )}

        {turns.map((t) => (
          <Bubble
            key={t.id}
            role={t.role}
            text={t.text}
            intent={t.intent}
            data={t.data}
            chips={t.chips}
            onChip={(m) => ask(m)}
          />
        ))}

        {isStreaming && (
          <Bubble
            role="assistant"
            text={streamingText || "…"}
            intent={streamingIntent ?? undefined}
            data={streamingData}
            chips={streamingChips}
            streaming
            onChip={(m) => ask(m)}
          />
        )}

        {error && (
          <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}
      </div>

      <form
        className="flex items-center gap-2 border-t border-slate-200 px-3 py-2"
        onSubmit={submit}
      >
        <input
          className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
          placeholder="Ask about your child's fees, events..."
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

function Bubble({
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
  onChip: (m: string) => void;
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
            {intent.name === "unknown" ? "no match" : intent.name}
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
