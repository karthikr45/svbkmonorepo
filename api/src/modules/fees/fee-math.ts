import { ReceiptResetPolicy } from '../tenants/entities/tenant.entity';
import { PaymentStatus } from './entities/fee.entity';

/**
 * Pure money math for the fee/receipt paths. Kept dependency-free (no
 * TypeORM / Nest) so the highest-risk logic — payment status transitions
 * and receipt-number uniqueness/format — is unit-tested in isolation.
 */

/**
 * Indian academic year boundary: April 1 — March 31. Months 0-2 (Jan/
 * Feb/Mar) belong to the *previous* academic year.
 */
export function guessAcademicYear(d: Date): string {
  const year = d.getFullYear();
  const monthIdx = d.getMonth(); // 0-based; April = 3
  const startYear = monthIdx >= 3 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

/** Period bucket a receipt sequence resets on, given the tenant policy. */
export function computePeriodKey(
  policy: ReceiptResetPolicy,
  when: Date,
  academicYear: string | null,
): string {
  if (policy === ReceiptResetPolicy.NEVER) return 'GLOBAL';
  if (policy === ReceiptResetPolicy.YEARLY) return String(when.getFullYear());
  if (policy === ReceiptResetPolicy.MONTHLY) {
    const mm = String(when.getMonth() + 1).padStart(2, '0');
    return `${when.getFullYear()}-${mm}`;
  }
  if (policy === ReceiptResetPolicy.DAILY) {
    const mm = String(when.getMonth() + 1).padStart(2, '0');
    const dd = String(when.getDate()).padStart(2, '0');
    return `${when.getFullYear()}${mm}${dd}`;
  }
  // ACADEMIC_YEAR — prefer the explicit AY from the fee row; fall back
  // to a calendar guess. Short-form "2025-26" reads better on receipts.
  const ay = academicYear ?? guessAcademicYear(when);
  const m = ay.match(/^(\d{4})\D+(\d{4})$/);
  if (!m) return ay;
  return `${m[1]}-${m[2].slice(2)}`;
}

/** Normalises a tenant's receipt prefix to [A-Z0-9]. */
export function sanitizeReceiptPrefix(raw: string | null | undefined): string {
  return (raw ?? 'RCP')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** Final receipt string: {PREFIX}[-{period}]-{####}. */
export function assembleReceiptNumber(
  prefix: string,
  policy: ReceiptResetPolicy,
  periodKey: string,
  seq: number,
): string {
  const padded = String(seq).padStart(4, '0');
  const periodSegment =
    policy === ReceiptResetPolicy.NEVER ? '' : `-${periodKey}`;
  return `${prefix}${periodSegment}-${padded}`;
}

/** UNPAID at 0, PARTIAL below net, PAID once paid covers net. */
export function deriveStatus(paid: number, net: number): PaymentStatus {
  if (paid === 0) return PaymentStatus.UNPAID;
  if (paid < net) return PaymentStatus.PARTIAL;
  return PaymentStatus.PAID;
}
