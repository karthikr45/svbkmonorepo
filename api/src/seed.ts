/**
 * SVBK Seed Script — full demo dataset
 * Usage:  pnpm --filter @svbk/api seed
 *
 * Creates a complete, testable system in one shot:
 *   1. Super-admin
 *   2. Demo tenant + tenant admin
 *   3. Current academic year
 *   4. Sample student
 *   5. Four term fees for that student
 *   6. Parent linked to the student's admission
 *
 * Idempotent — re-runnable, skips anything that already exists.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

import { Admin } from './modules/admins/entities/admin.entity';
import { Tenant } from './modules/tenants/entities/tenant.entity';
import { AcademicYear } from './modules/academic-years/entities/academic-year.entity';
import { Student } from './modules/students/entities/student.entity';
import { Fee, PaymentStatus, TermType } from './modules/fees/entities/fee.entity';
import { Parent } from './modules/parents/entities/parent.entity';
import { SystemMetadata } from './modules/system-metadata/entities/system-metadata.entity';
import { SystemMetadataService } from './modules/system-metadata/system-metadata.service';
import { ReceiptTemplatesService } from './modules/receipt-templates/receipt-templates.service';
import {
  ParentStudent,
  Relationship,
} from './modules/parents/entities/parent-student.entity';
import { Role } from './common/enums/roles.enum';

const SALT_ROUNDS = 10;

// ── Demo values ──────────────────────────────────────────────────────────────
const SUPER_ADMIN = {
  email: 'superadmin@svbk.com',
  password: 'Admin@123',
  firstName: 'Super',
  lastName: 'Admin',
  branch: 'HYD',
};
const DEMO_TENANT = {
  tenantCode: 'SVBK_HYD',
  tenantName: 'Sri Venkateswara Bala Kuteer',
  name: 'SVBK Hyderabad',
  code: 'SVBK',
  city: 'Hyderabad',
  state: 'Telangana',
  country: 'India',
  boardType: 'CBSE',
  medium: 'English',
  type: 'School',
};
const TENANT_ADMIN = {
  email: 'admin@svbk.com',
  password: 'Admin@123',
  firstName: 'School',
  lastName: 'Admin',
  branch: 'Main',
};
/**
 * Indian academic year is Apr–Mar: May 2026 is in 2026-2027,
 * Feb 2026 is still in 2025-2026. Computed from `today` so the seed
 * stays valid year-over-year without code edits. Override via
 * SEED_ACADEMIC_YEAR if you need to seed a specific year.
 */
