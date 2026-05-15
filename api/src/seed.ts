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
const ACADEMIC_YEAR = '2025-2026';
const DEMO_STUDENT = {
  branch: 'Main',
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
  await runPreSyncFixes();
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
        branch: DEMO_STUDENT.branch,
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
          branch: student.branch,
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
        branch: student.branch,
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
        branch: DEMO_STUDENT.branch,
        admissionNumber: DEMO_STUDENT.admissionNumber,
      },
    })
    .catch(() => null);

  if (!existingLink) {
    await linksRepo.save(
      linksRepo.create({
        parentId: parent.id,
        tenantId,
        branch: DEMO_STUDENT.branch,
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
  const { ReceiptTemplatesService } = await import(
    './modules/receipt-templates/receipt-templates.service'
  );
  const svc = app.get(ReceiptTemplatesService) as InstanceType<typeof ReceiptTemplatesService>;
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

  // Default reference data the super-admin can later edit.
  const defaults: { type: string; value: string; displayOrder: number }[] = [
    // Academic years
    { type: 'academic_year', value: '2024-2025', displayOrder: 1 },
    { type: 'academic_year', value: '2025-2026', displayOrder: 2 },
    { type: 'academic_year', value: '2026-2027', displayOrder: 3 },
    { type: 'academic_year', value: '2027-2028', displayOrder: 4 },
    // Boards
    { type: 'board_type', value: 'CBSE', displayOrder: 1 },
    { type: 'board_type', value: 'ICSE', displayOrder: 2 },
    { type: 'board_type', value: 'State', displayOrder: 3 },
    { type: 'board_type', value: 'IB', displayOrder: 4 },
    // Mediums (TS/AP)
    { type: 'medium', value: 'English', displayOrder: 1 },
    { type: 'medium', value: 'Telugu', displayOrder: 2 },
    { type: 'medium', value: 'Hindi', displayOrder: 3 },
    // Tenant types
    { type: 'tenant_type', value: 'School', displayOrder: 1 },
    { type: 'tenant_type', value: 'Hostel', displayOrder: 2 },
    { type: 'tenant_type', value: 'Transport', displayOrder: 3 },
    // Classes (full range for TS/AP)
    ...['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Inter 1Y', 'Inter 2Y']
      .map((v, i) => ({ type: 'class', value: v, displayOrder: i })),
    // Sections (common)
    ...['A', 'B', 'C', 'D', 'E']
      .map((v, i) => ({ type: 'section', value: v, displayOrder: i })),
    // Inter streams
    ...['MPC', 'BiPC', 'CEC', 'MEC', 'HEC']
      .map((v, i) => ({ type: 'stream', value: v, displayOrder: i })),
    // Admin roles assignable in the Add-Admin / Tenant Users forms.
    // Super-admin can add more here at runtime; permission gating in code
    // is keyed off the four built-ins, so custom roles act as labels only.
    { type: 'admin_role', value: 'admin', displayOrder: 1 },
    { type: 'admin_role', value: 'fin_admin', displayOrder: 2 },
    { type: 'admin_role', value: 'ops_admin', displayOrder: 3 },
    // Term labels — mirror of the TermType enum, used by every fee/penalty/
    // student form. TS/AP schools commonly run 5 terms.
    { type: 'term', value: '1st Term Fee', displayOrder: 1 },
    { type: 'term', value: '2nd Term Fee', displayOrder: 2 },
    { type: 'term', value: '3rd Term Fee', displayOrder: 3 },
    { type: 'term', value: '4th Term Fee', displayOrder: 4 },
    { type: 'term', value: '5th Term Fee', displayOrder: 5 },
    // Fee payment status (mirrors PaymentStatus enum; labels only).
    { type: 'payment_status', value: 'UNPAID', displayOrder: 1 },
    { type: 'payment_status', value: 'PARTIAL', displayOrder: 2 },
    { type: 'payment_status', value: 'PAID', displayOrder: 3 },
    // Cheque / DD clearance lifecycle.
    { type: 'clearance_status', value: 'PENDING', displayOrder: 1 },
    { type: 'clearance_status', value: 'CLEARED', displayOrder: 2 },
    { type: 'clearance_status', value: 'BOUNCED', displayOrder: 3 },
    // Template moderation states.
    { type: 'template_status', value: 'approved', displayOrder: 1 },
    { type: 'template_status', value: 'rejected', displayOrder: 2 },
    // Tenant config dropdowns.
    { type: 'environment_type', value: 'Production', displayOrder: 1 },
    { type: 'environment_type', value: 'QA', displayOrder: 2 },
    { type: 'environment_type', value: 'Development', displayOrder: 3 },
    { type: 'payment_gateway', value: 'Razorpay', displayOrder: 1 },
    { type: 'payment_gateway', value: 'Cashfree', displayOrder: 2 },
  ];

  let created = 0;
  for (const d of defaults) {
    const existing = await repo.findOne({
      where: { type: d.type, value: d.value },
    });
    if (!existing) {
      await repo.save(
        repo.create({ ...d, isActive: true, label: null, description: null }),
      );
      created++;
    }
  }

  // ── Starter receipt template HTML, stored in system_metadata so the
  // sections are editable from the System Metadata UI rather than code.
  // Each row uses `value` for the section key and `description` for the
  // HTML body of that section.
  const starterTemplate: Record<'header' | 'body' | 'footer', string> = {
    header: `
<div style="text-align:center;border-bottom:2px solid #0b54ab;padding-bottom:12px;margin-bottom:16px">
  <h1 style="margin:0;font-size:22px;color:#0b54ab">{{tenant.tenantName}}</h1>
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
      created++;
    }
  }
  console.log(
    `${created > 0 ? '✔' : '↩'}  system metadata: ${created} new, ${defaults.length - created} existing`,
  );
}

/**
 * One-shot schema fixes that need to run BEFORE TypeORM's synchronize step.
 * Currently:
 *  - Convert legacy `admins.role` enum column → varchar(50). TypeORM's
 *    auto-sync tries to drop+re-add the column on type change, which fails
 *    with "column contains null values". Doing an in-place ALTER preserves
 *    existing rows and lets synchronize be a no-op.
 *
 * Safe to run repeatedly: every action is idempotent.
 */
async function runPreSyncFixes(): Promise<void> {
  // Lazy-import pg so the script still runs in envs where typeorm pulls a
  // different driver.
  const { Client } = await import('pg');
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10) || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'svbk',
  });
  try {
    await client.connect();
  } catch (err) {
    // Connection failure here is fine — NestFactory will surface a clearer
    // error a moment later. Don't crash the seed for a connect-time problem
    // that the user will see immediately anyway.
    console.warn(
      '↩  pre-sync fixes skipped (could not connect):',
      (err as Error).message,
    );
    return;
  }
  try {
    // Check admins.role current type. udt_name = 'admins_role_enum' (or
    // similar) when it's still a PG enum; 'varchar' once we've migrated.
    const r = await client.query<{ udt_name: string }>(
      `SELECT udt_name FROM information_schema.columns
         WHERE table_name = 'admins' AND column_name = 'role'`,
    );
    if (r.rowCount && r.rows[0].udt_name !== 'varchar') {
      console.log('▶  converting admins.role from enum → varchar(50)…');
      await client.query(
        `ALTER TABLE admins ALTER COLUMN role TYPE varchar(50) USING role::text`,
      );
      await client.query(`DROP TYPE IF EXISTS admins_role_enum`);
      console.log('✔  admins.role migrated');
    }
  } catch (err) {
    console.warn('↩  pre-sync fix failed:', (err as Error).message);
  } finally {
    await client.end().catch(() => undefined);
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
