import { ProtectedRoute } from "@/features/auth";

export default function TenantsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      {children}
    </ProtectedRoute>
  );
}