function currentAcademicYear(): string {
  const override = process.env.SEED_ACADEMIC_YEAR?.trim();
  if (override) return override;
  const now = new Date();
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}
const ACADEMIC_YEAR = currentAcademicYear();
const DEMO_STUDENT = {
  schoolCode: 'SVBK-MAIN',
  admissionNumber: 'ADM-2024-001',
  name: 'Arjun Kumar',
  email: 'arjun@example.com',
  phoneNumber: '+91-9999999990',
  class: '7',
  section: 'A',
  rollNo: '1',
};
const DEMO_PARENT = {
  email: 'parent@svbk.com',
  name: 'Ramesh Kumar',
  phoneNumber: '+91-9876543210',
};
const TERM_AMOUNTS: { term: TermType; amount: number }[] = [
  { term: TermType.FIRST, amount: 25000 },
  { term: TermType.SECOND, amount: 25000 },
  { term: TermType.THIRD, amount: 25000 },
  { term: TermType.FOURTH, amount: 25000 },
];

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const get = <T extends ObjectLiteral>(entity: any) =>
    app.get<Repository<T>>(getRepositoryToken(entity));

  const adminsRepo = get<Admin>(Admin);
  const tenantsRepo = get<Tenant>(Tenant);
  const yearsRepo = get<AcademicYear>(AcademicYear);
  const studentsRepo = get<Student>(Student);
  const feesRepo = get<Fee>(Fee);
  const parentsRepo = get<Parent>(Parent);
  const linksRepo = get<ParentStudent>(ParentStudent);

  console.log('━'.repeat(60));
  console.log('  SVBK seed — creating demo dataset');
  console.log('━'.repeat(60));

  // 1. Super-admin
  const superAdmin = await ensureSuperAdmin(adminsRepo);

  // 2. Tenant
  const tenant = await ensureTenant(tenantsRepo);

  // 3. Tenant admin
  await ensureTenantAdmin(adminsRepo, tenant.id);

  // 4. Academic year
  await ensureAcademicYear(yearsRepo, tenant.id);

  // 5. Student
  const student = await ensureStudent(studentsRepo, tenant.id);

  // 6. Term fees
  await ensureFees(feesRepo, student);

  // 7. Parent + link
  await ensureParent(parentsRepo, linksRepo, tenant.id);

  // 8. System metadata (super-admin curated, available to all tenants)
  await ensureSystemMetadata(app);

  // 9. Backfill: every tenant gets a starter receipt template if none yet.
  await ensureReceiptTemplatePerTenant(app);

  console.log('━'.repeat(60));
  console.log('  ✔ Seed complete');
  console.log('━'.repeat(60));
  console.log('');
  console.log('  Super-admin login (POST /api/auth/signin):');
  console.log(`    email    : ${SUPER_ADMIN.email}`);
  console.log(`    password : ${SUPER_ADMIN.password}`);
  console.log('');
  console.log('  Tenant-admin login:');
  console.log(`    email    : ${TENANT_ADMIN.email}`);
  console.log(`    password : ${TENANT_ADMIN.password}`);
  console.log(`    tenantId : ${tenant.id}`);
  console.log('');
  console.log('  Parent OTP login (POST /api/parent/auth/send-otp):');
  console.log(`    email    : ${DEMO_PARENT.email}`);
  console.log('    OTP      : any 6 digits (DEMO_MODE=true) or check console');
  console.log('');
  console.log(`  Sample student: ${student.name} (${student.admissionNumber})`);
  console.log(`  Academic year: ${ACADEMIC_YEAR}`);
  console.log('');

  await app.close();
  process.exit(0);
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function ensureSuperAdmin(repo: Repository<Admin>): Promise<Admin> {
  const existing = await repo
    .findOne({ where: { email: SUPER_ADMIN.email } })
    .catch(() => null);
  if (existing) {
    console.log(`↩  super-admin exists: ${SUPER_ADMIN.email}`);
    return existing;
  }
  const passwordHash = await bcrypt.hash(SUPER_ADMIN.password, SALT_ROUNDS);
  const created = await repo.save(
    repo.create({
      firstName: SUPER_ADMIN.firstName,
      lastName: SUPER_ADMIN.lastName,
      email: SUPER_ADMIN.email,
      role: Role.SUPER_ADMIN,
      branch: SUPER_ADMIN.branch,
      clientId: `client_${randomBytes(8).toString('hex')}`,
      secretKey: randomBytes(32).toString('hex'),
      passwordHash,
    }),
  );
  console.log(`✔  super-admin created: ${created.email}`);
  return created;
}

async function ensureTenant(repo: Repository<Tenant>): Promise<Tenant> {
  const existing = await repo
    .findOne({ where: { tenantCode: DEMO_TENANT.tenantCode } })
    .catch(() => null);
  if (existing) {
    console.log(`↩  tenant exists: ${DEMO_TENANT.tenantCode} (${existing.id})`);
    return existing;
  }
  const created = await repo.save(
    repo.create({
      ...DEMO_TENANT,
      clientId: `tenant_client_${randomBytes(6).toString('hex')}`,
      secretKey: randomBytes(32).toString('hex'),
      isActive: true,
    }),
  );
  console.log(`✔  tenant created: ${created.tenantCode} (${created.id})`);
  return created;
}

async function ensureTenantAdmin(
  repo: Repository<Admin>,
  tenantId: string,
): Promise<Admin> {
  const existing = await repo
    .findOne({ where: { email: TENANT_ADMIN.email } })
    .catch(() => null);
  if (existing) {
    console.log(`↩  tenant-admin exists: ${TENANT_ADMIN.email}`);
    return existing;
  }
  const passwordHash = await bcrypt.hash(TENANT_ADMIN.password, SALT_ROUNDS);
  const created = await repo.save(
    repo.create({
      firstName: TENANT_ADMIN.firstName,
      lastName: TENANT_ADMIN.lastName,
      email: TENANT_ADMIN.email,
      role: Role.ADMIN,
      branch: TENANT_ADMIN.branch,
      tenantId,
      clientId: `client_${randomBytes(8).toString('hex')}`,
      secretKey: randomBytes(32).toString('hex'),
      passwordHash,
    }),
  );
  console.log(`✔  tenant-admin created: ${created.email}`);
  return created;
}

async function ensureAcademicYear(
  repo: Repository<AcademicYear>,
  tenantId: string,
): Promise<AcademicYear> {
  const existing = await repo
    .findOne({ where: { tenantId, academicYear: ACADEMIC_YEAR } })
    .catch(() => null);
  if (existing) {
    console.log(`↩  academic year exists: ${ACADEMIC_YEAR}`);
    return existing;
  }
  const created = await repo.save(
    repo.create({
      tenantId,
      academicYear: ACADEMIC_YEAR,
      isCurrentYear: true,
      isActive: true,
    }),
  );
  console.log(`✔  academic year created: ${created.academicYear} (current)`);
  return created;
}

