import type { Metadata } from "next";
import { PageHeader } from "@/components/layout";
import { ComingSoonCard } from "@/components/common/ComingSoonCard";

export const metadata: Metadata = {
  title: "Reports",
  description: "Reports and analytics",
};

export default function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Fee collection, defaulters, and tenant-wide analytics."
      />
      <ComingSoonCard
        title="Reports coming soon"
        body="Filter, export, and schedule reports across collections, outstanding balances, and tenant comparisons."
      />
    </div>
  );
}
