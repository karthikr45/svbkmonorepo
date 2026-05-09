"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getAuth, clearAuth } from "@/lib/auth";
import { parentData, type Child } from "@/lib/mockData";
import { FeeCard } from "@/components/FeeCard";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const AVATAR_COLORS = [
  { bg: "#dbeafe", text: "#1d4ed8" },
  { bg: "#fce7f3", text: "#be185d" },
  { bg: "#d1fae5", text: "#065f46" },
  { bg: "#fef3c7", text: "#92400e" },
  { bg: "#ede9fe", text: "#5b21b6" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [auth, setAuthState] = useState<{ email: string } | null>(null);

  useEffect(() => {
    setMounted(true);
    const stored = getAuth();
    if (!stored?.verified) {
      router.replace("/login");
      return;
    }
    setAuthState({ email: stored.email });
    if (parentData.children.length > 0) {
      setSelectedChild(parentData.children[0]);
    }
  }, [router]);

  const handleLogout = () => {
    clearAuth();
    router.replace("/login");
  };

  const handleSelectChild = (child: Child) => {
    setSelectedChild(child);
    setSidebarOpen(false);
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#f1f5f9" }}>
      {/* ── Sidebar ── */}
      <>
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`
            fixed top-0 left-0 h-full z-40 flex flex-col bg-white border-r border-slate-200
            transition-transform duration-300 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
            md:static md:translate-x-0 md:z-auto
          `}
          style={{ width: 256 }}
        >
          {/* Logo */}
          <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white shadow border border-slate-100 flex-shrink-0 p-0.5">
              <Image src="/svbk_logo.webp" alt="SVBK" width={36} height={36} className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-slate-800 text-sm leading-tight truncate">SVBK</p>
              <p className="text-xs text-slate-500 truncate">Parent Portal</p>
            </div>
            {/* Mobile close */}
            <button
              className="ml-auto md:hidden w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"
              onClick={() => setSidebarOpen(false)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Parent info */}
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{parentData.name}</p>
                <p className="text-xs text-slate-500 truncate">{auth?.email}</p>
              </div>
            </div>
          </div>

          {/* Children list */}
          <div className="flex-1 overflow-y-auto sidebar-scroll py-3">
            <p className="px-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              My Children
            </p>
            <nav className="flex flex-col gap-1 px-3">
              {parentData.children.map((child, i) => {
                const isActive = selectedChild?.id === child.id;
                const avatar = AVATAR_COLORS[i % AVATAR_COLORS.length];
                const paidCount = Object.values(child.fees).filter((f) => f.paid).length;
                const total = 3;

                return (
                  <button
                    key={child.id}
                    onClick={() => handleSelectChild(child)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all"
                    style={{
                      backgroundColor: isActive ? "#eff6ff" : "transparent",
                      border: isActive ? "1.5px solid #bfdbfe" : "1.5px solid transparent",
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm"
                      style={{ backgroundColor: avatar.bg, color: avatar.text }}
                    >
                      {getInitials(child.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-semibold leading-tight truncate"
                        style={{ color: isActive ? "#1d4ed8" : "#1e293b" }}
                      >
                        {child.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {child.grade} · {child.section}
                      </p>
                    </div>
                    {/* Fee status dot */}
                    <div className="flex-shrink-0">
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: paidCount === total ? "#dcfce7" : "#fef3c7",
                          color: paidCount === total ? "#15803d" : "#92400e",
                        }}
                      >
                        {paidCount}/{total}
                      </span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Logout */}
          <div className="p-3 border-t border-slate-100">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors text-sm font-medium"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16,17 21,12 16,7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Logout
            </button>
          </div>
        </aside>
      </>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top navbar */}
        <header
          className="h-16 flex items-center px-4 sm:px-6 gap-4 bg-white border-b border-slate-200 sticky top-0 z-20"
          style={{ boxShadow: "0 1px 3px rgb(0 0 0 / 0.05)" }}
        >
          {/* Mobile hamburger */}
          <button
            className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>

          <div className="flex-1 min-w-0">
            {selectedChild ? (
              <div>
                <h1 className="font-bold text-slate-800 text-base leading-tight truncate">
                  {selectedChild.name}
                </h1>
                <p className="text-xs text-slate-500 truncate">
                  {selectedChild.grade} · {selectedChild.section} · {selectedChild.rollNumber}
                </p>
              </div>
            ) : (
              <h1 className="font-bold text-slate-800 text-base">Dashboard</h1>
            )}
          </div>

          {/* School name badge (desktop) */}
          {selectedChild && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-xl border border-blue-100">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              </svg>
              <span className="text-xs font-semibold text-blue-700 truncate max-w-[200px]">
                {selectedChild.school}
              </span>
            </div>
          )}
        </header>

        {/* Content area */}
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {selectedChild ? (
            <>
              {/* Fee summary bar */}
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800">Fee Details</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {parentData.children.find((c) => c.id === selectedChild.id) &&
                      (() => {
                        const fees = Object.values(selectedChild.fees);
                        const paid = fees.filter((f) => f.paid).length;
                        return `${paid} of ${fees.length} fees paid · Term 1 – 2026`;
                      })()
                    }
                  </p>
                </div>

                {/* Summary chips */}
                <div className="flex gap-2 ml-auto flex-wrap">
                  {(() => {
                    const fees = Object.values(selectedChild.fees);
                    const paidAmt = fees.filter((f) => f.paid).reduce((s, f) => s + f.amount, 0);
                    const dueAmt = fees.filter((f) => !f.paid).reduce((s, f) => s + f.amount, 0);
                    return (
                      <>
                        {paidAmt > 0 && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="#15803d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Paid ₹{new Intl.NumberFormat("en-IN").format(paidAmt)}
                          </span>
                        )}
                        {dueAmt > 0 && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                              <circle cx="6" cy="6" r="5" stroke="#92400e" strokeWidth="1.5"/>
                              <path d="M6 3.5v3M6 8.5v.5" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                            Due ₹{new Intl.NumberFormat("en-IN").format(dueAmt)}
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Fee cards grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                <FeeCard type="school" child={selectedChild} index={0} />
                <FeeCard type="transportation" child={selectedChild} index={1} />
                <FeeCard type="hostel" child={selectedChild} index={2} />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0b54ab" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <p className="text-slate-700 font-semibold">Select a child</p>
              <p className="text-slate-400 text-sm mt-1">
                Choose a child from the sidebar to view fee details.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
