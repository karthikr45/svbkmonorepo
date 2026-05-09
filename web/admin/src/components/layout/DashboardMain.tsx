"use client";

export function DashboardMain({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      className={`flex-1 overflow-auto px-4 py-5 sm:px-6 sm:py-8 md:px-8 md:py-10 ${className}`}
      style={{ backgroundColor: "var(--app-search-bg)" }}
    >
      {children}
    </main>
  );
}
