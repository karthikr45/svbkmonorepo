import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Fee, PaymentStatus, TermType } from './entities/fee.entity';
import { FeePayment, ClearanceStatus, PaymentType } from './entities/fee-payment.entity';
import { Student } from '../students/entities/student.entity';
import { CreateFeeInput, ExistingFeeRecord } from './dto/fee.dto';

const BATCH_SIZE = 500;

/** Classification helpers for payment types. */
const OFFLINE_TYPES = new Set<PaymentType>([
  PaymentType.CASH,
  PaymentType.CHEQUE,
  PaymentType.DD,
  PaymentType.POS,
  PaymentType.NEFT,
]);
const ONLINE_TYPES = new Set<PaymentType>([
  PaymentType.RAZORPAY,
  PaymentType.CASHFREE,
  PaymentType.UPI,
  PaymentType.NETBANKING,
  PaymentType.CARD,
]);

@Injectable()
export class FeesService {
  private readonly logger = new Logger(FeesService.name);

  constructor(
    @InjectRepository(Fee) private readonly feeRepo: Repository<Fee>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async getFeeStats(tenantId: string): Promise<{
    students: {
      total: number;
      thisMonth: number;
      previousMonth: number;
      percentageChange: number;
      trend: 'increase' | 'decrease' | 'no_change';
    };
    amount: {
      total: number;
      thisMonth: number;
      previousMonth: number;
      percentageChange: number;
      trend: 'increase' | 'decrease' | 'no_change';
    };
    penalty: {
      total: number;
      thisMonth: number;
      previousMonth: number;
      percentageChange: number;
      trend: 'increase' | 'decrease' | 'no_change';
    };
  }> {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const studentRepo = this.dataSource.getRepository(Student);

    const [
      studentTotal,
      studentThis,
      studentPrev,
      amountTotalRow,
      amountThisRow,
      amountPrevRow,
      penaltyTotalRow,
      penaltyThisRow,
      penaltyPrevRow,
    ] = await Promise.all([
      // ── student counts ──
      studentRepo.count({ where: { tenantId } }),
      studentRepo
        .createQueryBuilder('s')
        .where('s.tenantId = :tenantId', { tenantId })
        .andWhere('s.createdAt >= :start', { start: thisMonthStart })
        .getCount(),
      studentRepo
        .createQueryBuilder('s')
        .where('s.tenantId = :tenantId', { tenantId })
        .andWhere('s.createdAt >= :start AND s.createdAt < :end', {
          start: prevMonthStart,
          end: thisMonthStart,
        })
        .getCount(),
      // ── originalAmount totals ──
      this.feeRepo
        .createQueryBuilder('fee')
        .select('COALESCE(SUM(fee.originalAmount), 0)', 'total')
        .where('fee.tenantId = :tenantId', { tenantId })
        .getRawOne<{ total: string }>(),
      this.feeRepo
        .createQueryBuilder('fee')
        .select('COALESCE(SUM(fee.originalAmount), 0)', 'total')
        .where('fee.tenantId = :tenantId', { tenantId })
        .andWhere('fee.createdAt >= :start', { start: thisMonthStart })
        .getRawOne<{ total: string }>(),
      this.feeRepo
        .createQueryBuilder('fee')
        .select('COALESCE(SUM(fee.originalAmount), 0)', 'total')
        .where('fee.tenantId = :tenantId', { tenantId })
        .andWhere('fee.createdAt >= :start AND fee.createdAt < :end', {
          start: prevMonthStart,
          end: thisMonthStart,
        })
        .getRawOne<{ total: string }>(),
      // ── totalPenalty totals ──
      this.feeRepo
        .createQueryBuilder('fee')
        .select('COALESCE(SUM(fee.totalPenalty), 0)', 'total')
        .where('fee.tenantId = :tenantId', { tenantId })
        .getRawOne<{ total: string }>(),
      this.feeRepo
        .createQueryBuilder('fee')
        .select('COALESCE(SUM(fee.totalPenalty), 0)', 'total')
        .where('fee.tenantId = :tenantId', { tenantId })
        .andWhere('fee.createdAt >= :start', { start: thisMonthStart })
        .getRawOne<{ total: string }>(),
      this.feeRepo
        .createQueryBuilder('fee')
        .select('COALESCE(SUM(fee.totalPenalty), 0)', 'total')
        .where('fee.tenantId = :tenantId', { tenantId })
        .andWhere('fee.createdAt >= :start AND fee.createdAt < :end', {
          start: prevMonthStart,
          end: thisMonthStart,
        })
        .getRawOne<{ total: string }>(),
    ]);

    return {
      students: buildStats(studentTotal, studentThis, studentPrev),
      amount: buildStats(
        Number(amountTotalRow?.total ?? 0),
        Number(amountThisRow?.total ?? 0),
        Number(amountPrevRow?.total ?? 0),
      ),
      penalty: buildStats(
        Number(penaltyTotalRow?.total ?? 0),
        Number(penaltyThisRow?.total ?? 0),
        Number(penaltyPrevRow?.total ?? 0),
      ),
    };
  }

  // ──────────────── Upload flow helpers ────────────────

  async findExistingByKeys(
    tenantId: string,
    branch: string,
    keys: { admissionNumber: string; academicYear: string }[],
  ): Promise<ExistingFeeRecord[]> {
    if (!keys.length) return [];

    const admissions = [...new Set(keys.map((k) => k.admissionNumber))];
    const years = [...new Set(keys.map((k) => k.academicYear))];

    return this.feeRepo
      .createQueryBuilder('fee')
      .innerJoin('fee.student', 'student')
      .select('fee.term', 'term')
      .addSelect('fee.academicYear', 'academicYear')
      .addSelect('student.admissionNumber', 'admissionNumber')
      .where('fee.tenantId = :tenantId', { tenantId })
      .andWhere('fee.branch = :branch', { branch })
      .andWhere('fee.academicYear IN (:...years)', { years })
      .andWhere('student.admissionNumber IN (:...admissions)', { admissions })
      .getRawMany<ExistingFeeRecord>();
  }

  async bulkCreate(
    inputs: CreateFeeInput[],
    manager: EntityManager,
  ): Promise<number> {
    if (!inputs.length) return 0;

    const repo = manager.getRepository(Fee);
    const rows = inputs.map((input) => {
      const discount = Math.max(0, input.totalDiscount ?? 0);
      const net = Math.max(0, input.originalAmount - discount);
      return repo.create({
        tenantId: input.tenantId,
        branch: input.branch,
        academicYear: input.academicYear,
        studentId: input.studentId,
        term: input.term,
        originalAmount: input.originalAmount.toFixed(2),
        totalPenalty: '0.00',
        totalDiscount: discount.toFixed(2),
        netAmount: net.toFixed(2),
        paidAmount: '0.00',
        paymentStatus: PaymentStatus.UNPAID,
      });
    });

    let saved = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      await repo.save(chunk);
      saved += chunk.length;
    }
    this.logger.log(`Created ${saved} fees`);
    return saved;
  }

