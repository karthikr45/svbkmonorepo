"use client";

import { useUi } from "@/context/ui-context";
import { getNotifications } from "@/features/notifications/service/notification.service";
import Link from "next/link";
import { useEffect, useState } from "react";

export function Navbar() {
  const { toggleSidebar } = useUi();
  const [notification,setNotification] =useState<any>()
  let notifications:any
  useEffect(()=>{
 const fetchNotifications=async()=>{

   const branch="hyd"
   const role="Admin"
   const response= await getNotifications(role,branch)
   setNotification(response)
  }
  fetchNotifications()
},[])
  return (
    <header
      className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b px-4 md:px-8 transition-[margin] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
      style={{
        backgroundColor: "var(--app-navbar-bg)",
        borderColor: "var(--app-navbar-border)",
      }}
    >
      <button
        type="button"
        onClick={toggleSidebar}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-[var(--app-nav-hover-bg)]"
        style={{ color: "var(--app-nav-icon)" }}
        aria-label="Open menu"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex flex-1 items-center gap-6">
        <div className="relative hidden flex-1 max-w-xl sm:block">
          <svg
            className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
            style={{ color: "var(--app-search-placeholder)" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search student records..."
            className="h-11 w-full rounded-xl border py-2.5 pl-12 pr-4 text-base outline-none transition-colors focus:ring-2 focus:ring-[var(--app-search-focus)]/20"
            style={{
              backgroundColor: "var(--app-search-bg)",
              borderColor: "var(--app-search-border)",
              color: "var(--app-text-primary)",
            }}
          />
        </div>
      </div>

      <nav className="flex items-center gap-3">
        <Link href="/notifications">

        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-[var(--app-nav-hover-bg)]"
          style={{ color: "var(--app-nav-icon)" }}
          aria-label="Notifications"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--app-danger)] px-1 text-[10px] font-medium text-white"
            aria-hidden
          >
            {notification?.notifications.length}
          </span>
        </button>
        </Link>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-[var(--app-nav-hover-bg)]"
          style={{ color: "var(--app-nav-icon)" }}
          aria-label="Help"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        <div className="ml-2 hidden items-center gap-4 border-l pl-4 md:flex" style={{ borderColor: "var(--app-divider)" }}>
          <div className="flex flex-col">
            <span className="text-base font-medium" style={{ color: "var(--app-text-primary)" }}>
              Admin User
            </span>
            <span className="text-sm" style={{ color: "var(--app-text-secondary)" }}>
              Super Admin
            </span>
          </div>
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium text-white"
            style={{ backgroundColor: "var(--app-brand, #0b54ab)" }}
          >
            A
          </div>
        </div>
      </nav>
    </header>
  );
}
