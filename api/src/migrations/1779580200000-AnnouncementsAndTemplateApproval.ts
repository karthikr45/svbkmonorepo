import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Flesh out the `announcements` table so the events feature can land,
 * and tidy up `templates.status` to default to 'pending' explicitly.
 *
 * The original `announcements` table was a placeholder (only `id`).
 * No real rows exist, so this migration drops and recreates it with
 * the real schema. If you somehow already have data in `announcements`,
 * back it up before running.
 *
 * `templates.status` already exists as a free-form varchar; we just make
 * the default explicit so newly-created rows land as 'pending' even when
 * the application layer forgets to set it.
 */
export class AnnouncementsAndTemplateApproval1779580200000
  implements MigrationInterface
{
  name = 'AnnouncementsAndTemplateApproval1779580200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── announcements ─────────────────────────────────────────────
    await queryRunner.query(`DROP TABLE IF EXISTS "announcements"`);
    await queryRunner.query(`
      CREATE TABLE "announcements" (
        "id"             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenant_id"      uuid NOT NULL,
        "title"          varchar(200) NOT NULL,
        "body"           text,
        "event_date"     timestamptz,
        "audience_role"  varchar(50),
        "published_at"   timestamptz,
        "created_by"     uuid,
        "created_at"     timestamptz NOT NULL DEFAULT now(),
        "updated_at"     timestamptz NOT NULL DEFAULT now(),
        "deleted_at"     timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_announcements_tenant_published" ON "announcements" ("tenant_id", "published_at")`,
    );

    // ── templates ─────────────────────────────────────────────────
    // Status was already varchar with default 'pending' via the entity
    // decorator, but if the DB was built before that default was set,
    // tighten it now so manual inserts also default correctly.
    await queryRunner.query(
      `ALTER TABLE "templates" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "templates" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_announcements_tenant_published"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "announcements"`);
    await queryRunner.query(`
      CREATE TABLE "announcements" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4()
      )
    `);
  }
}
