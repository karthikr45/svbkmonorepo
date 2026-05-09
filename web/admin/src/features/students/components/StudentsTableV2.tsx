"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import { getApiErrorMessage } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/env";
import {
  getAcademicYearsApi,
  getStudentsDetailsByBranchApi,
} from "@/features/students/api/students.api";
import { AddStudentModal } from "./AddStudentModal";
import type {
  AcademicYearItem,
  StudentFeeRow,
  TermFeeItem,
} from "@/features/students/types";

/**
 * Premium "Students" table that matches the product spec for TS/AP schools:
 *
 *   Identity columns:
 *     Name · Email · Phone · Adm No · Class · Section · Roll No
 *
 *   Per-term columns (up to 5):
 *     <N>th Term Fee · <N>th Term After Discount · <N>th Term Status
 *
 *   Filters: Academic Year · Class
 *   Actions: Download Excel template · Upload Excel · Add student
 */

const TERMS = [
  "1st Term Fee",
  "2nd Term Fee",
  "3rd Term Fee",
  "4th Term Fee",
  "5th Term Fee",
] as const;

const TERM_LABELS = ["1st", "2nd", "3rd", "4th", "5th"] as const;

/**
 * The API has a global TransformInterceptor that wraps responses in
 * { success, data, ... }. Some api-client wrappers unwrap once to .data,
 * others don't. List endpoints can return any of:
 *
 *   [item, …]                               // bare array
 *   { results: [...] }                      // older shape
 *   { items: [...], total }                 // paginated
 *   { data: [...] }                         // wrapped once
 *   { data: { items: [...], total } }       // wrapped paginated
 *   { data: { results: [...] } }            // wrapped older shape
 *
 * Unwrap defensively so the table never crashes on shape drift.
 */
function unwrapList<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (!res || typeof res !== "object") return [];
  const obj = res as Record<string, unknown>;

  if (Array.isArray(obj.results)) return obj.results as T[];
  if (Array.isArray(obj.items)) return obj.items as T[];

  if (obj.data && typeof obj.data === "object") {
    const inner = obj.data as Record<string, unknown>;
    if (Array.isArray(inner)) return inner as unknown as T[];
    if (Array.isArray(inner.results)) return inner.results as T[];
    if (Array.isArray(inner.items)) return inner.items as T[];
  }
  if (Array.isArray(obj.data)) return obj.data as T[];
  return [];
}

interface Props {
  onUpload: () => void;
  onShowLegacy?: () => void;
}

