/**
 * Context Payload Assembler (code, not LLM)
 *
 * After all three sub-agents complete, assembles the final context_payload
 * and runs vector retrieval (pgvector stub — returns empty until Supabase migration).
 */

import type {
  WindowMessage,
  EmotionalStateTracker,
  ContextPayload,
  RetrieverOutput,
} from "./types.js";

// TODO: replace with Supabase pgvector search once migrated
async function vectorSearch(
  _queries: string[],
  _maxResults: number,
  _conversationId: string
): Promise<WindowMessage[]> {
  // Stub — returns empty until Supabase pgvector is wired up.
  // When migrated: embed each query, run cosine similarity against
  // notsent_conversation_messages(embedding) filtered by conversation_id,
  // return top-N unique messages.
  return [];
}

export async function assembleContextPayload(opts: {
  conversationId: string;
  activeWindow: WindowMessage[];
  rollingSummary: string;
  emotionalStateTracker: EmotionalStateTracker;
  keyFacts: string[];
  retrieverOutput: RetrieverOutput;
}): Promise<ContextPayload> {
  const {
    conversationId,
    activeWindow,
    rollingSummary,
    emotionalStateTracker,
    keyFacts,
    retrieverOutput,
  } = opts;

  let retrieved_context: WindowMessage[] = [];
  if (retrieverOutput.retrieval_needed && retrieverOutput.search_queries.length > 0) {
    retrieved_context = await vectorSearch(
      retrieverOutput.search_queries,
      retrieverOutput.max_results,
      conversationId
    );
  }

  return {
    active_window: activeWindow,
    rolling_summary: rollingSummary,
    emotional_state_tracker: emotionalStateTracker,
    key_facts: keyFacts,
    retrieved_context,
  };
}

/**
 * Converts a ContextPayload into a formatted string block to inject
 * into the persona system prompt.
 */
export function formatContextForPrompt(payload: ContextPayload): string {
  const parts: string[] = [];

  if (payload.rolling_summary) {
    parts.push(`[CONVERSATION HISTORY — what happened before the recent messages]
${payload.rolling_summary}`);
  }

  const tracker = payload.emotional_state_tracker;
  if (tracker && (tracker.unresolved_tensions.length > 0 || tracker.active_emotional_threads.length > 0)) {
    const trackerLines: string[] = [];
    if (tracker.user_mood) trackerLines.push(`User mood: ${tracker.user_mood}`);
    if (tracker.simulated_person_mood) trackerLines.push(`Your current mood: ${tracker.simulated_person_mood}`);
    if (tracker.unresolved_tensions.length > 0) {
      trackerLines.push(`Unresolved tensions: ${tracker.unresolved_tensions.join("; ")}`);
    }
    if (tracker.active_emotional_threads.length > 0) {
      trackerLines.push(`Active threads: ${tracker.active_emotional_threads.join("; ")}`);
    }
    parts.push(`[EMOTIONAL CONTEXT]\n${trackerLines.join("\n")}`);
  }

  if (payload.key_facts.length > 0) {
    parts.push(`[KEY FACTS]\n${payload.key_facts.map((f) => `- ${f}`).join("\n")}`);
  }

  if (payload.retrieved_context.length > 0) {
    const retrieved = payload.retrieved_context
      .map((m) => `[${m.sender === "user" ? "User" : "You"}] ${m.text}`)
      .join("\n");
    parts.push(`[RETRIEVED FROM EARLIER IN CONVERSATION]\n${retrieved}`);
  }

  return parts.join("\n\n");
}
