import { ProtectedRoute } from "@/features/auth";
import { DashboardMain, Sidebar } from "@/components/layout";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <DashboardMain>{children}</DashboardMain>
      </div>
    </ProtectedRoute>
  );
}
