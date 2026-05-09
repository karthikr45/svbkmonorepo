/**
 * Auth feature – API layer (backend endpoint calls only).
 * Uses global api-client from lib. No business logic here.
 */

import { post } from "@/lib/api-client";
import type { LoginResponse } from "@/features/auth/types";

const AUTH_ENDPOINTS = {
  verifyLogin: "/auth/signin",
  logout: "/logout",
  refreshToken: "/auth/refresh",
} as const;

export async function verifyLoginApi(
  body: { email: string; password: string }
): Promise<LoginResponse> {
  return post<LoginResponse, typeof body>(AUTH_ENDPOINTS.verifyLogin, body);
}

export async function refreshTokenApi(refreshToken: string): Promise<LoginResponse> {
  return post<LoginResponse, { refreshToken: string }>(AUTH_ENDPOINTS.refreshToken, { refreshToken });
}
