"use client";

import { useAuth } from "@/features/auth";
import { Sidebar } from "@/components/layout";
import { DashboardMain } from "@/components/layout";

export default function PayNowLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    // Public users see only Pay Now content (no sidebar)
    return <>{children}</>;
  }

  // Authenticated users see dashboard-style UI + sidebar
  return (
    <div className="flex min-h-0 flex-1">
      <Sidebar />
      <DashboardMain>{children}</DashboardMain>
    </div>
  );
}