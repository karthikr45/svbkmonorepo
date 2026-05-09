"use client";

import { ProtectedRoute, useAuth } from "@/features/auth";

function TenantsHeader() {
  const { user, logout } = useAuth();
  return (
    <header
      className="h-14 flex items-center justify-between px-6 bg-white border-b border-slate-200 sticky top-0 z-20"
      style={{ boxShadow: "0 1px 3px rgb(0 0 0 / 0.05)" }}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
          <span className="text-blue-700 font-bold text-sm">S</span>
        </div>
        <div className="leading-tight">
          <p className="font-bold text-slate-800 text-sm">SVBK Super-admin</p>
          <p className="text-xs text-slate-500">{user?.email}</p>
        </div>
      </div>
      <button
        onClick={() => logout()}
        className="flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Logout
      </button>
    </header>
  );
}

export default function TenantsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <div className="min-h-screen flex flex-col bg-slate-50">
        <TenantsHeader />
        <div className="flex-1">{children}</div>
      </div>
    </ProtectedRoute>
  );
}
