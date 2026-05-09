import type { Metadata } from "next";
import { DashboardStats, RecentStudentsTable } from "@/components/dashboard";
import { PageHeader } from "@/components/layout";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Admin dashboard – stats and recent students",
};

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of students, fees, and recent activity."
      />
      <div className="space-y-6">
        <DashboardStats />
        <RecentStudentsTable />
      </div>
    </div>
  );
}
