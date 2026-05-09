import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { FeesService } from '../fees/fees.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Payment, PaymentStatus } from './entities/payment.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly feesService: FeesService,
  ) {}

  async createPayment(dto: CreatePaymentDto, parentId: string) {
    const feeRecord = await this.feesService.findById(dto.feeRecordId);
    if (!feeRecord) throw new NotFoundException('Fee record not found');

    const remaining = Number(feeRecord.totalAmount) - Number(feeRecord.paidAmount);
    if (dto.amount > remaining) {
      throw new BadRequestException(
        `Payment amount ₹${dto.amount} exceeds remaining due ₹${remaining}`,
      );
    }
    if (dto.amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    const transactionId = `TXN-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const payment = this.paymentRepo.create({
      feeRecordId: dto.feeRecordId,
      amount: dto.amount,
      status: PaymentStatus.SUCCESS,
      transactionId,
      metadata: { parentId, paidAt: new Date().toISOString() },
    });
    await this.paymentRepo.save(payment);

    const updatedFeeRecord = await this.feesService.updateAfterPayment(
      dto.feeRecordId,
      dto.amount,
    );

    return {
      payment: {
        id: payment.id,
        feeRecordId: payment.feeRecordId,
        amount: Number(payment.amount),
        status: payment.status,
        transactionId: payment.transactionId,
        createdAt: payment.createdAt,
      },
      feeRecord: {
        id: updatedFeeRecord.id,
        totalAmount: Number(updatedFeeRecord.totalAmount),
        paidAmount: Number(updatedFeeRecord.paidAmount),
        dueAmount: Number(updatedFeeRecord.totalAmount) - Number(updatedFeeRecord.paidAmount),
        status: updatedFeeRecord.status,
        receiptNumber: updatedFeeRecord.receiptNumber,
        paidDate: updatedFeeRecord.paidDate,
      },
    };
  }

  async getPaymentsByFeeRecord(feeRecordId: string): Promise<Payment[]> {
    return this.paymentRepo.find({
      where: { feeRecordId },
      order: { createdAt: 'DESC' },
    });
  }
}
