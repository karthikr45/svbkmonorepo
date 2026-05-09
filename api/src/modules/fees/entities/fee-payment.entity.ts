import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { Fee } from './fee.entity';

export enum PaymentType {
  // Online (inserted by the payments team's webhook handler)
  RAZORPAY = 'RAZORPAY',
  CASHFREE = 'CASHFREE',
  UPI = 'UPI',
  NETBANKING = 'NETBANKING',
  CARD = 'CARD',
  // Offline (inserted by admin staff)
  CASH = 'CASH',
  CHEQUE = 'CHEQUE',
  DD = 'DD',
  NEFT = 'NEFT',
}

/**
 * One row per payment installment. A fee with three part payments has
 * three rows here. For online payments, order_id + transaction_id come
 * from the gateway (Razorpay / Cashfree). For offline, those are null
 * and the relevant offline fields are populated.
 *
 * This is NOT a full accounting ledger — no reversals, no idempotency
 * keys, no receipt numbers. Those will come later if needed. For the
 * MVP this captures enough for: (a) listing a student's payment history,
 * (b) the webhook team to record online payments, (c) admins to record
 * offline payments.
 */
@Entity('fee_payments')
@Index('idx_fp_fee', ['feeId'])
@Index('idx_fp_tenant_paid_at', ['tenantId', 'paidAt'])
@Check('chk_fp_amount_positive', '"amount" > 0')
export class FeePayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 100 })
  branch: string;

  @ManyToOne(() => Fee, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'fee_id' })
  fee: Fee;

  @Column({ name: 'fee_id', type: 'uuid' })
  feeId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ name: 'payment_type', type: 'enum', enum: PaymentType })
  paymentType: PaymentType;

  /** Gateway order id (Razorpay's order_id, Cashfree's order_id, etc.). */
  @Column({ name: 'order_id', type: 'varchar', length: 100, nullable: true })
  orderId: string | null;

  /** Gateway payment / transaction id. */
  @Column({
    name: 'transaction_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  transactionId: string | null;

  /** Offline cheque details. */
  @Column({ name: 'cheque_number', type: 'varchar', length: 50, nullable: true })
  chequeNumber: string | null;

  @Column({ name: 'cheque_date', type: 'date', nullable: true })
  chequeDate: Date | null;

  /** Offline DD details. */
  @Column({ name: 'dd_number', type: 'varchar', length: 50, nullable: true })
  ddNumber: string | null;

  @Column({ name: 'dd_date', type: 'date', nullable: true })
  ddDate: Date | null;

  @Column({ name: 'bank_name', type: 'varchar', length: 100, nullable: true })
  bankName: string | null;

  /** When the money was actually received. For online this is when the
   *  webhook confirmed; for offline it's when the admin recorded it. */
  @Column({ name: 'paid_at', type: 'timestamptz' })
  paidAt: Date;

  /** User who recorded the payment. Null for webhook-inserted rows. */
  @Column({ name: 'recorded_by', type: 'uuid', nullable: true })
  recordedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}