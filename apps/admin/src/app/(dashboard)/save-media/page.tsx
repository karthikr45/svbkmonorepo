import type { Metadata } from "next";
import { SaveMediaPageContent } from "./SaveMediaPageContent";

export const metadata: Metadata = {
  title: "Save Media",
  description: "Upload and preview audio and video media files",
};

export default function SaveMediaPage() {
  return <SaveMediaPageContent />;
}
