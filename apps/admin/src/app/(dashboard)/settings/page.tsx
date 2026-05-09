import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
  description: "Settings",
};

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold" style={{ color: "var(--app-text-primary)" }}>
        Settings
      </h1>
      <p className="mt-2" style={{ color: "var(--app-text-secondary)" }}>
        Settings – add content as needed.
      </p>
    </div>
  );
}
