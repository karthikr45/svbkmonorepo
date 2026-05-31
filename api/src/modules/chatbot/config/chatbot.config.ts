/**
 * Chatbot tunables — all from env, never hardcoded values in code.
 *
 * Keep this file the *single* source for chatbot settings; everything
 * else imports `chatbotConfig` from here. Lets ops change behaviour
 * without a code deploy and keeps tests deterministic.
 *
 * Add new envs to `.env.example` whenever you add a field here.
 */
export interface ChatbotConfig {
  /** Confidence below this routes to LLM fallback (or to "unknown" if LLM off). */
  ruleConfidenceThreshold: number;
  /** How many prior turns to feed forward into context for follow-ups. */
  historyTurns: number;
  /** Per-user requests-per-minute on the ask endpoint. */
  ratePerMinute: number;
  /** Per-tenant per-day LLM token budget (input + output). 0 = unlimited. */
  tenantDailyTokenBudget: number;
  /** When false, the LLM fallback path is short-circuited even if a model is set. */
  llmEnabled: boolean;
  /** Model identifier (provider-specific). Empty string = LLM disabled. */
  llmModel: string;
  /** API key for the LLM provider. Empty = disabled. */
  llmApiKey: string;
  /** Hard request timeout for the LLM call, milliseconds. */
  llmTimeoutMs: number;
  /** Conversation rows older than this are eligible for purging. */
  conversationRetentionDays: number;
  /** Heartbeat interval — keeps the SSE stream alive through proxies. */
  ssePingMs: number;
  /** Cap on a single ask() stream lifetime; client must retry past it. */
  sseMaxDurationMs: number;
}

function envInt(name: string, def: number): number {
  const raw = process.env[name];
  if (!raw) return def;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : def;
}

function envFloat(name: string, def: number): number {
  const raw = process.env[name];
  if (!raw) return def;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : def;
}

function envBool(name: string, def: boolean): boolean {
  const raw = process.env[name];
  if (raw == null) return def;
  return ['true', '1', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

export function loadChatbotConfig(): ChatbotConfig {
  return {
    ruleConfidenceThreshold: envFloat('CHATBOT_RULE_CONFIDENCE', 0.5),
    historyTurns: envInt('CHATBOT_HISTORY_TURNS', 6),
    ratePerMinute: envInt('CHATBOT_RATE_PER_MINUTE', 30),
    tenantDailyTokenBudget: envInt('CHATBOT_TENANT_DAILY_TOKENS', 100_000),
    llmEnabled: envBool('CHATBOT_LLM_ENABLED', false),
    llmModel: process.env.CHATBOT_LLM_MODEL ?? '',
    llmApiKey: process.env.CHATBOT_LLM_API_KEY ?? '',
    llmTimeoutMs: envInt('CHATBOT_LLM_TIMEOUT_MS', 10_000),
    conversationRetentionDays: envInt(
      'CHATBOT_CONVERSATION_RETENTION_DAYS',
      90,
    ),
    ssePingMs: envInt('CHATBOT_SSE_PING_MS', 25_000),
    sseMaxDurationMs: envInt('CHATBOT_SSE_MAX_DURATION_MS', 60_000),
  };
}

export const CHATBOT_CONFIG = Symbol('CHATBOT_CONFIG');