  // ──────────────── Penalty / discount ────────────────

 /**
 * Adds `amount` penalty to fees in (branch, academicYear, term). Two modes:
 *  - applyToAll=true: every non-PAID fee in scope.
 *  - applyToAll=false: only fees of listed students.
 *
 * PAID fees are silently skipped and counted in `feesSkipped`.
 *
 * Atomic: one transaction. SELECT FOR UPDATE on each affected fee row
 * to serialize concurrent payment writes.
 */
async addPenaltyForStudents(
  tenantId: string,
  input: {
    branch: string;
    academicYear: string;
    term: TermType;
    applyToAll?: boolean;
    admissionNumbers?: string[];
    amount: number;
    reason?: string;
  },
): Promise<{
  feesAffected: number;
  feesSkipped: number;
  totalPenaltyApplied: string;
}> {
  if (
    !input.applyToAll &&
    (!input.admissionNumbers || !input.admissionNumbers.length)
  ) {
    return { feesAffected: 0, feesSkipped: 0, totalPenaltyApplied: '0.00' };
  }

  return this.dataSource.transaction(async (manager) => {
    const repo = manager.getRepository(Fee);

    let qb = repo
      .createQueryBuilder('fee')
      .innerJoin('fee.student', 'student')
      .setLock('pessimistic_write')
      .where('fee.tenantId = :tenantId', { tenantId })
      .andWhere('fee.branch = :branch', { branch: input.branch })
      .andWhere('fee.academicYear = :year', { year: input.academicYear })
      .andWhere('fee.term = :term', { term: input.term });

    if (!input.applyToAll) {
      qb = qb.andWhere('student.admissionNumber IN (:...admissions)', {
        admissions: input.admissionNumbers,
      });
    }

    const fees = await qb.getMany();

    let affected = 0;
    let skipped = 0;
    const toSave: Fee[] = [];

    for (const fee of fees) {
      if (fee.paymentStatus === PaymentStatus.PAID) {
        skipped++;
        continue;
      }
      fee.totalPenalty = (Number(fee.totalPenalty) + input.amount).toFixed(2);
      this.recomputeDerived(fee);
      toSave.push(fee);
      affected++;
    }

    if (toSave.length) await repo.save(toSave);

    this.logger.log(
      `Penalty +${input.amount} applied to ${affected} fees, skipped ${skipped} ` +
        `(branch=${input.branch}, year=${input.academicYear}, term=${input.term}, ` +
        `applyToAll=${!!input.applyToAll})${
          input.reason ? `; reason: ${input.reason}` : ''
        }`,
    );

    return {
      feesAffected: affected,
      feesSkipped: skipped,
      totalPenaltyApplied: (input.amount * affected).toFixed(2),
    };
  });
}

/**
 * Waives the entire current penalty on fees in (branch, academicYear, term).
 *  - applyToAll=true: every non-PAID fee with penalty > 0.
 *  - applyToAll=false: only fees of listed students.
 *
 * PAID fees and fees with no penalty are silently skipped.
 */
async waivePenaltyForStudents(
  tenantId: string,
  input: {
    branch: string;
    academicYear: string;
    term: TermType;
    applyToAll?: boolean;
    admissionNumbers?: string[];
    reason?: string;
  },
): Promise<{
  feesAffected: number;
  feesSkipped: number;
  totalPenaltyWaived: string;
}> {
  if (
    !input.applyToAll &&
    (!input.admissionNumbers || !input.admissionNumbers.length)
  ) {
    return { feesAffected: 0, feesSkipped: 0, totalPenaltyWaived: '0.00' };
  }

  return this.dataSource.transaction(async (manager) => {
    const repo = manager.getRepository(Fee);

    let qb = repo
      .createQueryBuilder('fee')
      .innerJoin('fee.student', 'student')
      .setLock('pessimistic_write')
      .where('fee.tenantId = :tenantId', { tenantId })
      .andWhere('fee.branch = :branch', { branch: input.branch })
      .andWhere('fee.academicYear = :year', { year: input.academicYear })
      .andWhere('fee.term = :term', { term: input.term });

    if (!input.applyToAll) {
      qb = qb.andWhere('student.admissionNumber IN (:...admissions)', {
        admissions: input.admissionNumbers,
      });
    }

    const fees = await qb.getMany();

    let affected = 0;
    let skipped = 0;
    let totalWaived = 0;
    const toSave: Fee[] = [];

    for (const fee of fees) {
      if (
        fee.paymentStatus === PaymentStatus.PAID ||
        Number(fee.totalPenalty) === 0
      ) {
        skipped++;
        continue;
      }
      totalWaived += Number(fee.totalPenalty);
      fee.totalPenalty = '0.00';
      this.recomputeDerived(fee);
      toSave.push(fee);
      affected++;
    }

    if (toSave.length) await repo.save(toSave);

    this.logger.log(
      `Penalty waiver removed ₹${totalWaived.toFixed(2)} from ${affected} fees, ` +
        `skipped ${skipped} (branch=${input.branch}, year=${input.academicYear}, ` +
        `term=${input.term}, applyToAll=${!!input.applyToAll})${
          input.reason ? `; reason: ${input.reason}` : ''
        }`,
    );

    return {
      feesAffected: affected,
      feesSkipped: skipped,
      totalPenaltyWaived: totalWaived.toFixed(2),
    };
  });
}

