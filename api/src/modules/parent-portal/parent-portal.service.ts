import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Student } from '../students/entities/student.entity';
import { Fee } from '../fees/entities/fee.entity';
import {
  ClearanceStatus,
  FeePayment,
} from '../fees/entities/fee-payment.entity';
import {
  Payment,
  PaymentGateway,
  PaymentType,
} from '../payments/entities/payment.entity';
import { ParentStudent } from '../parents/entities/parent-student.entity';
import { ParentsService } from '../parents/parents.service';
import { PaymentsService } from '../payments/payments.service';
import { AcademicYearsService } from '../academic-years/academic-years.service';

@Injectable()
export class ParentPortalService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Fee)
    private readonly feeRepo: Repository<Fee>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(ParentStudent)
    private readonly linkRepo: Repository<ParentStudent>,
    private readonly parentsService: ParentsService,
    private readonly paymentsService: PaymentsService,
    private readonly academicYearsService: AcademicYearsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async me(tenantId: string, parentId: string) {
    const parent = await this.parentsService.findOneOrFail(tenantId, parentId);
    return {
      id: parent.id,
      name: parent.name,
      email: parent.email,
      phoneNumber: parent.phoneNumber,
      tenantId: parent.tenantId,
      isActive: parent.isActive,
    };
  }

  /**
   * Resolves the current-academic-year Student rows for every admission
   * the parent is linked to. Falls back to the latest year row if no
   * "current" academic year is configured for the tenant.
   */
  async listChildren(tenantId: string, parentId: string): Promise<Student[]> {
    const links = await this.linkRepo.find({
      where: { parentId, tenantId },
    });
    if (!links.length) return [];

    const currentYear = await this.academicYearsService
      .findCurrentYear(tenantId)
      .catch(() => null);

    if (currentYear) {
      const students = await this.studentRepo.find({
        where: links.map((l) => ({
          tenantId,
          branch: l.branch,
          admissionNumber: l.admissionNumber,
          academicYear: currentYear.academicYear,
        })),
      });
      if (students.length) return students;
    }

    // Fallback: pick the most recent row per admission
    const all = await this.studentRepo.find({
      where: links.map((l) => ({
        tenantId,
        branch: l.branch,
        admissionNumber: l.admissionNumber,
      })),
      order: { academicYear: 'DESC', createdAt: 'DESC' },
    });

    const byKey = new Map<string, Student>();
    for (const s of all) {
      const key = `${s.branch}::${s.admissionNumber}`;
      if (!byKey.has(key)) byKey.set(key, s);
    }
    return [...byKey.values()];
  }

  async ensureChildBelongsToParent(
    tenantId: string,
    parentId: string,
    studentId: string,
  ): Promise<Student> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, tenantId },
    });
    if (!student) {
      throw new NotFoundException(`Student ${studentId} not found`);
    }
    const link = await this.linkRepo.findOne({
      where: {
        parentId,
        tenantId,
        branch: student.branch,
        admissionNumber: student.admissionNumber,
      },
    });
    if (!link) {
      throw new ForbiddenException('You are not linked to this student');
    }
    return student;
  }

  async listFees(
    tenantId: string,
    parentId: string,
    studentId?: string,
  ): Promise<Fee[]> {
    if (studentId) {
      await this.ensureChildBelongsToParent(tenantId, parentId, studentId);
      return this.feeRepo.find({
        where: { tenantId, studentId },
        order: { academicYear: 'DESC', term: 'ASC' },
      });
    }
    const children = await this.listChildren(tenantId, parentId);
    if (!children.length) return [];
    return this.feeRepo.find({
      where: { tenantId, studentId: In(children.map((c) => c.id)) },
      order: { academicYear: 'DESC', term: 'ASC' },
    });
  }

  async listPayments(tenantId: string, parentId: string): Promise<Payment[]> {
    const children = await this.listChildren(tenantId, parentId);
    if (!children.length) return [];
    const fees = await this.feeRepo.find({
      where: { tenantId, studentId: In(children.map((c) => c.id)) },
      select: ['id'],
    });
    if (!fees.length) return [];
    return this.paymentRepo.find({
      where: { tenantId, feeId: In(fees.map((f) => f.id)) },
      order: { createdAt: 'DESC' },
    });
  }

  async dashboard(tenantId: string, parentId: string) {
    const children = await this.listChildren(tenantId, parentId);
    if (!children.length) {
      return {
        children: [],
        summary: {
          totalDue: 0,
          totalPaid: 0,
          totalPenalty: 0,
          totalPendingClearance: 0,
        },
      };
    }

    const fees = await this.feeRepo.find({
      where: { tenantId, studentId: In(children.map((c) => c.id)) },
    });

    // Pending cheques/DDs — payments that don't yet count as paid
    // but are with the school awaiting bank clearance.
    const pendingClearance = await this.dataSource
      .getRepository(FeePayment)
      .createQueryBuilder('fp')
      .select('COALESCE(SUM(fp.amount), 0)', 'total')
      .where('fp.tenantId = :tenantId', { tenantId })
      .andWhere('fp.feeId IN (:...feeIds)', {
        feeIds: fees.length ? fees.map((f) => f.id) : [''],
      })
      .andWhere('fp.clearanceStatus = :status', {
        status: ClearanceStatus.PENDING,
      })
      .getRawOne<{ total: string }>();

    const sum = (key: 'netAmount' | 'paidAmount' | 'totalPenalty') =>
      fees.reduce((acc, f) => acc + Number(f[key] ?? 0), 0);

    const totalNet = sum('netAmount');
    const totalPaid = sum('paidAmount');
    const totalPenalty = sum('totalPenalty');
    const totalPendingClearance = Number(pendingClearance?.total ?? 0);

    const perChild = children.map((c) => {
      const childFees = fees.filter((f) => f.studentId === c.id);
      const due = childFees.reduce(
        (a, f) => a + (Number(f.netAmount) - Number(f.paidAmount)),
        0,
      );
      return {
        student: {
          id: c.id,
          name: c.name,
          admissionNumber: c.admissionNumber,
          class: c.class,
          section: c.section,
          rollNo: c.rollNo,
          academicYear: c.academicYear,
          imgUrl: c.imgUrl,
        },
        feesCount: childFees.length,
        amountDue: Math.max(0, due),
      };
    });

    return {
      children: perChild,
      summary: {
        totalDue: Math.max(0, totalNet - totalPaid),
        totalPaid,
        totalPenalty,
        totalPendingClearance,
      },
    };
  }

  /**
   * Initiate an online payment for a fee against the parent's child.
   * Validates the fee belongs to a child this parent is linked to, then
   * delegates to the existing PaymentsService.createOrder.
   */
  async initiatePayment(
    tenantId: string,
    parentId: string,
    feeId: string,
    gateway: PaymentGateway,
  ) {
    const fee = await this.feeRepo.findOne({ where: { id: feeId, tenantId } });
    if (!fee) {
      throw new NotFoundException(`Fee ${feeId} not found`);
    }
    if (fee.paymentStatus === 'PAID') {
      throw new BadRequestException('This fee is already fully paid');
    }
    const balance = Number(fee.netAmount) - Number(fee.paidAmount);
    if (balance <= 0) {
      throw new BadRequestException('Nothing left to pay on this fee');
    }

    const student = await this.ensureChildBelongsToParent(
      tenantId,
      parentId,
      fee.studentId,
    );

    return this.paymentsService.createOrder(tenantId, {
      tenantId,
      feeId: fee.id,
      paymentType: PaymentType.ONLINE,
      gateway,
      amount: Math.round(balance * 100), // paise
      currency: 'INR',
      ADMISSION: student.admissionNumber,
      academicYear: student.academicYear,
      term: fee.term,
      studentName: student.name,
      class: student.class,
      section: student.section,
      rollNo: student.rollNo,
      email: student.email,
    });
  }
}
