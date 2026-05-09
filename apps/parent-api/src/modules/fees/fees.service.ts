import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeeRecord, FeeStatus } from './entities/fee-record.entity';

@Injectable()
export class FeesService {
  constructor(
    @InjectRepository(FeeRecord)
    private readonly feeRepo: Repository<FeeRecord>,
  ) {}

  async findByStudentId(
    studentId: string,
    termNumber?: number,
    academicYear?: string,
  ): Promise<FeeRecord[]> {
    const where: any = { studentId };
    if (termNumber !== undefined) where.termNumber = termNumber;
    if (academicYear) where.academicYear = academicYear;
    return this.feeRepo.find({ where, order: { termNumber: 'ASC', feeType: 'ASC' } });
  }

  async findById(id: string): Promise<FeeRecord | null> {
    return this.feeRepo.findOne({ where: { id } });
  }

  async findByIdOrFail(id: string): Promise<FeeRecord> {
    const record = await this.feeRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Fee record not found');
    return record;
  }

  async updateAfterPayment(feeRecordId: string, paidNow: number): Promise<FeeRecord> {
    const record = await this.findByIdOrFail(feeRecordId);
    const newPaidAmount = Number(record.paidAmount) + paidNow;
    const total = Number(record.totalAmount);

    let status: FeeStatus;
    if (newPaidAmount >= total) {
      status = FeeStatus.PAID;
    } else if (newPaidAmount > 0) {
      status = FeeStatus.PARTIAL;
    } else {
      status = FeeStatus.DUE;
    }

    await this.feeRepo.update(feeRecordId, {
      paidAmount: newPaidAmount,
      status,
      paidDate: status === FeeStatus.PAID ? new Date() : record.paidDate,
    });

    return this.findByIdOrFail(feeRecordId);
  }

  buildFeeSummary(fees: FeeRecord[]) {
    const totalAmount = fees.reduce((s, f) => s + Number(f.totalAmount), 0);
    const paidAmount = fees.reduce((s, f) => s + Number(f.paidAmount), 0);
    const paidCount = fees.filter((f) => f.status === FeeStatus.PAID).length;
    return {
      totalAmount,
      paidAmount,
      dueAmount: totalAmount - paidAmount,
      paidCount,
      totalCount: fees.length,
    };
  }
}
