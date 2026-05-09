"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppImage } from "@/components/ui";
import { LoginForm } from "@/features/auth";
import { useAuth } from "@/features/auth";
import {
  getStoredRefreshToken,
  refreshAccessToken,
  getStoredUser,
} from "@/features/auth/services";

const LOGO_SRC = "/svbk_logo.webp";

function getRedirectPath(role?: string): string {
  return role === "super_admin" ? "/tenants" : "/dashboard";
}

export function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, user, setToken, setUser } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkSession() {
      // Case 1: already authenticated in React state → redirect immediately
      if (isAuthenticated) {
        router.replace(getRedirectPath(user?.role));
        return;
      }

      // Case 2: refresh token exists → let the server decide if it is still valid.
      // Never check expiry client-side: opaque tokens can't be decoded, and the
      // server is always the source of truth regardless of token format.
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
          // Refresh rejected by server — fall through to show the login form
        }
      }

      // Case 3: no valid session → show login form
      setChecking(false);
    }

    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While we're checking the refresh token, show a full-screen spinner
  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <svg
          className="h-10 w-10 animate-spin text-[var(--app-brand,#0b54ab)]"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
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
        <div className="auth-card-media">
          <AppImage
            src={LOGO_SRC}
            alt="SVBK - Sri Venkateswara Bala Kuteer, Guntur"
            variant="panel"
            priority
          />
        </div>
        <div className="auth-card-form">
          <AppImage
            src={LOGO_SRC}
            alt="SVBK Logo"
            variant="icon"
            wrapperClassName="mx-auto mb-6 md:hidden"
            priority
          />
          <LoginForm showBackLink={false} />
        </div>
      </div>
    </div>
  );
}
