import { api } from "./api";
import { setTokens, setParent, clearAuth, type ParentProfile } from "./auth";

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

export async function sendOtp(email: string, tenantCode?: string): Promise<{ message: string }> {
  const { data } = await api.post("/parent/auth/send-otp", { email, tenantCode });
  return unwrap(data);
}

export async function verifyOtp(email: string, otp: string, tenantCode?: string) {
  const { data } = await api.post("/parent/auth/verify-otp", {
    email,
    otp,
    tenantCode,
  });
  const result = unwrap<{
    accessToken: string;
    refreshToken: string;
    parent: ParentProfile;
  }>(data);
  await setTokens({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
  await setParent(result.parent);
  return result;
}

export async function logout(): Promise<void> {
  try {
    await api.post("/parent/auth/logout");
  } catch {
    // ignore
  } finally {
    await clearAuth();
  }
}

export interface DashboardChild {
  student: {
    id: string;
    name: string;
    admissionNumber: string;
    class: string;
    section: string;
    rollNo: string;
    academicYear: string;
    imgUrl: string | null;
  };
  feesCount: number;
  amountDue: number;
}

export interface DashboardResponse {
  children: DashboardChild[];
  summary: { totalDue: number; totalPaid: number; totalPenalty: number };
}

export async function fetchDashboard(): Promise<DashboardResponse> {
  const { data } = await api.get("/parent/dashboard");
  return unwrap<DashboardResponse>(data);
}
