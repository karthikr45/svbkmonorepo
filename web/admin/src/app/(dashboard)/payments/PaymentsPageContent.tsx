"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui";
import { getApiErrorMessage } from "@/lib/api-client";
import { getStoredToken } from "@/features/auth/services";
import {
  listPendingClearanceApi,
  receiptUrl,
  recordOfflinePaymentApi,
  updateClearanceApi,
  type OfflinePaymentType,
  type PendingClearancePayment,
  type RecordOfflinePaymentBody,
} from "@/features/payments/api/payments.api";

type TabId = "pending" | "record";

export function PaymentsPageContent() {
  const [tab, setTab] = useState<TabId>("pending");

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Record offline payments (Cash · Cheque · DD · POS · NEFT) and clear pending bank submissions."
      />

      <div
        className="mb-6 inline-flex items-center gap-1 rounded-xl border p-1 bg-white"
        style={{ borderColor: "var(--app-card-border)" }}
      >
        {[
          { id: "pending" as const, label: "Pending cheques" },
          { id: "record" as const, label: "Record payment" },
        ].map(({ id, label }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
              style={{
                backgroundColor: active ? "var(--app-brand-soft)" : "transparent",
                color: active ? "var(--app-brand)" : "var(--app-text-secondary)",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === "pending" ? <PendingClearancePanel /> : <RecordPaymentPanel />}
    </div>
  );
}

// ─── Pending cheques panel ─────────────────────────────────────────

function PendingClearancePanel() {
  const [items, setItems] = useState<PendingClearancePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    listPendingClearanceApi()
      .then((res) => {
        setItems(Array.isArray(res) ? res : (res as any)?.data ?? []);
      })
      .catch((err) =>
        setError(getApiErrorMessage(err, "Could not load pending cheques")),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleClearance(
    id: string,
    status: "CLEARED" | "BOUNCED",
    notes?: string,
  ) {
    setBusyId(id);
    try {
      await updateClearanceApi(id, status, notes);
      reload();
    } catch (err) {
      alert(getApiErrorMessage(err, "Could not update clearance"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card padding="none" className="overflow-hidden">
      {loading ? (
        <p className="p-8 text-center text-sm text-[var(--app-text-secondary)]">
          Loading…
        </p>
      ) : error ? (
        <div className="m-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth={2}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-[var(--app-text-primary)]">
            No pending cheques
          </h3>
          <p className="mt-1 text-sm text-[var(--app-text-secondary)] max-w-sm mx-auto">
            Every cheque and DD submitted to your branch has been cleared or bounced.
          </p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/60 border-b border-slate-100">
              <Th>Receipt</Th>
              <Th>Type</Th>
              <Th>Student</Th>
              <Th>Bank</Th>
              <Th>Drawer</Th>
              <Th align="right">Amount</Th>
              <Th>Submitted</Th>
              <Th align="right"></Th>
            </tr>
          </thead>
          <tbody>
            {items.map((p, i) => (
              <tr
                key={p.id}
                className={`hover:bg-slate-50 transition-colors ${i !== items.length - 1 ? "border-b border-slate-50" : ""}`}
              >
                <td className="px-5 py-3.5 text-[var(--app-text-secondary)] tabular-nums whitespace-nowrap">
                  {p.receiptNumber ?? p.id.slice(0, 8)}
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold"
                    style={{ backgroundColor: "#dbeafe", color: "#1d4ed8" }}
                  >
                    {p.paymentType}
                    <span className="font-normal opacity-70">
                      #{p.paymentType === "DD" ? p.ddNumber : p.chequeNumber}
                    </span>
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  {p.student ? (
                    <div className="leading-tight">
                      <div className="font-semibold text-[var(--app-text-primary)]">
                        {p.student.name}
                      </div>
                      <div className="text-xs text-[var(--app-text-secondary)] tabular-nums">
                        {p.student.admissionNumber} · {p.student.class}-{p.student.section}
                      </div>
                    </div>
                  ) : (
                    <span className="text-[var(--app-text-muted)]">—</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-[var(--app-text-secondary)]">
                  {p.bankName}
                  {p.bankBranch && (
                    <div className="text-xs text-[var(--app-text-muted)]">
                      {p.bankBranch}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3.5 text-[var(--app-text-secondary)]">
                  {p.drawerName ?? "—"}
                </td>
                <td className="px-5 py-3.5 text-right font-bold text-[var(--app-text-primary)] tabular-nums whitespace-nowrap">
                  {inr(Number(p.amount))}
                </td>
                <td className="px-5 py-3.5 text-[var(--app-text-secondary)] tabular-nums whitespace-nowrap">
                  {new Date(p.paidAt).toLocaleDateString("en-IN", {
                    day: "2-digit", month: "short", year: "numeric",
                  })}
                </td>
                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                  <button
                    onClick={() =>
                      handleClearance(p.id, "CLEARED")
                    }
                    disabled={busyId === p.id}
                    className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold mr-1.5 transition-colors disabled:opacity-50"
                    style={{ backgroundColor: "#dcfce7", color: "#15803d" }}
                  >
                    Mark cleared
                  </button>
                  <button
                    onClick={() => {
                      const reason = prompt(
                        "Reason for bounce (e.g. insufficient funds)?",
                      );
                      if (reason !== null) handleClearance(p.id, "BOUNCED", reason);
                    }}
                    disabled={busyId === p.id}
                    className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold transition-colors disabled:opacity-50"
                    style={{ backgroundColor: "#fee2e2", color: "#b91c1c" }}
                  >
                    Bounced
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

// ─── Record offline payment panel ──────────────────────────────────

function RecordPaymentPanel() {
  const [feeId, setFeeId] = useState("");
  const [type, setType] = useState<OfflinePaymentType>("CASH");
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  // Cheque
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  // DD
  const [ddNumber, setDdNumber] = useState("");
  const [ddDate, setDdDate] = useState("");
  // Bank
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [drawerName, setDrawerName] = useState("");
  // POS / NEFT
  const [transactionId, setTransactionId] = useState("");
  const [cardLast4, setCardLast4] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    receiptNumber: string;
    paymentId: string;
  } | null>(null);

  const requiresBank = type === "CHEQUE" || type === "DD" || type === "NEFT";
  const requiresDrawer = type === "CHEQUE" || type === "DD";
  const requiresTxn = type === "POS" || type === "NEFT";

  function reset() {
    setAmount(""); setNotes("");
    setChequeNumber(""); setChequeDate("");
    setDdNumber(""); setDdDate("");
    setBankName(""); setBankBranch(""); setDrawerName("");
    setTransactionId(""); setCardLast4("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!feeId.trim()) return setError("Fee ID is required");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return setError("Amount must be > 0");
    const body: RecordOfflinePaymentBody = {
      paymentType: type,
      amount: amt,
      paidAt: new Date(paidAt).toISOString(),
      notes: notes || undefined,
      chequeNumber: type === "CHEQUE" ? chequeNumber : undefined,
      chequeDate: type === "CHEQUE" ? chequeDate : undefined,
      ddNumber: type === "DD" ? ddNumber : undefined,
      ddDate: type === "DD" ? ddDate : undefined,
      bankName: requiresBank ? bankName : undefined,
      bankBranch: requiresBank ? bankBranch || undefined : undefined,
      drawerName: requiresDrawer ? drawerName : undefined,
      transactionId: requiresTxn ? transactionId : undefined,
      cardLast4: type === "POS" && cardLast4 ? cardLast4 : undefined,
    };
    setSubmitting(true);
    try {
      const res = (await recordOfflinePaymentApi(feeId.trim(), body)) as {
        id?: string;
        receiptNumber?: string;
        data?: { id?: string; receiptNumber?: string };
      };
      const inner = (res?.data ?? res) as { id?: string; receiptNumber?: string };
      setSuccess({
        receiptNumber: inner?.receiptNumber ?? "—",
        paymentId: inner?.id ?? "",
      });
      reset();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not record payment"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card padding="default">
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <Field label="Fee ID" required hint="Find this in the Students table → fee row → Edit">
            <input
              value={feeId}
              onChange={(e) => setFeeId(e.target.value)}
              placeholder="e.g. f47c2c25-…"
              className="form-input"
              required
            />
          </Field>
          <Field label="Payment type" required>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as OfflinePaymentType)}
              className="form-input"
            >
              <option value="CASH">Cash</option>
              <option value="CHEQUE">Cheque</option>
              <option value="DD">Demand Draft</option>
              <option value="POS">POS (Card swipe)</option>
              <option value="NEFT">NEFT / Bank Transfer</option>
            </select>
          </Field>
          <Field label="Amount (₹)" required>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 5000"
              className="form-input"
              required
            />
          </Field>
          <Field label="Paid on" required>
            <input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="form-input"
              required
            />
          </Field>
        </div>

        {/* Cheque-specific */}
        {type === "CHEQUE" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            <Field label="Cheque number" required>
              <input
                value={chequeNumber}
                onChange={(e) => setChequeNumber(e.target.value)}
                className="form-input"
                required
              />
            </Field>
            <Field label="Cheque date" required>
              <input
                type="date"
                value={chequeDate}
                onChange={(e) => setChequeDate(e.target.value)}
                className="form-input"
                required
              />
            </Field>
          </div>
        )}

        {/* DD-specific */}
        {type === "DD" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            <Field label="DD number" required>
              <input
                value={ddNumber}
                onChange={(e) => setDdNumber(e.target.value)}
                className="form-input"
                required
              />
            </Field>
            <Field label="DD date" required>
              <input
                type="date"
                value={ddDate}
                onChange={(e) => setDdDate(e.target.value)}
                className="form-input"
                required
              />
            </Field>
          </div>
        )}

        {/* Bank fields (cheque/DD/NEFT) */}
        {requiresBank && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            <Field label="Bank name" required>
              <input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="State Bank of India"
                className="form-input"
                required
              />
            </Field>
            <Field label="Branch (optional)">
              <input
                value={bankBranch}
                onChange={(e) => setBankBranch(e.target.value)}
                placeholder="Hyderabad — Banjara Hills"
                className="form-input"
              />
            </Field>
          </div>
        )}
        {requiresDrawer && (
          <div className="grid grid-cols-1 gap-5 mb-5">
            <Field label="Drawer name" required hint="As written on the cheque/DD">
              <input
                value={drawerName}
                onChange={(e) => setDrawerName(e.target.value)}
                placeholder="Ramesh Kumar"
                className="form-input"
                required
              />
            </Field>
          </div>
        )}

        {/* POS / NEFT */}
        {requiresTxn && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            <Field
              label={type === "POS" ? "Terminal txn id" : "UTR / Txn id"}
              required
            >
              <input
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder={type === "POS" ? "POS-TXN-99887766" : "UTR123456789"}
                className="form-input"
                required
              />
            </Field>
            {type === "POS" && (
              <Field label="Card last 4 (optional)">
                <input
                  value={cardLast4}
                  onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="4242"
                  maxLength={4}
                  className="form-input"
                />
              </Field>
            )}
          </div>
        )}

        <Field label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="form-input min-h-[60px] py-2"
            placeholder="Any free-text remark…"
          />
        </Field>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-sm text-emerald-800 flex items-center justify-between">
            <span>
              Payment recorded · receipt{" "}
              <strong className="tabular-nums">{success.receiptNumber}</strong>
            </span>
            {success.paymentId && (
              <button
                type="button"
                onClick={() => printReceipt(success.paymentId)}
                className="text-xs font-semibold text-emerald-800 underline"
              >
                Open receipt →
              </button>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Button type="submit" variant="primary" isLoading={submitting}>
            Record payment
          </Button>
        </div>

        <style jsx>{`
          :global(.form-input) {
            height: 40px;
            padding: 0 12px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            background: #ffffff;
            font-size: 14px;
            color: #0f172a;
            outline: none;
            width: 100%;
            transition: border-color 0.15s, box-shadow 0.15s;
          }
          :global(.form-input:focus) {
            border-color: var(--app-brand);
            box-shadow: 0 0 0 3px rgb(11 84 171 / 0.15);
          }
        `}</style>
      </form>
    </Card>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────

function inr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
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
      className={`px-5 py-3 text-${align} text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--app-text-muted)] whitespace-nowrap`}
    >
      {children}
    </th>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--app-text-secondary)]">
        {label}
        {required && <span className="text-red-500 normal-case"> *</span>}
      </span>
      {children}
      {hint && (
        <span className="text-xs text-[var(--app-text-muted)]">{hint}</span>
      )}
    </label>
  );
}

/**
 * Open the printable HTML receipt in a new tab. The endpoint requires
 * Bearer auth so we fetch + open as a Blob URL like the Excel template
 * download.
 */
async function printReceipt(paymentId: string) {
  try {
    const url = receiptUrl(paymentId);
    const token = getStoredToken();
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const blob = new Blob([html], { type: "text/html" });
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (err) {
    alert(getApiErrorMessage(err, "Could not open receipt"));
  }
}
