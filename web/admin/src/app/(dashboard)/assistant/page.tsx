import type { Metadata } from "next";
import { ChatbotPanel } from "@/features/chatbot/components/ChatbotPanel";

export const metadata: Metadata = {
  title: "Assistant",
  description: "Ask questions about your school in plain English.",
};

/**
 * Drops the chatbot panel onto a dedicated page. To expose it as a
 * floating widget on every page instead, mount <ChatbotPanel /> in
 * AppShell behind a small toggle button.
 */
export default function AssistantPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Assistant</h1>
        <p className="text-sm text-slate-500">
          Ask about defaulters, pending approvals, or fee collection.
          Answers come straight from your tenant&apos;s data.
        </p>
      </header>
      <ChatbotPanel />
    </div>
  );
}
