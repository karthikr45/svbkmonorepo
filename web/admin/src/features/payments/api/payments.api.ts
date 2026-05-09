/** Payments admin API: list pending cheques, mark clearance, open receipt. */
import { get, patch, post } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/env";

export type OfflinePaymentType = "CASH" | "CHEQUE" | "DD" | "POS" | "NEFT";

export interface RecordOfflinePaymentBody {
  paymentType: OfflinePaymentType;
  amount: number;
  paidAt: string; // ISO
  notes?: string;
  // Cheque
  chequeNumber?: string;
  chequeDate?: string;
  // DD
  ddNumber?: string;
  ddDate?: string;
  // Bank fields (cheque/DD/NEFT)
  bankName?: string;
  bankBranch?: string;
  drawerName?: string; // cheque/DD
  // POS / NEFT
  transactionId?: string;
  cardLast4?: string;
}

export interface PendingClearancePayment {
  id: string;
  feeId: string;
  amount: string;
  paymentType: "CHEQUE" | "DD";
  receiptNumber: string | null;
  chequeNumber: string | null;
  chequeDate: string | null;
  ddNumber: string | null;
  ddDate: string | null;
  bankName: string | null;
  bankBranch: string | null;
  drawerName: string | null;
  paidAt: string;
  fee?: {
    id: string;
    term: string;
    academicYear: string;
    studentId: string;
  };
  student?: {
    id: string;
    name: string;
    admissionNumber: string;
    class: string;
    section: string;
    rollNo: string;
  };
}

export async function recordOfflinePaymentApi(
  feeId: string,
  body: RecordOfflinePaymentBody,
): Promise<unknown> {
  return post<unknown, RecordOfflinePaymentBody>(
    `/fees/${feeId}/offline-payment`,
    body,
  );
}

export async function listPendingClearanceApi(): Promise<PendingClearancePayment[]> {
  return get<PendingClearancePayment[]>("/fees/payments/pending-clearance");
}

export async function updateClearanceApi(
  paymentId: string,
  status: "CLEARED" | "BOUNCED",
  notes?: string,
): Promise<unknown> {
  return patch<unknown>(`/fees/payments/${paymentId}/clearance`, {
    status,
    notes,
  });
}

/** Build the receipt URL — opens in a new tab; the API returns HTML. */
export function receiptUrl(paymentId: string): string {
  return `${getApiBaseUrl()}/fees/payments/${paymentId}/receipt`;
}
