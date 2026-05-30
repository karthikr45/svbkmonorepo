import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Per-turn audit row. Captures what the user typed, which intent was
 * matched (and at what confidence), what entities were extracted, how
 * long the handler took, and whether the rule-based path or the LLM
 * fallback served the answer.
 *
 * Drives:
 *   - "the bot answered wrong" support investigations
 *   - the weekly corpus-gap review (top user_text where matched=null)
 *   - per-tenant cost dashboards (sum llm_tokens where llm_used)
 */
@Entity('chatbot_intent_logs')
@Index('idx_chatbot_intent_log_tenant', ['tenantId', 'createdAt'])
@Index('idx_chatbot_intent_log_fallback', ['fallbackUsed', 'createdAt'])
export class ChatbotIntentLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @Column({ name: 'message_id', type: 'uuid' })
  messageId: string;

  @Column({ name: 'user_text', type: 'text' })
  userText: string;

  /** Null = no rule matched and (LLM disabled or LLM also failed). */
  @Column({ name: 'matched_intent', type: 'varchar', length: 100, nullable: true })
  matchedIntent: string | null;

  @Column({ type: 'real', nullable: true })
  confidence: number | null;

  @Column({ type: 'jsonb', nullable: true })
  entities: Record<string, unknown> | null;

  @Column({ name: 'handler_duration_ms', type: 'int', nullable: true })
  handlerDurationMs: number | null;

  @Column({ type: 'boolean', default: true })
  succeeded: boolean;

  @Column({ name: 'fallback_used', type: 'boolean', default: false })
  fallbackUsed: boolean;

  @Column({ name: 'llm_used', type: 'boolean', default: false })
  llmUsed: boolean;

  @Column({ name: 'llm_tokens', type: 'int', nullable: true })
  llmTokens: number | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