export function StudentsTableV2({ onUpload, onShowLegacy }: Props) {
  const [years, setYears] = useState<AcademicYearItem[]>([]);
  const [year, setYear] = useState<string>("");
  const [classFilter, setClassFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState<StudentFeeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Load academic years on mount
  useEffect(() => {
    getAcademicYearsApi()
      .then((res) => {
        const list = unwrapList<AcademicYearItem>(res);
        setYears(list);
        const current = list.find((y) => y.isCurrentYear) ?? list[0];
        if (current) setYear(current.academicYear);
      })
      .catch((err) =>
        setError(getApiErrorMessage(err, "Could not load academic years")),
      );
  }, []);

  // Load students whenever year changes (or after a create)
  useEffect(() => {
    if (!year) return;
    setLoading(true);
    setError(null);
    getStudentsDetailsByBranchApi("", year, { page: 1, pageSize: 200 })
      .then((res) => {
        setStudents(unwrapList<StudentFeeRow>(res));
      })
      .catch((err) =>
        setError(getApiErrorMessage(err, "Could not load students")),
      )
      .finally(() => setLoading(false));
  }, [year, reloadKey]);

  const classes = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => s.class && set.add(s.class));
    return [...set].sort();
  }, [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (classFilter && s.class !== classFilter) return false;
      if (!q) return true;
      return (
        s.name?.toLowerCase().includes(q) ||
        s.admissionNumber?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q)
      );
    });
  }, [students, classFilter, search]);

  function downloadTemplate(format: "xlsx" | "csv" = "xlsx") {
    try {
      const url = `${getApiBaseUrl()}/students/upload/template?format=${format}`;
      window.location.href = url;
    } catch (err) {
      alert(getApiErrorMessage(err, "Could not start download"));
    }
  }

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle="Bulk upload via Excel or add one at a time. Each row shows fees per term — original, after-discount, and current status."
        meta={
          !loading && (
            <span className="inline-flex h-6 items-center rounded-full bg-slate-100 px-2.5 text-xs font-semibold text-slate-700 tabular-nums">
              {filtered.length}
            </span>
          )
        }
        actions={
          <>
            <div className="inline-flex rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => downloadTemplate("xlsx")}
                className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                title="Download Excel template (with samples + instructions)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0 0l-4-4m4 4l4-4" />
                </svg>
                Excel template
              </button>
              <button
                type="button"
                onClick={() => downloadTemplate("csv")}
                className="px-2.5 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700 border-l border-slate-200 transition-colors"
                title="Download CSV instead"
              >
                CSV
              </button>
            </div>
            <Button variant="outline" size="md" onClick={onUpload}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Upload Excel
            </Button>
            <Button variant="primary" size="md" onClick={() => setAddOpen(true)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Add student
            </Button>
          </>
        }
      />

      {/* Filters */}
      <Card padding="tight" className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <FilterField label="Academic year">
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="filter-input min-w-[140px]"
            >
              {years.length === 0 && <option value="">—</option>}
              {years.map((y) => (
                <option key={y.id} value={y.academicYear}>
                  {y.academicYear}
                  {y.isCurrentYear ? " (current)" : ""}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Class">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="filter-input min-w-[110px]"
            >
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  Class {c}
                </option>
              ))}
            </select>
          </FilterField>
          <div className="flex-1 sm:ml-auto">
            <FilterField label="Search">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, admission, email…"
                  className="filter-input pl-9 w-full"
                />
              </div>
            </FilterField>
          </div>
          {onShowLegacy && (
            <button
              onClick={onShowLegacy}
              className="text-xs font-semibold text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)] underline self-end"
              title="Open the legacy detailed view"
            >
              Legacy view
            </button>
          )}
        </div>

        <style jsx>{`
          :global(.filter-input) {
            height: 38px;
            padding: 0 12px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            background: #ffffff;
            font-size: 13.5px;
            color: #0f172a;
            outline: none;
            transition: border-color 0.15s, box-shadow 0.15s;
          }
          :global(.filter-input:focus) {
            border-color: var(--app-brand);
            box-shadow: 0 0 0 3px rgb(11 84 171 / 0.15);
          }
        `}</style>
      </Card>

      {/* Error */}
      {error && (
        <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-100">
                {/* Identity */}
                <Th sticky>Name</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th>Adm No.</Th>
                <Th align="center">Class</Th>
                <Th align="center">Sec</Th>
                <Th align="center">Roll</Th>
                {/* Per term */}
                {TERM_LABELS.map((label) => (
                  <ThGroup key={label} label={label} />
                ))}
              </tr>
              <tr className="bg-slate-50/40 border-b border-slate-100 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-muted)]">
                <td colSpan={7}></td>
                {TERM_LABELS.map((label) => (
                  <SubHeaders key={label} />
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7 + 5 * 3} className="px-5 py-12 text-center text-sm text-[var(--app-text-secondary)]">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7 + 5 * 3} className="px-5 py-16 text-center">
                    <EmptyState onUpload={onUpload} />
                  </td>
                </tr>
              ) : (
                filtered.map((s, i) => (
                  <tr
                    key={s.id ?? s._id ?? i}
                    className={`hover:bg-slate-50 transition-colors ${i !== filtered.length - 1 ? "border-b border-slate-50" : ""}`}
                  >
                    <td className="sticky left-0 z-10 bg-white px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={s.name} />
                        <span className="font-semibold text-[var(--app-text-primary)] whitespace-nowrap">
                          {s.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[var(--app-text-secondary)] whitespace-nowrap">{s.email}</td>
                    <td className="px-5 py-3.5 text-[var(--app-text-secondary)] tabular-nums whitespace-nowrap">{s.phone}</td>
                    <td className="px-5 py-3.5 text-[var(--app-text-secondary)] tabular-nums whitespace-nowrap">{s.admissionNumber}</td>
                    <td className="px-5 py-3.5 text-center text-[var(--app-text-secondary)] tabular-nums">{s.class}</td>
                    <td className="px-5 py-3.5 text-center text-[var(--app-text-secondary)]">{s.section}</td>
                    <td className="px-5 py-3.5 text-center text-[var(--app-text-secondary)] tabular-nums">{s.rollNo}</td>
                    {TERMS.map((termKey) => {
                      const t = s.termFees?.[termKey];
                      return <TermCells key={termKey} term={t} />;
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <AddStudentModal
        open={addOpen}
        defaultAcademicYear={year}
        onClose={() => setAddOpen(false)}
        onCreated={() => setReloadKey((k) => k + 1)}
      />
    </div>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--app-text-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Th({
  children,
  align = "left",
  sticky = false,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  sticky?: boolean;
}) {
  return (
    <th
      className={`px-5 py-3 text-${align} text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--app-text-muted)] whitespace-nowrap ${sticky ? "sticky left-0 z-10 bg-slate-50" : ""}`}
    >
      {children}
    </th>
  );
}

function ThGroup({ label }: { label: string }) {
  return (
    <th
      colSpan={3}
      className="px-3 py-2 text-center text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--app-brand)] border-l border-slate-100 bg-[var(--app-brand-soft)]"
    >
      {label} term
    </th>
  );
}

function SubHeaders() {
  return (
    <>
      <td className="border-l border-slate-100 px-3 py-2 text-right">Fee</td>
      <td className="px-3 py-2 text-right">After Disc.</td>
      <td className="px-3 py-2 text-center">Status</td>
    </>
  );
}

function inr(v?: number) {
  if (v == null || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);
}

function TermCells({ term }: { term?: TermFeeItem }) {
  if (!term || !term.amount) {
    return (
      <>
        <td className="border-l border-slate-100 px-3 py-3 text-right text-[var(--app-text-muted)] tabular-nums">—</td>
        <td className="px-3 py-3 text-right text-[var(--app-text-muted)] tabular-nums">—</td>
        <td className="px-3 py-3 text-center"><Pill status="" /></td>
      </>
    );
  }
  const after =
    term.amountAfterDiscount ??
    Math.max(0, (term.amount ?? 0) - (term.totalDiscount ?? 0));
  return (
    <>
      <td className="border-l border-slate-100 px-3 py-3 text-right text-[var(--app-text-secondary)] tabular-nums whitespace-nowrap">
        {inr(term.amount)}
      </td>
      <td className="px-3 py-3 text-right font-semibold text-[var(--app-text-primary)] tabular-nums whitespace-nowrap">
        {inr(after)}
      </td>
      <td className="px-3 py-3 text-center">
        <Pill status={normaliseStatus(term.paymentStatus)} />
      </td>
    </>
  );
}

function normaliseStatus(raw?: string): "PAID" | "PARTIAL" | "UNPAID" | "" {
  if (!raw) return "";
  const v = raw.toUpperCase();
  if (v === "PAID") return "PAID";
  if (v === "PARTIAL") return "PARTIAL";
  return "UNPAID";
}

function Pill({ status }: { status: "PAID" | "PARTIAL" | "UNPAID" | "" }) {
  if (!status) return <span className="text-[var(--app-text-muted)]">—</span>;
  const styles: Record<string, { bg: string; fg: string; label: string }> = {
    PAID: { bg: "#dcfce7", fg: "#15803d", label: "Paid" },
    PARTIAL: { bg: "#fef3c7", fg: "#92400e", label: "Partial" },
    UNPAID: { bg: "#fee2e2", fg: "#b91c1c", label: "Unpaid" },
  };
  const s = styles[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.fg }} />
      {s.label}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = (name || "?")
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className="h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
      style={{ backgroundColor: "var(--app-brand)" }}
    >
      {initials}
    </div>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="text-slate-500">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-[var(--app-text-primary)]">
        No students for this year yet
      </h3>
      <p className="mt-1 text-sm text-[var(--app-text-secondary)] max-w-md">
        Upload your existing roster as Excel — fee terms and discounts come along too.
      </p>
      <Button onClick={onUpload} variant="primary" size="md" className="mt-4">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Upload Excel
      </Button>
    </div>
  );
}
