import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable } from 'rxjs';
import { ChatbotConversation } from './entities/chatbot-conversation.entity';
import {
  ChatbotMessage,
  ChatbotMessageRole,
} from './entities/chatbot-message.entity';
import { ChatbotIntentLog } from './entities/chatbot-intent-log.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { IntentRegistry } from './intents/intent.registry';
import { IntentMatcher } from './nlu/intent-matcher';
import { ChatbotStreamEvent } from './dto/ask.dto';
import type {
  ChatbotCaller,
  IntentDefinition,
  IntentHandlerDeps,
  IntentResponse,
} from './intents/intent.types';
import { LlmFallbackService } from './llm/llm-fallback.service';
import { CHATBOT_CONFIG } from './config/chatbot.config';
import type { ChatbotConfig } from './config/chatbot.config';

/**
 * Orchestrator. Per turn:
 *   1. Resolve or create the conversation.
 *   2. Persist the user message.
 *   3. Match an intent against the user text.
 *   4. If confidence >= threshold AND role allows → run the handler.
 *      Else if LLM enabled → ask the fallback.
 *      Else → graceful "I can help with X" reply + chips.
 *   5. Persist assistant message + intent log.
 *   6. Stream the answer back as SSE events.
 *
 * Tenant safety: caller.tenantId is read from the JWT (filled in the
 * controller); intent handlers never receive a tenantId argument they
 * could mutate.
 */
