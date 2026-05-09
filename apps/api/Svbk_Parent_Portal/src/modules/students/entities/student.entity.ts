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
import { Parent } from '../../parents/entities/parent.entity';
import { FeeRecord } from '../../fees/entities/fee-record.entity';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  studentId: string;

  @Column()
  grade: string;

  @Column()
  section: string;

  @Column()
  school: string;

  @Column({ default: true })
  isActive: boolean;

  @Column('uuid')
  parentId: string;

  @ManyToOne(() => Parent, (parent) => parent.children)
  @JoinColumn({ name: 'parentId' })
  parent: Parent;

  @OneToMany(() => FeeRecord, (fee) => fee.student)
  feeRecords: FeeRecord[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
