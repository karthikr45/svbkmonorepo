import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `academic_years.academic_year` was declared globally unique on the
 * entity — which prevented two tenants from sharing the same value
 * (e.g. every school has "2025-2026"). The intent was per-tenant
 * uniqueness.
 *
 * 1. Drop any existing UNIQUE on (academic_year) alone (TypeORM
 *    auto-names it, so we discover the constraint name from
 *    pg_constraint at runtime).
 * 2. Add UNIQUE (tenant_id, academic_year).
 * 3. Backfill every tenant from the curated system_metadata catalog
 *    (type='academic_year', active rows) so existing schools get the
 *    full AY list without manual setup. The newest entry by
 *    display_order becomes is_current_year iff the tenant has no
 *    current year yet.
 */
export class AcademicYearsPerTenantUnique1779580800000
  implements MigrationInterface
{
  name = 'AcademicYearsPerTenantUnique1779580800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop any UNIQUE constraint that's solely on academic_year.
    const dupes: { conname: string }[] = await queryRunner.query(`
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      WHERE t.relname = 'academic_years'
        AND c.contype = 'u'
        AND (
          SELECT array_agg(a.attname ORDER BY a.attname)
          FROM unnest(c.conkey) k
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
        ) = ARRAY['academic_year']::name[]
    `);
    for (const row of dupes ?? []) {
      await queryRunner.query(
        `ALTER TABLE "academic_years" DROP CONSTRAINT "${row.conname}"`,
      );
    }

    // 2. Add the per-tenant composite unique (idempotent).
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'uq_academic_years_tenant_year'
        ) THEN
          ALTER TABLE "academic_years"
            ADD CONSTRAINT "uq_academic_years_tenant_year"
            UNIQUE ("tenant_id", "academic_year");
        END IF;
      END $$;
    `);

    // 3. Backfill every tenant from the system_metadata catalog.
    //    INSERT ... ON CONFLICT DO NOTHING so it's safe to re-run.
    await queryRunner.query(`
      INSERT INTO "academic_years" ("id", "tenant_id", "academic_year", "is_active", "is_current_year")
      SELECT gen_random_uuid(), t."id", m."value", true, false
      FROM "tenants" t
      CROSS JOIN "system_metadata" m
      WHERE m."type" = 'academic_year'
        AND m."is_active" = true
      ON CONFLICT ("tenant_id", "academic_year") DO NOTHING
    `);

    // 4. For tenants with no current year, mark the newest seeded AY
    //    (highest display_order in metadata) as current.
    await queryRunner.query(`
      WITH newest AS (
        SELECT "value"
        FROM "system_metadata"
        WHERE "type" = 'academic_year' AND "is_active" = true
        ORDER BY "display_order" DESC, "value" DESC
        LIMIT 1
      ),
      missing AS (
        SELECT t."id" AS tenant_id
        FROM "tenants" t
        WHERE NOT EXISTS (
          SELECT 1 FROM "academic_years" ay
          WHERE ay."tenant_id" = t."id" AND ay."is_current_year" = true
        )
      )
      UPDATE "academic_years" ay
      SET "is_current_year" = true
      FROM newest n, missing m
      WHERE ay."tenant_id" = m.tenant_id
        AND ay."academic_year" = n."value"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "academic_years"
        DROP CONSTRAINT IF EXISTS "uq_academic_years_tenant_year"
    `);
    // We don't restore the global unique — it was wrong by design.
    // Backfilled rows are left in place; the AcademicYear module
    // treats them as legitimate per-tenant data.
  }
}
