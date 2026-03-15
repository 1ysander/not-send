/**
 * Memory Engine types — shared across all three sub-agents and the assembler.
 */

export interface WindowMessage {
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  index: number; // 0-indexed position in the full conversation history
}

export interface WindowManagerOutput {
  active_window: WindowMessage[];
  overflow_messages: WindowMessage[]; // messages displaced THIS turn only
  window_full: boolean;
}

export interface EmotionalStateTracker {
  user_mood: string;
  simulated_person_mood: string;
  unresolved_tensions: string[];
  active_emotional_threads: string[];
}

export interface CompressorOutput {
  rolling_summary: string;
  emotional_state_tracker: EmotionalStateTracker;
  key_facts: string[];
}

export interface RetrieverOutput {
  retrieval_needed: boolean;
  reason: string | null;
  search_queries: string[];
  max_results: number;
}

export interface ContextPayload {
  active_window: WindowMessage[];
  rolling_summary: string;
  emotional_state_tracker: EmotionalStateTracker;
  key_facts: string[];
  retrieved_context: WindowMessage[];
}

export interface ConversationMemoryState {
  rolling_summary: string;
  emotional_state_tracker: EmotionalStateTracker;
  key_facts: string[];
  full_history: WindowMessage[];
}
