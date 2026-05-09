import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

import { Parent } from './modules/parents/entities/parent.entity';
import { Student } from './modules/students/entities/student.entity';
import { FeeRecord, FeeStatus, FeeType } from './modules/fees/entities/fee-record.entity';
import { Payment, PaymentStatus } from './modules/payments/entities/payment.entity';
import { Otp } from './modules/auth/entities/otp.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'svbk_parent_portal',
  synchronize: true,
  entities: [Parent, Student, FeeRecord, Payment, Otp],
});

async function seed() {
  await AppDataSource.initialize();
  console.log('✅ Connected to database');

  const parentRepo = AppDataSource.getRepository(Parent);
  const studentRepo = AppDataSource.getRepository(Student);
  const feeRepo = AppDataSource.getRepository(FeeRecord);
  const paymentRepo = AppDataSource.getRepository(Payment);

  await paymentRepo.createQueryBuilder().delete().execute();
  await feeRepo.createQueryBuilder().delete().execute();
  await studentRepo.createQueryBuilder().delete().execute();
  await parentRepo.createQueryBuilder().delete().execute();
  console.log('🗑️  Cleared existing data');

  const parent = parentRepo.create({
    name: 'Rajesh Kumar',
    email: 'hejexi5764@bmoar.com',
    phone: '+91-98765-43210',
    isActive: true,
  });
  await parentRepo.save(parent);
  console.log(`👤 Parent created: ${parent.name} (${parent.email})`);

  const SCHOOL = 'Sri Venkateswara Bala Kuteer';

  const arjun = studentRepo.create({
    name: 'Arjun Kumar', studentId: 'SVK-2024-701',
    grade: 'Grade 7', section: 'Section A', school: SCHOOL, parentId: parent.id,
  });
  const priya = studentRepo.create({
    name: 'Priya Kumar', studentId: 'SVK-2024-702',
    grade: 'Grade 4', section: 'Section B', school: SCHOOL, parentId: parent.id,
  });
  const vikram = studentRepo.create({
    name: 'Vikram Kumar', studentId: 'SVK-2024-703',
    grade: 'Grade 10', section: 'Section C', school: SCHOOL, parentId: parent.id,
  });
  await studentRepo.save([arjun, priya, vikram]);
  console.log('👦 Students created: Arjun, Priya, Vikram');

  const arjunFees = [
    { studentId: arjun.id, termNumber: 1, academicYear: '2026', feeType: FeeType.SCHOOL, totalAmount: 45000, paidAmount: 45000, status: FeeStatus.PAID, dueDate: new Date('2026-04-15'), paidDate: new Date('2026-04-02'), receiptNumber: 'RCP-2026-0042' },
    { studentId: arjun.id, termNumber: 1, academicYear: '2026', feeType: FeeType.TRANSPORTATION, totalAmount: 12000, paidAmount: 0, status: FeeStatus.DUE, dueDate: new Date('2026-04-15'), paidDate: null, receiptNumber: null },
    { studentId: arjun.id, termNumber: 1, academicYear: '2026', feeType: FeeType.HOSTEL, totalAmount: 35000, paidAmount: 35000, status: FeeStatus.PAID, dueDate: new Date('2026-04-15'), paidDate: new Date('2026-04-01'), receiptNumber: 'RCP-2026-0038' },
    { studentId: arjun.id, termNumber: 2, academicYear: '2026', feeType: FeeType.SCHOOL, totalAmount: 45000, paidAmount: 0, status: FeeStatus.DUE, dueDate: new Date('2026-08-15'), paidDate: null, receiptNumber: null },
    { studentId: arjun.id, termNumber: 2, academicYear: '2026', feeType: FeeType.TRANSPORTATION, totalAmount: 12000, paidAmount: 0, status: FeeStatus.DUE, dueDate: new Date('2026-08-15'), paidDate: null, receiptNumber: null },
    { studentId: arjun.id, termNumber: 2, academicYear: '2026', feeType: FeeType.HOSTEL, totalAmount: 35000, paidAmount: 0, status: FeeStatus.DUE, dueDate: new Date('2026-08-15'), paidDate: null, receiptNumber: null },
    { studentId: arjun.id, termNumber: 3, academicYear: '2026', feeType: FeeType.SCHOOL, totalAmount: 45000, paidAmount: 0, status: FeeStatus.DUE, dueDate: new Date('2026-12-15'), paidDate: null, receiptNumber: null },
    { studentId: arjun.id, termNumber: 3, academicYear: '2026', feeType: FeeType.TRANSPORTATION, totalAmount: 12000, paidAmount: 0, status: FeeStatus.DUE, dueDate: new Date('2026-12-15'), paidDate: null, receiptNumber: null },
    { studentId: arjun.id, termNumber: 3, academicYear: '2026', feeType: FeeType.HOSTEL, totalAmount: 35000, paidAmount: 0, status: FeeStatus.DUE, dueDate: new Date('2026-12-15'), paidDate: null, receiptNumber: null },
  ];

  const priyaFees = [
    { studentId: priya.id, termNumber: 1, academicYear: '2026', feeType: FeeType.SCHOOL, totalAmount: 38000, paidAmount: 38000, status: FeeStatus.PAID, dueDate: new Date('2026-04-15'), paidDate: new Date('2026-04-03'), receiptNumber: 'RCP-2026-0044' },
    { studentId: priya.id, termNumber: 1, academicYear: '2026', feeType: FeeType.TRANSPORTATION, totalAmount: 10000, paidAmount: 0, status: FeeStatus.DUE, dueDate: new Date('2026-04-15'), paidDate: null, receiptNumber: null },
    { studentId: priya.id, termNumber: 1, academicYear: '2026', feeType: FeeType.HOSTEL, totalAmount: 30000, paidAmount: 0, status: FeeStatus.DUE, dueDate: new Date('2026-04-15'), paidDate: null, receiptNumber: null },
  ];

  const vikramFees = [
    { studentId: vikram.id, termNumber: 1, academicYear: '2026', feeType: FeeType.SCHOOL, totalAmount: 52000, paidAmount: 52000, status: FeeStatus.PAID, dueDate: new Date('2026-04-15'), paidDate: new Date('2026-04-01'), receiptNumber: 'RCP-2026-0031' },
    { studentId: vikram.id, termNumber: 1, academicYear: '2026', feeType: FeeType.TRANSPORTATION, totalAmount: 15000, paidAmount: 15000, status: FeeStatus.PAID, dueDate: new Date('2026-04-15'), paidDate: new Date('2026-04-01'), receiptNumber: 'RCP-2026-0032' },
    { studentId: vikram.id, termNumber: 1, academicYear: '2026', feeType: FeeType.HOSTEL, totalAmount: 40000, paidAmount: 0, status: FeeStatus.DUE, dueDate: new Date('2026-04-15'), paidDate: null, receiptNumber: null },
  ];

  const allFeeRecords = [...arjunFees, ...priyaFees, ...vikramFees];
  const savedFees = await feeRepo.save(allFeeRecords as any);
  console.log(`💰 Fee records created: ${savedFees.length}`);

  const paidFees = savedFees.filter((f) => f.status === FeeStatus.PAID);
  const payments = paidFees.map((fee) =>
    paymentRepo.create({
      feeRecordId: fee.id,
      amount: fee.paidAmount,
      status: PaymentStatus.SUCCESS,
      transactionId: `TXN-SEED-${fee.receiptNumber}`,
      metadata: { seeded: true },
    }),
  );
  await paymentRepo.save(payments);
  console.log(`💳 Payment records created: ${payments.length}`);

  console.log('\n🎉 Seed complete!');
  console.log('─────────────────────────────────────────');
  console.log(`Parent  : ${parent.name} <${parent.email}>`);
  console.log(`Children: Arjun Kumar, Priya Kumar, Vikram Kumar`);
  console.log(`Login   : POST /api/auth/send-otp  { email: "${parent.email}" }`);
  console.log(`         POST /api/auth/verify-otp { email: "...", otp: "123456" }  (demo mode)`);
  console.log('─────────────────────────────────────────');

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
