/**
 * AnthropicSimulator — Tier 1 implementation of PersonaSimulator.
 * Now delegates to StyleEngine (2-pass: StyleEnforcer + EmotionalCalibrator).
 * Swap this for SelfHostedSimulator in Tier 2 without touching any route code.
 */

import { styleEngine } from "./StyleEngine.js";
import { detectContextSignals } from "./contextInjector.js";
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
    // Run the two-pass StyleEngine pipeline
    const result = await styleEngine.generate(persona, conversationHistory);

    if (result.messages.length === 0) {
      // No-reply: signal silence to the caller
      const silenceText = "";
      onChunk(silenceText);
      return {
        messages: [],
        rawResponse: "",
        messageDelays: [],
      };
    }

    // Stream message text to caller (first message only for live streaming)
    // Delay simulation happens client-side using messageDelays
    const firstMessage = result.messages[0].text;
    onChunk(firstMessage);

    // For multi-message (double text), emit subsequent messages after first
    for (let i = 1; i < result.messages.length; i++) {
      onChunk(`[SPLIT]${result.messages[i].text}`);
    }

    const allText = result.messages.map((m) => m.text).join("[SPLIT]");

    if (result.retried) {
      console.info(
        `[AnthropicSimulator] Retried generation for "${persona.targetName}" — flags: ${result.calibration.flags.join(", ")}`
      );
    }

    return {
      messages: result.messages.map((m) => m.text),
      rawResponse: allText,
      messageDelays: result.messages.map((m) => m.delay_seconds),
    };
  }
}

/** Singleton used by routes — swap this for SelfHostedSimulator in Tier 2 */
export const defaultSimulator: PersonaSimulator = new AnthropicSimulator();
