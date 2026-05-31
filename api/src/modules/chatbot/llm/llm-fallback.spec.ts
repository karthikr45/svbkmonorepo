import { Logger } from '@nestjs/common';
import { LlmFallbackService } from './llm-fallback.service';
import type { ChatbotConfig } from '../config/chatbot.config';

/**
 * Unit tests for the pure-function safety layers on the LLM
 * fallback: identity stripping, output filter, token budget, circuit
 * breaker. None of these need Anthropic or a DB to test.
 */

function makeConfig(overrides: Partial<ChatbotConfig> = {}): ChatbotConfig {
  return {
    ruleConfidenceThreshold: 0.5,
    historyTurns: 6,
    ratePerMinute: 30,
    tenantDailyTokenBudget: 1000,
    llmEnabled: false,
    llmModel: '',
    llmApiKey: '',
    llmTimeoutMs: 10_000,
    conversationRetentionDays: 90,
    ssePingMs: 25_000,
    sseMaxDurationMs: 60_000,
    ...overrides,
  };
}

function makeService(
  config: Partial<ChatbotConfig> = {},
): LlmFallbackService {
  const registry = { namesForRole: () => [], get: () => null } as never;
  const metadataRepo = { findOne: async () => null } as never;
  const handlerDeps = { services: {} } as never;
  const svc = new LlmFallbackService(
    makeConfig(config),
    registry,
    metadataRepo,
    handlerDeps,
  );
  // Silence the logger so noisy filter cases don't pollute test output.
  (svc as unknown as { logger: Logger }).logger = {
    error: () => undefined,
    warn: () => undefined,
    log: () => undefined,
  } as unknown as Logger;
  return svc;
}

// Exposes private methods for direct testing — narrowly scoped helper.
function asPrivate(svc: LlmFallbackService): {
  stripIdentityKeys: (v: unknown) => unknown;
  outputFilter: (
    text: string,
    toolResults: unknown[],
    caller: { userId: string; tenantId: string | null; role: string },
  ) => string;
  withinBudget: (tenantId: string | null) => boolean;
  consumeBudget: (tenantId: string | null, tokens: number) => void;
  circuitOpen: () => boolean;
  recordFailure: () => void;
  recordSuccess: () => void;
} {
  return svc as unknown as ReturnType<typeof asPrivate>;
}

describe('LlmFallbackService — pure logic', () => {
  describe('stripIdentityKeys', () => {
    const svc = makeService();
    const strip = (v: unknown) => asPrivate(svc).stripIdentityKeys(v);

    it('drops tenantId at the top level', () => {
      expect(strip({ tenantId: 'x', class: '7' })).toEqual({ class: '7' });
    });

    it('drops snake_case variants', () => {
      expect(
        strip({ tenant_id: 'a', user_id: 'b', admin_id: 'c', role: 'd', ok: 1 }),
      ).toEqual({ ok: 1 });
    });

    it('drops nested identity keys recursively', () => {
      expect(
        strip({
          filters: { tenantId: 'x', class: '7' },
          range: { fromDate: '2026-04-01' },
        }),
      ).toEqual({
        filters: { class: '7' },
        range: { fromDate: '2026-04-01' },
      });
    });

    it('handles arrays of objects', () => {
      expect(
        strip([{ tenantId: 'x', term: '1st' }, { term: '2nd' }]),
      ).toEqual([{ term: '1st' }, { term: '2nd' }]);
    });

    it('passes through primitives untouched', () => {
      expect(strip('hello')).toBe('hello');
      expect(strip(42)).toBe(42);
      expect(strip(null)).toBeNull();
      expect(strip(undefined)).toBeUndefined();
    });
  });

  describe('outputFilter', () => {
    const svc = makeService();
    const filter = asPrivate(svc).outputFilter;
    const caller = { userId: 'u1', tenantId: 't1', role: 'admin' };

    it('keeps UUIDs that are present in tool results', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const tools = [{ id: uuid, name: 'X' }];
      const text = `Found row ${uuid}.`;
      expect(filter.call(svc, text, tools, caller)).toBe(text);
    });

    it('redacts UUIDs that were never in any tool result', () => {
      const known = '550e8400-e29b-41d4-a716-446655440000';
      const unknown = 'abcdef00-0000-0000-0000-000000000999';
      const tools = [{ id: known }];
      const text = `Known ${known} and unknown ${unknown}.`;
      const cleaned = filter.call(svc, text, tools, caller);
      expect(cleaned).not.toContain(unknown);
      expect(cleaned).toContain('[redacted]');
      expect(cleaned).toContain(known);
    });

    it('redacts admission numbers not in tool results', () => {
      const tools = [{ admissionNumber: 'ADM-2024-001' }];
      // Mention both — known one should survive, unknown one redacted.
      const text =
        'Arjun (ADM-2024-001) owes fees; sibling ADM-2024-B-002 is fine.';
      const cleaned = filter.call(svc, text, tools, caller);
      expect(cleaned).toContain('ADM-2024-001');
      expect(cleaned).not.toContain('ADM-2024-B-002');
    });

    it('redacts school codes not in tool results', () => {
      const tools = [{ schoolCode: 'SVBK-BRD' }];
      const text = 'Students at SVBK-BRD; also USH-CBSE not allowed.';
      const cleaned = filter.call(svc, text, tools, caller);
      expect(cleaned).toContain('SVBK-BRD');
      expect(cleaned).not.toContain('USH-CBSE');
    });

    it('is a no-op when text is empty', () => {
      expect(filter.call(svc, '', [], caller)).toBe('');
    });
  });

  describe('per-tenant token budget', () => {
    it('within budget when usage < cap', () => {
      const svc = makeService({ tenantDailyTokenBudget: 100 });
      const p = asPrivate(svc);
      p.consumeBudget('t1', 40);
      expect(p.withinBudget('t1')).toBe(true);
    });

    it('out of budget when usage >= cap', () => {
      const svc = makeService({ tenantDailyTokenBudget: 100 });
      const p = asPrivate(svc);
      p.consumeBudget('t1', 100);
      expect(p.withinBudget('t1')).toBe(false);
    });

    it('treats budget <= 0 as unlimited', () => {
      const svc = makeService({ tenantDailyTokenBudget: 0 });
      const p = asPrivate(svc);
      p.consumeBudget('t1', 100_000);
      expect(p.withinBudget('t1')).toBe(true);
    });

    it('tracks tenants independently', () => {
      const svc = makeService({ tenantDailyTokenBudget: 100 });
      const p = asPrivate(svc);
      p.consumeBudget('t1', 100);
      expect(p.withinBudget('t1')).toBe(false);
      expect(p.withinBudget('t2')).toBe(true);
    });
  });

  describe('circuit breaker', () => {
    const svc = makeService();
    const p = asPrivate(svc);

    beforeEach(() => {
      // Reset between tests.
      for (let i = 0; i < 10; i++) p.recordSuccess();
      expect(p.circuitOpen()).toBe(false);
    });

    it('stays closed under threshold', () => {
      p.recordFailure();
      p.recordFailure();
      p.recordFailure();
      expect(p.circuitOpen()).toBe(false);
    });

    it('opens after 5 consecutive failures', () => {
      for (let i = 0; i < 5; i++) p.recordFailure();
      expect(p.circuitOpen()).toBe(true);
    });

    it('a success resets the failure counter', () => {
      for (let i = 0; i < 4; i++) p.recordFailure();
      p.recordSuccess();
      p.recordFailure();
      expect(p.circuitOpen()).toBe(false);
    });
  });
});
