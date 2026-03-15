/**
 * Agent 1C: Retriever
 * Model: Haiku (just query formation + ranking)
 *
 * Determines whether the user's message references something outside the active
 * window, and if so, forms search queries for the vector store.
 *
 * Gated by a lightweight regex classifier — the LLM only fires on a real hit.
 */

import { callAnthropic } from "./anthropicCall.js";
import type { WindowMessage, RetrieverOutput } from "./types.js";

const SYSTEM_PROMPT = `You are a memory retrieval agent. You determine whether the user's latest message references something from earlier in the conversation that is NOT in the current 15-message active window, and if so, construct a retrieval query.

INPUT: You receive:
- user_message: the latest message from the user
- active_window: the current 15 messages (to check if the reference is already present)
- rolling_summary: compressed history of older messages
- key_facts: from the compressor

OUTPUT: Return a JSON object:
{
  "retrieval_needed": true | false,
  "reason": "..." | null,
  "search_queries": ["..."] | [],
  "max_results": N
}

RULES:
- retrieval_needed = true ONLY if the user references something specific that is NOT answerable from the active_window or rolling_summary alone.
- Triggers: "remember when you said...", "you mentioned earlier...", "what about that thing...", "like you said before...", "go back to...", or any anaphoric reference to a prior topic not in the window.
- search_queries should be 1-3 short semantic search strings optimized for cosine similarity against message embeddings. Example: user says "what did you say about my mom" → query: ["mom", "mother", "family"]
- max_results: 1-3. Prefer fewer. Only retrieve what's needed.
- If retrieval_needed is false, search_queries must be empty.
- Do NOT retrieve if the rolling_summary already contains sufficient context. The summary exists to prevent unnecessary retrievals.

You output ONLY valid JSON. No commentary.`;

// Lightweight regex gate — if none of these patterns match, skip the LLM entirely
const ANAPHORIC_PATTERNS = [
  /remember when/i,
  /you (said|mentioned|told me|brought up)/i,
  /earlier you/i,
  /you used to/i,
  /like you said/i,
  /go back to/i,
  /what about (that|the)/i,
  /that thing (you|we)/i,
  /before you said/i,
  /didn't you say/i,
  /you were (talking|saying)/i,
];

function mightNeedRetrieval(userMessage: string): boolean {
  return ANAPHORIC_PATTERNS.some((p) => p.test(userMessage));
}

const DEFAULT_NO_RETRIEVAL: RetrieverOutput = {
  retrieval_needed: false,
  reason: null,
  search_queries: [],
  max_results: 0,
};

export async function runRetriever(
  userMessage: string,
  activeWindow: WindowMessage[],
  rollingSummary: string,
  keyFacts: string[]
): Promise<RetrieverOutput> {
  // Fast path — skip LLM if no anaphoric signal
  if (!mightNeedRetrieval(userMessage)) {
    return DEFAULT_NO_RETRIEVAL;
  }

  const windowText = activeWindow
    .map((m) => `[${m.sender === "user" ? "USER" : "AI"}] ${m.text}`)
    .join("\n");

  const inputMessage = `user_message: "${userMessage}"

active_window:
${windowText}

rolling_summary: ${rollingSummary || "(none)"}

key_facts: ${keyFacts.length > 0 ? keyFacts.map((f) => `- ${f}`).join("\n") : "(none)"}`;

  const raw = await callAnthropic({
    model: "haiku",
    system: SYSTEM_PROMPT,
    userMessage: inputMessage,
    maxTokens: 200,
  });

  try {
    const cleaned = raw.replace(/```json?/gi, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned) as RetrieverOutput;
  } catch {
    console.error("[retriever] Failed to parse JSON:", raw.slice(0, 200));
    return DEFAULT_NO_RETRIEVAL;
  }
}