  /**
   * Adds `amount` to the fee's total_discount. Discount can't exceed
   * what's still owed (net − paid remaining after the discount).
   */
  async addDiscount(
    tenantId: string,
    feeId: string,
    amount: number,
    reason: string | undefined,
  ): Promise<Fee> {
    return this.dataSource.transaction(async (manager) => {
      const fee = await this.lockFee(manager, tenantId, feeId);

      const newDiscount = Number(fee.totalDiscount) + amount;
      const newNet =
        Number(fee.originalAmount) + Number(fee.totalPenalty) - newDiscount;

      if (newNet < Number(fee.paidAmount)) {
        throw new BadRequestException(
          `Discount would reduce net amount below what has already been paid`,
        );
      }

      fee.totalDiscount = newDiscount.toFixed(2);
      this.recomputeDerived(fee);
      this.logger.log(
        `Discount +${amount} on fee=${feeId}${reason ? ` (${reason})` : ''}`,
      );
      return manager.getRepository(Fee).save(fee);
    });
  }

  // ──────────────── Payment recording ────────────────

  /**
   * Records an offline payment and updates the fee's paid_amount +
   * payment_status atomically. Used by the admin UI.
   */
  async recordOfflinePayment(
    tenantId: string,
    feeId: string,
    input: {
      amount: number;
      paymentType: PaymentType;
      chequeNumber?: string;
      chequeDate?: string;
      ddNumber?: string;
      ddDate?: string;
      bankName?: string;
      bankBranch?: string;
      drawerName?: string;
      transactionId?: string;
      cardLast4?: string;
      notes?: string;
      paidAt?: string;
      recordedBy: string | null;
    },
  ): Promise<FeePayment> {
    if (!OFFLINE_TYPES.has(input.paymentType)) {
      throw new BadRequestException(
        `paymentType ${input.paymentType} is not an offline type`,
      );
    }
    return this.recordPayment(tenantId, feeId, {
      ...input,
      orderId: null,
      transactionId: input.transactionId ?? null,
    });
  }

