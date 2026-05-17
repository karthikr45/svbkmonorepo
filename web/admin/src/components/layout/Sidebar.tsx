"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useUi } from "@/context/ui-context";
import { useAuth } from "@/features/auth";

type NavItem =
  | { type: "item"; href: string; label: string; icon: string }
  | {
      type: "group";
      key: string;
      label: string;
      icon: string;
      children: { href: string; label: string }[];
    };

const tenantAdminNav: NavItem[] = [
  { type: "item", href: "/dashboard", label: "Dashboard", icon: "grid" },
  { type: "item", href: "/students", label: "Students", icon: "students" },
  {
    type: "item",
    href: "/transfer-certificate",
    label: "Transfer Certificate",
    icon: "document",
  },
  { type: "item", href: "/payments", label: "Payment Details", icon: "payment" },
  { type: "item", href: "/pay-now", label: "Pay Now", icon: "payment" },
  { type: "item", href: "/chat", label: "Chat", icon: "megaphone" },
  { type: "item", href: "/social", label: "Social Feed", icon: "megaphone" },
  {
    type: "group",
    key: "communications",
    label: "Communications",
    icon: "megaphone",
    children: [
      { href: "/announcements", label: "Announcements" },
      { href: "/templates", label: "Templates" },
      { href: "/media", label: "View Media" },
      { href: "/save-media", label: "Save Media" },
    ],
  },
  {
    type: "group",
    key: "configuration",
    label: "Configuration",
    icon: "save",
    children: [
      { href: "/settings/academic-years", label: "Academic Years" },
      { href: "/settings/penalty-rules", label: "Penalty Rules" },
      { href: "/settings/users", label: "Users & Roles" },
      { href: "/settings/receipt-sequence", label: "Receipt Sequence" },
      { href: "/settings/receipt-templates", label: "Receipt Templates" },
    ],
  },
  {
    type: "group",
    key: "reports",
    label: "Reports",
    icon: "document",
    children: [
      { href: "/reports/payment-logs", label: "Payment Logs" },
      { href: "/reports/pending-cheques", label: "Pending Cheques" },
      { href: "/reports/print-receipts", label: "Print Receipts" },
    ],
  },
];

const superAdminNav: NavItem[] = [
  { type: "item", href: "/super-admin", label: "Dashboard", icon: "grid" },
  { type: "item", href: "/tenants", label: "Tenants", icon: "students" },
  {
    type: "item",
    href: "/system-metadata",
    label: "System Metadata",
    icon: "save",
  },
  { type: "item", href: "/chat", label: "Chat", icon: "megaphone" },
];

function navItemsFor(role: string | undefined): NavItem[] {
  if (role === "super_admin") return superAdminNav;
  return tenantAdminNav;
}

const EASE = "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]";

