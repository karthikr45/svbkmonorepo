import { get, post } from "@/lib/api-client";

export interface ChatContact {
  adminId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string | null;
  tenantName: string | null;
}

export interface ChatConversation {
  conversationId: string;
  peer: ChatContact;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

function unwrap<T>(res: unknown): T {
  if (res && typeof res === "object" && "data" in res) {
    return (res as { data: T }).data;
  }
  return res as T;
}

export async function listContactsApi(): Promise<ChatContact[]> {
  return unwrap<ChatContact[]>(await get("/chat/contacts"));
}

export async function listConversationsApi(): Promise<ChatConversation[]> {
  return unwrap<ChatConversation[]>(await get("/chat/conversations"));
}

export async function getUnreadCountApi(): Promise<number> {
  const res = unwrap<{ unread: number }>(await get("/chat/unread"));
  return Number(res?.unread ?? 0);
}

export async function startConversationApi(
  peerAdminId: string,
): Promise<{ id: string }> {
  return unwrap<{ id: string }>(
    await post("/chat/conversations/start", { peerAdminId }),
  );
}

export async function listMessagesApi(
  conversationId: string,
  opts: { limit?: number; beforeId?: string } = {},
): Promise<ChatMessage[]> {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.beforeId) params.set("beforeId", opts.beforeId);
  const qs = params.toString();
  return unwrap<ChatMessage[]>(
    await get(`/chat/conversations/${conversationId}/messages${qs ? `?${qs}` : ""}`),
  );
}

export async function sendMessageApi(
  conversationId: string,
  body: string,
): Promise<ChatMessage> {
  return unwrap<ChatMessage>(
    await post(`/chat/conversations/${conversationId}/messages`, { body }),
  );
}

export async function markReadApi(
  conversationId: string,
  messageId: string,
): Promise<void> {
  await post(`/chat/conversations/${conversationId}/read`, { messageId });
}
