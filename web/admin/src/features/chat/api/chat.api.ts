import { get, post, apiClient } from "@/lib/api-client";

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

export interface MessageAttachment {
  url: string;
  name: string;
  mime: string;
  size: number;
}

export interface ReplyPreview {
  id: string;
  senderId: string;
  body: string;
  attachmentName: string | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  replyToId: string | null;
  replyTo?: ReplyPreview | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentMime: string | null;
  attachmentSize: number | null;
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
  payload: {
    body?: string;
    replyToId?: string | null;
    attachment?: MessageAttachment | null;
  },
): Promise<ChatMessage> {
  return unwrap<ChatMessage>(
    await post(`/chat/conversations/${conversationId}/messages`, {
      body: payload.body,
      replyToId: payload.replyToId ?? undefined,
      attachment: payload.attachment ?? undefined,
    }),
  );
}

export async function uploadAttachmentApi(
  conversationId: string,
  file: File,
): Promise<MessageAttachment> {
  const form = new FormData();
  form.append("file", file);
  const res = await apiClient.post(
    `/chat/conversations/${conversationId}/attachments`,
    form,
  );
  return unwrap<MessageAttachment>(res.data);
}

export async function markReadApi(
  conversationId: string,
  messageId: string,
): Promise<void> {
  await post(`/chat/conversations/${conversationId}/read`, { messageId });
}
