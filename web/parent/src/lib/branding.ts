"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import { isAuthenticated } from "./auth";

type BrandingPayload = {
  logoUrl: string | null;
  tenantId: string | null;
};

let cached: BrandingPayload | null = null;
let inflight: Promise<BrandingPayload> | null = null;

function unwrap<T>(payload: unknown): T {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in (payload as Record<string, unknown>)
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function fetchBranding(): Promise<BrandingPayload> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = api
    .get("/tenant-configs/me/branding")
    .then(({ data }) => {
      cached = unwrap<BrandingPayload>(data) ?? {
        logoUrl: null,
        tenantId: null,
      };
      return cached;
    })
    .catch(() => {
      cached = { logoUrl: null, tenantId: null };
      return cached;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function resetTenantBrandingCache(): void {
  cached = null;
  inflight = null;
}

/**
 * Parent-side branding hook. Returns the tenant's logo when configured,
 * otherwise the generic SVBK fallback. Skips the fetch if the user is
 * not signed in.
 */
export function useTenantBranding(): { logoUrl: string; isCustom: boolean } {
  const [logoUrl, setLogoUrl] = useState<string | null>(cached?.logoUrl ?? null);

  useEffect(() => {
    if (!isAuthenticated()) {
      setLogoUrl(null);
      return;
    }
    let cancelled = false;
    fetchBranding().then((b) => {
      if (!cancelled) setLogoUrl(b.logoUrl);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    logoUrl: logoUrl || "/svbk_logo.webp",
    isCustom: Boolean(logoUrl),
  };
}
