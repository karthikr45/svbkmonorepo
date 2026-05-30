import { Inject, Injectable, Logger } from '@nestjs/common';
import { CHATBOT_CONFIG } from '../config/chatbot.config';
import type { ChatbotConfig } from '../config/chatbot.config';
import type { ChatbotCaller, IntentResponse } from '../intents/intent.types';

/**
 * SEAM for the LLM fallback path. Implemented as a no-op today so the
 * rest of the module can ship safely without a provider SDK. When the
 * org is ready, drop the SDK call inside `ask()` and the orchestrator
 * picks it up — no other code change needed.
 *
 * Production contract when this is fleshed out:
 *   - tenantId for every tool comes from `caller`, never from LLM args
 *   - tools are the same intent handlers the rule-based path uses
 *   - request timeout = CHATBOT_LLM_TIMEOUT_MS
 *   - tokens charged against per-tenant daily budget
 *   - circuit breaker disables LLM for 5 min after 5% error rate window
 *   - output filter scans assistant text for tenant identifiers that
 *     weren't in any tool result; redact + alert if found
 */
@Injectable()
export class LlmFallbackService {
  private readonly logger = new Logger(LlmFallbackService.name);

  constructor(
    @Inject(CHATBOT_CONFIG) private readonly config: ChatbotConfig,
  ) {}

  enabled(): boolean {
    return (
      this.config.llmEnabled &&
      !!this.config.llmApiKey &&
      !!this.config.llmModel
    );
  }

  /**
   * Returns null when LLM is disabled OR no useful response could be
   * produced. The caller treats null as "show the fallback message".
   */
  async ask(
    _caller: ChatbotCaller,
    _userText: string,
    _history: { role: string; content: string }[],
  ): Promise<{ response: IntentResponse; tokens: number } | null> {
    if (!this.enabled()) return null;

    // TODO when ready: import { Anthropic } from '@anthropic-ai/sdk';
    // - build tool definitions from IntentRegistry
    // - call client.messages.stream({ model, tools, ... })
    // - loop tool_use blocks, dispatching through the same handlers
    // - aggregate tokens for billing
    // - apply output filter + return
    //
    // For now log and return null so the orchestrator surfaces a
    // graceful fallback message.
    this.logger.warn(
      'LLM fallback enabled but ask() is not implemented — returning null.',
    );
    return null;
  }
}
