import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Follow-up to SchoolCodeAndBilling. Adds the tenant-level columns the
 * SaaS plumbing needs and tightens data discipline:
 *
 *   tenants + school_code              (nullable varchar(32); shared across
 *                                       sibling school/hostel/transport
 *                                       tenants for one institution)
 *   tenants + monetization_enabled     (boolean default false; future
 *                                       subscription gate, off for the
 *                                       6 pilot institutions)
 *   tenants  billing_mode              backfill 'monthly' for transport
 *                                       tenants where it's still NULL
 *
 *   CHECK ck_tenants_school_code_fmt   uppercase letters/digits/dashes,
 *                                       2–31 chars, starting with a letter
 *                                       (NULL allowed so legacy rows pass)
 *
 * Idempotent — safe to re-run.
 */
export class TenantSchoolCodeAndMonetization1779580100000
  implements MigrationInterface
{
  name = 'TenantSchoolCodeAndMonetization1779580100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. tenants.school_code (nullable; sibling tenants share it).
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "school_code" character varying(32)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tenants_school_code" ON "tenants" ("school_code")`,
    );

    // 2. Format check — NULL allowed for legacy rows; new rows must
    //    match the canonical pattern.
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP CONSTRAINT IF EXISTS "ck_tenants_school_code_fmt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD CONSTRAINT "ck_tenants_school_code_fmt" CHECK ("school_code" IS NULL OR "school_code" ~ '^[A-Z][A-Z0-9-]{1,30}$')`,
    );

    // 3. monetization_enabled — per-tenant gate, off by default.
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "monetization_enabled" boolean NOT NULL DEFAULT false`,
    );

    // 4. Backfill: transport tenants are monthly by default. Existing
    //    rows with NULL billing_mode would otherwise silently behave as
    //    term-wise, which is wrong for transport.
    await queryRunner.query(
      `UPDATE "tenants" SET "billing_mode" = 'monthly' WHERE "billing_mode" IS NULL AND LOWER(COALESCE("type", '')) = 'transport'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Don't try to un-backfill — billing_mode was data, not schema.
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "monetization_enabled"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP CONSTRAINT IF EXISTS "ck_tenants_school_code_fmt"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tenants_school_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "school_code"`,
    );
  }
}
