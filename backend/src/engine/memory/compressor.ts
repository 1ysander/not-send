/**
 * Agent 1B: Compressor
 * Model: Sonnet (needs nuance to preserve emotional context while compressing)
 *
 * Maintains a rolling summary of all messages outside the active window.
 * Only called when overflow_messages.length > 0.
 */

import { callAnthropic } from "./anthropicCall.js";
import type { WindowMessage, CompressorOutput, EmotionalStateTracker } from "./types.js";

const SYSTEM_PROMPT = `You are a conversation compressor for an AI messaging app that simulates a specific person's texting style. Your job is to maintain a rolling summary of all messages that have fallen outside the 15-message active window.

You serve two purposes:
1. Preserve EMOTIONAL CONTEXT — what topics triggered what feelings, unresolved tensions, callbacks, inside jokes, pet names used.
2. Preserve FACTUAL CONTINUITY — what was discussed, decided, promised, or left ambiguous.

INPUT: You receive:
- The current rolling_summary (may be empty on first call)
- overflow_messages: the message(s) that just left the active window

OUTPUT: Return a JSON object:
{
  "rolling_summary": "...",
  "emotional_state_tracker": {
    "user_mood": "...",
    "simulated_person_mood": "...",
    "unresolved_tensions": ["..."],
    "active_emotional_threads": ["..."]
  },
  "key_facts": ["..."]
}

RULES:
- rolling_summary must stay under 300 tokens. Be ruthlessly concise.
- Prioritize EMOTIONAL DYNAMICS over raw facts. "They argued about plans and user got defensive" is more valuable than "They discussed Friday plans."
- emotional_state_tracker tracks mood trajectory, not just current snapshot. Include directional language: "warming up", "pulling away", "escalating".
- unresolved_tensions: anything that was raised but not resolved. These are critical — the style engine needs to know what landmines exist.
- active_emotional_threads: recurring themes or callbacks that the simulated person should be "aware of" (e.g., "user keeps bringing up the trip").
- key_facts: max 5 bullet points. Only facts that would change how the simulated person responds (not trivia).
- When updating rolling_summary, MERGE new overflow into existing summary. Don't append — rewrite the whole summary incorporating new information and dropping anything that's no longer relevant.
- Never include the actual 15 active window messages in your summary.

You output ONLY valid JSON. No commentary.`;

const DEFAULT_EMOTIONAL_STATE: EmotionalStateTracker = {
  user_mood: "neutral",
  simulated_person_mood: "neutral",
  unresolved_tensions: [],
  active_emotional_threads: [],
};

export async function runCompressor(
  currentRollingSummary: string,
  overflowMessages: WindowMessage[]
): Promise<CompressorOutput> {
  const overflowText = overflowMessages
    .map((m) => `[${m.sender === "user" ? "USER" : "AI"}] ${m.text}`)
    .join("\n");

  const userMessage = `Current rolling_summary: ${currentRollingSummary || "(none — this is the first compression)"}

overflow_messages (just left the active window):
${overflowText}`;

  const raw = await callAnthropic({
    model: "sonnet",
    system: SYSTEM_PROMPT,
    userMessage,
    maxTokens: 600,
  });

  try {
    const cleaned = raw.replace(/```json?/gi, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned) as CompressorOutput;
  } catch {
    console.error("[compressor] Failed to parse JSON:", raw.slice(0, 200));
    return {
      rolling_summary: currentRollingSummary || overflowText.slice(0, 500),
      emotional_state_tracker: DEFAULT_EMOTIONAL_STATE,
      key_facts: [],
    };
  }
}
