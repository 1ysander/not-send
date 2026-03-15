/**
 * StyleEngine — orchestrator for the two-pass style generation pipeline.
 *
 * Pass 1: StyleEnforcer (Sonnet) — generate response as the target person
 * Pass 2: EmotionalCalibrator (Haiku) — score and flag the response
 * Retry: if calibrator flags adjustment_needed, run enforcer once more with instructions
 *        Max 1 retry. Ship the second attempt regardless.
 */

import { toStyleFingerprint } from "../extraction/styleFingerprintAdapter.js";
import { detectEmotionalState } from "./emotionalStateTracker.js";
import { buildRollingSummary } from "./rollingSummarizer.js";
import { runStyleEnforcer } from "./styleEnforcer.js";
import { runEmotionalCalibrator } from "./emotionalCalibrator.js";
import type { PersonaProfile } from "../models/PersonaTypes.js";
import type { EmotionalState, StyleEngineResult } from "../models/StyleEngineTypes.js";

type Message = { role: "user" | "assistant"; content: string };

export class StyleEngine {
  /**
   * Generate a response using the two-pass style pipeline.
   *
   * @param persona - Full persona profile (PersonaJSON + metadata)
   * @param conversationHistory - Full conversation history (all turns)
   * @param previousEmotionalState - Emotional state from last turn (for continuity)
   * @param rollingSummaryCache - Cached rolling summary (pass undefined for first turn)
   */
  async generate(
    persona: PersonaProfile,
    conversationHistory: Message[],
    previousEmotionalState?: EmotionalState,
    rollingSummaryCache?: string
  ): Promise<StyleEngineResult> {
    const personaJson = persona.personaJson;
    const name = persona.targetName;

    // Build compact style fingerprint from full PersonaJSON
    const fingerprint = toStyleFingerprint(personaJson);

    // Split history into rolling summary + active window
    const { rollingSummary, activeWindow } = await buildRollingSummary(
      conversationHistory,
      rollingSummaryCache
    );

    // Detect current emotional state
    const emotionalState = detectEmotionalState(
      conversationHistory,
      personaJson,
      previousEmotionalState
    );

    // Enrich rolling summary with simulation brief from unified psych (if available)
    const unifiedBrief = persona.unifiedPsych?.simulation_brief;
    const enrichedSummary = unifiedBrief
      ? `[Psychological profile for ${name}]:\n${unifiedBrief.slice(0, 600)}\n\n${rollingSummary}`
      : rollingSummary;

    // ── Pass 1: Style Enforcer (Sonnet) ──────────────────────────────────────
    const enforcerOutput = await runStyleEnforcer({
      name,
      fingerprint,
      personaJson,
      emotionalState,
      rollingSummary: enrichedSummary,
      activeWindow,
    });

    // Handle no-reply action
    if (enforcerOutput.no_reply || enforcerOutput.messages.length === 0) {
      return {
        messages: [],
        internalEmotionalState: enforcerOutput.internal_emotional_state,
        confidence: enforcerOutput.confidence,
        calibration: {
          emotional_accuracy: 1.0,
          style_accuracy: 1.0,
          flags: [],
          adjustment_needed: false,
          adjustment_instructions: null,
        },
        retried: false,
      };
    }

    // ── Pass 2: Emotional Calibrator (Haiku) ─────────────────────────────────
    const calibration = await runEmotionalCalibrator({
      candidateMessages: enforcerOutput.messages,
      emotionalState,
      fingerprint,
      activeWindow,
    });

    // Log low confidence or flags for observability
    if (enforcerOutput.confidence < 0.6) {
      console.warn(`[StyleEngine] Low confidence (${enforcerOutput.confidence}) for "${name}"`);
    }
    if (calibration.flags.length > 0) {
      console.warn(`[StyleEngine] Calibration flags for "${name}":`, calibration.flags);
    }

    // ── Retry if calibration requires adjustment ──────────────────────────────
    if (calibration.adjustment_needed && calibration.adjustment_instructions) {
      console.info(`[StyleEngine] Retrying enforcer for "${name}" — ${calibration.adjustment_instructions}`);

      const retryOutput = await runStyleEnforcer({
        name,
        fingerprint,
        personaJson,
        emotionalState,
        rollingSummary: enrichedSummary,
        activeWindow,
        adjustmentInstructions: calibration.adjustment_instructions,
      });

      return {
        messages: retryOutput.messages.length > 0 ? retryOutput.messages : enforcerOutput.messages,
        internalEmotionalState: retryOutput.internal_emotional_state,
        confidence: retryOutput.confidence,
        calibration,  // report original calibration (retry reason)
        retried: true,
      };
    }

    return {
      messages: enforcerOutput.messages,
      internalEmotionalState: enforcerOutput.internal_emotional_state,
      confidence: enforcerOutput.confidence,
      calibration,
      retried: false,
    };
  }
}

/** Singleton — one engine per server, swappable in Tier 2. */
export const styleEngine = new StyleEngine();
