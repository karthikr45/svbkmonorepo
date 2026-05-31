"use client";

import { useEffect, useState } from "react";
import ChatbotPanel from "@/components/ChatbotPanel";
import { fetchChatbotStatus } from "@/lib/chatbot";

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
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Assistant</h1>
        <p className="text-sm text-slate-500">
          Ask about pending fees, receipts, and upcoming events. Answers
          come from your school&apos;s data.
        </p>
      </header>
      {state === "loading" && (
        <div className="rounded border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading…
        </div>
      )}
      {state === "disabled" && (
        <div className="rounded border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          The Assistant is not enabled by your school yet. Please contact
          the school office if you need help.
        </div>
      )}
      {state === "enabled" && <ChatbotPanel />}
    </main>
  );
}
