import type { Metadata } from "next";
import { AnnouncementsPageContent } from "./AnnouncementsPageContent";

export const metadata: Metadata = {
  title: "Announcements",
  description: "Manage announcements",
};

export default function AnnouncementsPage() {
  return <AnnouncementsPageContent />;
}
