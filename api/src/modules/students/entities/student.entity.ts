import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';

/**
 * One row per student per academic year.
 * Class/section/roll-no change yearly, so the same admission number
 * appears in multiple rows across years.
 *
 * Unique: (tenant_id, branch, admission_number, academic_year)
 */
@Entity('students')
@Unique('uq_students_tenant_branch_admission_year', [
  'tenantId',
  'branch',
  'admissionNumber',
  'academicYear',
])
@Index('idx_students_tenant_branch_year', [
  'tenantId',
  'branch',
  'academicYear',
])
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 100 })
  branch: string;

  @Column({ name: 'admission_number', type: 'varchar', length: 50 })
  admissionNumber: string;

  @Column({ name: 'academic_year', type: 'varchar', length: 20 })
  academicYear: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 150 })
  email: string;

  @Column({ name: 'phone_number', type: 'varchar', length: 20 })
  phoneNumber: string;

  @Column({ type: 'varchar', length: 20 })
  class: string;

  @Column({ type: 'varchar', length: 10 })
  section: string;

  @Column({ name: 'roll_no', type: 'varchar', length: 20 })
  rollNo: string;

  @Column({ name: 'img_url', type: 'text', nullable: true })
  imgUrl: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}