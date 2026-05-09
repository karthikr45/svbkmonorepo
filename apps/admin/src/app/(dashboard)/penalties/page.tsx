import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Penalties",
  description: "Penalties",
};

export default function PenaltiesPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold" style={{ color: "var(--app-text-primary)" }}>
        Penalties
      </h1>
      <p className="mt-2" style={{ color: "var(--app-text-secondary)" }}>
        Penalties – add content as needed.
      </p>
    </div>
  );
}
