import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `tenants.chatbot_enabled` so super-admin (and support) can
 * gate the chatbot per-tenant without a code deploy. Default false so
 * that the moment this migration runs in any environment, no tenant
 * has the chatbot live until it's explicitly turned on.
 */
export class TenantChatbotKillSwitch1779580400000
  implements MigrationInterface
{
  name = 'TenantChatbotKillSwitch1779580400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "chatbot_enabled" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "chatbot_enabled"`,
    );
  }
}
