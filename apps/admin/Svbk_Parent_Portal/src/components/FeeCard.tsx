"use client";

import type { Child, FeeItem } from "@/lib/mockData";

type FeeType = "school" | "transportation" | "hostel";

const CONFIG: Record<FeeType, {
  label: string;
  color: string;
  lightBg: string;
  borderColor: string;
  icon: React.ReactNode;
}> = {
  school: {
    label: "School Fee",
    color: "#0b54ab",
    lightBg: "#e8f0fb",
    borderColor: "#0b54ab",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
        <path d="M6 12v5c3 3 9 3 12 0v-5"/>
      </svg>
    ),
  },
  transportation: {
    label: "Transportation Fee",
    color: "#c2410c",
    lightBg: "#fff7ed",
    borderColor: "#ea580c",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" rx="2"/>
        <path d="M16 8h4l3 3v5h-7V8z"/>
        <circle cx="5.5" cy="18.5" r="2.5"/>
        <circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    ),
  },
  hostel: {
    label: "Hostel Fee",
    color: "#6d28d9",
    lightBg: "#f5f3ff",
    borderColor: "#7c3aed",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9,22 9,12 15,12 15,22"/>
      </svg>
    ),
  },
};

function formatAmount(n: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

function downloadReceipt(fee: FeeItem, childName: string, feeLabel: string) {
  const content = [
    "SRI VENKATESWARA BALA KUTEER",
    "Fee Receipt",
    "─────────────────────────────",
    `Receipt ID   : ${fee.receiptId}`,
    `Student Name : ${childName}`,
    `Fee Type     : ${feeLabel}`,
    `Term         : ${fee.term}`,
    `Amount Paid  : ₹${formatAmount(fee.amount)}`,
    `Paid On      : ${fee.paidDate}`,
    "─────────────────────────────",
    "Thank you for your payment.",
  ].join("\n");

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fee.receiptId}-${childName.replace(/\s+/g, "_")}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

interface FeeCardProps {
  type: FeeType;
  child: Child;
  index?: number;
}

export function FeeCard({ type, child, index = 0 }: FeeCardProps) {
  const cfg = CONFIG[type];
  const fee: FeeItem = child.fees[type];

  return (
    <div
      className="card-animate bg-white rounded-2xl overflow-hidden flex flex-col"
      style={{
        boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 4px 16px -4px rgb(0 0 0 / 0.1)",
        animationDelay: `${index * 80}ms`,
        borderTop: `4px solid ${cfg.borderColor}`,
      }}
    >
      {/* Card header */}
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: cfg.lightBg, color: cfg.color }}
          >
            {cfg.icon}
          </div>
          <div>
            <p className="font-bold text-slate-800 text-[15px] leading-tight">{cfg.label}</p>
            <p className="text-xs text-slate-500 mt-0.5">{fee.term}</p>
          </div>
        </div>

        {/* Status badge */}
        {fee.paid ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 flex-shrink-0">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="#15803d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            PAID
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 flex-shrink-0">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5" stroke="#92400e" strokeWidth="1.5"/>
              <path d="M6 3.5v3M6 8.5v.5" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            DUE
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-slate-100" />

      {/* Child info */}
      <div className="px-5 pt-4 pb-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span className="text-sm font-semibold text-slate-800">{child.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
            <path d="M6 12v5c3 3 9 3 12 0v-5"/>
          </svg>
          <span className="text-sm text-slate-600 truncate">{child.school}</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M3 9h18M9 21V9"/>
          </svg>
          <span className="text-sm text-slate-600">
            {child.grade} &middot; {child.section}
          </span>
        </div>
      </div>

      {/* Amount */}
      <div
        className="mx-5 my-3 rounded-xl px-4 py-3 text-center"
        style={{ backgroundColor: cfg.lightBg }}
      >
        <p className="text-xs font-medium mb-0.5" style={{ color: cfg.color }}>Amount</p>
        <p className="text-3xl font-extrabold tracking-tight" style={{ color: cfg.color }}>
          ₹{formatAmount(fee.amount)}
        </p>
        <p className="text-xs mt-1 text-slate-500">Due: {fee.dueDate}</p>
      </div>

      {/* Paid details (if paid) */}
      {fee.paid && fee.paidDate && (
        <div className="mx-5 mb-3 px-3 py-2 bg-green-50 rounded-lg border border-green-100">
          <div className="flex items-center justify-between text-xs">
            <span className="text-green-700 font-medium">Paid on {fee.paidDate}</span>
            <span className="text-slate-500 font-mono">{fee.receiptId}</span>
          </div>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action button */}
      <div className="px-5 pb-5 pt-2">
        {fee.paid ? (
          <button
            onClick={() => downloadReceipt(fee, child.name, cfg.label)}
            className="w-full h-11 rounded-xl border-2 font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-80"
            style={{ borderColor: cfg.color, color: cfg.color, backgroundColor: cfg.lightBg }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7,10 12,15 17,10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download Receipt
          </button>
        ) : (
          <button
            className="w-full h-11 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: cfg.color }}
            onClick={() => alert("Online payment integration coming soon.")}
          >
            Pay Now
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
