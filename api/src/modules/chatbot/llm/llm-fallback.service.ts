import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CHATBOT_CONFIG } from '../config/chatbot.config';
import type { ChatbotConfig } from '../config/chatbot.config';
import type {
  ChatbotCaller,
  IntentDefinition,
  IntentHandlerDeps,
  IntentResponse,
} from '../intents/intent.types';
import { IntentRegistry } from '../intents/intent.registry';
import { SystemMetadata } from '../../system-metadata/entities/system-metadata.entity';

const SYSTEM_PROMPT_METADATA_TYPE = 'chatbot_system_prompt';
const SYSTEM_PROMPT_METADATA_KEY = 'base';

/** Hard-coded floor in case the metadata row is missing on a fresh DB. */
const FALLBACK_SYSTEM_PROMPT =
  'You are a school-fees assistant. Always use tools to answer; never invent data.';

/** Anthropic Messages API content blocks we care about. */
interface AnthropicTextBlock {
  type: 'text';
  text: string;
}
interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}
type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock;

interface AnthropicResponse {
  id: string;
  stop_reason: string | null;
  content: AnthropicContentBlock[];
  usage: { input_tokens: number; output_tokens: number };
}

interface AnthropicClient {
  messages: {
    create: (args: Record<string, unknown>) => Promise<AnthropicResponse>;
  };
}

interface CircuitState {
  consecutiveFailures: number;
  openedAt: number | null;
}

interface TenantUsage {
  day: string; // YYYY-MM-DD in UTC
  tokens: number;
}

/**
 * Production LLM fallback for the chatbot. Activated when:
 *   - CHATBOT_LLM_ENABLED=true
 *   - CHATBOT_LLM_MODEL and CHATBOT_LLM_API_KEY are set
 *   - The rule-based matcher's confidence < CHATBOT_RULE_CONFIDENCE
 *
 * Safety
 *   - tenantId for every tool comes from `caller`, NEVER from LLM args
 *   - tools are gated by `IntentDefinition.allowedRoles`
 *   - circuit breaker disables LLM for a cooldown after consecutive failures
 *   - per-tenant daily token budget (in-memory; move to Redis for multi-instance)
 *   - output filter scans the LLM's final text for tenant identifiers
 *     (UUIDs / school codes) that weren't in any tool result
 *
 * The Anthropic SDK is required at runtime via dynamic import so the
 * module compiles + ships without a hard dep when LLM is disabled.
 */
@Injectable()
export class LlmFallbackService implements OnModuleInit {
  private readonly logger = new Logger(LlmFallbackService.name);
  private client: AnthropicClient | null = null;
  private cachedSystemPrompt: string | null = null;
  private cachedAt = 0;

  private readonly circuit: CircuitState = {
    consecutiveFailures: 0,
    openedAt: null,
  };
  private readonly CIRCUIT_OPEN_AFTER = 5;
  private readonly CIRCUIT_COOLDOWN_MS = 5 * 60 * 1000;

  /** Per-tenant token usage today. Resets at UTC midnight on lookup. */
  private readonly usage = new Map<string, TenantUsage>();

  /** Max tool_use iterations per turn before we abort. */
  private readonly MAX_TOOL_ITERATIONS = 4;

  constructor(
    @Inject(CHATBOT_CONFIG) private readonly config: ChatbotConfig,
    private readonly registry: IntentRegistry,
    @InjectRepository(SystemMetadata)
    private readonly metadataRepo: Repository<SystemMetadata>,
    @Inject('CHATBOT_HANDLER_DEPS')
    private readonly handlerDeps: IntentHandlerDeps,
  ) {}

  async onModuleInit() {
    if (!this.enabled()) return;
    try {
      // Optional runtime dep. We *do* declare @anthropic-ai/sdk in
      // package.json so types resolve, but routing the import through
      // a string variable means seed/dev environments where the
      // package isn't installed yet (or `pnpm install` was skipped)
      // still boot. The catch below logs and disables the client.
      const sdkModule = '@anthropic-ai/sdk';
      const mod = (await import(sdkModule)) as unknown as {
        default: new (opts: { apiKey: string }) => AnthropicClient;
      };
      this.client = new mod.default({ apiKey: this.config.llmApiKey });
      this.logger.log(
        `Anthropic client ready (model=${this.config.llmModel}).`,
      );
    } catch (err) {
      this.logger.warn(
        `LLM fallback enabled but SDK could not be loaded: ${(err as Error).message}. ` +
          `Install @anthropic-ai/sdk and restart, or set CHATBOT_LLM_ENABLED=false.`,
      );
    }
  }

  enabled(): boolean {
    return (
      this.config.llmEnabled &&
      !!this.config.llmApiKey &&
      !!this.config.llmModel
    );
  }

