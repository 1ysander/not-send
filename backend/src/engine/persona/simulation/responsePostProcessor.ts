/**
 * responsePostProcessor — apply style guardrails after LLM response.
 * Catches obvious drift (capitalization, length, abbreviations).
 * These are heuristic guardrails, not hard rules.
 */

import type { PersonaJSON } from "../models/PersonaTypes.js";

export interface ProcessedResponse {
  messages: string[];     // split on [SPLIT] for double texting
  rawResponse: string;
  driftDetected: boolean;
  driftReasons: string[];
}

function splitMessages(raw: string): string[] {
  return raw.split("[SPLIT]").map((s) => s.trim()).filter(Boolean);
}

function applyCapitalizationRule(text: string, persona: PersonaJSON): string {
  const cap = persona.surfaceStyle.capitalization;
  if (cap !== "none") return text;

  // If persona never capitalizes, lowercase first char of each sentence
  return text
    .split(". ")
    .map((sentence) => {
      const trimmed = sentence.trim();
      if (!trimmed) return trimmed;
      return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
    })
    .join(". ");
}

export function postProcess(rawResponse: string, persona: PersonaJSON): ProcessedResponse {
  const driftReasons: string[] = [];
  let driftDetected = false;

  const messages = splitMessages(rawResponse);
  const processed: string[] = [];

  for (const msg of messages) {
    let text = msg;

    // Length drift check
    const wordCount = text.trim().split(/\s+/).length;
    const avgWords = persona.surfaceStyle.avgMessageLength === "short" ? 5
      : persona.surfaceStyle.avgMessageLength === "medium" ? 12 : 25;

    if (wordCount > avgWords * 4) {
      driftDetected = true;
      driftReasons.push(`Response too long: ${wordCount} words vs avg ~${avgWords}`);
      // Truncate to first 3 sentences as a graceful recovery
      const sentences = text.split(/[.!?]+/).filter(Boolean).slice(0, 3);
      text = sentences.join(". ").trim();
      if (text && !text.match(/[.!?]$/)) text += ".";
    }

    // Capitalization drift check
    const cap = persona.surfaceStyle.capitalization;
    if (cap === "none" && /^[A-Z][a-z]/.test(text)) {
      driftDetected = true;
      driftReasons.push("Capitalization drift: persona uses none, response started with capital");
      text = applyCapitalizationRule(text, persona);
    }

    processed.push(text);
  }

  return {
    messages: processed,
    rawResponse,
    driftDetected,
    driftReasons,
  };
}
