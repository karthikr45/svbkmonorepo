import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Fee, PaymentStatus, TermType } from './entities/fee.entity';
import { FeePayment, ClearanceStatus, PaymentType } from './entities/fee-payment.entity';
import { FeeAdjustment, FeeAdjustmentKind } from './entities/fee-adjustment.entity';
import { Student } from '../students/entities/student.entity';
import { CreateFeeInput, ExistingFeeRecord } from './dto/fee.dto';

/** Snapshot of who triggered a penalty/discount mutation. */
export interface AdjustmentActor {
  userId: string | null;
  email?: string | null;
}

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
    @InjectRepository(FeeAdjustment)
    private readonly adjustmentRepo: Repository<FeeAdjustment>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * Records one fee_adjustments row inside the supplied transaction
   * manager so the audit row commits atomically with the fee mutation.
   */
  private async logAdjustment(
    manager: EntityManager,
    row: {
      tenantId: string;
      feeId: string;
      kind: FeeAdjustmentKind;
      amount: number;
      reason?: string | null;
      actor?: AdjustmentActor;
    },
  ): Promise<void> {
    const repo = manager.getRepository(FeeAdjustment);
    await repo.save(
      repo.create({
        tenantId: row.tenantId,
        feeId: row.feeId,
        kind: row.kind,
        amount: row.amount.toFixed(2),
        reason: row.reason?.trim() || null,
        createdById: row.actor?.userId ?? null,
        createdByEmail: row.actor?.email ?? null,
      }),
    );
  }

  /** Read all adjustments for a fee, newest first. */
  async listAdjustments(tenantId: string, feeId: string): Promise<FeeAdjustment[]> {
    return this.adjustmentRepo.find({
      where: { tenantId, feeId },
      order: { createdAt: 'DESC' },
    });
  }

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
  actor?: AdjustmentActor,
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

    if (toSave.length) {
      await repo.save(toSave);
      for (const fee of toSave) {
        await this.logAdjustment(manager, {
          tenantId,
          feeId: fee.id,
          kind: FeeAdjustmentKind.PENALTY_ADD,
          amount: input.amount,
          reason: input.reason,
          actor,
        });
      }
    }

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
  actor?: AdjustmentActor,
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
    const toSave: { fee: Fee; waived: number }[] = [];

    for (const fee of fees) {
      if (
        fee.paymentStatus === PaymentStatus.PAID ||
        Number(fee.totalPenalty) === 0
      ) {
        skipped++;
        continue;
      }
      const waivedFromThis = Number(fee.totalPenalty);
      totalWaived += waivedFromThis;
      fee.totalPenalty = '0.00';
      this.recomputeDerived(fee);
      toSave.push({ fee, waived: waivedFromThis });
      affected++;
    }

    if (toSave.length) {
      await repo.save(toSave.map((t) => t.fee));
      for (const { fee, waived } of toSave) {
        await this.logAdjustment(manager, {
          tenantId,
          feeId: fee.id,
          kind: FeeAdjustmentKind.PENALTY_WAIVE,
          amount: waived,
          reason: input.reason,
          actor,
        });
      }
    }

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
   * Bulk discount across fees in (branch, academicYear, term). Same
   * scope semantics as addPenaltyForStudents. Per-fee, the discount is
   * skipped if it would push net below what has already been paid (we
   * never silently invalidate a posted payment).
   */
  async addDiscountForStudents(
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
    actor?: AdjustmentActor,
  ): Promise<{
    feesAffected: number;
    feesSkipped: number;
    totalDiscountApplied: string;
  }> {
    if (
      !input.applyToAll &&
      (!input.admissionNumbers || !input.admissionNumbers.length)
    ) {
      return { feesAffected: 0, feesSkipped: 0, totalDiscountApplied: '0.00' };
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
        const newDiscount = Number(fee.totalDiscount) + input.amount;
        const newNet =
          Number(fee.originalAmount) + Number(fee.totalPenalty) - newDiscount;
        if (newNet < Number(fee.paidAmount)) {
          skipped++;
          continue;
        }
        fee.totalDiscount = newDiscount.toFixed(2);
        this.recomputeDerived(fee);
        toSave.push(fee);
        affected++;
      }

      if (toSave.length) {
        await repo.save(toSave);
        for (const fee of toSave) {
          await this.logAdjustment(manager, {
            tenantId,
            feeId: fee.id,
            kind: FeeAdjustmentKind.DISCOUNT_ADD,
            amount: input.amount,
            reason: input.reason,
            actor,
          });
        }
      }

      this.logger.log(
        `Discount +${input.amount} applied to ${affected} fees, skipped ${skipped} ` +
          `(branch=${input.branch}, year=${input.academicYear}, term=${input.term}, ` +
          `applyToAll=${!!input.applyToAll})${
            input.reason ? `; reason: ${input.reason}` : ''
          }`,
      );

      return {
        feesAffected: affected,
        feesSkipped: skipped,
        totalDiscountApplied: (input.amount * affected).toFixed(2),
      };
    });
  }

  /**
   * Waives the entire current discount on fees in scope. Skips PAID
   * fees, fees with no discount, and fees where removing the discount
   * would invalidate an already-posted payment.
   */
  async waiveDiscountForStudents(
    tenantId: string,
    input: {
      branch: string;
      academicYear: string;
      term: TermType;
      applyToAll?: boolean;
      admissionNumbers?: string[];
      reason?: string;
    },
    actor?: AdjustmentActor,
  ): Promise<{
    feesAffected: number;
    feesSkipped: number;
    totalDiscountWaived: string;
  }> {
    if (
      !input.applyToAll &&
      (!input.admissionNumbers || !input.admissionNumbers.length)
    ) {
      return { feesAffected: 0, feesSkipped: 0, totalDiscountWaived: '0.00' };
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
      const toSave: { fee: Fee; waived: number }[] = [];

      for (const fee of fees) {
        if (
          fee.paymentStatus === PaymentStatus.PAID ||
          Number(fee.totalDiscount) === 0
        ) {
          skipped++;
          continue;
        }
        const newNet =
          Number(fee.originalAmount) + Number(fee.totalPenalty);
        if (newNet < Number(fee.paidAmount)) {
          // Removing the discount would push net below paid → skip.
          skipped++;
          continue;
        }
        const waivedFromThis = Number(fee.totalDiscount);
        totalWaived += waivedFromThis;
        fee.totalDiscount = '0.00';
        this.recomputeDerived(fee);
        toSave.push({ fee, waived: waivedFromThis });
        affected++;
      }

      if (toSave.length) {
        await repo.save(toSave.map((t) => t.fee));
        for (const { fee, waived } of toSave) {
          await this.logAdjustment(manager, {
            tenantId,
            feeId: fee.id,
            kind: FeeAdjustmentKind.DISCOUNT_WAIVE,
            amount: waived,
            reason: input.reason,
            actor,
          });
        }
      }

      this.logger.log(
        `Discount waiver removed ₹${totalWaived.toFixed(2)} from ${affected} fees, ` +
          `skipped ${skipped} (branch=${input.branch}, year=${input.academicYear}, ` +
          `term=${input.term}, applyToAll=${!!input.applyToAll})${
            input.reason ? `; reason: ${input.reason}` : ''
          }`,
      );

      return {
        feesAffected: affected,
        feesSkipped: skipped,
        totalDiscountWaived: totalWaived.toFixed(2),
      };
    });
  }

  /**
   * Adds `amount` to a single fee's total_penalty. PAID fees are
   * rejected — penalising a fully-paid student would create a phantom
   * balance and should be done by re-opening the fee instead.
   */
  async addPenaltyToFee(
    tenantId: string,
    feeId: string,
    amount: number,
    reason: string | undefined,
    actor?: AdjustmentActor,
  ): Promise<Fee> {
    return this.dataSource.transaction(async (manager) => {
      const fee = await this.lockFee(manager, tenantId, feeId);
      if (fee.paymentStatus === PaymentStatus.PAID) {
        throw new BadRequestException(
          'Cannot add penalty to a PAID fee. Adjust the underlying payment first.',
        );
      }
      fee.totalPenalty = (Number(fee.totalPenalty) + amount).toFixed(2);
      this.recomputeDerived(fee);
      const saved = await manager.getRepository(Fee).save(fee);
      await this.logAdjustment(manager, {
        tenantId,
        feeId,
        kind: FeeAdjustmentKind.PENALTY_ADD,
        amount,
        reason,
        actor,
      });
      this.logger.log(
        `Penalty +${amount} on fee=${feeId}${reason ? ` (${reason})` : ''}`,
      );
      return saved;
    });
  }

  /**
   * Waives part or all of a single fee's penalty. If `amount` is
   * omitted, the entire current penalty is wiped. Skips PAID fees.
   */
  async waivePenaltyOnFee(
    tenantId: string,
    feeId: string,
    amount: number | undefined,
    reason: string | undefined,
    actor?: AdjustmentActor,
  ): Promise<Fee> {
    return this.dataSource.transaction(async (manager) => {
      const fee = await this.lockFee(manager, tenantId, feeId);
      if (fee.paymentStatus === PaymentStatus.PAID) {
        throw new BadRequestException('Cannot waive penalty on a PAID fee.');
      }
      const current = Number(fee.totalPenalty);
      if (current === 0) {
        throw new BadRequestException('No penalty to waive.');
      }
      const waiveAmt = amount ? Math.min(amount, current) : current;
      fee.totalPenalty = (current - waiveAmt).toFixed(2);
      this.recomputeDerived(fee);
      const saved = await manager.getRepository(Fee).save(fee);
      await this.logAdjustment(manager, {
        tenantId,
        feeId,
        kind: FeeAdjustmentKind.PENALTY_WAIVE,
        amount: waiveAmt,
        reason,
        actor,
      });
      this.logger.log(
        `Penalty waiver −${waiveAmt} on fee=${feeId}${reason ? ` (${reason})` : ''}`,
      );
      return saved;
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
    actor?: AdjustmentActor,
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
      const saved = await manager.getRepository(Fee).save(fee);
      await this.logAdjustment(manager, {
        tenantId,
        feeId,
        kind: FeeAdjustmentKind.DISCOUNT_ADD,
        amount,
        reason,
        actor,
      });
      this.logger.log(
        `Discount +${amount} on fee=${feeId}${reason ? ` (${reason})` : ''}`,
      );
      return saved;
    });
  }

  /**
   * Waives part or all of a single fee's discount. If `amount` is
   * omitted, the full discount is wiped. Refuses to push net below
   * paid amount.
   */
  async waiveDiscountOnFee(
    tenantId: string,
    feeId: string,
    amount: number | undefined,
    reason: string | undefined,
    actor?: AdjustmentActor,
  ): Promise<Fee> {
    return this.dataSource.transaction(async (manager) => {
      const fee = await this.lockFee(manager, tenantId, feeId);
      const current = Number(fee.totalDiscount);
      if (current === 0) {
        throw new BadRequestException('No discount to waive.');
      }
      const waiveAmt = amount ? Math.min(amount, current) : current;
      const newDiscount = current - waiveAmt;
      const newNet =
        Number(fee.originalAmount) + Number(fee.totalPenalty) - newDiscount;
      if (newNet < Number(fee.paidAmount)) {
        throw new BadRequestException(
          'Removing this discount would push net below the amount already paid.',
        );
      }
      fee.totalDiscount = newDiscount.toFixed(2);
      this.recomputeDerived(fee);
      const saved = await manager.getRepository(Fee).save(fee);
      await this.logAdjustment(manager, {
        tenantId,
        feeId,
        kind: FeeAdjustmentKind.DISCOUNT_WAIVE,
        amount: waiveAmt,
        reason,
        actor,
      });
      this.logger.log(
        `Discount waiver −${waiveAmt} on fee=${feeId}${reason ? ` (${reason})` : ''}`,
      );
      return saved;
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
   * Resolve a student by admission number (current/specified academic
   * year) along with every fee for that year. Used by the admin
   * Record-Payment fee picker.
   */
  async findStudentWithFees(
    tenantId: string,
    admissionNumber: string,
    academicYear?: string,
  ): Promise<{ student: Student | null; fees: Fee[] }> {
    const studentRepo = this.dataSource.getRepository(Student);
    const where: Record<string, unknown> = {
      tenantId,
      admissionNumber,
    };
    if (academicYear) where.academicYear = academicYear;
    const students = await studentRepo.find({
      where: where as any,
      order: { academicYear: 'DESC', createdAt: 'DESC' },
    });
    const student = students[0] ?? null;
    if (!student) return { student: null, fees: [] };
    const fees = await this.feeRepo.find({
      where: { tenantId, studentId: student.id },
      order: { term: 'ASC' },
    });
    return { student, fees };
  }

  /**
   * Cross-tenant payment details. Finds the student in the current
   * tenant, plus the matching student (by admissionNumber + name) in
   * sibling tenants of type 'Hostel' / 'Transport'. Returns the fees
   * (and their payment history) grouped per tenant.
   *
   * Multi-tenant safety: only sibling tenants whose `type` is in
   * { Hostel, Transport } are considered, and the match requires
   * BOTH admissionNumber and name to align — this stops cross-school
   * collisions from leaking data.
   */
  async findPaymentDetails(
    callerTenantId: string,
    admissionNumber: string,
    academicYear?: string,
  ): Promise<{
    student: Student | null;
    groups: {
      tenantId: string;
      tenantName: string;
      type: 'School' | 'Hostel' | 'Transport';
      fees: (Fee & { payments?: FeePayment[] })[];
    }[];
  }> {
    const studentRepo = this.dataSource.getRepository(Student);
    const tenantsRepo = this.dataSource.getRepository('tenants');

    // 1. Caller's own student
    const own = (
      await studentRepo.find({
        where: {
          tenantId: callerTenantId,
          admissionNumber,
          ...(academicYear ? { academicYear } : {}),
        } as any,
        order: { academicYear: 'DESC', createdAt: 'DESC' },
      })
    )[0];
    if (!own) return { student: null, groups: [] };

    // 2. School tenant info
    const callerTenant: any = await tenantsRepo
      .createQueryBuilder('t')
      .where('t.id = :id', { id: callerTenantId })
      .getRawOne();

    const groups: {
      tenantId: string;
      tenantName: string;
      type: 'School' | 'Hostel' | 'Transport';
      fees: (Fee & { payments?: FeePayment[] })[];
    }[] = [];

    // 3. Caller fees + payments
    const ownFees = await this.feeRepo.find({
      where: { tenantId: callerTenantId, studentId: own.id },
      order: { term: 'ASC' },
    });
    const ownFeesWithPayments = await this.attachPayments(callerTenantId, ownFees);
    groups.push({
      tenantId: callerTenantId,
      tenantName:
        (callerTenant?.t_tenant_name ??
          callerTenant?.t_name ??
          callerTenant?.tenantName ??
          'School') as string,
      type: 'School',
      fees: ownFeesWithPayments,
    });

    // 4. Sibling Hostel + Transport tenants
    const siblings: any[] = await tenantsRepo
      .createQueryBuilder('t')
      .where("t.type IN (:...types)", { types: ['Hostel', 'Transport'] })
      .andWhere('t.id != :id', { id: callerTenantId })
      .getRawMany();

    for (const t of siblings) {
      const tId = (t.t_id ?? t.id) as string;
      const tType = ((t.t_type ?? t.type) as string) as
        | 'Hostel'
        | 'Transport'
        | string;
      const tName = (t.t_tenant_name ??
        t.t_name ??
        t.tenantName ??
        tType) as string;
      // Match: same admission number AND same name (case-insensitive)
      const candidate = await studentRepo
        .createQueryBuilder('s')
        .where('s.tenant_id = :tid', { tid: tId })
        .andWhere('s.admission_number = :adm', { adm: admissionNumber })
        .andWhere('LOWER(s.name) = LOWER(:nm)', { nm: own.name })
        .andWhere(
          academicYear ? 's.academic_year = :ay' : '1=1',
          academicYear ? { ay: academicYear } : {},
        )
        .orderBy('s.academic_year', 'DESC')
        .limit(1)
        .getOne();
      if (!candidate) continue;
      const fees = await this.feeRepo.find({
        where: { tenantId: tId, studentId: candidate.id },
        order: { term: 'ASC' },
      });
      const feesWithPayments = await this.attachPayments(tId, fees);
      groups.push({
        tenantId: tId,
        tenantName: tName,
        type: tType === 'Hostel' || tType === 'Transport' ? tType : 'School',
        fees: feesWithPayments,
      });
    }

    return { student: own, groups };
  }

  private async attachPayments(
    tenantId: string,
    fees: Fee[],
  ): Promise<(Fee & { payments?: FeePayment[] })[]> {
    if (!fees.length) return [];
    const payments = await this.dataSource
      .getRepository(FeePayment)
      .find({
        where: { tenantId, feeId: In(fees.map((f) => f.id)) },
        order: { paidAt: 'ASC' },
      });
    const byFee = new Map<string, FeePayment[]>();
    for (const p of payments) {
      if (!byFee.has(p.feeId)) byFee.set(p.feeId, []);
      byFee.get(p.feeId)!.push(p);
    }
    return fees.map((f) => Object.assign(f, { payments: byFee.get(f.id) ?? [] }));
  }

  /**
   * Every payment recorded against a fee, oldest first. Used for the
   * admin payment-history view (under Payments → Fee detail).
   */
  async listFeePayments(tenantId: string, feeId: string): Promise<FeePayment[]> {
    return this.dataSource
      .getRepository(FeePayment)
      .find({
        where: { tenantId, feeId },
        order: { paidAt: 'ASC' },
      });
  }

  /**
   * Tenant-wide payment log with optional filters.
   * Drives /reports/payment-logs.
   */
  async listAllPayments(
    tenantId: string,
    filters: {
      type?: 'online' | 'offline';
      clearance?: 'PENDING' | 'CLEARED' | 'BOUNCED' | 'NA';
      search?: string;
      from?: string;
      to?: string;
    } = {},
  ): Promise<FeePayment[]> {
    const qb = this.dataSource
      .getRepository(FeePayment)
      .createQueryBuilder('fp')
      .leftJoinAndMapOne('fp.fee', Fee, 'fee', 'fee.id = fp.feeId')
      .leftJoinAndMapOne(
        'fp.student',
        'students',
        'student',
        'student.id = fee.student_id',
      )
      .where('fp.tenantId = :tenantId', { tenantId })
      .orderBy('fp.paidAt', 'DESC')
      .limit(500);

    if (filters.type === 'online') {
      qb.andWhere('fp.paymentType IN (:...online)', {
        online: ['RAZORPAY', 'CASHFREE', 'UPI', 'NETBANKING', 'CARD'],
      });
    } else if (filters.type === 'offline') {
      qb.andWhere('fp.paymentType IN (:...offline)', {
        offline: ['CASH', 'CHEQUE', 'DD', 'POS', 'NEFT'],
      });
    }
    if (filters.clearance) {
      qb.andWhere('fp.clearanceStatus = :cs', { cs: filters.clearance });
    }
    if (filters.search) {
      const s = `%${filters.search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(fp.receipt_number) LIKE :s OR LOWER(student.admission_number) LIKE :s OR LOWER(student.name) LIKE :s)',
        { s },
      );
    }
    if (filters.from) {
      qb.andWhere('fp.paidAt >= :from', { from: new Date(filters.from) });
    }
    if (filters.to) {
      qb.andWhere('fp.paidAt <= :to', { to: new Date(filters.to) });
    }
    return qb.getMany();
  }

  /**
   * Every cheque/DD that's still awaiting bank clearance for the
   * current tenant. Used by the admin "Pending cheques" view.
   */
  async listPendingClearance(tenantId: string): Promise<FeePayment[]> {
    return this.dataSource
      .getRepository(FeePayment)
      .createQueryBuilder('fp')
      .leftJoinAndMapOne('fp.fee', Fee, 'fee', 'fee.id = fp.feeId')
      .leftJoinAndMapOne(
        'fp.student',
        'students',
        'student',
        'student.id = fee.student_id',
      )
      .where('fp.tenantId = :tenantId', { tenantId })
      .andWhere('fp.clearanceStatus = :status', { status: ClearanceStatus.PENDING })
      .orderBy('fp.paidAt', 'ASC')
      .getMany();
  }

  /**
   * Render a printable HTML receipt for one fee_payments row.
   * Self-contained — inlined CSS, no external assets — so admins can
   * print directly from the browser.
   */
  async renderReceipt(tenantId: string, paymentId: string): Promise<string> {
    return this.renderReceiptInner(tenantId, paymentId, /* asPage */ true);
  }

  /**
   * Render multiple receipts as one print-friendly HTML page with a
   * page break between each. Accepts either fee_payment UUIDs or
   * receipt_number strings — auto-detected per item.
   */
  async renderReceiptsBatch(
    tenantId: string,
    idsOrReceiptNos: string[],
  ): Promise<string> {
    if (idsOrReceiptNos.length === 0) return '';

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Resolve each input to a payment UUID
    const resolved: string[] = [];
    const notFound: string[] = [];
    for (const item of idsOrReceiptNos) {
      let id: string | null = null;
      if (uuidRe.test(item)) {
        id = item;
      } else {
        const row = await this.dataSource
          .getRepository(FeePayment)
          .findOne({ where: { tenantId, receiptNumber: item } });
        if (row) id = row.id;
      }
      if (id) resolved.push(id);
      else notFound.push(item);
    }

    const fragments = await Promise.all(
      resolved.map((id) => this.renderReceiptInner(tenantId, id, /* asPage */ false)),
    );

    const notFoundBanner = notFound.length
      ? `<div style="padding:24px;margin-bottom:16px;background:#fee2e2;border:1px solid #fecaca;border-radius:12px;color:#b91c1c;font-family:sans-serif;max-width:760px;margin:0 auto 16px"><strong>${notFound.length} receipt(s) not found:</strong> ${escapeHtml(notFound.join(', '))}</div>`
      : '';

    const body = fragments
      .map((f, i) => {
        const breakRule =
          i < fragments.length - 1
            ? '<div style="page-break-after:always;height:0"></div>'
            : '';
        return `<div class="receipt-wrap">${f}</div>${breakRule}`;
      })
      .join('\n');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Receipts (${resolved.length})</title>
<style>
  body{margin:0;padding:24px 0;background:#f1f5f9}
  .receipt-wrap{margin-bottom:24px}
  @media print{
    body{padding:0;background:#fff}
    .receipt-wrap{margin:0}
  }
  .toolbar{position:sticky;top:0;z-index:10;background:#fff;padding:12px 16px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#0f172a;box-shadow:0 1px 2px rgba(15,23,42,.04)}
  .toolbar button{background:#0b54ab;color:#fff;border:0;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer}
  .toolbar button:hover{background:#094a96}
  @media print{.toolbar{display:none}}
</style>
</head>
<body>
<div class="toolbar">
  <span>${resolved.length} receipt${resolved.length === 1 ? '' : 's'} ready to print${notFound.length ? ` · ${notFound.length} not found` : ''}</span>
  <button onclick="window.print()">Print all</button>
</div>
${notFoundBanner}
${body}
</body>
</html>`;
  }

  private async renderReceiptInner(
    tenantId: string,
    paymentId: string,
    asPage: boolean,
  ): Promise<string> {
    const fp = await this.dataSource
      .getRepository(FeePayment)
      .createQueryBuilder('fp')
      .innerJoinAndMapOne('fp.fee', Fee, 'fee', 'fee.id = fp.feeId')
      .where('fp.tenantId = :tenantId AND fp.id = :paymentId', {
        tenantId,
        paymentId,
      })
      .getOne();
    if (!fp) throw new NotFoundException(`fee_payment ${paymentId} not found`);
    const fee = (fp as any).fee as Fee;

    const student = await this.dataSource
      .getRepository('students')
      .createQueryBuilder('s')
      .where('s.id = :id', { id: fee.studentId })
      .getRawOne();

    const tenant = await this.dataSource
      .getRepository('tenants')
      .createQueryBuilder('t')
      .where('t.id = :id', { id: tenantId })
      .getRawOne();

    const inr = (n: number) =>
      new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
      }).format(n);

    const amount = Number(fp.amount);
    const words = numberToINRWords(amount);
    const paidAt = new Date(fp.paidAt).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const detailRow = (label: string, value: string | null | undefined) =>
      value
        ? `<tr><td class="lbl">${label}</td><td class="val">${escapeHtml(value)}</td></tr>`
        : '';

    const typeDetails: string[] = [];
    if (fp.paymentType === PaymentType.CHEQUE) {
      typeDetails.push(detailRow('Cheque No.', fp.chequeNumber));
      typeDetails.push(
        detailRow(
          'Cheque Date',
          fp.chequeDate ? new Date(fp.chequeDate).toLocaleDateString('en-IN') : '',
        ),
      );
      typeDetails.push(detailRow('Drawer', fp.drawerName));
      typeDetails.push(detailRow('Bank', fp.bankName));
      typeDetails.push(detailRow('Branch', fp.bankBranch));
      typeDetails.push(detailRow('Status', fp.clearanceStatus));
    } else if (fp.paymentType === PaymentType.DD) {
      typeDetails.push(detailRow('DD No.', fp.ddNumber));
      typeDetails.push(
        detailRow(
          'DD Date',
          fp.ddDate ? new Date(fp.ddDate).toLocaleDateString('en-IN') : '',
        ),
      );
      typeDetails.push(detailRow('Drawer', fp.drawerName));
      typeDetails.push(detailRow('Bank', fp.bankName));
      typeDetails.push(detailRow('Branch', fp.bankBranch));
      typeDetails.push(detailRow('Status', fp.clearanceStatus));
    } else if (fp.paymentType === PaymentType.POS) {
      typeDetails.push(detailRow('Terminal Txn', fp.transactionId));
      if (fp.cardLast4) typeDetails.push(detailRow('Card ending', `**** ${fp.cardLast4}`));
    } else if (fp.paymentType === PaymentType.NEFT) {
      typeDetails.push(detailRow('UTR / Txn', fp.transactionId));
      typeDetails.push(detailRow('Bank', fp.bankName));
    } else if (
      fp.paymentType === PaymentType.RAZORPAY ||
      fp.paymentType === PaymentType.CASHFREE ||
      fp.paymentType === PaymentType.UPI ||
      fp.paymentType === PaymentType.NETBANKING ||
      fp.paymentType === PaymentType.CARD
    ) {
      typeDetails.push(detailRow('Order ID', fp.orderId));
      typeDetails.push(detailRow('Transaction ID', fp.transactionId));
    }

    const receiptFragment = `  <div class="receipt">
    <div class="head">
      <div>
        <h1>${escapeHtml(tenant?.tenantName ?? 'School Receipt')}</h1>
        <h2>${escapeHtml(tenant?.address ?? '')} ${escapeHtml(tenant?.city ?? '')}</h2>
      </div>
      <div style="text-align:right">
        <span class="badge">Fee Receipt</span>
        <div style="margin-top:8px;font-size:12px;color:#64748b">${escapeHtml(fp.receiptNumber ?? fp.id)}</div>
      </div>
    </div>

    <div class="meta">
      <div><span>Receipt No.</span><strong>${escapeHtml(fp.receiptNumber ?? '—')}</strong></div>
      <div><span>Date</span><strong>${paidAt}</strong></div>
      <div><span>Branch</span><strong>${escapeHtml(fp.branch)}</strong></div>
      <div><span>Academic Year</span><strong>${escapeHtml(fee.academicYear)}</strong></div>
    </div>

    <div class="body">
      <h3>Student</h3>
      <table>
        <tr><td class="lbl">Name</td><td class="val">${escapeHtml(student?.name ?? '—')}</td></tr>
        <tr><td class="lbl">Admission No.</td><td class="val">${escapeHtml(student?.admission_number ?? '—')}</td></tr>
        <tr><td class="lbl">Class / Section</td><td class="val">${escapeHtml((student?.class ?? '') + ' — ' + (student?.section ?? ''))}</td></tr>
        <tr><td class="lbl">Roll No.</td><td class="val">${escapeHtml(student?.roll_no ?? '—')}</td></tr>
      </table>

      <h3>Fee</h3>
      <table>
        <tr><td class="lbl">Term</td><td class="val">${escapeHtml(fee.term)}</td></tr>
        <tr><td class="lbl">Original Amount</td><td class="val">${inr(Number(fee.originalAmount))}</td></tr>
        ${Number(fee.totalPenalty) > 0 ? `<tr><td class="lbl">Penalty</td><td class="val">${inr(Number(fee.totalPenalty))}</td></tr>` : ''}
        ${Number(fee.totalDiscount) > 0 ? `<tr><td class="lbl">Discount</td><td class="val">−${inr(Number(fee.totalDiscount))}</td></tr>` : '<tr><td class="lbl">Discount</td><td class="val">' + inr(0) + '</td></tr>'}
        <tr><td class="lbl">Net Amount</td><td class="val">${inr(Number(fee.netAmount))}</td></tr>
      </table>

      <h3>Payment</h3>
      <table>
        <tr><td class="lbl">Mode</td><td class="val">${escapeHtml(humanType(fp.paymentType))}</td></tr>
        ${typeDetails.join('\n        ')}
        ${detailRow('Notes', fp.notes)}
      </table>

      <div class="amount-box">
        <span class="total-label">Amount Received</span>
        <span class="total-fig">${inr(amount)}</span>
      </div>
      <p class="words"><strong>In words:</strong> ${escapeHtml(words)}</p>
    </div>

    <div class="footer">
      <div class="stamp">School Stamp</div>
      <div class="sig-line">Authorised Signatory</div>
    </div>
  </div>`;

    if (!asPage) return receiptFragment;

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Receipt ${escapeHtml(fp.receiptNumber ?? fp.id)}</title>
<style>
  *,*::before,*::after{box-sizing:border-box}
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#f1f5f9;color:#0f172a;margin:0;padding:32px}
  .receipt{max-width:760px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(15,23,42,.08);overflow:hidden}
  .head{padding:24px 32px;border-bottom:2px solid #0b54ab;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
  .head h1{margin:0;font-size:22px;color:#0b54ab;letter-spacing:-.01em}
  .head h2{margin:0;font-size:14px;font-weight:600;color:#475569}
  .badge{display:inline-block;padding:6px 12px;border-radius:6px;background:#eff6ff;color:#0b54ab;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.06em}
  .meta{padding:16px 32px;display:grid;grid-template-columns:1fr 1fr;gap:12px;border-bottom:1px solid #e2e8f0;font-size:13px}
  .meta div span{display:block;color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}
  .meta div strong{font-weight:700;color:#0f172a;font-size:14px}
  .body{padding:24px 32px}
  .body h3{margin:0 0 12px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#475569}
  table{width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px}
  td{padding:8px 0;vertical-align:top}
  td.lbl{color:#64748b;width:36%}
  td.val{color:#0f172a;font-weight:600}
  .amount-box{margin-top:16px;padding:18px 20px;background:#0b54ab;color:#fff;border-radius:10px;display:flex;justify-content:space-between;align-items:center}
  .amount-box .total-label{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;opacity:.85}
  .amount-box .total-fig{font-size:26px;font-weight:800;letter-spacing:-.01em}
  .words{margin-top:10px;font-size:13px;color:#334155;font-style:italic}
  .footer{display:flex;justify-content:space-between;padding:24px 32px 32px;border-top:1px dashed #cbd5e1;font-size:12px;color:#475569}
  .sig-line{border-top:1px solid #94a3b8;padding-top:6px;width:200px;text-align:center;font-weight:600;color:#475569;margin-top:36px}
  .stamp{width:160px;height:80px;border:2px dashed #cbd5e1;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;margin-top:18px}
  @media print{body{background:#fff;padding:0}.receipt{box-shadow:none;border-radius:0}}
</style>
</head>
<body>
${receiptFragment}
</body>
</html>`;
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
// ─────────────── Receipt helpers ───────────────

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function humanType(t: string): string {
  switch (t) {
    case 'CASH': return 'Cash';
    case 'CHEQUE': return 'Cheque';
    case 'DD': return 'Demand Draft';
    case 'POS': return 'POS (Card swipe)';
    case 'NEFT': return 'NEFT / Bank Transfer';
    case 'RAZORPAY': return 'Online — Razorpay';
    case 'CASHFREE': return 'Online — Cashfree';
    case 'UPI': return 'Online — UPI';
    case 'CARD': return 'Online — Card';
    case 'NETBANKING': return 'Online — Net Banking';
    default: return t;
  }
}

/**
 * Convert an INR amount (rupees + paise) to Indian-numbering English
 * words. Used for the receipt's "amount in words" line.
 */
function numberToINRWords(amount: number): string {
  if (amount == null || isNaN(amount)) return '';
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  const r = rupees === 0 ? 'Zero' : indianNumberWords(rupees);
  const p = paise > 0 ? ` and ${indianNumberWords(paise)} Paise` : '';
  return `Rupees ${r}${p} only`;
}

function indianNumberWords(num: number): string {
  if (num === 0) return 'Zero';
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function under1000(n: number): string {
    let str = '';
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + ' Hundred';
      n %= 100;
      if (n > 0) str += ' ';
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)];
      if (n % 10 > 0) str += ' ' + ones[n % 10];
    } else if (n > 0) {
      str += ones[n];
    }
    return str;
  }

  let n = num;
  let words = '';
  if (n >= 10000000) {
    words += under1000(Math.floor(n / 10000000)) + ' Crore ';
    n %= 10000000;
  }
  if (n >= 100000) {
    words += under1000(Math.floor(n / 100000)) + ' Lakh ';
    n %= 100000;
  }
  if (n >= 1000) {
    words += under1000(Math.floor(n / 1000)) + ' Thousand ';
    n %= 1000;
  }
  if (n > 0) words += under1000(n);
  return words.trim();
}
