/**
 * Chatbot SSE client.
 *
 * The browser's built-in `EventSource` only supports GET, but our
 * endpoint is POST (body is the user message + conversationId). So we
 * use fetch + a manual SSE parser — the standard pattern used by every
 * production AI chat UI today.
 */
import { getApiBaseUrl } from "@/lib/env";
import { getStoredToken } from "@/features/auth/services";

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

export interface ChatbotConversationSummary {
  id: string;
  title: string | null;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface ChatbotConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

/**
 * Open an SSE stream against POST /chatbot/ask and route every event
 * through the supplied callbacks. Resolves when the server closes the
 * stream (`done` or `error` event).
 *
 * Pass an AbortSignal to cancel mid-stream (e.g. component unmount).
 */
export async function streamChatbotAsk(
  body: { message: string; conversationId?: string | null },
  cb: ChatbotStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const token = getStoredToken();
  const res = await fetch(`${getApiBaseUrl()}/chatbot/ask`, {
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

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Chatbot request failed (${res.status}): ${text || res.statusText}`,
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line.
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
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      // SSE allows multi-line data — concatenate as-is per the spec.
      dataLines.push(line.slice(5).trimStart());
    }
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

export async function listChatbotConversations(): Promise<
  ChatbotConversationSummary[]
> {
  const token = getStoredToken();
  const res = await fetch(`${getApiBaseUrl()}/chatbot/conversations`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`Failed to list conversations (${res.status})`);
  const body = (await res.json()) as
    | ChatbotConversationSummary[]
    | { data: ChatbotConversationSummary[] };
  return Array.isArray(body) ? body : (body.data ?? []);
}

export async function getChatbotConversation(id: string): Promise<{
  conversation: ChatbotConversationSummary;
  messages: ChatbotConversationMessage[];
}> {
  const token = getStoredToken();
  const res = await fetch(`${getApiBaseUrl()}/chatbot/conversations/${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`Failed to load conversation (${res.status})`);
  const body = (await res.json()) as {
    conversation: ChatbotConversationSummary;
    messages: ChatbotConversationMessage[];
  } & { data?: unknown };
  // Some clients wrap responses in { data: ... }
  const payload = (body.data ?? body) as typeof body;
  return {
    conversation: payload.conversation,
    messages: payload.messages ?? [],
  };
}
