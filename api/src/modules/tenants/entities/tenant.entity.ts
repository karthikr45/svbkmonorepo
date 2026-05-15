import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * How often the receipt-number running sequence rolls back to the
 * tenant's configured start. ACADEMIC_YEAR is the default because most
 * Indian schools want one continuous sequence per academic year.
 */
export enum ReceiptResetPolicy {
  /** Never reset — single global sequence forever. */
  NEVER = 'NEVER',
  /** Reset on January 1st each calendar year. */
  YEARLY = 'YEARLY',
  /** Reset at the start of every new academic year (e.g. 2025-2026). */
  ACADEMIC_YEAR = 'ACADEMIC_YEAR',
  /** Reset at the start of every calendar month. */
  MONTHLY = 'MONTHLY',
  /** Reset at the start of every day. */
  DAILY = 'DAILY',
}

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  code: string;

  @Column({ unique: true })
  tenantCode: string;

  @Column()
  tenantName: string;

  @Column({ nullable: true })
  medium: string;

  @Column({ nullable: true })
  type: string;

  @Column({ nullable: true })
  boardType: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  country: string;

  @Column({ unique: true })
  clientId: string;

  @Column()
  secretKey: string;

  // ─── Receipt numbering ────────────────────────────────────────────
  /**
   * Human-readable prefix for receipts (e.g. "SVBK"). When null, the
   * generator falls back to tenant.code → tenant.tenantCode → "RCP".
   */
  @Column({ name: 'receipt_prefix', type: 'varchar', length: 20, nullable: true })
  receiptPrefix: string | null;

  /** How the running sequence resets. Default ACADEMIC_YEAR. */
  @Column({
    name: 'receipt_reset_policy',
    type: 'enum',
    enum: ReceiptResetPolicy,
    default: ReceiptResetPolicy.ACADEMIC_YEAR,
  })
  receiptResetPolicy: ReceiptResetPolicy;

  /** First number issued in any fresh period. Most schools start at 1. */
  @Column({ name: 'receipt_start_number', type: 'int', default: 1 })
  receiptStartNumber: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
