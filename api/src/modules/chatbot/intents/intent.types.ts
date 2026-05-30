/**
 * Contract every chatbot intent must satisfy. The matcher classifies
 * to an intent name; the registry looks up the corresponding handler.
 *
 * `handler` receives the authenticated caller (NEVER trust args for
 * identity), the extracted entities, and a `deps` bag of injected
 * services. It returns a structured payload + a short prose answer.
 *
 * Keeping reply text in the handler (not the matcher) lets each tool
 * own its phrasing and stay testable without an LLM.
 */
export interface ChatbotCaller {
  userId: string;
  /** Null for super-admin. */
  tenantId: string | null;
  role: string;
}

export interface IntentMatch {
  intent: string;
  confidence: number;
  entities: Record<string, unknown>;
  source: 'rules' | 'llm';
}

export interface ChatbotChip {
  label: string;
  message: string;
}

export interface IntentResponse {
  /** Structured payload — rendered as a table/list in the UI. */
  data: unknown;
  /** Plain text answer, streamed token-by-token to the client. */
  text: string;
  /** Suggested next-step chips. Optional. */
  chips?: ChatbotChip[];
}

export interface IntentHandlerDeps {
  // Filled at module wiring time. Keep this surface small — adding
  // a service here means every handler has access to it.
  services: Record<string, unknown>;
}

export interface IntentDefinition {
  /** Stable identifier, snake_case. Used as the corpus key. */
  name: string;
  /**
   * Plain-English description used by the LLM fallback to decide
   * when to call this tool. Keep it tight — one sentence describing
   * WHEN to use it, not HOW.
   */
  description: string;
  /**
   * JSON-Schema for the entities/inputs the LLM is allowed to supply.
   * MUST NOT declare `tenantId` / `userId` / `role` — those come from
   * the authenticated caller, never from the LLM.
   */
  inputSchema: {
    type: 'object';
    properties: Record<
      string,
      { type: string; description?: string; enum?: string[] }
    >;
    required?: string[];
  };
  /** Roles permitted to invoke this intent. */
  allowedRoles: string[];
  /**
   * Calls existing app services. MUST scope every query by
   * `caller.tenantId` (or explicitly opt-out for super-admin tools).
   */
  handler: (
    caller: ChatbotCaller,
    entities: Record<string, unknown>,
    deps: IntentHandlerDeps,
  ) => Promise<IntentResponse>;
}
