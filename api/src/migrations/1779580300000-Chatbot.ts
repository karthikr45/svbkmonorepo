import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schema for the chatbot module.
 *
 *   chatbot_conversations — one row per chatbot session
 *   chatbot_messages       — turns (user / assistant / system)
 *   chatbot_intent_logs    — audit row per ask, used for support +
 *                            corpus-gap reviews + per-tenant cost
 *
 * Idempotent: uses IF NOT EXISTS / IF EXISTS so re-running on an
 * already-migrated DB is a no-op.
 */
export class Chatbot1779580300000 implements MigrationInterface {
  name = 'Chatbot1779580300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chatbot_conversations" (
        "id"               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenant_id"        uuid,
        "user_id"          uuid NOT NULL,
        "user_role"        varchar(50) NOT NULL,
        "title"            varchar(200),
        "message_count"    int NOT NULL DEFAULT 0,
        "last_message_at"  timestamptz,
        "created_at"       timestamptz NOT NULL DEFAULT now(),
        "updated_at"       timestamptz NOT NULL DEFAULT now(),
        "deleted_at"       timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_chatbot_conv_tenant_user"
         ON "chatbot_conversations" ("tenant_id", "user_id", "last_message_at")`,
    );

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "chatbot_messages_role_enum"
          AS ENUM ('user', 'assistant', 'system');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chatbot_messages" (
        "id"               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "conversation_id"  uuid NOT NULL,
        "role"             "chatbot_messages_role_enum" NOT NULL,
        "content"          text NOT NULL,
        "token_count"      int,
        "created_at"       timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_chatbot_msg_conv"
         ON "chatbot_messages" ("conversation_id", "created_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chatbot_intent_logs" (
        "id"                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenant_id"            uuid,
        "conversation_id"      uuid NOT NULL,
        "message_id"           uuid NOT NULL,
        "user_text"            text NOT NULL,
        "matched_intent"       varchar(100),
        "confidence"           real,
        "entities"             jsonb,
        "handler_duration_ms"  int,
        "succeeded"            boolean NOT NULL DEFAULT true,
        "fallback_used"        boolean NOT NULL DEFAULT false,
        "llm_used"             boolean NOT NULL DEFAULT false,
        "llm_tokens"           int,
        "error_message"        text,
        "created_at"           timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_chatbot_intent_log_tenant"
         ON "chatbot_intent_logs" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_chatbot_intent_log_fallback"
         ON "chatbot_intent_logs" ("fallback_used", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "chatbot_intent_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chatbot_messages"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "chatbot_messages_role_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chatbot_conversations"`);
  }
}
