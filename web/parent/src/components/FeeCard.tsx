"use client";

import { useState } from "react";
import { initiatePayment, type Fee, type Gateway } from "@/lib/parent-portal";
import { apiErrorMessage } from "@/lib/api";

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

export function FeeCard({ fee }: { fee: Fee }) {
  const statusStyle = STATUS_STYLES[fee.paymentStatus] ?? STATUS_STYLES.UNPAID;
  const balance = Number(fee.netAmount) - Number(fee.paidAmount);
  const canPay = balance > 0 && fee.paymentStatus !== "PAID";
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [orderInfo, setOrderInfo] = useState<string | null>(null);

  async function handlePay(gateway: Gateway) {
    setPaying(true);
    setPayError(null);
    setOrderInfo(null);
    try {
      const res = await initiatePayment(fee.id, gateway);
      // The gatewayResponse contains the order id (and key/session) needed by
      // the gateway SDK on the client. Show a friendly summary; full SDK
      // integration is out of scope of this scaffold.
      const orderId =
        (res.gatewayResponse as { id?: string; orderId?: string }).id ??
        (res.gatewayResponse as { orderId?: string }).orderId ??
        res.payment?.id;
      setOrderInfo(`Order created (${gateway}): ${orderId}`);
    } catch (err) {
      setPayError(apiErrorMessage(err, "Could not initiate payment"));
    } finally {
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
              style={{ backgroundColor: "#0b54ab" }}
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
          {orderInfo && (
            <p className="text-xs text-green-700">{orderInfo}</p>
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
