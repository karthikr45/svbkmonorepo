import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AskChatbotDto {
  @ApiProperty({
    description:
      'Free-form question from the user. Plain text, max 1000 chars.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  message: string;

  @ApiPropertyOptional({
    description:
      'Continue an existing chatbot conversation. Omit to start a new one.',
  })
  @IsOptional()
  @IsUUID()
  conversationId?: string;
}

/**
 * SSE event shape the controller writes. Keep names stable —
 * the frontend EventSource listens by name.
 *
 *   typing  — fired once at the start so the client can show a dot
 *   intent  — which intent matched (or 'unknown') with confidence
 *   data    — the raw structured tool result, for table rendering
 *   token   — one chunk of the assistant's natural-language reply
 *   chips   — suggested follow-ups the bot CAN answer next
 *   error   — recoverable error, surfaced to user
 *   done    — terminal event with messageId + timings
 */
export type ChatbotStreamEvent =
  | { event: 'typing'; data: Record<string, never> }
  | {
      event: 'intent';
      data: { name: string; confidence: number; source: 'rules' | 'llm' };
    }
  | { event: 'data'; data: unknown }
  | { event: 'token'; data: string }
  | { event: 'chips'; data: Array<{ label: string; message: string }> }
  | { event: 'error'; data: { message: string } }
  | {
      event: 'done';
      data: {
        messageId: string;
        durationMs: number;
        llmUsed: boolean;
      };
    };
