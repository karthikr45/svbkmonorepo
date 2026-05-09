"use client";

import Link from "next/link";

const QUICK_ACTIONS = [
  {
    href: "/students",
    label: "Add students",
    icon: "users",
    desc: "Upload via Excel",
  },
  {
    href: "/parents",
    label: "Add parent",
    icon: "user-plus",
    desc: "Link to admission",
  },
  {
    href: "/pay-now",
    label: "Collect payment",
    icon: "card",
    desc: "Razorpay / Cashfree",
  },
  {
    href: "/templates",
    label: "Templates",
    icon: "doc",
    desc: "Edit notifications",
  },
];

function Icon({ name }: { name: string }) {
  const cls = "h-4 w-4";
  switch (name) {
    case "users":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 014-4h2m6-4a4 4 0 11-8 0 4 4 0 018 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case "user-plus":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm11-1v6m3-3h-6" />
        </svg>
      );
    case "card":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      );
    case "doc":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    default:
      return null;
  }
}

export function WelcomeCard() {
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div
      className="relative overflow-hidden rounded-[var(--app-card-radius)] border p-6 sm:p-8 mb-6"
      style={{
        background: "linear-gradient(135deg, #0b54ab 0%, #1e3a8a 65%, #1e1b4b 100%)",
        borderColor: "transparent",
        color: "white",
      }}
    >
      {/* Decorative blobs */}
      <div
        aria-hidden
        className="absolute rounded-full blur-3xl opacity-30 pointer-events-none"
        style={{
          width: 280, height: 280, top: -80, right: -40,
          background: "radial-gradient(circle, rgba(139,92,246,0.6) 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="absolute rounded-full blur-3xl opacity-25 pointer-events-none"
        style={{
          width: 200, height: 200, bottom: -60, left: -40,
          background: "radial-gradient(circle, rgba(255,255,255,0.5) 0%, transparent 70%)",
        }}
      />
      {/* Subtle grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-200/80">
            {greeting}
          </p>
          <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold leading-tight tracking-tight">
            Welcome to SVBK Console
          </h2>
          <p className="mt-2 text-sm sm:text-[15px] text-blue-100/90 leading-relaxed">
            Your fees are running, parents can log in via OTP, and payments are
            settling on time. Here's a snapshot of today.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:gap-3">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="group flex flex-col gap-1 px-3 py-3 rounded-xl bg-white/10 ring-1 ring-white/15 hover:bg-white/20 transition-all"
            >
              <div className="flex items-center gap-2 text-white">
                <Icon name={a.icon} />
                <span className="text-[13px] font-semibold">{a.label}</span>
              </div>
              <span className="text-[11px] text-blue-200/80">{a.desc}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
