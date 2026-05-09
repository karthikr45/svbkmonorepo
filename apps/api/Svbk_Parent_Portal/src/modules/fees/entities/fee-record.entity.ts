import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Student } from '../../students/entities/student.entity';
import { Payment } from '../../payments/entities/payment.entity';

export enum FeeType {
  SCHOOL = 'school',
  TRANSPORTATION = 'transportation',
  HOSTEL = 'hostel',
}

export enum FeeStatus {
  PAID = 'paid',
  DUE = 'due',
  PARTIAL = 'partial',
}

@Entity('fee_records')
export class FeeRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  studentId: string;

  @ManyToOne(() => Student, (student) => student.feeRecords)
  @JoinColumn({ name: 'studentId' })
  student: Student;

  @Column()
  termNumber: number;

  @Column()
  academicYear: string;

  @Column({ type: 'enum', enum: FeeType })
  feeType: FeeType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  paidAmount: number;

  @Column({ type: 'enum', enum: FeeStatus, default: FeeStatus.DUE })
  status: FeeStatus;

  @Column({ type: 'date', nullable: true })
  dueDate: Date;

  @Column({ nullable: true })
  receiptNumber: string;

  @Column({ type: 'date', nullable: true })
  paidDate: Date;

  @OneToMany(() => Payment, (payment) => payment.feeRecord)
  payments: Payment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
