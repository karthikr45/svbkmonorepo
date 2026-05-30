/**
 * Chatbot SSE client for the parent app. Mirrors the admin app's
 * helper — duplicated rather than shared because the two apps are
 * separate Next.js projects. If a shared package gets created later,
 * move both copies there.
 */
import { getTokens } from "./auth";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:3001/api";

export interface ChatbotIntent {
  name: string;
  confidence: number;
  source: "rules" | "llm";
}

export interface ChatbotChip {
  label: string;
  message: string;
}

export interface ChatbotStreamCallbacks {
  onTyping?: () => void;
  onIntent?: (intent: ChatbotIntent) => void;
  onData?: (data: unknown) => void;
  onToken?: (token: string) => void;
  onChips?: (chips: ChatbotChip[]) => void;
  onError?: (message: string) => void;
  onDone?: (info: {
    messageId: string;
    durationMs: number;
    llmUsed: boolean;
  }) => void;
}

export async function streamChatbotAsk(
  body: { message: string; conversationId?: string | null },
  cb: ChatbotStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const token = getTokens()?.accessToken;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/chatbot/ask`, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        message: body.message,
        conversationId: body.conversationId ?? undefined,
      }),
    });
  } catch (err) {
    throw err instanceof Error
      ? err
      : new Error(`Network error: ${String(err)}`);
  }
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    let detail = text || res.statusText;
    if (text) {
      try {
        const j = JSON.parse(text) as { message?: string | string[] };
        if (Array.isArray(j.message)) detail = j.message.join("; ");
        else if (typeof j.message === "string") detail = j.message;
      } catch {
        // Not JSON — keep raw text.
      }
    }
    throw new Error(`Assistant request failed (${res.status}): ${detail}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      dispatchFrame(frame, cb);
    }
  }
  if (buffer.trim()) dispatchFrame(buffer, cb);
}

function dispatchFrame(frame: string, cb: ChatbotStreamCallbacks): void {
  let event = "message";
  const dataLines: string[] = [];
  for (const rawLine of frame.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:"))
      dataLines.push(line.slice(5).trimStart());
  }
  const raw = dataLines.join("\n");
  let parsed: unknown = raw;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw;
    }
  }
  switch (event) {
    case "typing":
      cb.onTyping?.();
      return;
    case "intent":
      cb.onIntent?.(parsed as ChatbotIntent);
      return;
    case "data":
      cb.onData?.(parsed);
      return;
    case "token":
      cb.onToken?.(typeof parsed === "string" ? parsed : String(parsed));
      return;
    case "chips":
      cb.onChips?.(parsed as ChatbotChip[]);
      return;
    case "error":
      cb.onError?.((parsed as { message: string }).message ?? "Unknown error");
      return;
    case "done":
      cb.onDone?.(
        parsed as {
          messageId: string;
          durationMs: number;
          llmUsed: boolean;
        },
      );
      return;
  }
}
