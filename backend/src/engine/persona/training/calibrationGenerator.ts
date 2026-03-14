/**
 * calibrationGenerator — generate A/B style calibration pairs post-extraction.
 * Lets users override extracted patterns where the LLM guessed wrong.
 * One LLM call, returns 12 pairs testing different style dimensions.
 */

import { chat } from "../../../ai/model.js";
import type { PersonaJSON, CalibrationPair } from "../models/PersonaTypes.js";

const DIMENSIONS = [
  "abbreviation_usage",
  "abbreviation_usage",
  "capitalization",
  "punctuation",
  "emoji_usage",
  "emoji_usage",
  "message_length",
  "emotional_tone",
  "emotional_tone",
  "conflict_response",
  "humor_style",
  "humor_style",
];

export async function generateCalibrationPairs(
  persona: PersonaJSON
): Promise<CalibrationPair[]> {
  const name = persona.meta.name;

  const systemPrompt = `You are a calibration assistant. Generate exactly 12 A/B style test pairs to help users verify an AI persona profile is accurate. Return ONLY a valid JSON array, no markdown.`;

  const userMessage = `Based on this persona profile for ${name}:

Style: ${JSON.stringify(persona.surfaceStyle)}
Vocabulary: ${JSON.stringify(persona.vocabulary)}
Emoji: ${JSON.stringify(persona.emojiProfile)}
Emotional: ${JSON.stringify(persona.emotionalPatterns)}
Conflict: ${JSON.stringify(persona.conflictBehavior)}
Voice: ${JSON.stringify(persona.verbalIdentity)}

Generate 12 calibration pairs. Each pair shows two possible messages from ${name} in response to a given context. One matches the extracted profile; one differs on ONE dimension.

Test these dimensions in order: ${DIMENSIONS.join(", ")}

Return a JSON array of 12 objects, each with:
{
  "dimensionTested": "which dimension this tests",
  "context": "brief situation description (e.g. 'Someone asks if they're coming to the party')",
  "optionA": "first possible message from ${name}",
  "optionB": "second possible message from ${name}",
  "extractedPrediction": "a" or "b" (which option matches the extracted profile)
}`;

  const { text } = await chat({
    systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 2000,
  });

  try {
    const cleaned = text.replace(/```json?/gi, "").replace(/```/g, "").trim();
    const pairs = JSON.parse(cleaned) as CalibrationPair[];
    return pairs.slice(0, 12);
  } catch {
    console.error("[calibrationGenerator] Failed to parse calibration pairs:", text.slice(0, 200));
    return [];
  }
}
