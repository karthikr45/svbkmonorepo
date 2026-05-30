import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Role } from '../../../common/enums/roles.enum';
import { Fee, PaymentStatus } from '../../fees/entities/fee.entity';
import {
  AdjustmentApproval,
  ApprovalStatus,
} from '../../approvals/entities/adjustment-approval.entity';
import {
  IntentDefinition,
  IntentHandlerDeps,
  IntentResponse,
} from './intent.types';

interface AdminDeps {
  feeRepo: Repository<Fee>;
  approvalRepo: Repository<AdjustmentApproval>;
}

function deps(d: IntentHandlerDeps): AdminDeps {
  return d.services as unknown as AdminDeps;
}

function rupees(amount: string | number | null | undefined): string {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return '₹0';
  return `₹${n.toLocaleString('en-IN')}`;
}

const ADMIN_ROLES: string[] = [Role.ADMIN, Role.SUPER_ADMIN];

function assertAdmin(role: string) {
  if (!ADMIN_ROLES.includes(role)) {
    throw new ForbiddenException('Admin-only query.');
  }
}

export const getFeeDefaultersIntent: IntentDefinition = {
  name: 'get_fee_defaulters',
  allowedRoles: ADMIN_ROLES,
  async handler(caller, entities, d): Promise<IntentResponse> {
    assertAdmin(caller.role);
    if (!caller.tenantId) {
      return {
        data: [],
        text: 'No tenant on your token; pick a tenant first.',
      };
    }

    const qb = deps(d)
      .feeRepo.createQueryBuilder('f')
      .where('f.tenantId = :tenantId', { tenantId: caller.tenantId })
      .andWhere('f.paymentStatus != :paid', { paid: PaymentStatus.PAID });

    const term = entities.term as string | undefined;
    if (term) qb.andWhere('f.term = :term', { term });

    const academicYear = entities.academicYear as string | undefined;
    if (academicYear) {
      qb.andWhere('f.academicYear = :ay', { ay: academicYear });
    }

    const rows = await qb.limit(200).getMany();
    const count = rows.length;
    const totalDue = rows.reduce(
      (s, r) => s + (Number(r.netAmount) - Number(r.paidAmount)),
      0,
    );

    if (!count) {
      return {
        data: [],
        text:
          `No outstanding fees${term ? ` for ${term}` : ''}${
            academicYear ? ` (${academicYear})` : ''
          }.`,
      };
    }

    return {
      data: { count, totalDue: totalDue.toFixed(2), rows: rows.slice(0, 50) },
      text:
        `${count} fee row${count === 1 ? '' : 's'} outstanding, ` +
        `${rupees(totalDue)} in total${term ? ` for ${term}` : ''}.`,
      chips: [
        {
          label: 'Pending approvals',
          message: 'Show pending discount approvals',
        },
      ],
    };
  },
};

export const getPendingApprovalsIntent: IntentDefinition = {
  name: 'get_pending_approvals',
  allowedRoles: ADMIN_ROLES,
  async handler(caller, _entities, d): Promise<IntentResponse> {
    assertAdmin(caller.role);
    if (!caller.tenantId) {
      return { data: [], text: 'No tenant on your token.' };
    }
    const rows = await deps(d).approvalRepo.find({
      where: { tenantId: caller.tenantId, status: ApprovalStatus.PENDING },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    if (!rows.length) {
      return { data: [], text: 'No pending approvals right now.' };
    }
    return {
      data: rows.map((r) => ({
        id: r.id,
        summary: r.summary,
        requestedAt: r.createdAt,
      })),
      text:
        `${rows.length} approval${rows.length === 1 ? '' : 's'} waiting on you. ` +
        `Latest: "${rows[0].summary}".`,
    };
  },
};

export const getCollectionSummaryIntent: IntentDefinition = {
  name: 'get_collection_summary',
  allowedRoles: ADMIN_ROLES,
  async handler(caller, entities, d): Promise<IntentResponse> {
    assertAdmin(caller.role);
    if (!caller.tenantId) {
      return { data: null, text: 'No tenant on your token.' };
    }

    // Date range from extracted entities; default to current academic year.
    const fromDate = entities.fromDate as string | undefined;
    const toDate = entities.toDate as string | undefined;

    const qb = deps(d)
      .feeRepo.createQueryBuilder('f')
      .select('COALESCE(SUM(f.paid_amount), 0)', 'total')
      .addSelect('COUNT(f.id)', 'count')
      .where('f.tenantId = :tenantId', { tenantId: caller.tenantId })
      .andWhere('f.paidAmount > 0');

    if (fromDate) qb.andWhere('f.updatedAt >= :from', { from: fromDate });
    if (toDate) qb.andWhere('f.updatedAt <= :to', { to: toDate });

    const row = await qb.getRawOne<{ total: string; count: string }>();
    const total = Number(row?.total ?? 0);
    const count = Number(row?.count ?? 0);

    return {
      data: { totalCollected: total.toFixed(2), feesCount: count },
      text:
        `${rupees(total)} collected across ${count} fee row${
          count === 1 ? '' : 's'
        }${fromDate || toDate ? ` (${fromDate ?? 'all-time'} → ${toDate ?? 'now'})` : ''}.`,
    };
  },
};
