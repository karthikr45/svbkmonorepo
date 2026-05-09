const AUTH_KEY = "svk_parent_auth";

export interface ParentAuth {
  email: string;
  verified: boolean;
}

export function getAuth(): ParentAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(AUTH_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as ParentAuth;
  } catch {
    return null;
  }
}

export function setAuth(auth: ParentAuth): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_KEY);
}

export function isAuthenticated(): boolean {
  const auth = getAuth();
  return auth?.verified === true;
}
