import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `tenant_configurations.payment_mode` ('test' | 'production'),
 * defaulting to 'test'. Drives sandbox-vs-live for the gateway SDKs
 * (currently Cashfree) so each tenant can pilot on test keys and flip
 * to production independently — no env var or deploy required.
 *
 * Idempotent via IF NOT EXISTS on the enum and column.
 */
export class AddPaymentMode1779580900000 implements MigrationInterface {
  name = 'AddPaymentMode1779580900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'tenant_configurations_payment_mode_enum'
        ) THEN
          CREATE TYPE "tenant_configurations_payment_mode_enum"
            AS ENUM ('test', 'production');
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "tenant_configurations"
        ADD COLUMN IF NOT EXISTS "payment_mode"
        "tenant_configurations_payment_mode_enum"
        NOT NULL DEFAULT 'test'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenant_configurations"
        DROP COLUMN IF EXISTS "payment_mode"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "tenant_configurations_payment_mode_enum"
    `);
  }
}
