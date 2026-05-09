import { api } from "./api";
import { setTokens, setParent, clearAuth, type ParentProfile } from "./auth";

// API may wrap responses in { data } via TransformInterceptor. Unwrap defensively.
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

// ── Auth ─────────────────────────────────────────────────────────────
export async function sendOtp(email: string, tenantCode?: string): Promise<{ message: string }> {
  const { data } = await api.post("/parent/auth/send-otp", { email, tenantCode });
  return unwrap(data);
}

export interface VerifyOtpResponse {
  accessToken: string;
  refreshToken: string;
  parent: ParentProfile;
}

export async function verifyOtp(
  email: string,
  otp: string,
  tenantCode?: string,
): Promise<VerifyOtpResponse> {
  const { data } = await api.post("/parent/auth/verify-otp", {
    email,
    otp,
    tenantCode,
  });
  const result = unwrap<VerifyOtpResponse>(data);
  setTokens({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
  setParent(result.parent);
  return result;
}

export async function logout(): Promise<void> {
  try {
    await api.post("/parent/auth/logout");
  } catch {
    // ignore — we still clear locally
  } finally {
    clearAuth();
    // Hard nav guarantees every component remounts with fresh state and
    // bypasses any stale router/route-group caching.
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
  }
}

// ── Portal data ──────────────────────────────────────────────────────
export interface Student {
  id: string;
  tenantId: string;
  branch: string;
  admissionNumber: string;
  academicYear: string;
  name: string;
  email: string;
  phoneNumber: string;
  class: string;
  section: string;
  rollNo: string;
  imgUrl: string | null;
}

export type FeeTerm =
  | "1st Term Fee"
  | "2nd Term Fee"
  | "3rd Term Fee"
  | "4th Term Fee";
export type FeePaymentStatus = "UNPAID" | "PARTIAL" | "PAID";

export interface Fee {
  id: string;
  tenantId: string;
  branch: string;
  academicYear: string;
  studentId: string;
  term: FeeTerm;
  originalAmount: string;
  totalPenalty: string;
  totalDiscount: string;
  netAmount: string;
  paidAmount: string;
  paymentStatus: FeePaymentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  feeId: string | null;
  amount: number;
  currency: string;
  status: string;
  gateway: string | null;
  paymentType: string;
  paidAt: string | null;
  createdAt: string;
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
  summary: {
    totalDue: number;
    totalPaid: number;
    totalPenalty: number;
    totalPendingClearance: number;
  };
}

export async function fetchMe(): Promise<ParentProfile> {
  const { data } = await api.get("/parent/me");
  return unwrap<ParentProfile>(data);
}

export async function fetchChildren(): Promise<Student[]> {
  const { data } = await api.get("/parent/students");
  return unwrap<Student[]>(data);
}

export async function fetchDashboard(): Promise<DashboardResponse> {
  const { data } = await api.get("/parent/dashboard");
  return unwrap<DashboardResponse>(data);
}

export async function fetchFees(studentId?: string): Promise<Fee[]> {
  const { data } = await api.get("/parent/fees", {
    params: studentId ? { studentId } : undefined,
  });
  return unwrap<Fee[]>(data);
}

export async function fetchPayments(): Promise<Payment[]> {
  const { data } = await api.get("/parent/payments");
  return unwrap<Payment[]>(data);
}

export type Gateway = "razorpay" | "cashfree";

export interface InitiatePaymentResponse {
  payment: Payment;
  transaction: { id: string };
  gatewayResponse: Record<string, unknown>;
}

export async function initiatePayment(
  feeId: string,
  gateway: Gateway,
): Promise<InitiatePaymentResponse> {
  const { data } = await api.post("/parent/payments", { feeId, gateway });
  return unwrap<InitiatePaymentResponse>(data);
}
