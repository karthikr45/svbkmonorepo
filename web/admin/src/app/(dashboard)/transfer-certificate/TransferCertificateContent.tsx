"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  issueTcApi,
  listEnrollmentsByAdmissionApi,
  revokeTcApi,
  type EnrollmentSummary,
} from "@/features/student-identities/api/student-identities.api";

/**
 * Self-contained Transfer Certificate screen. No identity backfill
 * required — search by admission number, the screen lists every
 * enrollment row for that admission (and, if identities are linked,
 * the full history), and TC is issued directly on the student row.
 */
export function TransferCertificateContent() {
  const [admission, setAdmission] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [rows, setRows] = useState<EnrollmentSummary[] | null>(null);
  const [tcFor, setTcFor] = useState<EnrollmentSummary | null>(null);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    const adm = admission.trim();
    if (!adm) {
      setError("Enter an admission number.");
      return;
    }
    setSearching(true);
    setError(null);
    setInfo(null);
    setRows(null);
    try {
      const res = await listEnrollmentsByAdmissionApi(adm);
      if (!res.enrollments || res.enrollments.length === 0) {
        setInfo(`No student found with admission number "${adm}".`);
        setRows([]);
      } else {
        setRows(res.enrollments);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Search failed"));
    } finally {
      setSearching(false);
    }
  }

  async function revoke(row: EnrollmentSummary) {
    if (!confirm(`Revoke TC for admission ${row.admissionNumber} (${row.academicYear})?`)) {
      return;
    }
    try {
      await revokeTcApi(row.id);
      setInfo(`TC revoked for ${row.admissionNumber}.`);
      search();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not revoke TC"));
    }
  }

  return (
    <div className="p-6 sm:p-8 max-w-[1000px] mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Transfer Certificate
        </h1>
        <p className="mt-1.5 text-sm text-slate-500 max-w-2xl">
          Search a student by admission number, then issue or revoke a TC.
          Existing fees, payments and receipts are preserved — a TC simply
          closes the enrollment and removes it from active rosters.
        </p>
      </header>

      <Card padding="default" className="mb-5">
        <form onSubmit={search} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5 flex-1 min-w-[240px]">
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
              Admission number
            </span>
            <input
              value={admission}
              onChange={(e) => setAdmission(e.target.value)}
              placeholder="e.g. ADM-2024-001"
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-[#0b54ab] focus:ring-2 focus:ring-[#0b54ab]/20"
              autoFocus
            />
          </label>
          <Button variant="primary" type="submit" isLoading={searching}>
            Search
          </Button>
        </form>
      </Card>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
          {error}
        </div>
      )}
      {info && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-700">
          {info}
        </div>
      )}

      {rows && rows.length > 0 && (
        <Card padding="none" className="overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">
              Enrollments for {admission.trim()}
            </h3>
            <p className="text-xs text-slate-500">
              {rows.length === 1
                ? "1 enrollment record."
                : `${rows.length} enrollment records (across years / re-admissions).`}
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-100">
                <Th>Admission</Th>
                <Th>Year</Th>
                <Th>Class / Sec / Roll</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.id}
                  className={`hover:bg-slate-50 ${i !== rows.length - 1 ? "border-b border-slate-50" : ""}`}
                >
                  <td className="px-5 py-3 font-mono font-semibold text-slate-900">
                    {r.admissionNumber}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-slate-600">
                    {r.academicYear}
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {r.class}-{r.section} · Roll {r.rollNo} · {r.branch}
                  </td>
                  <td className="px-5 py-3">
                    {r.tcIssuedAt ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-slate-200 text-slate-700"
                        title={`Issued ${new Date(r.tcIssuedAt).toLocaleDateString("en-IN")}`}
                      >
                        TC issued
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-emerald-50 text-emerald-700">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right space-x-3">
                    <Link
                      href={`/payments?admission=${encodeURIComponent(r.admissionNumber)}&academicYear=${encodeURIComponent(r.academicYear)}`}
                      className="text-xs font-semibold text-[#0b54ab] hover:underline"
                    >
                      Payments
                    </Link>
                    {r.tcIssuedAt ? (
                      <button
                        onClick={() => revoke(r)}
                        className="text-xs font-semibold text-amber-600 hover:underline"
                      >
                        Revoke TC
                      </button>
                    ) : (
                      <button
                        onClick={() => setTcFor(r)}
                        className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg"
                      >
                        Issue TC
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tcFor && (
        <TcDialog
          enrollment={tcFor}
          onClose={() => setTcFor(null)}
          onIssued={() => {
            setTcFor(null);
            setInfo(`TC issued for ${tcFor.admissionNumber}.`);
            search();
          }}
        />
      )}
    </div>
  );
}

function TcDialog({
  enrollment,
  onClose,
  onIssued,
}: {
  enrollment: EnrollmentSummary;
  onClose: () => void;
  onIssued: () => void;
}) {
  const [reason, setReason] = useState("");
  const [certificateNo, setCertificateNo] = useState("");
  const [issuedAt, setIssuedAt] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await issueTcApi(enrollment.id, {
        reason: reason.trim() || undefined,
        certificateNo: certificateNo.trim() || undefined,
        issuedAt: new Date(issuedAt).toISOString(),
      });
      onIssued();
    } catch (e2) {
      setErr(getApiErrorMessage(e2, "Could not issue TC"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(ev) => ev.stopPropagation()}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Issue Transfer Certificate</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <p>
              <span className="font-semibold">Admission</span>{" "}
              {enrollment.admissionNumber} · {enrollment.academicYear}
            </p>
            <p className="mt-0.5">
              Class {enrollment.class}-{enrollment.section} · Roll {enrollment.rollNo}
            </p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
              Date of TC
            </span>
            <input
              type="date"
              value={issuedAt}
              onChange={(e) => setIssuedAt(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-[#0b54ab] focus:ring-2 focus:ring-[#0b54ab]/20"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
              TC certificate no. (optional)
            </span>
            <input
              value={certificateNo}
              onChange={(e) => setCertificateNo(e.target.value)}
              placeholder="e.g. TC-2025-042"
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-[#0b54ab] focus:ring-2 focus:ring-[#0b54ab]/20"
              maxLength={50}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
              Reason (optional)
            </span>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Moving abroad / parent transfer / etc."
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-[#0b54ab] focus:ring-2 focus:ring-[#0b54ab]/20"
              maxLength={500}
            />
          </label>

          {err && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
              {err}
            </div>
          )}

          <p className="text-[11px] text-slate-500">
            Existing fees, payments and receipts on this enrollment are kept.
            Unpaid dues can still be collected later from Payment Details.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={busy}>
              Issue TC
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-5 py-3 text-${align} text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500`}
    >
      {children}
    </th>
  );
}
