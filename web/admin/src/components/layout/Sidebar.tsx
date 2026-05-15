"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useUi } from "@/context/ui-context";
import { useAuth } from "@/features/auth";
import { SidebarBrand } from "./SidebarBrand";

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
  { type: "item", href: "/payments", label: "Payment Details", icon: "payment" },
  { type: "item", href: "/pay-now", label: "Pay Now", icon: "payment" },
  { type: "item", href: "/chat", label: "Chat", icon: "megaphone" },
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
  { type: "item", href: "/system-metadata", label: "System Metadata", icon: "save" },
  { type: "item", href: "/chat", label: "Chat", icon: "megaphone" },
];

function navItemsFor(role: string | undefined): NavItem[] {
  if (role === "super_admin") return superAdminNav;
  return tenantAdminNav;
}

const transitionClass = "transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]";

function NavIcon({ name }: { name: string }) {
  const className = "h-5 w-5 flex-shrink-0";
  if (name === "grid")
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    );
  if (name === "document")
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  if (name === "save")
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
      </svg>
    );
  if (name === "media")
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    );
  if (name === "megaphone")
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13a3 3 0 005.064 0M18 13a3 3 0 01-3 3h-6a3 3 0 01-3-3M18 7a3 3 0 00-3-3h-6a3 3 0 00-3 3" />
      </svg>
    );
  if (name === "upload")
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    );
  if (name === "view")
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    );
  if (name === "students")
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    );
  if (name === "template-add")
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  if (name === "payment")
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    );
  return null;
}

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useUi();
  const { user, logout } = useAuth();
  const navItems = useMemo(() => navItemsFor(user?.role), [user?.role]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const closeSidebar = () => setSidebarOpen(false);

  // Auto-expand a group when one of its children is active.
  const initialOpenGroups = useMemo(() => {
    const open: Record<string, boolean> = {};
    for (const item of navItems) {
      if (item.type === "group") {
        open[item.key] = item.children.some((c) => isActive(c.href));
      }
    }
    return open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, navItems]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(initialOpenGroups);

  // Sync open state when route changes (so navigating into a group's child
  // also opens that group, even if the user collapsed it earlier).
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const item of navItems) {
        if (item.type === "group" && item.children.some((c) => isActive(c.href))) {
          next[item.key] = true;
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <>
      {/* Mobile-only backdrop. Hidden on md+ where the sidebar is always visible. */}
      <div
        role="presentation"
        aria-hidden={!sidebarOpen}
        onClick={closeSidebar}
        className={`md:hidden fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-64 flex-col max-w-[85vw] ${transitionClass} ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:sticky md:top-0 md:translate-x-0 md:h-screen md:z-30 md:max-w-none md:flex-shrink-0`}
        style={{
          backgroundColor: "var(--app-sidebar-bg)",
          borderRight: "1px solid var(--app-sidebar-border)",
        }}
        aria-label="Main navigation"
      >
        <div
          className="flex min-w-0 items-center justify-between overflow-hidden border-b px-4 py-4"
          style={{ borderColor: "var(--app-sidebar-border)" }}
        >
          <div className="min-w-0 flex-1">
            <SidebarBrand />
          </div>
          {/* Mobile close button */}
          <button
            type="button"
            onClick={closeSidebar}
            className="md:hidden h-8 w-8 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Close menu"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
          <p
            className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.08em]"
            style={{ color: "var(--app-sidebar-section)" }}
          >
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
                  className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${transitionClass} ${
                    active ? "" : "hover:bg-[var(--app-nav-hover-bg)]"
                  }`}
                  style={
                    active
                      ? {
                          backgroundColor: "var(--app-nav-active-bg)",
                          color: "var(--app-nav-active-text)",
                          fontWeight: 600,
                        }
                      : { color: "var(--app-sidebar-text)" }
                  }
                  title={item.label}
                >
                  {active && (
                    <span
                      className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r"
                      style={{ backgroundColor: "var(--app-brand)" }}
                    />
                  )}
                  <NavIcon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              );
            }

            // Group
            const open = openGroups[item.key];
            const anyChildActive = item.children.some((c) => isActive(c.href));
            return (
              <div key={item.key} className="flex flex-col">
                <button
                  type="button"
                  onClick={() => toggleGroup(item.key)}
                  className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium w-full ${transitionClass} ${
                    anyChildActive ? "" : "hover:bg-[var(--app-nav-hover-bg)]"
                  }`}
                  style={{
                    color: anyChildActive
                      ? "var(--app-nav-active-text)"
                      : "var(--app-sidebar-text)",
                    fontWeight: anyChildActive ? 600 : 500,
                  }}
                >
                  <NavIcon name={item.icon} />
                  <span className="flex-1 text-left">{item.label}</span>
                  <svg
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <path
                      d="M6 4l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {open && (
                  <div className="ml-7 mt-0.5 flex flex-col gap-0.5 border-l border-[var(--app-sidebar-border)] pl-3">
                    {item.children.map((child) => {
                      const active = isActive(child.href);
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={closeSidebar}
                          className="rounded-lg px-3 py-2 text-[13px] font-medium transition-colors"
                          style={{
                            backgroundColor: active
                              ? "var(--app-nav-active-bg)"
                              : "transparent",
                            color: active
                              ? "var(--app-nav-active-text)"
                              : "var(--app-sidebar-text)",
                            fontWeight: active ? 600 : 500,
                          }}
                          onMouseEnter={(e) => {
                            if (!active) {
                              e.currentTarget.style.backgroundColor =
                                "var(--app-nav-hover-bg)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!active) {
                              e.currentTarget.style.backgroundColor =
                                "transparent";
                            }
                          }}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-t px-3 py-3" style={{ borderColor: "var(--app-sidebar-border)" }}>
          {/* Profile + logout — premium pattern: avatar, name, role, action */}
          <div className="mb-2 flex items-center gap-3 rounded-lg px-2 py-2.5">
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
              style={{ backgroundColor: "var(--app-brand)" }}
            >
              A
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-sm font-semibold leading-tight truncate"
                style={{ color: "var(--app-text-primary)" }}
              >
                Admin
              </p>
              <p
                className="text-xs leading-tight truncate"
                style={{ color: "var(--app-text-secondary)" }}
              >
                Tenant admin
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { closeSidebar(); logout(); }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${transitionClass}`}
            style={{ color: "var(--app-text-secondary)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--app-danger-bg)";
              e.currentTarget.style.color = "var(--app-danger-text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--app-text-secondary)";
            }}
            title="Logout"
          >
            <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
