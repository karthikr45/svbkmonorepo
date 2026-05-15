"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/features/auth";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  getUnreadCountApi,
  listContactsApi,
  listConversationsApi,
  listMessagesApi,
  markReadApi,
  sendMessageApi,
  startConversationApi,
  type ChatContact,
  type ChatConversation,
  type ChatMessage,
} from "@/features/chat/api/chat.api";

/**
 * 5-second poll for new messages on the open thread and the unread
 * total in the rail. Good enough for an MVP — a websocket can replace
 * this later without changing the UI.
 */
const POLL_MS = 5000;

export function ChatPageContent() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activePeer, setActivePeer] = useState<ChatContact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cs, convs] = await Promise.all([
        listContactsApi(),
        listConversationsApi(),
      ]);
      setContacts(cs);
      setConversations(convs);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load chat"));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (convId: string) => {
    try {
      const msgs = await listMessagesApi(convId, { limit: 100 });
      setMessages(msgs);
      const last = msgs[msgs.length - 1];
      if (last) {
        try {
          await markReadApi(convId, last.id);
        } catch {
          /* non-fatal */
        }
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load messages"));
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Poll unread + active thread.
  useEffect(() => {
    const tick = async () => {
      try {
        await getUnreadCountApi();
        const convs = await listConversationsApi();
        setConversations(convs);
        if (activeConvId) {
          const msgs = await listMessagesApi(activeConvId, { limit: 100 });
          setMessages(msgs);
          const last = msgs[msgs.length - 1];
          if (last) {
            try {
              await markReadApi(activeConvId, last.id);
            } catch {
              /* non-fatal */
            }
          }
        }
      } catch {
        /* swallow polling errors */
      }
    };
    const id = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(id);
  }, [activeConvId]);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  async function openConversationWith(peer: ChatContact) {
    setActivePeer(peer);
    try {
      const conv = await startConversationApi(peer.adminId);
      setActiveConvId(conv.id);
      await loadMessages(conv.id);
      const convs = await listConversationsApi();
      setConversations(convs);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not start conversation"));
    }
  }

  function openExistingConv(c: ChatConversation) {
    setActivePeer(c.peer);
    setActiveConvId(c.conversationId);
    loadMessages(c.conversationId);
  }

  async function send() {
    if (!activeConvId || !draft.trim()) return;
    setSending(true);
    try {
      const msg = await sendMessageApi(activeConvId, draft.trim());
      setMessages((prev) => [...prev, msg]);
      setDraft("");
      const convs = await listConversationsApi();
      setConversations(convs);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not send message"));
    } finally {
      setSending(false);
    }
  }

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      [c.firstName, c.lastName, c.email, c.tenantName ?? "", c.role]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [contacts, search]);

  const conversationContactIds = new Set(
    conversations.map((c) => c.peer.adminId),
  );

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4 max-w-[1400px] mx-auto">
      {/* Left rail */}
      <aside className="w-[320px] flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Chat</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {isSuperAdmin
              ? "You can message anyone across tenants."
              : "Message your tenant team or any super-admin."}
          </p>
        </div>

        <div className="px-3 py-2 border-b border-slate-100">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, school…"
            className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-[#0b54ab] focus:ring-2 focus:ring-[#0b54ab]/20"
          />
        </div>

        {error && (
          <div className="m-3 p-2 rounded-lg bg-red-50 border border-red-100 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {conversations.length > 0 && (
            <div>
              <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">
                Recent
              </div>
              {conversations.map((c) => {
                const isActive = activeConvId === c.conversationId;
                return (
                  <button
                    key={c.conversationId}
                    onClick={() => openExistingConv(c)}
                    className={`w-full text-left px-4 py-2.5 border-b border-slate-50 hover:bg-slate-50 ${
                      isActive ? "bg-blue-50/60" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {c.peer.firstName} {c.peer.lastName}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {isSuperAdmin && c.peer.tenantName
                            ? `${c.peer.tenantName} · `
                            : ""}
                          {c.lastMessagePreview ?? "Start chatting"}
                        </p>
                      </div>
                      {c.unreadCount > 0 && (
                        <span className="bg-[#0b54ab] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div>
            <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">
              {conversations.length > 0 ? "Start new chat" : "Contacts"}
              <span className="ml-2 text-slate-400/70 normal-case font-normal">
                {!loading && `(${contacts.length})`}
              </span>
            </div>
            {loading ? (
              <p className="px-4 py-3 text-xs text-slate-500">Loading…</p>
            ) : contacts.length === 0 ? (
              <p className="px-4 py-3 text-xs text-slate-500">
                No one to chat with yet.{" "}
                {isSuperAdmin
                  ? "Create a tenant admin first."
                  : "Ask your super-admin to add team members."}
              </p>
            ) : filteredContacts.length === 0 ? (
              <p className="px-4 py-3 text-xs text-slate-500">
                No contacts match "{search}". Try a different search or clear it.
              </p>
            ) : (
              filteredContacts
                .filter((c) => !conversationContactIds.has(c.adminId))
                .map((c) => (
                  <button
                    key={c.adminId}
                    onClick={() => openConversationWith(c)}
                    className="w-full text-left px-4 py-2.5 border-b border-slate-50 hover:bg-slate-50"
                  >
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {c.firstName} {c.lastName}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      <span className="uppercase tracking-[0.04em] font-bold text-slate-400">
                        {c.role.replace("_", " ")}
                      </span>
                      {(isSuperAdmin || c.role === "super_admin") &&
                      c.tenantName
                        ? ` · ${c.tenantName}`
                        : ""}
                      {" · "}
                      {c.email}
                    </p>
                  </button>
                ))
            )}
          </div>
        </div>
      </aside>

      {/* Thread */}
      <section className="flex-1 flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {!activeConvId ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
            <div className="text-center">
              <div className="text-2xl mb-2">💬</div>
              Pick a contact on the left to start chatting.
            </div>
          </div>
        ) : (
          <>
            <header className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {activePeer?.firstName} {activePeer?.lastName}
                </h2>
                <p className="text-[11px] text-slate-500">
                  <span className="uppercase tracking-[0.04em] font-bold text-slate-400">
                    {activePeer?.role?.replace("_", " ")}
                  </span>
                  {activePeer?.tenantName ? ` · ${activePeer.tenantName}` : ""}
                  {" "}· {activePeer?.email}
                </p>
              </div>
            </header>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-5 py-4 space-y-2 bg-slate-50/40"
            >
              {messages.length === 0 ? (
                <p className="text-center text-xs text-slate-400 mt-12">
                  No messages yet. Say hi.
                </p>
              ) : (
                messages.map((m, i) => {
                  const mine = m.senderId === user?.id;
                  const prev = messages[i - 1];
                  const sameSender = prev && prev.senderId === m.senderId;
                  return (
                    <div
                      key={m.id}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-sm leading-snug ${
                          mine
                            ? "bg-[#0b54ab] text-white rounded-br-sm"
                            : "bg-white border border-slate-200 text-slate-900 rounded-bl-sm"
                        } ${sameSender ? "mt-1" : "mt-3"}`}
                      >
                        <div className="whitespace-pre-wrap break-words">{m.body}</div>
                        <div
                          className={`text-[10px] mt-1 ${
                            mine ? "text-blue-100" : "text-slate-400"
                          }`}
                        >
                          {new Date(m.createdAt).toLocaleString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "short",
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {error && (
              <div className="mx-5 mb-2 p-2 rounded-lg bg-red-50 border border-red-100 text-xs text-red-700">
                {error}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="px-4 py-3 border-t border-slate-100 flex items-end gap-2"
            >
              <textarea
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Type a message… (Shift+Enter for newline)"
                className="flex-1 resize-none px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#0b54ab] focus:ring-2 focus:ring-[#0b54ab]/20 max-h-32"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="h-10 px-4 rounded-xl bg-[#0b54ab] text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90"
              >
                Send
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
