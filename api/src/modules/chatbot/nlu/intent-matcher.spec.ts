import { IntentMatcher } from './intent-matcher';
import type { IntentRegistry } from '../intents/intent.registry';
import type { ChatbotCorpus, IntentCorpusEntry } from './corpus.loader';
import { Role } from '../../../common/enums/roles.enum';

function makeMatcher(
  intents: Record<string, IntentCorpusEntry>,
  rolesByIntent: Record<string, string[]>,
): IntentMatcher {
  const registry = {
    namesForRole: (role: string) =>
      Object.entries(rolesByIntent)
        .filter(([, roles]) => roles.includes(role))
        .map(([name]) => name),
  } as unknown as IntentRegistry;
  const corpus = {
    intentNames: () => Object.keys(intents),
    forIntent: (name: string) => intents[name] ?? null,
  } as unknown as ChatbotCorpus;
  return new IntentMatcher(registry, corpus);
}

describe('IntentMatcher', () => {
  const intents: Record<string, IntentCorpusEntry> = {
    get_my_child_fees: {
      utterances: ['pending fees', 'show my child fees'],
      anyOf: ['fee', 'fees', 'due', 'owe', 'balance'],
      boost: ['my', 'child', 'son', 'daughter'],
    },
    get_fee_defaulters: {
      anyOf: ['defaulter', 'defaulters', 'unpaid'],
      boost: ['students', 'list'],
    },
    list_my_children: {
      utterances: ['show my children'],
      anyOf: ['child', 'children', 'kids'],
    },
  };
  const rolesByIntent = {
    get_my_child_fees: [Role.PARENT],
    get_fee_defaulters: [Role.ADMIN],
    list_my_children: [Role.PARENT],
  };
  const matcher = makeMatcher(intents, rolesByIntent);

  it('matches a clear parent utterance', () => {
    const { match } = matcher.match('show my pending fees', Role.PARENT);
    expect(match?.intent).toBe('get_my_child_fees');
    expect(match?.confidence).toBeGreaterThan(0);
  });

  it("never matches a parent intent for an admin's text", () => {
    const { match } = matcher.match('show my children', Role.ADMIN);
    // No admin-eligible intent for this text, so it must be null.
    expect(match).toBeNull();
  });

  it('returns null for empty input', () => {
    const { match } = matcher.match('', Role.PARENT);
    expect(match).toBeNull();
  });

  it('returns null when no keyword from anyOf is present', () => {
    const { match } = matcher.match('hello there', Role.PARENT);
    expect(match).toBeNull();
  });

  it('extracts term entity from "term 2"', () => {
    const { entities } = matcher.match(
      'show fee defaulters for term 2',
      Role.ADMIN,
    );
    expect(entities.term).toBe('2nd Term Fee');
  });

  it('extracts term entity from "2nd term"', () => {
    const { entities } = matcher.match(
      'show defaulters for 2nd term',
      Role.ADMIN,
    );
    expect(entities.term).toBe('2nd Term Fee');
  });

  it('extracts academic year only when end = start + 1', () => {
    const ok = matcher.match(
      'show defaulters for 2025-2026',
      Role.ADMIN,
    ).entities;
    expect(ok.academicYear).toBe('2025-2026');

    const bad = matcher.match(
      'show defaulters for 2025-2027',
      Role.ADMIN,
    ).entities;
    expect(bad.academicYear).toBeUndefined();
  });

  it('extracts an admission number in uppercase', () => {
    const { entities } = matcher.match(
      'fees for ADM-2024-001',
      Role.PARENT,
    );
    expect(entities.admissionNumber).toBe('ADM-2024-001');
  });

  it('picks the higher-scoring intent when two are eligible', () => {
    // Both could match on a generic word; the boost on "my" + "child"
    // should win for get_my_child_fees.
    const { match } = matcher.match(
      'my child has pending fees',
      Role.PARENT,
    );
    expect(match?.intent).toBe('get_my_child_fees');
  });

  it('confidence is between 0 and 1', () => {
    const { match } = matcher.match('pending fees', Role.PARENT);
    expect(match).not.toBeNull();
    expect(match!.confidence).toBeGreaterThan(0);
    expect(match!.confidence).toBeLessThanOrEqual(1);
  });
});
