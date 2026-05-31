import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes the chatbot feature from the schema in one go:
 *   - drops chatbot_intent_logs, chatbot_messages, chatbot_conversations
 *   - drops the chatbot_messages_role_enum type
 *   - drops the tenants.chatbot_enabled column
 *   - deletes the seeded chatbot_system_prompt rows from system_metadata
 *
 * The chatbot module + LLM code is being removed; this migration
 * brings every existing DB back to a chatbot-free state idempotently.
 * Safe to re-run.
 */
export class RemoveChatbot1779580500000 implements MigrationInterface {
  name = 'RemoveChatbot1779580500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "chatbot_intent_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chatbot_messages"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "chatbot_messages_role_enum"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "chatbot_conversations"`);
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "chatbot_enabled"`,
    );
    await queryRunner.query(
      `DELETE FROM "system_metadata" WHERE "type" = 'chatbot_system_prompt'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op. Re-introducing the chatbot is a feature commit, not a
    // schema rollback — the old chatbot migrations are deleted from
    // the repo, so we can't reach back.
    void queryRunner;
  }
}
