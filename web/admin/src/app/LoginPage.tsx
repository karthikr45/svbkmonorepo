"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { LoginForm } from "@/features/auth";
import { useAuth } from "@/features/auth";
import {
  getStoredRefreshToken,
  refreshAccessToken,
  getStoredUser,
} from "@/features/auth/services";

const LOGO_SRC = "/svbk_logo.webp";
const FEATURES = [
  "Multi-tenant school management",
  "Real-time fee collection",
  "Razorpay & Cashfree gateways",
  "Parent + students portals",
];

function getRedirectPath(role?: string): string {
  return role === "super_admin" ? "/tenants" : "/dashboard";
}

export function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, user, setToken, setUser } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkSession() {
      if (isAuthenticated) {
        router.replace(getRedirectPath(user?.role));
        return;
      }
      const refreshToken = getStoredRefreshToken();
      if (refreshToken) {
        try {
          const newToken = await refreshAccessToken();
          if (newToken) {
            const storedUser = getStoredUser();
            setToken(newToken);
            setUser(storedUser);
            router.replace(getRedirectPath(storedUser?.role));
            return;
          }
        } catch {
          /* fall through to login form */
        }
      }
      setChecking(false);
    }
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checking) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "var(--auth-page-bg)" }}
      >
        <svg
          className="h-10 w-10 animate-spin text-[var(--app-brand,#0b54ab)]"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Left brand panel */}
        <div className="auth-card-media">
          <div className="relative z-10 flex flex-col items-center px-10 py-12 text-center text-white">
            <div className="mb-6 h-32 w-32 overflow-hidden rounded-2xl bg-white/95 p-3 shadow-2xl ring-1 ring-white/20">
              <Image
                src={LOGO_SRC}
                alt="SVBK"
                width={128}
                height={128}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <h2 className="text-2xl font-extrabold leading-tight tracking-tight">
              SVBK Admin Console
            </h2>
            <p className="mt-2 text-sm text-blue-100">
              Sri Venkateswara Bala Kuteer
            </p>

            <div className="mt-10 flex w-full max-w-[260px] flex-col gap-2.5 text-left">
              {FEATURES.map((f) => (
                <div
                  key={f}
                  className="flex items-center gap-2.5 text-[13px] text-blue-100"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" fill="rgba(255,255,255,0.2)" />
                    <path
                      d="M4.5 8l2.5 2.5 4.5-4.5"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right form panel */}
        <div className="auth-card-form">
          <div className="md:hidden mx-auto mb-6 h-20 w-20 overflow-hidden rounded-xl border border-slate-100 bg-white p-1.5 shadow">
            <Image
              src={LOGO_SRC}
              alt="SVBK Logo"
              width={72}
              height={72}
              className="h-full w-full object-contain"
              priority
            />
          </div>
          <LoginForm showBackLink={false} />
        </div>
      </div>
    </div>
  );
}