function NavIcon({ name }: { name: string }) {
  const c = "h-[18px] w-[18px] flex-shrink-0";
  if (name === "grid")
    return (
      <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    );
  if (name === "document")
    return (
      <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  if (name === "save")
    return (
      <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
      </svg>
    );
  if (name === "megaphone")
    return (
      <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13a3 3 0 005.064 0M18 13a3 3 0 01-3 3h-6a3 3 0 01-3-3M18 7a3 3 0 00-3-3h-6a3 3 0 00-3 3" />
      </svg>
    );
  if (name === "students")
    return (
      <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    );
  if (name === "payment")
    return (
      <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    );
  return null;
}

function prettyRole(role?: string) {
  if (!role) return "Member";
  return role
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useUi();
  const { user, logout } = useAuth();
  const navItems = useMemo(() => navItemsFor(user?.role), [user?.role]);

  const email = user?.email ?? "";
  const displayName =
    (email.split("@")[0] || "Admin")
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase()) || "Admin";
  const initials =
    displayName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "A";

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  const closeSidebar = () => setSidebarOpen(false);

  const initialOpenGroups = useMemo(() => {
    const open: Record<string, boolean> = {};
    for (const item of navItems) {
      if (item.type === "group")
        open[item.key] = item.children.some((c) => isActive(c.href));
    }
    return open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, navItems]);

  const [openGroups, setOpenGroups] =
    useState<Record<string, boolean>>(initialOpenGroups);

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const item of navItems) {
        if (
          item.type === "group" &&
          item.children.some((c) => isActive(c.href))
        )
          next[item.key] = true;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const ACTIVE_BG =
    "linear-gradient(135deg, rgba(59,130,246,0.28), rgba(99,102,241,0.20))";

  return (
    <>
      <div
        role="presentation"
        aria-hidden={!sidebarOpen}
        onClick={closeSidebar}
        className={`md:hidden fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 ${
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-[270px] flex-col max-w-[85vw] ${EASE} ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:sticky md:top-0 md:translate-x-0 md:h-screen md:z-30 md:max-w-none md:flex-shrink-0`}
        style={{
          backgroundColor: "#0b1026",
          backgroundImage:
            "radial-gradient(120% 60% at 0% 0%, rgba(59,130,246,0.16), transparent 60%)," +
            "radial-gradient(90% 50% at 100% 100%, rgba(99,102,241,0.14), transparent 60%)," +
            "linear-gradient(180deg,#0b1026 0%,#111a3e 48%,#0a0f24 100%)",
          borderRight: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "inset -1px 0 0 rgba(255,255,255,0.03)",
        }}
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div
          className="flex min-w-0 items-center justify-between px-4 py-[18px]"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <Link
            href="/dashboard"
            onClick={closeSidebar}
            className="group flex min-w-0 items-center gap-3 outline-none"
          >
            <span
              className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))",
                boxShadow:
                  "0 0 0 1px rgba(255,255,255,0.10), 0 8px 20px -8px rgba(37,99,235,0.6)",
              }}
            >
              <Image
                src="/svbk_logo.webp"
                alt="SVBK"
                width={34}
                height={34}
                className="object-contain p-0.5"
                priority
              />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[15px] font-extrabold tracking-tight text-white">
                SVBK
              </span>
              <span className="block truncate text-[11px] font-medium text-blue-200/60">
                School Console
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={closeSidebar}
            className="md:hidden h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Close menu"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500/80">
            Workspace
          </p>

          {navItems.map((item) => {
            if (item.type === "item") {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeSidebar}
                  title={item.label}
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] ${EASE} ${
                    active
                      ? "text-white font-semibold"
                      : "text-slate-300/80 font-medium hover:text-white hover:bg-white/[0.055]"
                  }`}
                  style={
                    active
                      ? {
                          backgroundImage: ACTIVE_BG,
                          boxShadow:
                            "0 0 0 1px rgba(255,255,255,0.08), 0 10px 24px -14px rgba(37,99,235,0.9)",
                        }
                      : undefined
                  }
                >
                  {active && (
                    <span
                      className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full"
                      style={{
                        background: "linear-gradient(180deg,#60a5fa,#6366f1)",
                        boxShadow: "0 0 10px 1px rgba(96,165,250,0.7)",
                      }}
                    />
                  )}
                  <span
                    className={
                      active
                        ? "text-blue-300"
                        : "text-slate-400 group-hover:text-blue-300 transition-colors"
                    }
                  >
                    <NavIcon name={item.icon} />
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            }

            const open = openGroups[item.key];
            const anyChildActive = item.children.some((c) => isActive(c.href));
            return (
              <div key={item.key} className="flex flex-col">
                <button
                  type="button"
                  onClick={() => toggleGroup(item.key)}
                  className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] ${EASE} ${
                    anyChildActive
                      ? "text-white font-semibold"
                      : "text-slate-300/80 font-medium hover:text-white hover:bg-white/[0.055]"
                  }`}
                >
                  <span
                    className={
                      anyChildActive
                        ? "text-blue-300"
                        : "text-slate-400 group-hover:text-blue-300 transition-colors"
                    }
                  >
                    <NavIcon name={item.icon} />
                  </span>
                  <span className="flex-1 text-left truncate">
                    {item.label}
                  </span>
                  <svg
                    className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-300 ${
                      open ? "rotate-90" : ""
                    }`}
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                <div
                  className={`grid ${EASE} ${
                    open
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="ml-[22px] mt-1 flex flex-col gap-0.5 border-l border-white/10 pl-3">
                      {item.children.map((child) => {
                        const active = isActive(child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={closeSidebar}
                            className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px] ${EASE} ${
                              active
                                ? "text-white font-semibold bg-white/[0.07]"
                                : "text-slate-400/80 font-medium hover:text-white hover:bg-white/[0.045]"
                            }`}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full flex-shrink-0 transition-colors"
                              style={{
                                background: active
                                  ? "linear-gradient(135deg,#60a5fa,#6366f1)"
                                  : "rgba(148,163,184,0.4)",
                                boxShadow: active
                                  ? "0 0 8px 1px rgba(96,165,250,0.7)"
                                  : "none",
                              }}
                            />
                            <span className="truncate">{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Profile + sign out */}
        <div
          className="px-3 py-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div
            className="mb-2 flex items-center gap-3 rounded-xl px-2.5 py-2.5"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
            }}
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
              style={{
                background: "linear-gradient(135deg,#3b82f6,#6366f1)",
                boxShadow: "0 8px 18px -8px rgba(59,130,246,0.8)",
              }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-tight text-white">
                {displayName}
              </p>
              <p className="truncate text-[11px] leading-tight text-blue-200/55">
                {prettyRole(user?.role)}
              </p>
            </div>
            <span
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{
                background: "#34d399",
                boxShadow: "0 0 8px 1px rgba(52,211,153,0.7)",
              }}
              title="Online"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              closeSidebar();
              logout();
            }}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-300/80 hover:text-rose-300 hover:bg-rose-500/10 ${EASE}`}
            title="Logout"
          >
            <svg className="h-[18px] w-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
