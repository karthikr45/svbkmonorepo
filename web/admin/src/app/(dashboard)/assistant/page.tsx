"use client";

import { useEffect, useState } from "react";
import { ChatbotPanel } from "@/features/chatbot/components/ChatbotPanel";
import { fetchChatbotStatus } from "@/features/chatbot/api/chatbot.api";

/**
 * Mounts the chatbot panel, but only after `/chatbot/status` confirms
 * the tenant has the bot enabled. Direct visits land on a clear
 * "not enabled" panel instead of a broken-looking UI.
 */
export default function AssistantPage() {
  const [state, setState] = useState<"loading" | "enabled" | "disabled">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    fetchChatbotStatus()
      .then((s) => {
        if (!cancelled) setState(s.enabled ? "enabled" : "disabled");
      })
      .catch(() => {
        if (!cancelled) setState("disabled");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Assistant</h1>
        <p className="text-sm text-slate-500">
          Ask about defaulters, pending approvals, or fee collection.
          Answers come straight from your tenant&apos;s data.
        </p>
      </header>
      {state === "loading" && (
        <div className="rounded border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading…
        </div>
      )}
      {state === "disabled" && (
        <div className="rounded border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          The Assistant is not enabled for your account yet. Your super-admin
          can turn it on from the Tenants screen.
        </div>
      )}
      {state === "enabled" && <ChatbotPanel />}
    </div>
  );
}
