import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatbotConversation } from './entities/chatbot-conversation.entity';
import { ChatbotMessage } from './entities/chatbot-message.entity';
import { ChatbotIntentLog } from './entities/chatbot-intent-log.entity';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { ChatbotCleanupService } from './chatbot-cleanup.service';
import { IntentRegistry } from './intents/intent.registry';
import { IntentMatcher } from './nlu/intent-matcher';
import { ChatbotCorpus } from './nlu/corpus.loader';
import { LlmFallbackService } from './llm/llm-fallback.service';
import { CHATBOT_CONFIG, loadChatbotConfig } from './config/chatbot.config';

import { Fee } from '../fees/entities/fee.entity';
import { AdjustmentApproval } from '../approvals/entities/adjustment-approval.entity';
import { SystemMetadata } from '../system-metadata/entities/system-metadata.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { ParentPortalModule } from '../parent-portal/parent-portal.module';
import { ParentPortalService } from '../parent-portal/parent-portal.service';
import { AnnouncementsModule } from '../announcements/announcements.module';
import { AnnouncementsService } from '../announcements/announcements.service';

/**
 * The "handler deps bag" — a single object passed to every intent
 * handler. Centralised here so handler files don't need their own
 * @InjectRepository / DI boilerplate.
 *
 * Add a service here only when an intent actually needs it; keeping
 * this surface small keeps the blast radius of any one handler small.
 */
const HANDLER_DEPS_TOKEN = 'CHATBOT_HANDLER_DEPS';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatbotConversation,
      ChatbotMessage,
      ChatbotIntentLog,
      Fee,
      AdjustmentApproval,
      SystemMetadata,
      Tenant,
    ]),
    ParentPortalModule,
    AnnouncementsModule,
  ],
  controllers: [ChatbotController],
  providers: [
    {
      provide: CHATBOT_CONFIG,
      useFactory: loadChatbotConfig,
    },
    ChatbotCorpus,
    IntentRegistry,
    IntentMatcher,
    LlmFallbackService,
    ChatbotService,
    ChatbotCleanupService,
    {
      provide: HANDLER_DEPS_TOKEN,
      useFactory: (
        feeRepo: Repository<Fee>,
        approvalRepo: Repository<AdjustmentApproval>,
        parentPortal: ParentPortalService,
        announcements: AnnouncementsService,
      ) => ({
        services: {
          feeRepo,
          approvalRepo,
          parentPortal,
          announcements,
        },
      }),
      inject: [
        getRepositoryToken(Fee),
        getRepositoryToken(AdjustmentApproval),
        ParentPortalService,
        AnnouncementsService,
      ],
    },
  ],
})
export class ChatbotModule {}
