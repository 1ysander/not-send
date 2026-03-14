/**
 * AnthropicSimulator — Tier 1 implementation of PersonaSimulator.
 * Uses the existing multi-provider streamChat() from ai/model.ts.
 * Swap this for SelfHostedSimulator in Tier 2 without touching any route code.
 */

import { streamChat } from "../../../ai/model.js";
import { buildSimulationSystemPrompt } from "./systemPromptBuilder.js";
import { detectContextSignals } from "./contextInjector.js";
import { trimConversationHistory } from "./conversationManager.js";
import { postProcess } from "./responsePostProcessor.js";
import type { PersonaSimulator, StreamCallback } from "./PersonaSimulator.js";
import type { PersonaProfile, SimulatedResponse } from "../models/PersonaTypes.js";
import type { ContextSignals } from "../models/ContextSignals.js";

export class AnthropicSimulator implements PersonaSimulator {
  async generateResponse(
    persona: PersonaProfile,
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
    signals: ContextSignals,
    onChunk: StreamCallback
  ): Promise<SimulatedResponse> {
    const personaJson = persona.personaJson;

    // Build dynamic system prompt with current context signals
    const systemPrompt = buildSimulationSystemPrompt(personaJson, signals);

    // Trim history to token budget
    const trimmedHistory = trimConversationHistory(conversationHistory);

    // Stream the response
    const parts: string[] = [];
    await streamChat(
      {
        systemPrompt,
        messages: trimmedHistory,
        maxTokens: 512, // persona responses are short
      },
      (chunk) => {
        parts.push(chunk);
        onChunk(chunk);
      }
    );

    const rawResponse = parts.join("");

    // Apply style guardrails
    const { messages, driftDetected, driftReasons } = postProcess(rawResponse, personaJson);

    if (driftDetected) {
      console.warn(`[AnthropicSimulator] Style drift for persona "${persona.targetName}":`, driftReasons);
    }

    return { messages, rawResponse };
  }
}

/** Singleton used by routes — swap this for SelfHostedSimulator in Tier 2 */
export const defaultSimulator: PersonaSimulator = new AnthropicSimulator();
