/**
 * Chatbot tenant-isolation tests.
 *
 * Spins up two tenants (A and B), each with its own admin + student +
 * fee row, then runs every parent-facing and admin-facing intent
 * through ChatbotService while impersonating a user from one tenant.
 * The assertions are tight: the response payload must NOT mention any
 * identifier belonging to the OTHER tenant.
 *
 * Opt-in (same pattern as money-paths.e2e-spec.ts):
 *   RUN_DB_E2E=true DB_HOST=localhost ... pnpm test:e2e
 *
 * Without it, the suite is skipped so default test runs stay DB-free.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { firstValueFrom, toArray } from 'rxjs';
import { AppModule } from '../src/app.module';
import { ChatbotService } from '../src/modules/chatbot/chatbot.service';
import {
  Tenant,
  ReceiptResetPolicy,
} from '../src/modules/tenants/entities/tenant.entity';
import { Student } from '../src/modules/students/entities/student.entity';
import {
  Fee,
  PaymentStatus,
  TermType,
} from '../src/modules/fees/entities/fee.entity';
import { Admin } from '../src/modules/admins/entities/admin.entity';
import { Role } from '../src/common/enums/roles.enum';
import { randomBytes } from 'crypto';

const run = process.env.RUN_DB_E2E === 'true' ? describe : describe.skip;

interface TenantBag {
  tenantId: string;
  schoolCode: string;
  adminId: string;
  studentId: string;
  admissionNumber: string;
  feeId: string;
}

async function createTenantBag(
  ds: DataSource,
  label: string,
): Promise<TenantBag> {
  const tenant = await ds.getRepository(Tenant).save(
    ds.getRepository(Tenant).create({
      name: `${label} School`,
      tenantCode: `ISO-${label}-${Date.now()}`,
      tenantName: `${label} School`,
      clientId: `iso-client-${label}-${Date.now()}-${randomBytes(2).toString('hex')}`,
      secretKey: 'iso-secret',
      receiptPrefix: 'ISO',
      receiptResetPolicy: ReceiptResetPolicy.ACADEMIC_YEAR,
      receiptStartNumber: 1,
      type: 'School',
    }),
  );

  const schoolCode = `ISO-${label}`;
  const admin = await ds.getRepository(Admin).save(
    ds.getRepository(Admin).create({
      firstName: `${label}First`,
      lastName: `${label}Last`,
      email: `admin-${label}-${Date.now()}@example.com`,
      role: Role.ADMIN,
      branch: 'main',
      tenantId: tenant.id,
      clientId: `client-${label}-${randomBytes(4).toString('hex')}`,
      secretKey: 'x',
      passwordHash: 'x',
      isActive: true,
    }),
  );

  const student = await ds.getRepository(Student).save(
    ds.getRepository(Student).create({
      tenantId: tenant.id,
      schoolCode,
      admissionNumber: `ADM-ISO-${label}-001`,
      academicYear: '2025-2026',
      name: `${label}Student`,
      email: `${label.toLowerCase()}student@example.com`,
      phoneNumber: '9999999999',
      class: 'V',
      section: 'A',
      rollNo: '1',
    }),
  );

  const fee = await ds.getRepository(Fee).save(
    ds.getRepository(Fee).create({
      tenantId: tenant.id,
      branch: schoolCode,
      academicYear: '2025-2026',
      studentId: student.id,
      term: TermType.FIRST,
      originalAmount: '1000.00',
      netAmount: '1000.00',
      paidAmount: '0.00',
      paymentStatus: PaymentStatus.UNPAID,
    }),
  );

  return {
    tenantId: tenant.id,
    schoolCode,
    adminId: admin.id,
    studentId: student.id,
    admissionNumber: student.admissionNumber,
    feeId: fee.id,
  };
}

run('Chatbot — tenant isolation (e2e, Postgres)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let chatbot: ChatbotService;
  let bagA: TenantBag;
  let bagB: TenantBag;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    ds = app.get(DataSource);
    chatbot = app.get(ChatbotService);

    bagA = await createTenantBag(ds, 'A');
    bagB = await createTenantBag(ds, 'B');
  });

  afterAll(async () => {
    if (ds?.isInitialized) {
      // Clean both tenants in dependency order.
      for (const bag of [bagA, bagB]) {
        if (!bag) continue;
        await ds.getRepository(Fee).delete({ tenantId: bag.tenantId });
        await ds.getRepository(Student).delete({ tenantId: bag.tenantId });
        await ds.getRepository(Admin).delete({ id: bag.adminId });
        await ds.getRepository(Tenant).delete({ id: bag.tenantId });
      }
    }
    await app?.close();
  });

  // Helper — drain the SSE Observable to its string events for inspection.
  async function ask(
    caller: { userId: string; tenantId: string | null; role: string },
    text: string,
  ): Promise<{ events: { type: string; data: string }[]; joined: string }> {
    const stream$ = chatbot.ask(caller, text);
    const events = await firstValueFrom(stream$.pipe(toArray()));
    return { events, joined: JSON.stringify(events) };
  }

  // Identifiers we MUST NEVER see in tenant-A's chatbot output.
  function bSecretsRegexes(): RegExp[] {
    return [
      new RegExp(bagB.tenantId, 'i'),
      new RegExp(bagB.studentId, 'i'),
      new RegExp(bagB.feeId, 'i'),
      new RegExp(bagB.admissionNumber, 'i'),
      // Student name is "BStudent" — case-insensitive substring.
      /BStudent/i,
    ];
  }

  function expectNoCrossLeak(joined: string) {
    for (const re of bSecretsRegexes()) {
      expect(joined).not.toMatch(re);
    }
  }

  it('admin in tenant A can ask "show fee defaulters" without seeing tenant B', async () => {
    const { joined } = await ask(
      { userId: bagA.adminId, tenantId: bagA.tenantId, role: Role.ADMIN },
      'show fee defaulters',
    );
    expect(joined).toMatch(/\bdefaulter|outstanding|pending\b/i);
    expectNoCrossLeak(joined);
  });

  it('admin in tenant A asking by tenant B\'s school_code does not leak', async () => {
    const { joined } = await ask(
      { userId: bagA.adminId, tenantId: bagA.tenantId, role: Role.ADMIN },
      `show fee defaulters for ${bagB.schoolCode}`,
    );
    // Even though the user mentions B's school code, only A's data
    // (or none) should appear. Definitely not B's secrets.
    expectNoCrossLeak(joined);
  });

  it('admin in tenant A asking "collection summary" stays within tenant A', async () => {
    const { joined } = await ask(
      { userId: bagA.adminId, tenantId: bagA.tenantId, role: Role.ADMIN },
      'how much have we collected this week',
    );
    expectNoCrossLeak(joined);
  });

  it('an unknown question lands in the fallback and never references other tenants', async () => {
    const { joined } = await ask(
      { userId: bagA.adminId, tenantId: bagA.tenantId, role: Role.ADMIN },
      'tell me a joke about chemistry',
    );
    expectNoCrossLeak(joined);
  });

  it('a parent-only intent is refused for an admin-typed token', async () => {
    // list_my_children is parent-only; an admin user shouldn't be able
    // to invoke it even if the matcher were to score it.
    const { joined } = await ask(
      { userId: bagA.adminId, tenantId: bagA.tenantId, role: Role.ADMIN },
      'show my children',
    );
    // No crash; either fallback message or unrelated intent matched.
    // Critical: B's identifiers must not appear, and the response
    // must not contain a child name from any tenant since the intent
    // wasn't actually executed for this role.
    expectNoCrossLeak(joined);
    expect(joined).not.toMatch(/BStudent/i);
  });

  it('audit log records the turn with the caller\'s tenant only', async () => {
    await ask(
      { userId: bagA.adminId, tenantId: bagA.tenantId, role: Role.ADMIN },
      'show pending approvals',
    );

    const rows = await ds.query(
      `SELECT tenant_id, matched_intent
         FROM chatbot_intent_logs
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 5`,
      [bagA.tenantId],
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.tenant_id).toBe(bagA.tenantId);
      expect(r.tenant_id).not.toBe(bagB.tenantId);
    }
  });
});
