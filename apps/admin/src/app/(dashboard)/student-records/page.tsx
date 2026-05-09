import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Student Records",
  description: "Student records",
};

export default function StudentRecordsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold" style={{ color: "var(--app-text-primary)" }}>
        Student Records
      </h1>
      <p className="mt-2" style={{ color: "var(--app-text-secondary)" }}>
        Student records – add content as needed.
      </p>
    </div>
  );
}