  /**
   * Returns null when LLM is disabled, the circuit is open, the tenant
   * is over budget, or the call simply fails. Callers should treat
   * null as "show a graceful fallback to the user".
   */
  async ask(
    caller: ChatbotCaller,
    userText: string,
    history: { role: string; content: string }[],
  ): Promise<{ response: IntentResponse; tokens: number } | null> {
    if (!this.enabled() || !this.client) return null;

    if (this.circuitOpen()) {
      this.logger.warn(
        `LLM circuit open; skipping call for tenant ${caller.tenantId ?? 'super'}.`,
      );
      return null;
    }

    if (!this.withinBudget(caller.tenantId)) {
      this.logger.warn(
        `LLM token budget exhausted for tenant ${caller.tenantId ?? 'super'}; skipping.`,
      );
      return null;
    }

    const systemPrompt = await this.systemPrompt();
    const tools = this.toolsFor(caller.role);
    if (!tools.length) return null;

    const messages: Array<{ role: string; content: unknown }> = [
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: userText },
    ];

    let totalTokens = 0;
    const allToolResults: unknown[] = [];

    try {
      for (let i = 0; i < this.MAX_TOOL_ITERATIONS; i++) {
        const resp = await this.callWithTimeout({
          model: this.config.llmModel,
          max_tokens: 1024,
          system: systemPrompt,
          messages,
          tools,
        });

        totalTokens += resp.usage.input_tokens + resp.usage.output_tokens;

        if (resp.stop_reason !== 'tool_use') {
          const text = resp.content
            .filter((b): b is AnthropicTextBlock => b.type === 'text')
            .map((b) => b.text)
            .join('')
            .trim();

          const filtered = this.outputFilter(text, allToolResults, caller);
          this.recordSuccess();
          this.consumeBudget(caller.tenantId, totalTokens);
          return {
            response: {
              data:
                allToolResults.length === 1
                  ? allToolResults[0]
                  : allToolResults,
              text:
                filtered || "I couldn't put that into words. Please try again.",
            },
            tokens: totalTokens,
          };
        }

        // Reply contains tool_use blocks — run each and feed results back.
        const toolUses = resp.content.filter(
          (b): b is AnthropicToolUseBlock => b.type === 'tool_use',
        );
        // Echo the assistant turn back so Anthropic stays in sync.
        messages.push({ role: 'assistant', content: resp.content });

        const toolResultBlocks: unknown[] = [];
        for (const use of toolUses) {
          const result = await this.runTool(caller, use);
          allToolResults.push(result.data);
          toolResultBlocks.push({
            type: 'tool_result',
            tool_use_id: use.id,
            content: JSON.stringify(result),
            is_error: result.isError,
          });
        }
        messages.push({ role: 'user', content: toolResultBlocks });
      }

      this.logger.warn(
        `LLM exceeded MAX_TOOL_ITERATIONS for caller ${caller.userId}; giving up.`,
      );
      this.recordSuccess(); // not a transport failure
      this.consumeBudget(caller.tenantId, totalTokens);
      return null;
    } catch (err) {
      this.recordFailure();
      this.logger.error(`LLM call failed: ${(err as Error).message}`);
      return null;
    }
  }

  // ─── tool dispatch ────────────────────────────────────────────────

  private async runTool(
    caller: ChatbotCaller,
    use: AnthropicToolUseBlock,
  ): Promise<{ data: unknown; text: string; isError: boolean }> {
    const intent = this.registry.get(use.name);
    if (!intent) {
      return {
        data: null,
        text: `Unknown tool "${use.name}".`,
        isError: true,
      };
    }
    if (!intent.allowedRoles.includes(caller.role)) {
      // Hard refusal — don't let the LLM call a tool the user can't.
      return {
        data: null,
        text: `Role "${caller.role}" is not permitted to call "${use.name}".`,
        isError: true,
      };
    }
    try {
      // CRITICAL: caller (with tenantId from JWT) wins. LLM input is
      // entities only; never tenantId / userId / role — recursively
      // stripped, so nested objects can't smuggle them in.
      const sanitized = this.stripIdentityKeys(use.input) as Record<
        string,
        unknown
      >;
      const res = await intent.handler(caller, sanitized, this.handlerDeps);
      return { data: res.data, text: res.text, isError: false };
    } catch (err) {
      return {
        data: null,
        text: `Tool "${use.name}" failed: ${(err as Error).message}`,
        isError: true,
      };
    }
  }

  private static readonly IDENTITY_KEYS = new Set([
    'tenantId',
    'tenant_id',
    'userId',
    'user_id',
    'adminId',
    'admin_id',
    'role',
  ]);

  /**
   * Recursively drops identity keys from any LLM-supplied object,
   * including nested objects + arrays. The LLM can't sneak a
   * `{ filters: { tenantId: '...' } }` through.
   */
  private stripIdentityKeys(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((v) => this.stripIdentityKeys(v));
    }
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (LlmFallbackService.IDENTITY_KEYS.has(k)) continue;
        out[k] = this.stripIdentityKeys(v);
      }
      return out;
    }
    return value;
  }

  private toolsFor(
    role: string,
  ): Array<{ name: string; description: string; input_schema: unknown }> {
    return this.registry
      .namesForRole(role)
      .map((name) => this.registry.get(name))
      .filter((i): i is IntentDefinition => !!i)
      .map((i) => ({
        name: i.name,
        description: i.description,
        input_schema: i.inputSchema,
      }));
  }

  // ─── circuit breaker ──────────────────────────────────────────────

  private circuitOpen(): boolean {
    if (!this.circuit.openedAt) return false;
    if (Date.now() - this.circuit.openedAt > this.CIRCUIT_COOLDOWN_MS) {
      this.circuit.openedAt = null;
      this.circuit.consecutiveFailures = 0;
      return false;
    }
    return true;
  }
  private recordFailure() {
    this.circuit.consecutiveFailures++;
    if (this.circuit.consecutiveFailures >= this.CIRCUIT_OPEN_AFTER) {
      this.circuit.openedAt = Date.now();
      this.logger.warn(
        `LLM circuit opened after ${this.CIRCUIT_OPEN_AFTER} consecutive failures.`,
      );
    }
  }
  private recordSuccess() {
    this.circuit.consecutiveFailures = 0;
  }

  // ─── per-tenant daily token budget ────────────────────────────────

  private withinBudget(tenantId: string | null): boolean {
    if (this.config.tenantDailyTokenBudget <= 0) return true;
    const key = tenantId ?? '__super__';
    const today = new Date().toISOString().slice(0, 10);
    const cur = this.usage.get(key);
    if (!cur || cur.day !== today) {
      this.usage.set(key, { day: today, tokens: 0 });
      return true;
    }
    return cur.tokens < this.config.tenantDailyTokenBudget;
  }
  private consumeBudget(tenantId: string | null, tokens: number) {
    if (this.config.tenantDailyTokenBudget <= 0) return;
    const key = tenantId ?? '__super__';
    const today = new Date().toISOString().slice(0, 10);
    const cur = this.usage.get(key) ?? { day: today, tokens: 0 };
    if (cur.day !== today) {
      cur.day = today;
      cur.tokens = 0;
    }
    cur.tokens += tokens;
    this.usage.set(key, cur);
  }

  // ─── output filter (paranoia layer) ───────────────────────────────

  /**
   * Patterns that look like institution-specific identifiers. Anything
   * matching one of these in the assistant text MUST also appear in
   * the tool result haystack — otherwise the LLM has "remembered"
   * (hallucinated) an identifier that we never returned.
   */
  private static readonly LEAK_PATTERNS: { name: string; re: RegExp }[] = [
    {
      name: 'uuid',
      re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    },
    // Admission numbers, e.g. ADM-2024-G-101
    { name: 'admission', re: /\bADM-[A-Z0-9-]{2,40}\b/gi },
    // School/tenant codes — same shape as our regex in
    // common/constants/tenant.ts: uppercase letters + digits + dashes,
    // starting with a letter, 2–31 chars. Word boundary on both sides.
    { name: 'schoolCode', re: /\b[A-Z][A-Z0-9-]{2,30}\b/g },
  ];

  private outputFilter(
    text: string,
    toolResults: unknown[],
    caller: ChatbotCaller,
  ): string {
    if (!text) return text;
    // Haystack of strings we *gave* the LLM. If a token appears in the
    // text but not here, the LLM made it up.
    const haystack = JSON.stringify(toolResults);
    const haystackLower = haystack.toLowerCase();

    const leaked: { name: string; value: string }[] = [];
    for (const { name, re } of LlmFallbackService.LEAK_PATTERNS) {
      for (const m of text.matchAll(re)) {
        const id = m[0];
        if (!haystackLower.includes(id.toLowerCase())) {
          leaked.push({ name, value: id });
        }
      }
    }
    if (!leaked.length) return text;

    this.logger.error(
      `LLM output filter caught identifier(s) not in tool results: ` +
        leaked.map((l) => `${l.name}=${l.value}`).join(', ') +
        ` caller=${caller.userId} tenant=${caller.tenantId ?? 'super'}. Redacting.`,
    );
    let cleaned = text;
    for (const { value } of leaked)
      cleaned = cleaned.split(value).join('[redacted]');
    return cleaned;
  }

  // ─── system prompt (cached, super-admin editable in system_metadata) ─

  private async systemPrompt(): Promise<string> {
    const TTL_MS = 60_000;
    if (this.cachedSystemPrompt && Date.now() - this.cachedAt < TTL_MS) {
      return this.cachedSystemPrompt;
    }
    try {
      const row = await this.metadataRepo.findOne({
        where: {
          type: SYSTEM_PROMPT_METADATA_TYPE,
          value: SYSTEM_PROMPT_METADATA_KEY,
          isActive: true,
        },
      });
      this.cachedSystemPrompt =
        row?.description?.trim() || FALLBACK_SYSTEM_PROMPT;
    } catch {
      this.cachedSystemPrompt = FALLBACK_SYSTEM_PROMPT;
    }
    this.cachedAt = Date.now();
    return this.cachedSystemPrompt;
  }

  // ─── SDK call with timeout ────────────────────────────────────────

  private async callWithTimeout(
    args: Record<string, unknown>,
  ): Promise<AnthropicResponse> {
    if (!this.client) throw new Error('LLM client not initialised');
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.config.llmTimeoutMs,
    );
    try {
      return await this.client.messages.create({
        ...args,
        // Anthropic SDK accepts an AbortSignal via signal option (v0.x).
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
