"use client";

import { useEffect, useState } from "react";
import { get } from "@/lib/api-client";
import { useAuth } from "@/features/auth";

type BrandingPayload = {
  logoUrl: string | null;
  tenantId: string | null;
};

// Module-level cache so multiple components (sidebar + collapsed brand)
// don't each issue their own request after login.
let cached: BrandingPayload | null = null;
let inflight: Promise<BrandingPayload> | null = null;

function fetchBranding(): Promise<BrandingPayload> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = get<BrandingPayload>("/tenant-configs/me/branding")
    .then((res) => {
      const payload =
        (res as { data?: BrandingPayload })?.data ?? (res as BrandingPayload);
      cached = payload ?? { logoUrl: null, tenantId: null };
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

/** Reset the in-memory cache — call on logout / tenant switch. */
export function resetTenantBrandingCache(): void {
  cached = null;
  inflight = null;
}

/**
 * Returns the tenant's branding (logo) loaded from tenant_configurations.
 * Falls back to the generic SVBK logo when the tenant has no logo configured
 * or when the user is not yet authenticated.
 */
export function useTenantBranding(): { logoUrl: string; isCustom: boolean } {
  const { isAuthenticated } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string | null>(cached?.logoUrl ?? null);

  useEffect(() => {
    if (!isAuthenticated) {
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
  }, [isAuthenticated]);

  return {
    logoUrl: logoUrl || "/svbk_logo.webp",
    isCustom: Boolean(logoUrl),
  };
}
