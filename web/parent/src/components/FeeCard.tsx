"use client";

import { useState } from "react";
import {
  initiatePayment,
  fetchActivePaymentConfig,
  verifyParentPayment,
  type Fee,
  type Gateway,
} from "@/lib/parent-portal";
import { apiErrorMessage } from "@/lib/api";

/** Injects a script tag once; resolves true on load, false on error. */
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

const STATUS_STYLES: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  PAID: { bg: "#dcfce7", text: "#15803d", label: "Paid" },
  PARTIAL: { bg: "#fef3c7", text: "#92400e", label: "Partial" },
  UNPAID: { bg: "#fee2e2", text: "#b91c1c", label: "Unpaid" },
};

function inr(value: number | string) {
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

export function FeeCard({
  fee,
  onPaid,
}: {
  fee: Fee;
  onPaid?: () => void;
}) {
  const statusStyle = STATUS_STYLES[fee.paymentStatus] ?? STATUS_STYLES.UNPAID;
  const balance = Number(fee.netAmount) - Number(fee.paidAmount);
  const canPay = balance > 0 && fee.paymentStatus !== "PAID";
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function settle(args: {
    gatewayOrderId: string;
    gatewayPaymentId?: string;
    signature?: string;
  }) {
    try {
      await verifyParentPayment(args);
      setSuccessMsg("Payment successful. Updating…");
      onPaid?.();
    } catch (err) {
      setPayError(
        apiErrorMessage(
          err,
          "Payment was made but confirmation is pending. It will update shortly.",
        ),
      );
    } finally {
      setPaying(false);
    }
  }

  async function handlePay(gateway: Gateway) {
    setPaying(true);
    setPayError(null);
    setSuccessMsg(null);
    try {
      const res = await initiatePayment(fee.id, gateway);
      const raw = res.gatewayResponse as Record<string, unknown>;
      const orderId =
        res.payment?.gatewayOrderId ??
        (raw.id as string | undefined) ??
        (raw.order_id as string | undefined);
      if (!orderId) throw new Error("Gateway did not return an order id.");

      if (gateway === "razorpay") {
        const cfg = await fetchActivePaymentConfig();
        if (!cfg.paymentClientId) {
          throw new Error(
            "Online payment isn't configured for your school yet. " +
              "Please contact the school office.",
          );
        }
        const ok = await loadScript(
          "https://checkout.razorpay.com/v1/checkout.js",
        );
        if (!ok) throw new Error("Failed to load the Razorpay checkout.");
        const w = window as unknown as { Razorpay: new (o: unknown) => { open: () => void } };
        const rzp = new w.Razorpay({
          key: cfg.paymentClientId,
          order_id: orderId,
          amount: res.payment.amount,
          currency: res.payment.currency || "INR",
          name: "SVBK",
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
              setPaying(false);
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
            checkout: (o: unknown) => Promise<{ error?: { message?: string } }>;
          };
        };
        const cashfree = w.Cashfree({ mode: "production" });
        const result = await cashfree.checkout({
          paymentSessionId: sessionId,
          redirectTarget: "_modal",
          onSuccess: () => {
            void settle({ gatewayOrderId: orderId });
          },
          onFailure: () => {
            setPaying(false);
            setPayError("Cashfree payment failed.");
          },
        });
        if (result?.error) {
          throw new Error(result.error.message ?? "Cashfree payment failed.");
        }
      }
    } catch (err) {
      setPayError(apiErrorMessage(err, "Could not start the payment."));
      setPaying(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {fee.academicYear}
          </p>
          <h3 className="text-base font-bold text-slate-800 mt-0.5">{fee.term}</h3>
        </div>
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-full"
          style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
        >
          {statusStyle.label}
        </span>
      </div>

      <div className="flex flex-col gap-1.5 text-sm">
        <Row label="Original" value={inr(fee.originalAmount)} />
        {Number(fee.totalPenalty) > 0 && (
          <Row label="Penalty" value={`+ ${inr(fee.totalPenalty)}`} />
        )}
        {Number(fee.totalDiscount) > 0 && (
          <Row label="Discount" value={`− ${inr(fee.totalDiscount)}`} />
        )}
        <Row label="Net" value={inr(fee.netAmount)} bold />
        <Row label="Paid" value={inr(fee.paidAmount)} />
        {balance > 0 && (
          <Row label="Balance" value={inr(balance)} bold valueColor="#b91c1c" />
        )}
      </div>

      {canPay && (
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => handlePay("razorpay")}
              disabled={paying}
              className="flex-1 h-9 rounded-lg text-white text-xs font-bold disabled:opacity-60"
              style={{ backgroundColor: "#6c739c" }}
            >
              {paying ? "Working…" : "Pay via Razorpay"}
            </button>
            <button
              onClick={() => handlePay("cashfree")}
              disabled={paying}
              className="flex-1 h-9 rounded-lg text-xs font-bold disabled:opacity-60"
              style={{ backgroundColor: "#e2e8f0", color: "#0f172a" }}
            >
              {paying ? "Working…" : "Pay via Cashfree"}
            </button>
          </div>
          {payError && (
            <p className="text-xs text-red-600" role="alert">{payError}</p>
          )}
          {successMsg && (
            <p className="text-xs text-green-700">{successMsg}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  valueColor,
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span
        className={bold ? "font-bold text-slate-800" : "text-slate-700"}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
