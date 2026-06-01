"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  fetchPublicTenant,
  fetchPublicFees,
  initiatePublicPayment,
  verifyPublicPayment,
  publicApiErrorMessage,
  publicReceiptUrl,
  type PublicTenantInfo,
  type PublicFee,
  type PublicFeesResponse,
} from "@/lib/public-pay";

function loadScript(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve(true);
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function inr(n: number | string) {
  const v = typeof n === "string" ? Number(n) : n;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(v) ? v : 0);
}

export default function PublicPayPage() {
  const [tenant, setTenant] = useState<PublicTenantInfo | null>(null);
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [feesData, setFeesData] = useState<PublicFeesResponse | null>(null);
  const [loadingFees, setLoadingFees] = useState(false);
  const [feesError, setFeesError] = useState<string | null>(null);
  const [payingFeeId, setPayingFeeId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  // FeePayment id from /verify — drives the Download Receipt button.
  const [lastReceiptId, setLastReceiptId] = useState<string | null>(null);

  // Read host once on mount, fetch the tenant + AY list.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.host;
    fetchPublicTenant(host)
      .then((t) => {
        setTenant(t);
        const current = t.academicYears.find((y) => y.isCurrent);
        if (current) setAcademicYear(current.academicYear);
        else if (t.academicYears[0])
          setAcademicYear(t.academicYears[0].academicYear);
      })
      .catch((err) => {
        setTenantError(
          publicApiErrorMessage(err, "Could not identify the school for this page."),
        );
      });
  }, []);

  // If Cashfree fell back to a full-page redirect (card 3DS), it
  // returns the parent to /pay?order_id=... — auto-verify so the
  // user lands directly on the success state without re-typing
  // their admission number. Strips the query param after handling
  // so a refresh doesn't re-trigger.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id");
    if (!orderId) return;
    const host = window.location.host;
    verifyPublicPayment({ host, gatewayOrderId: orderId })
      .then((result) => {
        setSuccessMsg("Payment successful.");
        setLastReceiptId(result.feePaymentId ?? null);
        if (result.feePaymentId) {
          try {
            window.open(
              publicReceiptUrl(host, result.feePaymentId),
              "_blank",
              "noopener,noreferrer",
            );
          } catch {
            /* popup blocked */
          }
        }
      })
      .catch((err) => {
        setPayError(
          publicApiErrorMessage(
            err,
            "Could not confirm the payment. Please contact the school office.",
          ),
        );
      })
      .finally(() => {
        // Clean URL so a refresh / share doesn't replay the verify.
        window.history.replaceState(
          null,
          "",
          window.location.pathname,
        );
      });
  }, []);

  const logoSrc = tenant?.logoUrl || "/svbk_logo.webp";
  const isCustomLogo = !!tenant?.logoUrl;

  const canSubmit = useMemo(
    () => !!tenant && !!admissionNumber.trim() && !!academicYear.trim(),
    [tenant, admissionNumber, academicYear],
  );

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant || !canSubmit) return;
    setLoadingFees(true);
    setFeesError(null);
    setFeesData(null);
    setSuccessMsg(null);
    try {
      const host = window.location.host;
      const res = await fetchPublicFees(host, admissionNumber.trim(), academicYear);
      setFeesData(res);
    } catch (err) {
      setFeesError(publicApiErrorMessage(err, "Could not look up fees."));
    } finally {
      setLoadingFees(false);
    }
  }

  async function refreshFees() {
    if (!tenant) return;
    try {
      const host = window.location.host;
      const res = await fetchPublicFees(host, admissionNumber.trim(), academicYear);
      setFeesData(res);
    } catch {
      /* keep prior list; non-fatal */
    }
  }

  async function pay(fee: PublicFee) {
    if (!tenant) return;
    setPayingFeeId(fee.id);
    setPayError(null);
    setSuccessMsg(null);
    try {
      const host = window.location.host;
      const res = await initiatePublicPayment(host, fee.id);
      const gateway = res.payment.gateway ?? "razorpay";
      const raw = res.gatewayResponse as Record<string, unknown>;
      const orderId =
        res.payment.gatewayOrderId ??
        (raw.id as string | undefined) ??
        (raw.order_id as string | undefined);
      if (!orderId) throw new Error("Gateway did not return an order id.");

      async function settle(args: {
        gatewayOrderId: string;
        gatewayPaymentId?: string;
        signature?: string;
      }) {
        try {
          const result = await verifyPublicPayment({ host, ...args });
          setSuccessMsg("Payment successful.");
          setLastReceiptId(result.feePaymentId ?? null);
          // Auto-open the PDF receipt in a new tab so the parent sees
          // confirmation without clicking anything. The visible
          // Download Receipt button stays as a fallback (popup
          // blockers, browser settings).
          if (result.feePaymentId && typeof window !== "undefined") {
            try {
              window.open(
                publicReceiptUrl(window.location.host, result.feePaymentId),
                "_blank",
                "noopener,noreferrer",
              );
            } catch {
              /* popup blocked — Download Receipt button still works */
            }
          }
          // Re-pull the fee list so the just-paid row flips to PAID
          // and the Pay button disappears.
          await refreshFees();
          if (typeof window !== "undefined") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        } catch (err) {
          setPayError(
            publicApiErrorMessage(
              err,
              "Payment was made but confirmation is pending. It will update shortly.",
            ),
          );
        } finally {
          setPayingFeeId(null);
        }
      }

      if (gateway === "razorpay") {
        const ok = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
        if (!ok) throw new Error("Failed to load the Razorpay checkout.");
        const w = window as unknown as {
          Razorpay: new (o: unknown) => { open: () => void };
        };
        const rzp = new w.Razorpay({
          key: res.gatewayPublicKey,
          order_id: orderId,
          amount: res.payment.amount,
          currency: res.payment.currency || "INR",
          name: feesData?.student.name ?? "School Fee",
          description: `${fee.term} · ${fee.academicYear}`,
          handler: (r: {
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            void settle({
              gatewayOrderId: orderId,
              gatewayPaymentId: r.razorpay_payment_id,
              signature: r.razorpay_signature,
            });
          },
          modal: {
            ondismiss: () => {
              setPayingFeeId(null);
              setPayError("Payment cancelled.");
            },
          },
        });
        rzp.open();
      } else {
        const sessionId = raw.payment_session_id as string | undefined;
        if (!sessionId) throw new Error("Cashfree session was not created.");
        const ok = await loadScript("https://sdk.cashfree.com/js/v3/cashfree.js");
        if (!ok) throw new Error("Failed to load the Cashfree checkout.");
        const w = window as unknown as {
          Cashfree: (o: { mode: string }) => {
            checkout: (o: unknown) => Promise<{
              error?: { message?: string };
              redirect?: boolean;
              paymentDetails?: unknown;
            }>;
          };
        };
        // Cashfree v3 Drop-in: Promise-based API. No onSuccess/
        // onFailure props — those silently get dropped and the SDK
        // falls back to redirecting to payments.cashfree.com, which
        // is why the parent saw the checkout open on a new domain.
        const cashfree = w.Cashfree({ mode: res.cashfreeMode ?? "sandbox" });
        const result = await cashfree.checkout({
          paymentSessionId: sessionId,
          redirectTarget: "_modal",
        });
        if (result?.error) {
          // result.error fires for both user-closed-modal and real
          // failures. Run verify anyway — it's a no-op if no payment
          // was attempted, and catches the "user paid but closed
          // before SDK could resolve" edge case.
          await settle({ gatewayOrderId: orderId });
        } else if (result?.paymentDetails) {
          await settle({ gatewayOrderId: orderId });
        }
      }
    } catch (err) {
      setPayError(publicApiErrorMessage(err, "Could not start the payment."));
      setPayingFeeId(null);
    }
  }

  if (tenantError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
          <h1 className="text-lg font-bold text-slate-800 mb-2">
            School not found
          </h1>
          <p className="text-sm text-slate-600">{tenantError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center bg-white">
            <Image
              src={logoSrc}
              alt=""
              width={36}
              height={36}
              className="object-contain p-0.5"
              unoptimized={isCustomLogo}
            />
          </div>
          <div>
            <p className="text-[15px] font-bold text-slate-800 leading-tight">
              Pay School Fees
            </p>
            <p className="text-[11px] text-slate-500">No login required</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <form
          onSubmit={handleLookup}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Academic year
            </label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              disabled={!tenant}
            >
              {!tenant && <option>Loading…</option>}
              {tenant?.academicYears.length === 0 && (
                <option value="">No academic years configured</option>
              )}
              {tenant?.academicYears.map((y) => (
                <option key={y.academicYear} value={y.academicYear}>
                  {y.academicYear}
                  {y.isCurrent ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Admission number
            </label>
            <input
              type="text"
              value={admissionNumber}
              onChange={(e) => setAdmissionNumber(e.target.value)}
              placeholder="Enter admission number"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              autoCapitalize="characters"
            />
          </div>
          <button
            type="submit"
            disabled={!canSubmit || loadingFees}
            className="w-full rounded-lg bg-indigo-600 text-white text-sm font-semibold py-2.5 hover:bg-indigo-700 disabled:opacity-50"
          >
            {loadingFees ? "Looking up…" : "View fees"}
          </button>
          {feesError && (
            <p className="text-sm text-red-600">{feesError}</p>
          )}
        </form>

        {feesData && (
          <section className="space-y-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Student
              </p>
              <p className="text-base font-bold text-slate-800">
                {feesData.student.name}
              </p>
              <p className="text-xs text-slate-500">
                {feesData.student.admissionNumber}
                {feesData.student.class ? ` · Class ${feesData.student.class}` : ""}
                {feesData.student.section ? ` · ${feesData.student.section}` : ""}
                {" · "}
                {feesData.student.academicYear}
              </p>
            </div>

            {successMsg && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800 flex items-center justify-between gap-3">
                <span>{successMsg}</span>
                {lastReceiptId && (
                  <a
                    href={publicReceiptUrl(window.location.host, lastReceiptId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800"
                  >
                    Download receipt
                  </a>
                )}
              </div>
            )}
            {payError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                {payError}
              </div>
            )}

            {feesData.fees.length === 0 && (
              <p className="text-sm text-slate-600 bg-white border border-slate-200 rounded-2xl p-4">
                No fees on record for this admission number and year.
              </p>
            )}

            {feesData.fees.map((f) => {
              const balance = Number(f.balance);
              const paid = f.paymentStatus === "PAID" || balance <= 0;
              return (
                <div
                  key={f.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {f.academicYear}
                      </p>
                      <h3 className="text-base font-bold text-slate-800 mt-0.5">
                        {f.term}
                      </h3>
                    </div>
                    <span
                      className={
                        "text-xs font-bold px-2.5 py-1 rounded-full " +
                        (paid
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-800")
                      }
                    >
                      {paid ? "PAID" : "DUE"}
                    </span>
                  </div>
                  <div className="text-sm space-y-1.5">
                    <div className="flex justify-between text-slate-600">
                      <span>Original</span>
                      <span>{inr(f.originalAmount)}</span>
                    </div>
                    {Number(f.totalPenalty) > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>Penalty</span>
                        <span>+ {inr(f.totalPenalty)}</span>
                      </div>
                    )}
                    {Number(f.totalDiscount) > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>Discount</span>
                        <span>− {inr(f.totalDiscount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>Net</span>
                      <span>{inr(f.netAmount)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Paid</span>
                      <span>{inr(f.paidAmount)}</span>
                    </div>
                    {balance > 0 && (
                      <div className="flex justify-between font-bold text-red-700">
                        <span>Balance</span>
                        <span>{inr(balance)}</span>
                      </div>
                    )}
                  </div>
                  {!paid && (
                    <button
                      onClick={() => pay(f)}
                      disabled={payingFeeId === f.id}
                      className="mt-4 w-full rounded-lg bg-indigo-600 text-white text-sm font-semibold py-2.5 hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {payingFeeId === f.id
                        ? "Opening checkout…"
                        : `Pay ${inr(balance)}`}
                    </button>
                  )}
                </div>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
