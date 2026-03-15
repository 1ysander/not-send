/**
 * Memory Engine — orchestrates Agents 1A, 1B, 1C + context assembly.
 *
 * Per-conversation state is held in-memory (dev/MVP).
 * Target: persist to Supabase (notsent_conversation_memory table) once migrated.
 *
 * Usage:
 *   const payload = await memoryEngine.assembleContext(conversationId, incomingMessages, newUserMessage);
 *   // payload.active_window → use as message history for the generation call
 *   // formatContextForPrompt(payload) → inject into system prompt
 */

import { runWindowManager } from "./windowManager.js";
import { runCompressor } from "./compressor.js";
import { runRetriever } from "./retriever.js";
import { assembleContextPayload } from "./contextAssembler.js";
import { getAIConfig } from "../../ai/config.js";
import type { WindowMessage, ConversationMemoryState, ContextPayload, EmotionalStateTracker } from "./types.js";

const DEFAULT_EMOTIONAL_STATE: EmotionalStateTracker = {
  user_mood: "neutral",
  simulated_person_mood: "neutral",
  unresolved_tensions: [],
  active_emotional_threads: [],
};

// In-memory state store, keyed by conversationId
const memoryStore = new Map<string, ConversationMemoryState>();

function getState(conversationId: string): ConversationMemoryState {
  if (!memoryStore.has(conversationId)) {
    memoryStore.set(conversationId, {
      rolling_summary: "",
      emotional_state_tracker: { ...DEFAULT_EMOTIONAL_STATE },
      key_facts: [],
      full_history: [],
    });
  }
  return memoryStore.get(conversationId)!;
}

/**
 * Convert frontend messages ({ role, content }) to WindowMessage format.
 * Timestamps are approximated — we don't have real send times from the client.
 */
function toWindowMessages(
  messages: Array<{ role: string; content: string }>
): WindowMessage[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m, i) => ({
      sender: m.role === "user" ? "user" : "ai" as "user" | "ai",
      text: m.content,
      timestamp: new Date(Date.now() - (messages.length - i) * 60000).toISOString(),
      index: i,
    }));
}

/**
 * Convert WindowMessage[] back to the format expected by streamChat.
 */
export function windowToMessages(
  window: WindowMessage[]
): Array<{ role: "user" | "assistant"; content: string }> {
  return window.map((m) => ({
    role: m.sender === "user" ? "user" : "assistant",
    content: m.text,
  }));
}

/**
 * Main entrypoint. Called before each generation.
 *
 * @param conversationId - stable ID for this conversation (e.g. contactId)
 * @param allMessages    - full message history from the client (role + content)
 * @param newUserMessage - the new message just sent by the user
 */
export async function assembleContext(
  conversationId: string,
  allMessages: Array<{ role: string; content: string }>,
  newUserMessage: string
): Promise<ContextPayload> {
  const config = getAIConfig();
  const state = getState(conversationId);

  // Sync full_history from the canonical client-provided history.
  // The client is the source of truth for message content.
  state.full_history = toWindowMessages(allMessages);

  const newMsg: WindowMessage = {
    sender: "user",
    text: newUserMessage,
    timestamp: new Date().toISOString(),
    index: state.full_history.length,
  };

  // ── Agent 1A: Window Manager (pure code) ──────────────────────────────────
  const windowResult = runWindowManager(state.full_history, newMsg);

  // ── Agent 1B: Compressor (Sonnet — only when overflow exists) ─────────────
  if (windowResult.overflow_messages.length > 0 && config.provider === "anthropic") {
    try {
      const compressed = await runCompressor(
        state.rolling_summary,
        windowResult.overflow_messages
      );
      state.rolling_summary = compressed.rolling_summary;
      state.emotional_state_tracker = compressed.emotional_state_tracker;
      state.key_facts = compressed.key_facts;
    } catch (err) {
      console.error("[memoryEngine] Compressor failed, keeping previous state:", err);
    }
  }

  // ── Agent 1C: Retriever (Haiku — gated by regex, only when Anthropic) ─────
  let retrieverOutput = {
    retrieval_needed: false,
    reason: null as string | null,
    search_queries: [] as string[],
    max_results: 0,
  };

  if (config.provider === "anthropic") {
    try {
      retrieverOutput = await runRetriever(
        newUserMessage,
        windowResult.active_window,
        state.rolling_summary,
        state.key_facts
      );
    } catch (err) {
      console.error("[memoryEngine] Retriever failed, skipping retrieval:", err);
    }
  }

  // ── Context Payload Assembly ───────────────────────────────────────────────
  const payload = await assembleContextPayload({
    conversationId,
    activeWindow: windowResult.active_window,
    rollingSummary: state.rolling_summary,
    emotionalStateTracker: state.emotional_state_tracker,
    keyFacts: state.key_facts,
    retrieverOutput,
  });

  // Persist updated state
  memoryStore.set(conversationId, state);

  return payload;
}

/** Clear memory for a conversation (e.g. when user deletes chat history). */
export function clearConversationMemory(conversationId: string): void {
  memoryStore.delete(conversationId);
}
