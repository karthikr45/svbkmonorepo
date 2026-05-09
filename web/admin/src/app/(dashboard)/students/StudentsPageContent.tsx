"use client";

import { useState } from "react";
import { ViewPageContent } from "@/app/(dashboard)/view/ViewPageContent";
import { UploadPageContent } from "./UploadPageContent";
import { StudentsTableV2 } from "@/features/students/components/StudentsTableV2";

type TabId = "view" | "upload" | "legacy";

export function StudentsPageContent() {
  const [activeTab, setActiveTab] = useState<TabId>("view");

  return (
    <div>
      {activeTab === "view" && (
        <StudentsTableV2
          onUpload={() => setActiveTab("upload")}
          onShowLegacy={() => setActiveTab("legacy")}
        />
      )}
      {activeTab === "upload" && (
        <UploadPageContent onBack={() => setActiveTab("view")} />
      )}
      {activeTab === "legacy" && (
        <ViewPageContent onNavigateUpload={() => setActiveTab("upload")} />
      )}
    </div>
  );
}
