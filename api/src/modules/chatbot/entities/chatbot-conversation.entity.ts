import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A chatbot session for one user. Tenant-scoped (super-admins land
 * here with `tenantId = null`).
 *
 * `title` is the first user message, trimmed — populated server-side
 * so the UI can show a meaningful history list without an extra call.
 */
@Entity('chatbot_conversations')
@Index('idx_chatbot_conv_tenant_user', ['tenantId', 'userId', 'lastMessageAt'])
export class ChatbotConversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Role at the time of the conversation; intent gating uses this. */
  @Column({ name: 'user_role', type: 'varchar', length: 50 })
  userRole: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title: string | null;

  @Column({ name: 'message_count', type: 'int', default: 0 })
  messageCount: number;

  @Column({ name: 'last_message_at', type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