  /**
   * Records an online payment. Called by the payments team's webhook
   * handler after a gateway confirms success. Same internals as the
   * offline path but requires orderId + transactionId and rejects
   * offline payment types.
   */
  async recordOnlinePayment(
    tenantId: string,
    feeId: string,
    input: {
      amount: number;
      paymentType: PaymentType;
      orderId: string;
      transactionId: string;
      paidAt?: string;
      recordedBy: string | null;
    },
  ): Promise<FeePayment> {
    if (!ONLINE_TYPES.has(input.paymentType)) {
      throw new BadRequestException(
        `paymentType ${input.paymentType} is not an online type`,
      );
    }
    return this.recordPayment(tenantId, feeId, input);
  }

  /**
   * Shared payment-recording logic. Inside one transaction:
   *   1. Lock the fee row
   *   2. Verify amount doesn't exceed remaining balance
   *   3. Insert the FeePayment
   *   4. Update fee.paid_amount + payment_status
   */
  private async recordPayment(
    tenantId: string,
    feeId: string,
    input: {
      amount: number;
      paymentType: PaymentType;
      orderId: string | null;
      transactionId: string | null;
      chequeNumber?: string;
      chequeDate?: string;
      ddNumber?: string;
      ddDate?: string;
      bankName?: string;
      bankBranch?: string;
      drawerName?: string;
      cardLast4?: string;
      notes?: string;
      paidAt?: string;
      recordedBy: string | null;
    },
  ): Promise<FeePayment> {
    return this.dataSource.transaction(async (manager) => {
      const fee = await this.lockFee(manager, tenantId, feeId);

      const remaining = Number(fee.netAmount) - Number(fee.paidAmount);
      if (input.amount > remaining + 0.01) {
        throw new BadRequestException(
          `Payment of ${input.amount} exceeds remaining balance ${remaining.toFixed(2)}`,
        );
      }

      // Cheque/DD start as PENDING; everything else clears instantly.
      const clearanceStatus =
        input.paymentType === PaymentType.CHEQUE ||
        input.paymentType === PaymentType.DD
          ? ClearanceStatus.PENDING
          : ClearanceStatus.NA;

      const receiptNumber = await this.generateReceiptNumber(
        manager,
        tenantId,
        input.paidAt ? new Date(input.paidAt) : new Date(),
      );

      const payment = manager.getRepository(FeePayment).create({
        tenantId,
        branch: fee.branch,
        feeId,
        amount: input.amount.toFixed(2),
        paymentType: input.paymentType,
        receiptNumber,
        orderId: input.orderId,
        transactionId: input.transactionId,
        chequeNumber: input.chequeNumber ?? null,
        chequeDate: input.chequeDate ? new Date(input.chequeDate) : null,
        ddNumber: input.ddNumber ?? null,
        ddDate: input.ddDate ? new Date(input.ddDate) : null,
        bankName: input.bankName ?? null,
        bankBranch: input.bankBranch ?? null,
        drawerName: input.drawerName ?? null,
        cardLast4: input.cardLast4 ?? null,
        notes: input.notes ?? null,
        clearanceStatus,
        paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
        recordedBy: input.recordedBy,
      });
      const savedPayment = await manager
        .getRepository(FeePayment)
        .save(payment);

      // Pending cheque/DD payments do NOT add to paid_amount yet —
      // only on clearance (see updateClearance). Cash/POS/online/NEFT
      // are recognised immediately.
      if (clearanceStatus === ClearanceStatus.NA) {
        fee.paidAmount = (Number(fee.paidAmount) + input.amount).toFixed(2);
        fee.paymentStatus = this.deriveStatus(
          Number(fee.paidAmount),
          Number(fee.netAmount),
        );
        await manager.getRepository(Fee).save(fee);
      }

      this.logger.log(
        `Payment ${input.amount} (${input.paymentType}, ${clearanceStatus}) on fee=${feeId}; paid_amount=${fee.paidAmount}, receipt=${receiptNumber}`,
      );
      return savedPayment;
    });
  }

