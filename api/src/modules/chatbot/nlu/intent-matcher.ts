import { Injectable } from '@nestjs/common';
import { IntentRegistry } from '../intents/intent.registry';
import { ChatbotCorpus, IntentCorpusEntry } from './corpus.loader';
import { IntentMatch } from '../intents/intent.types';

/** Words ignored when computing overlap. Cheap stop-list, English-only. */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'i', 'me', 'my', 'we', 'our', 'you', 'your',
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'has', 'have', 'had',
  'of', 'to', 'in', 'on', 'for', 'at', 'by', 'with', 'and', 'or',
  'this', 'that', 'these', 'those', 'it', 'its',
  'please', 'pls', 'plz', 'tell', 'show', 'list', 'give', 'get',
  'what', 'how', 'when', 'where', 'who', 'why',
]);

function tokenize(text: string): string[] {
  return (text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function hasAny(tokens: Set<string>, candidates: string[]): boolean {
  return candidates.some((c) => tokens.has(c.toLowerCase()));
}

@Injectable()
export class IntentMatcher {
  constructor(
    private readonly registry: IntentRegistry,
    private readonly corpus: ChatbotCorpus,
  ) {}

  /**
   * Returns the best-scoring intent (and its confidence 0..1) for a
   * given user text, restricted to intents the caller's role can run.
   *
   * Confidence is intentionally simple — sum the matches against the
   * intent's keyword sets, divide by the maximum reachable score. Good
   * enough for a deterministic top-N intent surface; swap for a real
   * classifier when the corpus outgrows ~30 intents.
   */
  match(
    text: string,
    role: string,
  ): { match: IntentMatch | null; entities: Record<string, unknown> } {
    const tokens = tokenize(text);
    if (tokens.length === 0) {
      return { match: null, entities: {} };
    }
    const tokenSet = new Set(tokens.filter((t) => !STOPWORDS.has(t)));
    const allowed = new Set(this.registry.namesForRole(role));

    let best: { name: string; score: number; max: number } | null = null;

    for (const name of this.corpus.intentNames()) {
      if (!allowed.has(name)) continue;
      const entry = this.corpus.forIntent(name);
      if (!entry) continue;

      const { score, max } = this.scoreOne(text, tokenSet, entry);
      if (score <= 0) continue;
      if (!best || score / max > best.score / best.max) {
        best = { name, score, max };
      }
    }

    const entities = this.extractEntities(text, tokens);

    if (!best) return { match: null, entities };

    const confidence = Math.min(1, best.score / best.max);
    return {
      match: {
        intent: best.name,
        confidence,
        entities,
        source: 'rules',
      },
      entities,
    };
  }

  private scoreOne(
    text: string,
    tokenSet: Set<string>,
    entry: IntentCorpusEntry,
  ): { score: number; max: number } {
    let score = 0;
    let max = 0;

    // Whole-utterance match — exact-ish substring boost.
    const lower = text.toLowerCase();
    if (entry.utterances?.length) {
      max += 5;
      for (const u of entry.utterances) {
        if (lower.includes(u.toLowerCase())) {
          score += 5;
          break;
        }
      }
    }

    // allOf — each inner group is a required OR set.
    if (entry.allOf?.length) {
      max += entry.allOf.length * 3;
      for (const group of entry.allOf) {
        if (hasAny(tokenSet, group)) score += 3;
      }
    }

    // anyOf — at least one keyword required for any score.
    if (entry.anyOf?.length) {
      max += 3;
      if (hasAny(tokenSet, entry.anyOf)) {
        score += 3;
      } else {
        // No keyword from anyOf present → this intent is not eligible.
        return { score: 0, max };
      }
    }

    // Boost — purely additive.
    if (entry.boost?.length) {
      max += 2;
      for (const b of entry.boost) {
        if (tokenSet.has(b.toLowerCase())) {
          score += 0.5;
        }
      }
      if (score > max) score = max;
    }

    return { score, max: Math.max(max, 1) };
  }

  /**
   * Lightweight regex entity extraction. Returns a plain object the
   * intent handler can read. Keep regex simple and well-tested —
   * complex entity normalisation belongs in a dedicated tokeniser.
   */
  private extractEntities(
    text: string,
    tokens: string[],
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};

    // Term: "term 2", "2nd term", "second term"
    const termMatch =
      text.match(/term\s*(\d)/i) ?? text.match(/(\d)(?:st|nd|rd|th)?\s*term/i);
    if (termMatch) {
      const n = Number(termMatch[1]);
      if (n >= 1 && n <= 5) {
        // Stored as the canonical TermType label so handlers can pass
        // it straight to fee queries. Mirrors fees.term column values.
        const label = ['1st', '2nd', '3rd', '4th', '5th'][n - 1];
        out.term = `${label} Term Fee`;
      }
    }

    // Academic year: YYYY-YYYY
    const ayMatch = text.match(/(\d{4})-(\d{4})/);
    if (ayMatch && Number(ayMatch[2]) === Number(ayMatch[1]) + 1) {
      out.academicYear = ayMatch[0];
    }

    // Admission number: anything looking like ADM-prefixed code.
    const admMatch = text.match(/\b(ADM[\w-]+)\b/i);
    if (admMatch) out.admissionNumber = admMatch[1].toUpperCase();

    // Time window words; handlers translate to dates as they prefer.
    const lower = text.toLowerCase();
    if (/\btoday\b/.test(lower)) out.timeWindow = 'today';
    else if (/\bthis\s+week\b/.test(lower)) out.timeWindow = 'thisWeek';
    else if (/\bthis\s+month\b/.test(lower)) out.timeWindow = 'thisMonth';

    // Free-form child name hint: any 2+ char token that isn't a stopword
    // and isn't already used by another entity. Best-effort only — the
    // handler still resolves the actual child against the parent's
    // children list, so wrong guesses just default to the first child.
    const used = new Set<string>();
    for (const v of Object.values(out)) used.add(String(v).toLowerCase());
    const nameish = tokens.find(
      (t) =>
        t.length >= 3 &&
        !STOPWORDS.has(t) &&
        !/^\d+$/.test(t) &&
        !used.has(t) &&
        /^[a-z][a-z'-]+$/i.test(t),
    );
    if (nameish) out.childName = nameish;

    return out;
  }
}
