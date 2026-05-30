import type { Metadata } from "next";
import ChatbotPanel from "@/components/ChatbotPanel";

export const metadata: Metadata = {
  title: "Assistant",
  description: "Ask about your child's fees and school events.",
};

export default function AssistantPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Assistant</h1>
        <p className="text-sm text-slate-500">
          Ask about pending fees, receipts, and upcoming events. Answers
          come from your school&apos;s data.
        </p>
      </header>
      <ChatbotPanel />
    </main>
  );
}