  /**
   * Mark a previously-recorded cheque/DD as CLEARED or BOUNCED.
   * - CLEARED: adds the amount to fee.paid_amount.
   * - BOUNCED: leaves fee.paid_amount untouched (it never went up).
   * - Re-clearing or re-bouncing the same payment is a no-op.
   */
  async updateClearance(
    tenantId: string,
    feePaymentId: string,
    status: ClearanceStatus,
    notes?: string,
  ): Promise<FeePayment> {
    if (status === ClearanceStatus.PENDING || status === ClearanceStatus.NA) {
      throw new BadRequestException(
        'status must be CLEARED or BOUNCED',
      );
    }
    return this.dataSource.transaction(async (manager) => {
      const fp = await manager.getRepository(FeePayment).findOne({
        where: { id: feePaymentId, tenantId },
      });
      if (!fp) throw new NotFoundException(`fee_payment ${feePaymentId} not found`);
      if (
        fp.paymentType !== PaymentType.CHEQUE &&
        fp.paymentType !== PaymentType.DD
      ) {
        throw new BadRequestException(
          'Only CHEQUE / DD payments have a clearance step',
        );
      }
      if (fp.clearanceStatus === status) {
        return fp; // idempotent
      }

      const fee = await this.lockFee(manager, tenantId, fp.feeId);

      if (
        fp.clearanceStatus === ClearanceStatus.PENDING &&
        status === ClearanceStatus.CLEARED
      ) {
        fee.paidAmount = (
          Number(fee.paidAmount) + Number(fp.amount)
        ).toFixed(2);
      } else if (
        fp.clearanceStatus === ClearanceStatus.CLEARED &&
        status === ClearanceStatus.BOUNCED
      ) {
        // Reverse a previously-cleared cheque (rare).
        fee.paidAmount = Math.max(
          0,
          Number(fee.paidAmount) - Number(fp.amount),
        ).toFixed(2);
      }
      fee.paymentStatus = this.deriveStatus(
        Number(fee.paidAmount),
        Number(fee.netAmount),
      );
      await manager.getRepository(Fee).save(fee);

      fp.clearanceStatus = status;
      if (notes) fp.notes = (fp.notes ? fp.notes + '\n' : '') + notes;
      const saved = await manager.getRepository(FeePayment).save(fp);

      this.logger.log(
        `Clearance ${status} for fee_payment=${feePaymentId}; fee.paid_amount=${fee.paidAmount}`,
      );
      return saved;
    });
  }

