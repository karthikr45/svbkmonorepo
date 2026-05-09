import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentGateway, PaymentStatus, PaymentType } from './entities/payment.entity';
import { Transaction, TransactionType } from './entities/transaction.entity';
import { CreateOrderDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentGatewayFactory } from './gateways/payment-gateway.factory';
import { PaymentAuditService } from './payment-audit.service';
import { AuditAction } from './entities/payment-audit-log.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @InjectRepository(Transaction)
    private readonly transactionsRepository: Repository<Transaction>,
    private readonly gatewayFactory: PaymentGatewayFactory,
    private readonly auditService: PaymentAuditService,
  ) {}

  async createOrder(tenantId: string, dto: CreateOrderDto): Promise<{ payment: Payment; transaction: Transaction; gatewayResponse: Record<string, any> }> {
    const notes = {
      admission: dto.ADMISSION,
      academicYear: dto.academicYear,
      term: dto.term,
      studentName: dto.studentName,
      email: dto.email,
      class: dto.class,
      section: dto.section,
      rollNo: dto.rollNo,
    };

    if (dto.paymentType === PaymentType.OFFLINE) {
      const payment = await this.paymentsRepository.save(
        this.paymentsRepository.create({
          tenantId,
          feeId: dto.feeId ?? null,
          paymentType: PaymentType.OFFLINE,
          gateway: null,
          status: PaymentStatus.PAID,
          gatewayOrderId: null,
          amount: dto.amount,
          currency: dto.currency,
          notes: JSON.stringify(notes),
          chequeNumber: dto.chequeNumber ?? null,
          chequeDate: dto.chequeDate ? new Date(dto.chequeDate) : null,
          ddDate: dto.ddDate ? new Date(dto.ddDate) : null,
          paidAt: new Date(),
        }),
      );

      const transaction = await this.transactionsRepository.save(
        this.transactionsRepository.create({
          tenantId,
          paymentId: payment.id,
          type: TransactionType.ORDER_CREATED,
          gateway: PaymentGateway.RAZORPAY, // placeholder — no gateway for offline
          status: PaymentStatus.PAID,
          gatewayOrderId: payment.id, // use payment id as reference
          amount: dto.amount,
          currency: dto.currency,
          notes: JSON.stringify(notes),
          paymentDetails: {
            studentName: dto.studentName,
            email: dto.email,
            admission: dto.ADMISSION,
            academicYear: dto.academicYear,
            term: dto.term,
            chequeNumber: dto.chequeNumber,
            chequeDate: dto.chequeDate,
            ddDate: dto.ddDate,
          },
        }),
      );

      void this.auditService.log({
        tenantId,
        action: AuditAction.ORDER_CREATED,
        paymentId: payment.id,
        transactionId: transaction.id,
        gateway: undefined,
        gatewayOrderId: undefined,
        toStatus: PaymentStatus.PAID,
        actor: 'api',
        metadata: { amount: dto.amount, currency: dto.currency, notes, paymentType: 'offline' },
      });

      return { payment, transaction, gatewayResponse: {} };
    }

    // Online payment — call the gateway
    const gateway = this.gatewayFactory.get(dto.gateway!);
    const result = await gateway.createOrder(dto.amount, dto.currency, notes);

    const payment = await this.paymentsRepository.save(
      this.paymentsRepository.create({
        tenantId,
        feeId: dto.feeId ?? null,
        paymentType: PaymentType.ONLINE,
        gateway: dto.gateway!,
        status: PaymentStatus.CREATED,
        gatewayOrderId: result.gatewayOrderId,
        amount: result.amount,
        currency: result.currency,
        notes: JSON.stringify(notes),
        chequeNumber: null,
        chequeDate: null,
        ddDate: null,
      }),
    );

    const transaction = await this.transactionsRepository.save(
      this.transactionsRepository.create({
        tenantId,
        paymentId: payment.id,
        type: TransactionType.ORDER_CREATED,
        gateway: dto.gateway!,
        status: PaymentStatus.CREATED,
        gatewayOrderId: result.gatewayOrderId,
        amount: result.amount,
        currency: result.currency,
        notes: JSON.stringify(notes),
        paymentDetails: {
          ...result.raw,
          studentName: dto.studentName,
          email: dto.email,
          admission: dto.ADMISSION,
          academicYear: dto.academicYear,
          term: dto.term,
        },
      }),
    );

    void this.auditService.log({
      tenantId,
      action: AuditAction.ORDER_CREATED,
      paymentId: payment.id,
      transactionId: transaction.id,
      gateway: dto.gateway,
      gatewayOrderId: result.gatewayOrderId,
      toStatus: PaymentStatus.CREATED,
      actor: 'api',
      metadata: {
        amount: result.amount,
        currency: result.currency,
        notes,
        rawGatewayResponse: result.raw,
      },
    });

    return { payment, transaction, gatewayResponse: result.raw };
  }

  async verifyPayment(tenantId: string, dto: VerifyPaymentDto): Promise<{ payment: Payment; transaction: Transaction }> {
    const orderId   = dto.gatewayOrderId   ?? dto.razorpay_order_id;
    const paymentId = dto.gatewayPaymentId ?? dto.razorpay_payment_id;
    const signature = dto.signature        ?? dto.razorpay_signature ?? '';
    const resolvedGateway = dto.gateway ?? (dto.razorpay_order_id ? PaymentGateway.RAZORPAY : undefined);

    if (!orderId)          throw new BadRequestException('gatewayOrderId or razorpay_order_id is required');
    if (!paymentId)        throw new BadRequestException('gatewayPaymentId or razorpay_payment_id is required');
    if (!resolvedGateway)  throw new BadRequestException('gateway is required');

    const payment = await this.paymentsRepository.findOne({
      where: { gatewayOrderId: orderId, tenantId },
    });
    if (!payment) throw new NotFoundException(`Order ${orderId} not found`);

    if (payment.status === PaymentStatus.PAID) {
      const transaction = await this.transactionsRepository.findOne({
        where: { paymentId: payment.id, type: TransactionType.PAYMENT_SUCCESS },
      });
      return { payment, transaction: transaction! };
    }

    const gateway = this.gatewayFactory.get(resolvedGateway);
    const result = await gateway.verifyPayment({
      gatewayOrderId: orderId,
      gatewayPaymentId: paymentId,
      signature,
    });
    console.log(result,"rrrrrrrrrrr",paymentId,signature,orderId,"gtt",resolvedGateway)

    const transactionType = result.success ? TransactionType.PAYMENT_SUCCESS : TransactionType.PAYMENT_FAILED;
    const paymentStatus = result.success ? PaymentStatus.PAID : PaymentStatus.FAILED;

    if (!result.success) {
      payment.status = PaymentStatus.FAILED;
      payment.failureReason = 'Signature verification failed';
      await this.paymentsRepository.save(payment);

      const failedTx = await this.transactionsRepository.save(
        this.transactionsRepository.create({
          tenantId,
          paymentId: payment.id,
          type: transactionType,
          gateway: resolvedGateway,
          status: paymentStatus,
          gatewayOrderId: orderId,
          gatewayPaymentId: paymentId,
          amount: payment.amount,
          currency: payment.currency,
          notes: payment.notes,
          paymentDetails: {
            gatewayOrderId: orderId,
            gatewayPaymentId: paymentId,
            reason: 'Signature verification failed',
          },
        }),
      ) as unknown as Transaction;

      void this.auditService.log({
        tenantId,
        action: AuditAction.PAYMENT_VERIFY_FAILED,
        paymentId: payment.id,
        transactionId: failedTx.id,
        gateway: resolvedGateway,
        gatewayOrderId: orderId,
        gatewayPaymentId: paymentId,
        fromStatus: PaymentStatus.CREATED,
        toStatus: PaymentStatus.FAILED,
        actor: 'api',
        isError: true,
        errorMessage: 'Signature verification failed',
        metadata: {
          gatewayOrderId: orderId,
          gatewayPaymentId: paymentId,
          rawGatewayResult: result,
        },
      });

      throw new BadRequestException('Payment verification failed');
    }

    const fromStatus = payment.status;
    payment.status = PaymentStatus.PAID;
    payment.gatewayPaymentId = result.gatewayPaymentId;
    payment.paidAt = new Date();
    const savedPayment = await this.paymentsRepository.save(payment);

    const transaction = await this.transactionsRepository.save(
      this.transactionsRepository.create({
        tenantId,
        paymentId: payment.id,
        type: transactionType,
        gateway: resolvedGateway,
        status: paymentStatus,
        gatewayOrderId: orderId,
        gatewayPaymentId: result.gatewayPaymentId,
        amount: payment.amount,
        currency: payment.currency,
        notes: payment.notes,
        paymentDetails: {
          gatewayOrderId: orderId,
          gatewayPaymentId: result.gatewayPaymentId,
          signature,
          verifiedAt: new Date().toISOString(),
        },
      }),
    ) as unknown as Transaction;

    void this.auditService.log({
      tenantId,
      action: AuditAction.PAYMENT_VERIFIED,
      paymentId: savedPayment.id,
      transactionId: transaction.id,
      gateway: resolvedGateway,
      gatewayOrderId: orderId,
      gatewayPaymentId: result.gatewayPaymentId,
      fromStatus,
      toStatus: PaymentStatus.PAID,
      actor: 'api',
      metadata: {
        verifiedAt: savedPayment.paidAt,
        rawGatewayResult: result,
      },
    });

    return { payment: savedPayment, transaction };
  }

  async findAll(tenantId: string): Promise<Payment[]> {
    return this.paymentsRepository.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async findOne(tenantId: string, id: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({ where: { id, tenantId } });
    if (!payment) throw new NotFoundException(`Payment ${id} not found`);
    return payment;
  }

  async findTransactions(tenantId: string, paymentId: string): Promise<Transaction[]> {
    return this.transactionsRepository.find({
      where: { paymentId, tenantId },
      order: { createdAt: 'ASC' },
    });
  }
}
