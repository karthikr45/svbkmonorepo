"use client";

import { useState } from "react";
import { ViewPageContent } from "@/app/(dashboard)/view/ViewPageContent";
import { UploadPageContent } from "./UploadPageContent";

type TabId = "view" | "upload";

export function StudentsPageContent() {
  const [activeTab, setActiveTab] = useState<TabId>("view");

  return (
    <div className="space-y-1">
      {activeTab === "view" && (
        <ViewPageContent onNavigateUpload={() => setActiveTab("upload")} />
      )}
      {activeTab === "upload" && (
        <UploadPageContent onBack={() => setActiveTab("view")} />
      )}
    </div>
  );
}
