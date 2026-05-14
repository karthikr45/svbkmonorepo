import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

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

  /**
   * Admission-number generator template. Empty = manual entry only.
   * Tokens (case sensitive):
   *   {TENANT}  tenant.code
   *   {BRANCH}  branch passed in the request
   *   {YYYY}    4-digit current year
   *   {YY}      2-digit current year
   *   {AY}      academicYear as supplied (e.g. "2025-2026")
   *   {AYY}     academicYear short ("25-26")
   *   {###}     zero-padded running sequence (any number of #'s
   *             controls the width — at least one is required to
   *             enable auto-generation).
   * Example: "SVBK/{AYY}/{####}"  →  "SVBK/25-26/0001"
   */
  @Column({
    name: 'admission_number_pattern',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  admissionNumberPattern: string | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