async function ensureStudent(
  repo: Repository<Student>,
  tenantId: string,
): Promise<Student> {
  const existing = await repo
    .findOne({
      where: {
        tenantId,
        schoolCode: DEMO_STUDENT.schoolCode,
        admissionNumber: DEMO_STUDENT.admissionNumber,
        academicYear: ACADEMIC_YEAR,
      },
    })
    .catch(() => null);
  if (existing) {
    console.log(`↩  student exists: ${existing.admissionNumber}`);
    return existing;
  }
  const created = await repo.save(
    repo.create({
      tenantId,
      academicYear: ACADEMIC_YEAR,
      ...DEMO_STUDENT,
    }),
  );
  console.log(`✔  student created: ${created.name} (${created.admissionNumber})`);
  return created;
}

async function ensureFees(
  repo: Repository<Fee>,
  student: Student,
): Promise<void> {
  for (const { term, amount } of TERM_AMOUNTS) {
    const existing = await repo
      .findOne({
        where: {
          tenantId: student.tenantId,
          branch: student.schoolCode,
          studentId: student.id,
          academicYear: student.academicYear,
          term,
        },
      })
      .catch(() => null);
    if (existing) {
      console.log(`↩  fee exists: ${term}`);
      continue;
    }
    await repo.save(
      repo.create({
        tenantId: student.tenantId,
        branch: student.schoolCode,
        academicYear: student.academicYear,
        studentId: student.id,
        term,
        originalAmount: String(amount),
        totalPenalty: '0',
        totalDiscount: '0',
        netAmount: String(amount),
        paidAmount: '0',
        paymentStatus: PaymentStatus.UNPAID,
      }),
    );
    console.log(`✔  fee created: ${term} (₹${amount})`);
  }
}

async function ensureParent(
  parentsRepo: Repository<Parent>,
  linksRepo: Repository<ParentStudent>,
  tenantId: string,
): Promise<Parent> {
  let parent = await parentsRepo
    .findOne({ where: { tenantId, email: DEMO_PARENT.email } })
    .catch(() => null);

  if (!parent) {
    parent = await parentsRepo.save(
      parentsRepo.create({
        tenantId,
        name: DEMO_PARENT.name,
        email: DEMO_PARENT.email,
        phoneNumber: DEMO_PARENT.phoneNumber,
        isActive: true,
      }),
    );
    console.log(`✔  parent created: ${parent.email}`);
  } else {
    console.log(`↩  parent exists: ${parent.email}`);
  }

  const existingLink = await linksRepo
    .findOne({
      where: {
        parentId: parent.id,
        tenantId,
        branch: DEMO_STUDENT.schoolCode,
        admissionNumber: DEMO_STUDENT.admissionNumber,
      },
    })
    .catch(() => null);

  if (!existingLink) {
    await linksRepo.save(
      linksRepo.create({
        parentId: parent.id,
        tenantId,
        branch: DEMO_STUDENT.schoolCode,
        admissionNumber: DEMO_STUDENT.admissionNumber,
        relationship: Relationship.FATHER,
        isPrimary: true,
      }),
    );
    console.log(`✔  parent linked to student ${DEMO_STUDENT.admissionNumber}`);
  } else {
    console.log(`↩  parent-student link exists`);
  }

  return parent;
}

/**
 * Make sure every tenant has at least one receipt template. New
 * tenants get one automatically on creation; this catches anything
 * that pre-dates the receipt-template feature.
 */
async function ensureReceiptTemplatePerTenant(app: any): Promise<void> {
  const svc = app.get(ReceiptTemplatesService) as ReceiptTemplatesService;
  const tenantsRepo = app.get(getRepositoryToken(Tenant)) as Repository<Tenant>;
  const all = await tenantsRepo.find();
  let created = 0;
  for (const t of all) {
    try {
      const before = await svc.list(t.id);
      if (before.length === 0) {
        await svc.ensureStarterForTenant(t.id);
        created++;
      }
    } catch (err) {
      console.warn(
        `↩  could not seed starter template for tenant ${t.id}:`,
        (err as Error).message,
      );
    }
  }
  console.log(
    `${created > 0 ? '✔' : '↩'}  receipt templates: ${created} new, ${all.length - created} existing`,
  );
}

