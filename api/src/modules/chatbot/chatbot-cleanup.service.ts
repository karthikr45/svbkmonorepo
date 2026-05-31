import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { ChatbotConversation } from './entities/chatbot-conversation.entity';
import { ChatbotMessage } from './entities/chatbot-message.entity';
import { ChatbotIntentLog } from './entities/chatbot-intent-log.entity';
import { CHATBOT_CONFIG } from './config/chatbot.config';
import type { ChatbotConfig } from './config/chatbot.config';

/**
 * Daily housekeeping for the chatbot tables.
 *
 * Retention is driven by CHATBOT_CONVERSATION_RETENTION_DAYS (default
 * 90). A non-positive value disables the job — useful when ops wants
 * full retention temporarily (e.g. during a support investigation).
 *
 * Soft-deletes the conversation row (sets `deleted_at`) and hard-
 * deletes the dependent message + intent-log rows since they're
 * append-only audit data with no soft-delete column.
 */
@Injectable()
export class ChatbotCleanupService {
  private readonly logger = new Logger(ChatbotCleanupService.name);

  constructor(
    @InjectRepository(ChatbotConversation)
    private readonly convRepo: Repository<ChatbotConversation>,
    @InjectRepository(ChatbotMessage)
    private readonly msgRepo: Repository<ChatbotMessage>,
    @InjectRepository(ChatbotIntentLog)
    private readonly logRepo: Repository<ChatbotIntentLog>,
    @Inject(CHATBOT_CONFIG) private readonly config: ChatbotConfig,
  ) {}

  /** 03:15 UTC daily — quietest hour for Indian school traffic. */
  @Cron('15 3 * * *')
  async purgeExpired(): Promise<void> {
    const days = this.config.conversationRetentionDays;
    if (!days || days <= 0) {
      this.logger.log('Retention disabled (days <= 0); skipping purge.');
      return;
    }

    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - days);

    // Find conversations to drop. We page so a very large backlog
    // doesn't pin a transaction for minutes.
    const PAGE = 500;
    let totalConvs = 0;
    let totalMsgs = 0;
    let totalLogs = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const batch = await this.convRepo.find({
        where: { lastMessageAt: LessThan(cutoff) },
        take: PAGE,
        select: ['id'],
      });
      if (!batch.length) break;
      const ids = batch.map((c) => c.id);

      // Delete dependents first so the FK-style joins stay sane even
      // if soft-delete is reversed later.
      const msgRes = await this.msgRepo.delete({ conversationId: In(ids) });
      totalMsgs += msgRes.affected ?? 0;
      const logRes = await this.logRepo.delete({
        conversationId: In(ids),
      });
      totalLogs += logRes.affected ?? 0;
      const convRes = await this.convRepo.softDelete(ids);
      totalConvs += convRes.affected ?? 0;

      // Don't loop forever if soft-delete didn't remove rows from the
      // unfiltered find (shouldn't happen — the entity uses TypeORM's
      // deleted_at column which find() respects by default — but be
      // defensive against a misconfigured entity).
      if (convRes.affected === 0) break;
    }

    this.logger.log(
      `Chatbot purge: convs=${totalConvs}, messages=${totalMsgs}, ` +
        `intent_logs=${totalLogs} older than ${days}d (cutoff ${cutoff.toISOString()}).`,
    );
  }
}

