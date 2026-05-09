import type { Metadata } from "next";
import { DashboardStats, RecentStudentsTable } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Admin dashboard – stats and recent students",
};

export default function DashboardPage() {
  return (
    <div className="space-y-6 sm:space-y-10">
      <DashboardStats />
      <RecentStudentsTable />
    </div>
  );
}
