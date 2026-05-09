"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  getStoredToken,
  getStoredUser,
  clearStoredToken,
  clearStoredUser,
  clearStoredRefreshToken,
  setStoredToken,
  setStoredUser,
} from "@/features/auth/services";
import type { AuthUser } from "@/features/auth/types";

interface AuthContextValue {
  isAuthenticated: boolean;
  token: string | null;
  user: AuthUser | null;
  logout: () => void;
  setToken: (token: string | null) => void;
  setUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTokenState(getStoredToken());
    setUserState(getStoredUser());
    setMounted(true);
  }, []);

  const setToken = useCallback((value: string | null) => {
    setStoredToken(value);
    setTokenState(value);
  }, []);

  const setUser = useCallback((value: AuthUser | null) => {
    setStoredUser(value);
    setUserState(value);
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    clearStoredRefreshToken();
    clearStoredUser();
    setTokenState(null);
    setUserState(null);
    // Hard-nav guarantees every component remounts with a fresh auth state,
    // bypassing any stale-state edge cases in route-group layouts.
    if (typeof window !== "undefined") {
      window.location.replace("/");
    }
  }, []);

  // Handle forced logout from the 401 interceptor (refresh token expired/invalid).
  useEffect(() => {
    const handleForcedLogout = () => {
      setTokenState(null);
      setUserState(null);
    };
    window.addEventListener("auth:logout", handleForcedLogout);
    return () => window.removeEventListener("auth:logout", handleForcedLogout);
  }, []);

  const value: AuthContextValue = {
    isAuthenticated: !!token,
    token,
    user,
    logout,
    setToken,
    setUser,
  };

  if (!mounted) {
    return null;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
