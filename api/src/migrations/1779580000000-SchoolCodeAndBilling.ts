import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * In-place schema upgrade for dev/staging DBs that were built with
 * `synchronize` before the school-code + billing-mode work landed.
 *
 *   students.branch (NOT NULL)       → students.school_code (NOT NULL)
 *   students                         + pickup_location, drop_location (nullable)
 *   tenants                          + billing_mode (nullable)
 *   fees.term (enum: 5 TermType)     → fees.term varchar(30) (TermType | MonthType)
 *
 * Existing rows are preserved: `school_code` is backfilled from
 * `branch`, and the term enum is converted to its text representation
 * before the type swap, so all current term values stay valid.
 *
 * Run with:   pnpm migration:run
 * Revert:     pnpm migration:revert
 */
export class SchoolCodeAndBilling1779580000000 implements MigrationInterface {
  name = 'SchoolCodeAndBilling1779580000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── students: rename branch → school_code (preserve values) ────
    await queryRunner.query(
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "school_code" character varying(100)`,
    );
    await queryRunner.query(
      `UPDATE "students" SET "school_code" = "branch" WHERE "school_code" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" ALTER COLUMN "school_code" SET NOT NULL`,
    );

    // Old branch-based unique key + index → school_code-based.
    await queryRunner.query(
      `ALTER TABLE "students" DROP CONSTRAINT IF EXISTS "uq_students_tenant_branch_admission_year"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_students_tenant_branch_year"`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" ADD CONSTRAINT "uq_students_tenant_branch_admission_year" UNIQUE ("tenant_id", "school_code", "admission_number", "academic_year")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_students_tenant_branch_year" ON "students" ("tenant_id", "school_code", "academic_year")`,
    );

    await queryRunner.query(
      `ALTER TABLE "students" DROP COLUMN IF EXISTS "branch"`,
    );

    // Transport pickup/drop (nullable; only set on transport rows).
    await queryRunner.query(
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "pickup_location" character varying(200)`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "drop_location" character varying(200)`,
    );

    // ── tenants: admin-selectable billing mode (term_wise | monthly).
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "billing_mode" character varying(20)`,
    );

    // ── fees.term: enum → varchar so months can share the column ──
    // Cast existing enum values to text in place; drop the enum type.
    await queryRunner.query(
      `ALTER TABLE "fees" ALTER COLUMN "term" TYPE character varying(30) USING "term"::text`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "fees_term_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate the term enum and convert back. Any month values stored
    // in `term` will fail this cast — that's intentional: rolling back
    // monthly billing data isn't safe.
    await queryRunner.query(
      `CREATE TYPE "fees_term_enum" AS ENUM ('1st Term Fee','2nd Term Fee','3rd Term Fee','4th Term Fee','5th Term Fee')`,
    );
    await queryRunner.query(
      `ALTER TABLE "fees" ALTER COLUMN "term" TYPE "fees_term_enum" USING "term"::"fees_term_enum"`,
    );

    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "billing_mode"`,
    );

    await queryRunner.query(
      `ALTER TABLE "students" DROP COLUMN IF EXISTS "drop_location"`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" DROP COLUMN IF EXISTS "pickup_location"`,
    );

    await queryRunner.query(
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "branch" character varying(100)`,
    );
    await queryRunner.query(
      `UPDATE "students" SET "branch" = "school_code" WHERE "branch" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" ALTER COLUMN "branch" SET NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "students" DROP CONSTRAINT IF EXISTS "uq_students_tenant_branch_admission_year"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_students_tenant_branch_year"`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" ADD CONSTRAINT "uq_students_tenant_branch_admission_year" UNIQUE ("tenant_id", "branch", "admission_number", "academic_year")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_students_tenant_branch_year" ON "students" ("tenant_id", "branch", "academic_year")`,
    );

    await queryRunner.query(
      `ALTER TABLE "students" DROP COLUMN IF EXISTS "school_code"`,
    );
  }
}
