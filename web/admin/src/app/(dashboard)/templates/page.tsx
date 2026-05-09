import type { Metadata } from "next";
import { TemplatesPageContent } from "./TemplatesPageContent";

export const metadata: Metadata = {
  title: "Templates",
  description: "Manage templates",
};

export default function TemplatesPage() {
  return <TemplatesPageContent />;
}
