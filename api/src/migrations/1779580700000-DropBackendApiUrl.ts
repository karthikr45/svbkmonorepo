import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drop `tenant_configurations.backend_api_url`. The column was being
 * stored by the admin form but never read by any runtime code — the
 * frontend always uses NEXT_PUBLIC_API_BASE_URL (build-time env),
 * never a value from this row. Removing it before more admins start
 * filling it in expecting it to do something.
 *
 * IF EXISTS makes the migration idempotent on already-clean databases.
 */
export class DropBackendApiUrl1779580700000 implements MigrationInterface {
  name = 'DropBackendApiUrl1779580700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenant_configurations" DROP COLUMN IF EXISTS "backend_api_url"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenant_configurations" ADD COLUMN IF NOT EXISTS "backend_api_url" text`,
    );
  }
}
