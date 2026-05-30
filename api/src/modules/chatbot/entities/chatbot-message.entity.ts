import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum ChatbotMessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

/**
 * One turn in a chatbot conversation. `content` is plain text for
 * user/assistant turns; for `system` turns it's used to capture
 * structured context (greeting, error, etc.) when needed.
 *
 * Token count is kept so per-tenant LLM spend can be billed/capped
 * cheaply without re-tokenising history.
 */
@Entity('chatbot_messages')
@Index('idx_chatbot_msg_conv', ['conversationId', 'createdAt'])
export class ChatbotMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @Column({ type: 'enum', enum: ChatbotMessageRole })
  role: ChatbotMessageRole;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'token_count', type: 'int', nullable: true })
  tokenCount: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
