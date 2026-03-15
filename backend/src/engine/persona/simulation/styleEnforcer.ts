/**
 * styleEnforcer — Sub-Agent 2A.
 * Model: Sonnet (primary generation). Returns structured JSON with delay_seconds + confidence.
 * Responsible for generating a response that is indistinguishable from the real person.
 */

import { chat } from "../../../ai/model.js";
import type { PersonaJSON } from "../models/PersonaTypes.js";
import type { StyleFingerprint, EmotionalState, StyleEnforcerOutput } from "../models/StyleEngineTypes.js";

const SONNET_MODEL = "claude-sonnet-4-6";

const BASE_SYSTEM_PROMPT = `You are simulating a specific person in a text message conversation.
Your goal is to be INDISTINGUISHABLE from this person's real texting style.
You are not an AI assistant. You do not help. You do not advise. You respond
exactly as this person would — including being dismissive, emotional, avoidant,
or confusing if that matches their style.

You output ONLY valid JSON. No commentary.`;

function buildExamplesBlock(persona: PersonaJSON): string {
  const sr = persona.sampleResponses;
  const examples = [
    sr.toCasualGreeting,
    sr.toEmotionalMessage,
    sr.toConflict,
    sr.toDirectQuestion,
    sr.toBoringMessage,
  ].filter(Boolean).slice(0, 5);

  if (examples.length === 0) return "";
  return `## REAL MESSAGE EXAMPLES FROM THIS PERSON\n${examples.map((e, i) => `${i + 1}. "${e}"`).join("\n")}`;
}

function buildFingerprintBlock(fp: StyleFingerprint, name: string): string {
  const lines: string[] = [
    `## STYLE FINGERPRINT — ${name}`,
    `casing: ${fp.casing}`,
    `avg message length: ~${fp.avg_message_length_words} words`,
    `punctuation: ${fp.punctuation_frequency}${fp.common_punctuation.length ? " — common: " + fp.common_punctuation.join(", ") : ""}`,
    `emoji: ${fp.emoji_usage}${fp.top_emojis.length ? " — top: " + fp.top_emojis.join(" ") : ""}`,
    `filler words: ${fp.filler_words.length ? fp.filler_words.join(", ") : "none"}`,
    `slang: ${fp.slang_vocabulary.length ? fp.slang_vocabulary.join(", ") : "none"}`,
    `double texting: ${fp.double_text_frequency}`,
    `confrontation style: ${fp.confrontation_style}`,
    `affection style: ${fp.affection_style}`,
    `humor: ${fp.humor_markers.join(", ")}`,
    `opening patterns: ${fp.opening_patterns.length ? fp.opening_patterns.join(", ") : "none"}`,
    `closing patterns: ${fp.closing_patterns.length ? fp.closing_patterns.join(", ") : "none"}`,
    `signature phrases: ${fp.unique_phrases.length ? fp.unique_phrases.join(", ") : "none"}`,
    `grammar quirks: ${fp.grammar_quirks.length ? fp.grammar_quirks.join(", ") : "none"}`,
  ];
  return lines.join("\n");
}

function buildEmotionalStateBlock(state: EmotionalState): string {
  const lines: string[] = [
    "## EMOTIONAL STATE",
    `Their mood: ${state.simulatedPersonMood}`,
    `User's mood: ${state.userMood}`,
    `Unresolved tensions: ${state.unresolvedTensions.length ? state.unresolvedTensions.join(", ") : "none"}`,
    `Active threads: ${state.activeEmotionalThreads.length ? state.activeEmotionalThreads.join(", ") : "none"}`,
  ];
  return lines.join("\n");
}

function buildActiveWindowBlock(
  messages: Array<{ role: "user" | "assistant"; content: string }>
): string {
  const formatted = messages
    .map((m) => `${m.role === "user" ? "User" : "Them"}: ${m.content}`)
    .join("\n");
  return `## RECENT MESSAGES (last ${messages.length})\n${formatted}`;
}

function buildGenerationRules(name: string, fp: StyleFingerprint): string {
  return `## GENERATION RULES

1. MATCH THE FINGERPRINT EXACTLY.
   - Casing is ${fp.casing}. Mirror it exactly.
   - Average length is ~${fp.avg_message_length_words} words. Don't exceed 3× this unless the persona has extreme_variation.
   - Emoji usage is ${fp.emoji_usage}. Match it — don't add more, don't remove their signatures.
   - Double texting is ${fp.double_text_frequency}. If sending multiple messages, add them as separate entries in the messages array.

2. EMOTIONAL CONTINUITY.
   - Follow the emotional state. Don't suddenly shift tone unless provoked.
   - If there are unresolved tensions, don't pretend they don't exist unless deflection is this person's pattern.

3. NEVER BREAK CHARACTER.
   - Never say "as an AI" or anything meta.
   - Never be more articulate or emotionally mature than ${name} actually is.
   - If ${name} would leave someone on read, output: { "no_reply": { "action": "no_reply", "wait_minutes": N } }

4. OUTPUT FORMAT — return ONLY this JSON:
{
  "messages": [
    { "text": "...", "delay_seconds": N },
    { "text": "...", "delay_seconds": N }
  ],
  "internal_emotional_state": "one sentence on how ${name} is feeling right now",
  "confidence": 0.0-1.0
}
- delay_seconds: realistic pacing between messages (0-300)
- confidence: how sure you are this matches their real style (below 0.6 = your output needs calibration)
- For a no-reply: { "messages": [], "no_reply": { "action": "no_reply", "wait_minutes": N }, "internal_emotional_state": "...", "confidence": 0.0-1.0 }`;
}

export async function runStyleEnforcer(options: {
  name: string;
  fingerprint: StyleFingerprint;
  personaJson: PersonaJSON;
  emotionalState: EmotionalState;
  rollingSummary: string;
  activeWindow: Array<{ role: "user" | "assistant"; content: string }>;
  adjustmentInstructions?: string;
}): Promise<StyleEnforcerOutput> {
  const {
    name,
    fingerprint,
    personaJson,
    emotionalState,
    rollingSummary,
    activeWindow,
    adjustmentInstructions,
  } = options;

  const sections: string[] = [
    buildFingerprintBlock(fingerprint, name),
    buildExamplesBlock(personaJson),
  ];

  if (rollingSummary) {
    sections.push(`## EARLIER CONVERSATION SUMMARY\n${rollingSummary}`);
  }

  sections.push(buildEmotionalStateBlock(emotionalState));
  sections.push(buildActiveWindowBlock(activeWindow));
  sections.push(buildGenerationRules(name, fingerprint));

  if (adjustmentInstructions) {
    sections.push(`## ADJUSTMENT REQUIRED\nYour previous attempt was flagged. Apply this correction exactly:\n${adjustmentInstructions}`);
  }

  const userMessage = sections.join("\n\n");

  const { text } = await chat({
    systemPrompt: BASE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 400,
    model: SONNET_MODEL,
  });

  try {
    const cleaned = text.replace(/```json?/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as StyleEnforcerOutput;

    // Ensure messages array exists
    if (!parsed.messages) parsed.messages = [];
    if (typeof parsed.confidence !== "number") parsed.confidence = 0.5;

    return parsed;
  } catch {
    // Fallback: wrap raw text as a single message
    return {
      messages: [{ text: text.trim().slice(0, 200), delay_seconds: 0 }],
      internal_emotional_state: "unknown",
      confidence: 0.3,
    };
  }
}