  /**
   * Generate a unique receipt number for a payment. Format:
   *   RCP-{tenant short}-{YYYYMMDD}-{NNNN}
   * Where NNNN is a per-day per-tenant sequence. Uses a row-level
   * lock by reading the max existing seq for the day.
   */
  private async generateReceiptNumber(
    manager: EntityManager,
    tenantId: string,
    paidAt: Date,
  ): Promise<string> {
    const yyyy = paidAt.getFullYear();
    const mm = String(paidAt.getMonth() + 1).padStart(2, '0');
    const dd = String(paidAt.getDate()).padStart(2, '0');
    const datePart = `${yyyy}${mm}${dd}`;
    const prefix = `RCP-${tenantId.slice(0, 4).toUpperCase()}-${datePart}-`;
    const last = await manager
      .getRepository(FeePayment)
      .createQueryBuilder('fp')
      .select('fp.receipt_number', 'receipt_number')
      .where('fp.tenant_id = :tenantId', { tenantId })
      .andWhere('fp.receipt_number LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('fp.receipt_number', 'DESC')
      .limit(1)
      .getRawOne<{ receipt_number: string }>();
    const lastSeq = last?.receipt_number
      ? Number(last.receipt_number.slice(prefix.length))
      : 0;
    const nextSeq = String(lastSeq + 1).padStart(4, '0');
    return `${prefix}${nextSeq}`;
  }

  // ──────────────── Internals ────────────────

  /** SELECT ... FOR UPDATE so concurrent writes serialize. */
  private async lockFee(
    manager: EntityManager,
    tenantId: string,
    feeId: string,
  ): Promise<Fee> {
    const fee = await manager
      .getRepository(Fee)
      .createQueryBuilder('fee')
      .setLock('pessimistic_write')
      .where('fee.id = :feeId AND fee.tenantId = :tenantId', {
        feeId,
        tenantId,
      })
      .getOne();
    if (!fee) throw new NotFoundException(`Fee ${feeId} not found`);
    return fee;
  }

  /** Recomputes net_amount and payment_status from the other fields. */
  private recomputeDerived(fee: Fee): void {
    const net =
      Number(fee.originalAmount) +
      Number(fee.totalPenalty) -
      Number(fee.totalDiscount);
    fee.netAmount = net.toFixed(2);
    fee.paymentStatus = this.deriveStatus(Number(fee.paidAmount), net);
  }

  private deriveStatus(paid: number, net: number): PaymentStatus {
    if (paid === 0) return PaymentStatus.UNPAID;
    if (paid < net) return PaymentStatus.PARTIAL;
    return PaymentStatus.PAID; // paid >= net; net was validated >= paid on discount
  }
}

function buildStats(total: number, thisMonth: number, previousMonth: number) {
  let percentageChange = 0;
  let trend: 'increase' | 'decrease' | 'no_change' = 'no_change';

  if (previousMonth === 0) {
    percentageChange = thisMonth > 0 ? 100 : 0;
    trend = thisMonth > 0 ? 'increase' : 'no_change';
  } else {
    const raw = ((thisMonth - previousMonth) / previousMonth) * 100;
    percentageChange = Math.round(raw * 100) / 100;
    if (thisMonth > previousMonth) trend = 'increase';
    else if (thisMonth < previousMonth) trend = 'decrease';
  }

  return { total, thisMonth, previousMonth, percentageChange, trend };
}