async function ensureSystemMetadata(app: any): Promise<void> {
  const repo = app.get(getRepositoryToken(SystemMetadata)) as Repository<SystemMetadata>;

  // Default catalog now lives in the SystemMetadataService — same code
  // path the API runs on every boot, so the seed and the running app
  // can't drift.
  const { created } = await app.get(SystemMetadataService).ensureDefaults();
  console.log(
    created > 0
      ? `✔  ${created} default metadata row(s) inserted`
      : '↩  system_metadata catalog already up to date',
  );

  // ── Starter receipt template HTML, stored in system_metadata so the
  // sections are editable from the System Metadata UI rather than code.
  // Each row uses `value` for the section key and `description` for the
  // HTML body of that section.
  const starterTemplate: Record<'header' | 'body' | 'footer', string> = {
    header: `
<div style="text-align:center;border-bottom:2px solid #6c739c;padding-bottom:12px;margin-bottom:16px">
  <h1 style="margin:0;font-size:22px;color:#6c739c">{{tenant.tenantName}}</h1>
  <p style="margin:4px 0 0;color:#475569;font-size:13px">{{tenant.address}}, {{tenant.city}}, {{tenant.state}}</p>
  <h2 style="margin:10px 0 0;font-size:14px;color:#334155;letter-spacing:.15em">FEE RECEIPT</h2>
</div>`.trim(),
    body: `
<table style="width:100%;font-size:14px;border-collapse:collapse">
  <tr><td style="padding:4px 8px;color:#64748b">Receipt No.</td><td style="padding:4px 8px;font-weight:600">{{payment.receiptNumber}}</td></tr>
  <tr><td style="padding:4px 8px;color:#64748b">Date</td><td style="padding:4px 8px">{{payment.paidAtFormatted}}</td></tr>
  <tr><td style="padding:4px 8px;color:#64748b">Student</td><td style="padding:4px 8px">{{student.name}} ({{student.admissionNumber}})</td></tr>
  <tr><td style="padding:4px 8px;color:#64748b">Class</td><td style="padding:4px 8px">{{student.class}}-{{student.section}} · Roll {{student.rollNo}}</td></tr>
  <tr><td style="padding:4px 8px;color:#64748b">Academic Year</td><td style="padding:4px 8px">{{fee.academicYear}}</td></tr>
  <tr><td style="padding:4px 8px;color:#64748b">Term</td><td style="padding:4px 8px">{{fee.term}}</td></tr>
</table>
<table style="width:100%;font-size:14px;border-collapse:collapse;margin-top:14px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0">
  <tr><td style="padding:6px 8px;color:#64748b">Original Amount</td><td style="padding:6px 8px;text-align:right">{{fee.originalAmountInr}}</td></tr>
  <tr><td style="padding:6px 8px;color:#64748b">Penalty</td><td style="padding:6px 8px;text-align:right">{{fee.totalPenaltyInr}}</td></tr>
  <tr><td style="padding:6px 8px;color:#64748b">Discount</td><td style="padding:6px 8px;text-align:right">−{{fee.totalDiscountInr}}</td></tr>
  <tr><td style="padding:6px 8px;color:#64748b;font-weight:700">Net Amount</td><td style="padding:6px 8px;text-align:right;font-weight:700">{{fee.netAmountInr}}</td></tr>
</table>
<div style="margin-top:14px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">
  <div style="font-size:12px;color:#64748b">Amount received via {{payment.source}} ({{payment.paymentType}})</div>
  <div style="font-size:22px;font-weight:700;margin-top:2px">{{payment.amountInr}}</div>
  <div style="font-size:12px;color:#475569;margin-top:6px">In words: {{payment.amountInWords}}</div>
</div>`.trim(),
    footer: `
<div style="margin-top:24px;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8">
  <span>This is a computer-generated receipt.</span>
  <span>Generated on {{date.now}}</span>
</div>`.trim(),
  };

  let createdTemplate = 0;
  for (const [section, html] of Object.entries(starterTemplate)) {
    const existing = await repo.findOne({
      where: { type: 'receipt_template_starter', value: section },
    });
    if (!existing) {
      await repo.save(
        repo.create({
          type: 'receipt_template_starter',
          value: section,
          isActive: true,
          label: `Receipt template starter — ${section}`,
          description: html,
          displayOrder: section === 'header' ? 1 : section === 'body' ? 2 : 3,
        }),
      );
      createdTemplate++;
    }
  }
  if (createdTemplate > 0) {
    console.log(
      `✔  receipt template starter sections inserted: ${createdTemplate}`,
    );
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
