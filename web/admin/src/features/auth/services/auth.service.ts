/**
 * Auth service – business logic. Calls api layer only; handles token storage.
 * Stores accessToken and refreshToken. When a 401 occurs, api-client calls
 * refreshAccessToken() via the registered callback, retries the request, and
 * dispatches 'auth:logout' if the refresh itself fails.
 */

import { setAuthTokenGetter, setRefreshTokenCallback } from "@/lib/api-client";
import { authConfig } from "@/features/auth/config";
import type { AuthUser, LoginCredentials, LoginResponse } from "@/features/auth/types";
import { verifyLoginApi, refreshTokenApi } from "@/features/auth/api/auth.api";
import {
  STORAGE_KEY,
  getStorageItem,
  removeStorageItem,
  setStorageItem,
} from "@/storage";

// ─── Token helpers ────────────────────────────────────────────────────────────

function readToken(): string | null {
  return getStorageItem<string>(STORAGE_KEY.authToken);
}

function writeToken(token: string): void {
  setStorageItem<string>(STORAGE_KEY.authToken, token);
}

function removeToken(): void {
  removeStorageItem(STORAGE_KEY.authToken);
}

function readRefreshToken(): string | null {
  return getStorageItem<string>(STORAGE_KEY.refreshToken);
}

function writeRefreshToken(token: string): void {
  setStorageItem<string>(STORAGE_KEY.refreshToken, token);
}

function removeRefreshToken(): void {
  removeStorageItem(STORAGE_KEY.refreshToken);
}

// ─── API-client wiring ────────────────────────────────────────────────────────

if (authConfig.useTokenAuth) {
  setAuthTokenGetter(readToken);
}

if (authConfig.useJwtRefresh) {
  setRefreshTokenCallback(refreshAccessToken);
}

// ─── JWT expiry helper ────────────────────────────────────────────────────────

export function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    // JWT uses base64url – replace chars before decoding
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));
    if (typeof payload.exp !== "number") return false;
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

// ─── Public token API ─────────────────────────────────────────────────────────

export function getStoredToken(): string | null {
  return readToken();
}

export function setStoredToken(token: string | null): void {
  if (token) writeToken(token);
  else removeToken();
}

export function clearStoredToken(): void {
  removeToken();
}

export function getStoredRefreshToken(): string | null {
  return readRefreshToken();
}

export function clearStoredRefreshToken(): void {
  removeRefreshToken();
}

// ─── Public user API ──────────────────────────────────────────────────────────

export function getStoredUser(): AuthUser | null {
  return getStorageItem<AuthUser>(STORAGE_KEY.userDetails);
}

export function setStoredUser(user: AuthUser | null): void {
  if (user) setStorageItem<AuthUser>(STORAGE_KEY.userDetails, user);
  else removeStorageItem(STORAGE_KEY.userDetails);
}

export function clearStoredUser(): void {
  removeStorageItem(STORAGE_KEY.userDetails);
}

// ─── Login / logout ───────────────────────────────────────────────────────────

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const res = await verifyLoginApi({
    email: credentials.email.trim(),
    password: credentials.password,
  });

  const { accessToken, refreshToken, email, role , tenantId, id} = res.data.response;

  if (authConfig.useTokenAuth && accessToken) {
    writeToken(accessToken);
  }

  if (authConfig.useJwtRefresh && refreshToken) {
    writeRefreshToken(refreshToken);
  }

  setStoredUser({ email, role , tenantId, id });

  return res;
}

export async function logout(): Promise<void> {
  removeToken();
  removeRefreshToken();
  removeStorageItem(STORAGE_KEY.userDetails);
}

// ─── Token refresh (called by api-client 401 interceptor) ────────────────────

export async function refreshAccessToken(): Promise<string | null> {
  const storedRefresh = readRefreshToken();
  if (!storedRefresh) {
    dispatchLogout();
    return null;
  }

  try {
    const res = await refreshTokenApi(storedRefresh);

    // Backends vary: some wrap tokens in data.response (login shape),
    // others return a flat { accessToken, refreshToken } object.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = res as any;
    const accessToken: string | undefined =
      raw?.data?.response?.accessToken ?? raw?.data?.accessToken ?? raw?.accessToken;
    const refreshToken: string | undefined =
      raw?.data?.response?.refreshToken ?? raw?.data?.refreshToken ?? raw?.refreshToken;

    if (accessToken) {
      writeToken(accessToken);
      if (refreshToken) writeRefreshToken(refreshToken);
      return accessToken;
    }
    dispatchLogout();
    return null;
  } catch {
    removeToken();
    removeRefreshToken();
    removeStorageItem(STORAGE_KEY.userDetails);
    dispatchLogout();
    return null;
  }
}

function dispatchLogout(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth:logout"));
  }
}
