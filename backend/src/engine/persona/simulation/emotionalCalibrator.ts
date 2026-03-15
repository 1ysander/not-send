/**
 * emotionalCalibrator — Sub-Agent 2B.
 * Model: Haiku (fast QA pass). Scores and flags the enforcer's output.
 * If adjustment_needed, the StyleEngine retries Sub-Agent 2A with correction instructions.
 * Max 1 retry. If second attempt still flags, ship anyway.
 */

import { chat } from "../../../ai/model.js";
import type { StyleFingerprint, EmotionalState, StyleEnforcerMessage, CalibratorOutput } from "../models/StyleEngineTypes.js";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You are a quality assurance layer for a texting style simulator.
You receive a candidate response and evaluate whether it is emotionally calibrated
to the conversation context. You do NOT rewrite — you score and flag.
You output ONLY valid JSON. No commentary.`;

const CRITICAL_FLAGS: Set<string> = new Set(["ai_leakage", "mood_whiplash", "too_articulate"]);

function buildCalibratorPrompt(options: {
  candidateMessages: StyleEnforcerMessage[];
  emotionalState: EmotionalState;
  fingerprint: StyleFingerprint;
  activeWindow: Array<{ role: "user" | "assistant"; content: string }>;
}): string {
  const { candidateMessages, emotionalState, fingerprint, activeWindow } = options;

  const recentText = activeWindow
    .slice(-6)
    .map((m) => `${m.role === "user" ? "User" : "Them"}: ${m.content}`)
    .join("\n");

  const candidateText = candidateMessages
    .map((m) => `"${m.text}" (delay: ${m.delay_seconds}s)`)
    .join("\n");

  return `## CANDIDATE RESPONSE
${candidateText}

## EMOTIONAL STATE
Their mood: ${emotionalState.simulatedPersonMood}
User's mood: ${emotionalState.userMood}
Unresolved tensions: ${emotionalState.unresolvedTensions.join(", ") || "none"}
Active threads: ${emotionalState.activeEmotionalThreads.join(", ") || "none"}

## RECENT MESSAGES
${recentText}

## STYLE FINGERPRINT
casing: ${fingerprint.casing}
avg length: ~${fingerprint.avg_message_length_words} words
emoji: ${fingerprint.emoji_usage} (top: ${fingerprint.top_emojis.join(" ") || "none"})
confrontation: ${fingerprint.confrontation_style}
affection: ${fingerprint.affection_style}
grammar quirks: ${fingerprint.grammar_quirks.join(", ") || "none"}

## SCORE THIS RESPONSE

Return ONLY this JSON:
{
  "emotional_accuracy": 0.0-1.0,
  "style_accuracy": 0.0-1.0,
  "flags": [],
  "adjustment_needed": true | false,
  "adjustment_instructions": "..." | null
}

## SCORING GUIDE
emotional_accuracy:
- 1.0 = perfectly matches expected emotional trajectory
- Below 0.7 = needs adjustment

style_accuracy:
- 1.0 = indistinguishable from the real person
- Below 0.7 = needs adjustment

flags — add any that apply:
- "too_articulate": more polished than the real person would be
- "mood_whiplash": tone shifted too abruptly from conversation context
- "ai_leakage": sounds like an AI assistant (helpful, structured, advisory tone)
- "length_mismatch": significantly longer or shorter than fingerprint average
- "emoji_mismatch": emoji usage doesn't match fingerprint
- "too_agreeable": person would push back here but response is accommodating
- "missing_callback": unresolved thread that should be referenced wasn't
- "wrong_energy": hard to articulate but something feels off

adjustment_needed: true if EITHER score < 0.7 OR any critical flag (ai_leakage, mood_whiplash, too_articulate) present
adjustment_instructions: ONE specific, actionable correction if adjustment_needed. Max 20 words. Example: "Shorten to 6 words, remove the question, sound more annoyed". Null if no adjustment needed.`;
}

export async function runEmotionalCalibrator(options: {
  candidateMessages: StyleEnforcerMessage[];
  emotionalState: EmotionalState;
  fingerprint: StyleFingerprint;
  activeWindow: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<CalibratorOutput> {
  const prompt = buildCalibratorPrompt(options);

  try {
    const { text } = await chat({
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      maxTokens: 250,
      model: HAIKU_MODEL,
    });

    const cleaned = text.replace(/```json?/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as CalibratorOutput;

    // Validate structure
    if (typeof parsed.emotional_accuracy !== "number") parsed.emotional_accuracy = 0.7;
    if (typeof parsed.style_accuracy !== "number") parsed.style_accuracy = 0.7;
    if (!Array.isArray(parsed.flags)) parsed.flags = [];

    // Enforce adjustment_needed logic based on scores + critical flags
    const hasCriticalFlag = parsed.flags.some((f) => CRITICAL_FLAGS.has(f));
    parsed.adjustment_needed =
      parsed.emotional_accuracy < 0.7 || parsed.style_accuracy < 0.7 || hasCriticalFlag;

    if (!parsed.adjustment_needed) parsed.adjustment_instructions = null;

    return parsed;
  } catch {
    // If calibrator fails, don't block — return a passing score
    return {
      emotional_accuracy: 0.75,
      style_accuracy: 0.75,
      flags: [],
      adjustment_needed: false,
      adjustment_instructions: null,
    };
  }
}
