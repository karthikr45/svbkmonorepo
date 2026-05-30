import { Injectable } from '@nestjs/common';
import { IntentDefinition } from './intent.types';
import {
  getMyChildFeesIntent,
  getUpcomingAnnouncementsIntent,
  listMyChildrenIntent,
} from './parent.intents';
import {
  getCollectionSummaryIntent,
  getFeeDefaultersIntent,
  getPendingApprovalsIntent,
} from './admin.intents';

/**
 * Single source of truth for every intent the chatbot recognises.
 * Adding an intent = a new file in `intents/` + an entry here.
 *
 * The matcher reads `Object.keys(...)` to know what to score against,
 * so removing an intent here removes it from the bot's vocabulary
 * (the corpus JSON entry can stay; it just becomes inert).
 */
@Injectable()
export class IntentRegistry {
  private readonly intents: Record<string, IntentDefinition> = {
    [listMyChildrenIntent.name]: listMyChildrenIntent,
    [getMyChildFeesIntent.name]: getMyChildFeesIntent,
    [getUpcomingAnnouncementsIntent.name]: getUpcomingAnnouncementsIntent,
    [getFeeDefaultersIntent.name]: getFeeDefaultersIntent,
    [getPendingApprovalsIntent.name]: getPendingApprovalsIntent,
    [getCollectionSummaryIntent.name]: getCollectionSummaryIntent,
  };

  get(name: string): IntentDefinition | null {
    return this.intents[name] ?? null;
  }

  /** Names visible to a given role. Used to scope matcher candidates. */
  namesForRole(role: string): string[] {
    return Object.values(this.intents)
      .filter((i) => i.allowedRoles.includes(role))
      .map((i) => i.name);
  }

  /** Every intent — used at boot to validate the corpus is in sync. */
  allNames(): string[] {
    return Object.keys(this.intents);
  }
}
