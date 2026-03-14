/**
 * PersonaSimulator — the Tier 1/2/3 swap interface.
 *
 * Tier 1: AnthropicSimulator (this file's companion) — API calls.
 * Tier 2: SelfHostedSimulator (not built yet) — fine-tuned base model.
 * Tier 3: LoraSimulator (not built yet) — per-persona LoRA adapters.
 *
 * Routes call this interface only. The underlying model is swappable.
 */

import type { PersonaProfile, SimulatedResponse } from "../models/PersonaTypes.js";
import type { ContextSignals } from "../models/ContextSignals.js";

export type StreamCallback = (chunk: string) => void;

export interface PersonaSimulator {
  /**
   * Generate a response in the target's voice.
   * Streaming: onChunk is called for each text chunk as it arrives.
   */
  generateResponse(
    persona: PersonaProfile,
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
    signals: ContextSignals,
    onChunk: StreamCallback
  ): Promise<SimulatedResponse>;
}
