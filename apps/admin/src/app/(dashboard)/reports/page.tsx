import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reports",
  description: "Reports",
};

export default function ReportsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold" style={{ color: "var(--app-text-primary)" }}>
        Reports
      </h1>
      <p className="mt-2" style={{ color: "var(--app-text-secondary)" }}>
        Reports – add content as needed.
      </p>
    </div>
  );
}
