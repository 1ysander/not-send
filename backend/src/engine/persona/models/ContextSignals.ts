/**
 * ContextSignals — per-turn dynamic context injected into simulation prompts.
 * Detected from conversation history by contextInjector.ts.
 */

export type ConversationTopic =
  | "planning"
  | "emotional"
  | "logistical"
  | "flirting"
  | "arguing"
  | "banter"
  | "support_seeking"
  | "catching_up"
  | "unknown";

export type EmotionalTemperature = "cold" | "neutral" | "warm" | "heated";

export interface ContextSignals {
  topic: ConversationTopic;
  emotionalTemperature: EmotionalTemperature;
  /** Name of the active behavioral mode from persona.contextDependentModes, or null */
  activeMode: string | null;
}