@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    @InjectRepository(ChatbotConversation)
    private readonly convRepo: Repository<ChatbotConversation>,
    @InjectRepository(ChatbotMessage)
    private readonly msgRepo: Repository<ChatbotMessage>,
    @InjectRepository(ChatbotIntentLog)
    private readonly logRepo: Repository<ChatbotIntentLog>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly registry: IntentRegistry,
    private readonly matcher: IntentMatcher,
    private readonly llm: LlmFallbackService,
    @Inject(CHATBOT_CONFIG) private readonly config: ChatbotConfig,
    @Inject('CHATBOT_HANDLER_DEPS')
    private readonly handlerDeps: IntentHandlerDeps,
  ) {}

  /**
   * Per-tenant feature gate. Super-admins (no tenantId) always pass —
   * they need the bot to test/onboard new tenants. Everyone else needs
   * their tenant's `chatbot_enabled` set to true.
   *
   * Cached briefly (10s) per tenant so the per-turn lookup is cheap.
   */
  private readonly gateCache = new Map<
    string,
    { enabled: boolean; at: number }
  >();
  private readonly GATE_TTL_MS = 10_000;

  async isEnabledFor(caller: ChatbotCaller): Promise<boolean> {
    if (!caller.tenantId) return true; // super-admin bypass
    const cached = this.gateCache.get(caller.tenantId);
    if (cached && Date.now() - cached.at < this.GATE_TTL_MS) {
      return cached.enabled;
    }
    const t = await this.tenantRepo.findOne({
      where: { id: caller.tenantId },
      select: ['id', 'chatbotEnabled'],
    });
    const enabled = !!t?.chatbotEnabled;
    this.gateCache.set(caller.tenantId, { enabled, at: Date.now() });
    return enabled;
  }

  /** Server-Sent Events stream consumed by `EventSource` on the frontend. */
  ask(
    caller: ChatbotCaller,
    userText: string,
    conversationId?: string,
  ): Observable<{ data: string; type: string }> {
    return new Observable((subscriber) => {
      // Wrap in an IIFE so we can use async/await but still return the
      // synchronous teardown function rxjs expects. `void` discards the
      // returned promise — every reject path inside the IIFE is caught
      // and reported via `subscriber`/`emit`, so there is no failure
      // mode that should bubble to an unhandled rejection.
      let cancelled = false;
      void (async () => {
        const started = Date.now();
        const emit = (e: ChatbotStreamEvent) => {
          if (cancelled) return;
          subscriber.next({ type: e.event, data: JSON.stringify(e.data) });
        };
        // Declared outside the try so the catch can use real IDs for
        // the audit log when the failure happens after they're created.
        let conv: ChatbotConversation | null = null;
        let userMsg: ChatbotMessage | null = null;
        try {
          if (!(await this.isEnabledFor(caller))) {
            emit({
              event: 'error',
              data: {
                message:
                  'The assistant is not enabled for your account. ' +
                  'Please ask your school administrator.',
              },
            });
            subscriber.complete();
            return;
          }
          emit({ event: 'typing', data: {} });

          conv = await this.resolveConversation(
            caller,
            conversationId,
            userText,
          );
          userMsg = await this.saveMessage(
            conv.id,
            ChatbotMessageRole.USER,
            userText,
          );

          const { match } = this.matcher.match(userText, caller.role);
          const matchedAbove =
            match && match.confidence >= this.config.ruleConfidenceThreshold;

          let response: IntentResponse;
          let llmUsed = false;
          let intentName = match?.intent ?? 'unknown';
          let confidence = match?.confidence ?? 0;
          let source: 'rules' | 'llm' = 'rules';

          if (matchedAbove) {
            const intent = this.registry.get(match.intent);
            if (!intent) {
              // Registry/corpus drift — log and fall through.
              this.logger.warn(
                `Matcher returned "${match.intent}" but registry has no entry.`,
              );
              response = this.fallbackResponse(caller.role);
              intentName = 'unknown';
              confidence = 0;
            } else {
              this.assertRoleAllowed(intent, caller.role);
              response = await intent.handler(
                caller,
                match.entities,
                this.handlerDeps,
              );
            }
          } else if (this.llm.enabled()) {
            source = 'llm';
            const history = await this.recentHistory(conv.id);
            const llm = await this.llm.ask(caller, userText, history);
            if (llm) {
              llmUsed = true;
              response = llm.response;
              intentName = match?.intent ?? 'llm_freeform';
              confidence = 1;
            } else {
              response = this.fallbackResponse(caller.role);
              intentName = 'unknown';
            }
          } else {
            response = this.fallbackResponse(caller.role);
          }

          emit({
            event: 'intent',
            data: { name: intentName, confidence, source },
          });
          if (response.data !== undefined && response.data !== null) {
            emit({ event: 'data', data: response.data });
          }
          await this.streamText(response.text, emit, cancelled);
          if (response.chips?.length) {
            emit({ event: 'chips', data: response.chips });
          }

          const asstMsg = await this.saveMessage(
            conv.id,
            ChatbotMessageRole.ASSISTANT,
            response.text,
          );

          await this.logRepo.save(
            this.logRepo.create({
              tenantId: caller.tenantId,
              conversationId: conv.id,
              messageId: userMsg.id,
              userText,
              matchedIntent: intentName === 'unknown' ? null : intentName,
              confidence,
              entities: match?.entities ?? null,
              handlerDurationMs: Date.now() - started,
              succeeded: true,
              fallbackUsed: !matchedAbove,
              llmUsed,
            }),
          );

          emit({
            event: 'done',
            data: {
              messageId: asstMsg.id,
              durationMs: Date.now() - started,
              llmUsed,
            },
          });
          subscriber.complete();
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Something went wrong.';
          this.logger.error(`Chatbot ask failed: ${message}`);
          // Only write the audit row if we got far enough to have real
          // conversation + message IDs — otherwise the FK-like values
          // pollute the log table. The logger entry above is the
          // canonical record for very-early failures.
          if (conv && userMsg) {
            await this.logRepo
              .save(
                this.logRepo.create({
                  tenantId: caller.tenantId,
                  conversationId: conv.id,
                  messageId: userMsg.id,
                  userText,
                  matchedIntent: null,
                  confidence: 0,
                  entities: null,
                  handlerDurationMs: Date.now() - started,
                  succeeded: false,
                  fallbackUsed: true,
                  llmUsed: false,
                  errorMessage: message,
                }),
              )
              .catch(() => undefined);
          }
          emit({ event: 'error', data: { message } });
          subscriber.complete();
        }
      })();

      return () => {
        cancelled = true;
      };
    });
  }

  async listConversations(caller: ChatbotCaller) {
    if (!(await this.isEnabledFor(caller))) {
      throw new ForbiddenException(
        'The assistant is not enabled for your account.',
      );
    }
    return this.convRepo.find({
      where: { userId: caller.userId },
      order: { lastMessageAt: 'DESC' },
      take: 50,
    });
  }

  async getConversation(caller: ChatbotCaller, id: string) {
    if (!(await this.isEnabledFor(caller))) {
      throw new ForbiddenException(
        'The assistant is not enabled for your account.',
      );
    }
    const conv = await this.convRepo.findOne({
      where: { id, userId: caller.userId },
    });
    if (!conv) throw new NotFoundException();
    const messages = await this.msgRepo.find({
      where: { conversationId: id },
      order: { createdAt: 'ASC' },
    });
    return { conversation: conv, messages };
  }

  // ─── helpers ────────────────────────────────────────────────────

  private async resolveConversation(
    caller: ChatbotCaller,
    id: string | undefined,
    firstText: string,
  ): Promise<ChatbotConversation> {
    if (id) {
      const existing = await this.convRepo.findOne({
        where: { id, userId: caller.userId },
      });
      if (existing) return existing;
    }
    return this.convRepo.save(
      this.convRepo.create({
        tenantId: caller.tenantId,
        userId: caller.userId,
        userRole: caller.role,
        title: firstText.slice(0, 200),
        messageCount: 0,
      }),
    );
  }

  private async saveMessage(
    conversationId: string,
    role: ChatbotMessageRole,
    content: string,
  ): Promise<ChatbotMessage> {
    const saved = await this.msgRepo.save(
      this.msgRepo.create({ conversationId, role, content }),
    );
    await this.convRepo.update(
      { id: conversationId },
      {
        lastMessageAt: saved.createdAt,
        messageCount: () => 'message_count + 1',
      },
    );
    return saved;
  }

  private async recentHistory(
    conversationId: string,
  ): Promise<{ role: string; content: string }[]> {
    const rows = await this.msgRepo.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: this.config.historyTurns * 2,
    });
    return rows.reverse().map((r) => ({ role: r.role, content: r.content }));
  }

  private assertRoleAllowed(intent: IntentDefinition, role: string) {
    if (!intent.allowedRoles.includes(role)) {
      throw new ForbiddenException(
        `Your role is not permitted to run "${intent.name}".`,
      );
    }
  }

  /**
   * Streams the assistant text out as small `token` events so the
   * frontend can render a typewriter. Splits on word boundaries to
   * avoid cutting words mid-letter. No LLM = no real token boundary;
   * this just makes the experience feel responsive.
   */
  private async streamText(
    text: string,
    emit: (e: ChatbotStreamEvent) => void,
    cancelled: boolean,
  ): Promise<void> {
    const parts = text.match(/\S+\s*|\s+/g) ?? [text];
    // Keep the loop tight; the human eye can't keep up with sub-30ms anyway.
    for (const p of parts) {
      if (cancelled) return;
      emit({ event: 'token', data: p });
      await new Promise((r) => setTimeout(r, 18));
    }
  }

  private fallbackResponse(role: string): IntentResponse {
    const chips = this.suggestionChipsFor(role);
    const human = chips.map((c) => c.label).join(', ');
    return {
      data: null,
      text:
        "I'm not sure how to answer that yet. " +
        `I can help with: ${human || 'a few things'}. ` +
        'Try one of the suggestions below.',
      chips,
    };
  }

  /**
   * Turn intent names like `get_my_child_fees` into human-readable
   * chip labels ("Get my child fees") and messages the bot can match
   * back via its corpus. Title-case the words; keep it simple.
   */
  private suggestionChipsFor(
    role: string,
  ): { label: string; message: string }[] {
    const humanise = (name: string) => {
      const cleaned = name.replace(/^(get|list)_/, '').replace(/_/g, ' ');
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    };
    return this.registry
      .namesForRole(role)
      .slice(0, 3)
      .map((n) => ({ label: humanise(n), message: humanise(n) }));
  }
}
