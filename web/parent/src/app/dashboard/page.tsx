"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { isAuthenticated, getParent } from "@/lib/auth";
import {
  fetchDashboard,
  fetchFees,
  logout,
  type DashboardChild,
  type DashboardResponse,
  type Fee,
} from "@/lib/parent-portal";
import { apiErrorMessage } from "@/lib/api";
import { FeeCard } from "@/components/FeeCard";

const AVATAR_COLORS = [
  { bg: "#dbeafe", text: "#1d4ed8" },
  { bg: "#fce7f3", text: "#be185d" },
  { bg: "#d1fae5", text: "#065f46" },
  { bg: "#fef3c7", text: "#92400e" },
  { bg: "#ede9fe", text: "#5b21b6" },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function inr(n: number | string) {
  const v = typeof n === "string" ? Number(n) : n;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(v) ? v : 0);
}

export default function DashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [parent, setParentState] = useState<{ name: string; email: string } | null>(
    null,
  );
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [fees, setFees] = useState<Fee[]>([]);
  const [feesLoading, setFeesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    const stored = getParent();
    if (stored) setParentState({ name: stored.name, email: stored.email });

    fetchDashboard()
      .then((data) => {
        setDashboard(data);
        if (data.children.length > 0) {
          setSelectedChildId(data.children[0].student.id);
        }
      })
      .catch((err) => setError(apiErrorMessage(err, "Could not load dashboard.")));
  }, [router]);

  useEffect(() => {
    if (!selectedChildId) {
      setFees([]);
      return;
    }
    setFeesLoading(true);
    fetchFees(selectedChildId)
      .then((data) => setFees(data))
      .catch((err) => setError(apiErrorMessage(err, "Could not load fees.")))
      .finally(() => setFeesLoading(false));
  }, [selectedChildId]);

  const refreshAfterPayment = useCallback(() => {
    fetchDashboard()
      .then(setDashboard)
      .catch((err) =>
        setError(apiErrorMessage(err, "Could not refresh dashboard.")),
      );
    if (selectedChildId) {
      setFeesLoading(true);
      fetchFees(selectedChildId)
        .then(setFees)
        .catch((err) =>
          setError(apiErrorMessage(err, "Could not refresh fees.")),
        )
        .finally(() => setFeesLoading(false));
    }
  }, [selectedChildId]);

  const handleLogout = useCallback(async () => {
    await logout(); // logout itself does the hard nav to /login
  }, []);

  const selectedChild: DashboardChild | undefined = useMemo(
    () => dashboard?.children.find((c) => c.student.id === selectedChildId),
    [dashboard, selectedChildId],
  );

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#f1f5f9" }}>
      {/* ── Sidebar ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed top-0 left-0 h-full z-40 flex flex-col bg-white border-r border-slate-200 transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:static md:translate-x-0 md:z-auto`}
        style={{ width: 256 }}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-white shadow border border-slate-100 flex-shrink-0 p-0.5">
            <Image src="/svbk_logo.webp" alt="SVBK" width={36} height={36} className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <p className="font-extrabold text-slate-800 text-sm leading-tight truncate">SVBK</p>
            <p className="text-xs text-slate-500 truncate">Parent Portal</p>
          </div>
        </div>

        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">{parent?.name ?? "Parent"}</p>
              <p className="text-xs text-slate-500 truncate">{parent?.email}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          <p className="px-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">My Children</p>
          <nav className="flex flex-col gap-1 px-3">
            {!dashboard && (
              <p className="px-3 py-2 text-xs text-slate-400">Loading…</p>
            )}
            {dashboard?.children.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-400">No children linked yet.</p>
            )}
            {dashboard?.children.map((child, i) => {
              const isActive = selectedChildId === child.student.id;
              const avatar = AVATAR_COLORS[i % AVATAR_COLORS.length];
              return (
                <button
                  key={child.student.id}
                  onClick={() => {
                    setSelectedChildId(child.student.id);
                    setSidebarOpen(false);
                  }}
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
                    {getInitials(child.student.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight truncate" style={{ color: isActive ? "#1d4ed8" : "#1e293b" }}>
                      {child.student.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {child.student.class} · {child.student.section}
                    </p>
                  </div>
                  {child.amountDue > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      Due
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

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

      {/* ── Main ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header
          className="h-16 flex items-center px-4 sm:px-6 gap-4 bg-white border-b border-slate-200 sticky top-0 z-20"
          style={{ boxShadow: "0 1px 3px rgb(0 0 0 / 0.05)" }}
        >
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
                  {selectedChild.student.name}
                </h1>
                <p className="text-xs text-slate-500 truncate">
                  {selectedChild.student.class} · {selectedChild.student.section} · {selectedChild.student.rollNo} · Adm {selectedChild.student.admissionNumber}
                </p>
              </div>
            ) : (
              <h1 className="font-bold text-slate-800 text-base">Dashboard</h1>
            )}
          </div>
          <a
            href="/feed"
            className="ml-auto text-sm font-semibold text-[#0b54ab] hover:underline"
          >
            School feed →
          </a>
        </header>

        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm" role="alert">
              {error}
            </div>
          )}

          {dashboard && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <StatCard label="Total Paid" value={inr(dashboard.summary.totalPaid)} tone="green" />
                <StatCard label="Total Due" value={inr(dashboard.summary.totalDue)} tone="amber" />
                <StatCard label="Penalty" value={inr(dashboard.summary.totalPenalty)} tone="slate" />
                <StatCard
                  label="Pending Clearance"
                  value={inr(dashboard.summary.totalPendingClearance ?? 0)}
                  tone="blue"
                />
              </div>
              {dashboard.summary.totalPendingClearance > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-800">
                  You have <strong>{inr(dashboard.summary.totalPendingClearance)}</strong>{" "}
                  in cheque/DD payments awaiting bank clearance — they're with the
                  school but not yet recognised. Once cleared they'll move to
                  Total Paid.
                </div>
              )}
            </>
          )}

          {!selectedChild && dashboard?.children.length === 0 && (
            <EmptyState
              title="No children linked"
              body="Ask your school admin to link your account to your child's admission number."
            />
          )}

          {selectedChild && (
            <>
              <div className="mb-4">
                <h2 className="text-lg font-extrabold text-slate-800">Fee Details</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Academic year {selectedChild.student.academicYear} · {selectedChild.feesCount} fee record(s)
                </p>
              </div>

              {feesLoading ? (
                <p className="text-sm text-slate-500">Loading fees…</p>
              ) : fees.length === 0 ? (
                <EmptyState
                  title="No fees yet"
                  body="No fee records were found for this child."
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                  {fees.map((fee) => (
                    <FeeCard
                      key={fee.id}
                      fee={fee}
                      onPaid={refreshAfterPayment}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "slate" | "blue";
}) {
  const palette = {
    green: { bg: "#dcfce7", text: "#15803d" },
    amber: { bg: "#fef3c7", text: "#92400e" },
    slate: { bg: "#f1f5f9", text: "#334155" },
    blue: { bg: "#dbeafe", text: "#1d4ed8" },
  }[tone];
  return (
    <div
      className="rounded-xl p-4 border"
      style={{ backgroundColor: palette.bg, borderColor: "transparent" }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: palette.text }}>
        {label}
      </p>
      <p className="mt-1 text-xl font-extrabold" style={{ color: palette.text }}>
        {value}
      </p>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0b54ab" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
      <p className="text-slate-700 font-semibold">{title}</p>
      <p className="text-slate-400 text-sm mt-1 max-w-sm">{body}</p>
    </div>
  );
}
