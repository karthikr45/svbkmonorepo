import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { IntentRegistry } from '../intents/intent.registry';

export interface IntentCorpusEntry {
  /** Sample user phrases — used for direct phrase scoring. */
  utterances?: string[];
  /** Each inner array is an OR-group; ALL groups must be matched. */
  allOf?: string[][];
  /** At least one keyword from this list must appear. */
  anyOf?: string[];
  /** Optional bonus tokens that nudge confidence without being required. */
  boost?: string[];
}

export interface CorpusFile {
  language: string;
  audience: string;
  intents: Record<string, IntentCorpusEntry>;
}

/**
 * Reads every `*.en.json` corpus file under nlu/corpus, validates each
 * intent against the live IntentRegistry (so a typo in an intent name
 * fails fast at boot, not in production), and exposes the merged
 * corpus to the matcher.
 *
 * Adding a new corpus file = drop a JSON file into nlu/corpus/.
 */
@Injectable()
export class ChatbotCorpus implements OnModuleInit {
  private readonly logger = new Logger(ChatbotCorpus.name);
  private merged: Record<string, IntentCorpusEntry> = {};

  constructor(private readonly registry: IntentRegistry) {}

  onModuleInit() {
    this.merged = this.loadAndValidate();
    const intentNames = Object.keys(this.merged);
    this.logger.log(
      `Chatbot corpus loaded: ${intentNames.length} intent(s).`,
    );
  }

  /** Inspect entry for a known intent (returns null if not in corpus). */
  forIntent(name: string): IntentCorpusEntry | null {
    return this.merged[name] ?? null;
  }

  intentNames(): string[] {
    return Object.keys(this.merged);
  }

  private loadAndValidate(): Record<string, IntentCorpusEntry> {
    const dir = join(__dirname, 'corpus');
    // Hardcoding the file list is fine because the *contents* are not
    // hardcoded — files can be edited / added without touching code.
    // Add new files here when a new audience or language ships.
    const files = ['parent.en.json', 'admin.en.json'];

    const out: Record<string, IntentCorpusEntry> = {};
    for (const f of files) {
      const path = join(dir, f);
      let parsed: CorpusFile;
      try {
        parsed = JSON.parse(readFileSync(path, 'utf8')) as CorpusFile;
      } catch (err) {
        throw new Error(
          `Chatbot corpus file ${f} is missing or invalid JSON: ${
            (err as Error).message
          }`,
        );
      }
      for (const [name, entry] of Object.entries(parsed.intents ?? {})) {
        if (!this.registry.get(name)) {
          this.logger.warn(
            `Corpus file ${f} references intent "${name}" but no ` +
              `handler is registered — entry will be ignored.`,
          );
          continue;
        }
        out[name] = entry;
      }
    }

    // Inverse check: any intent in the registry that has no corpus?
    for (const name of this.registry.allNames()) {
      if (!out[name]) {
        this.logger.warn(
          `Intent "${name}" is registered but has no corpus entry — ` +
            `the rule matcher cannot reach it; only the LLM fallback can.`,
        );
      }
    }
    return out;
  }
}
