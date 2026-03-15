/**
 * rollingSummarizer — LLM-based rolling summary of older conversation messages.
 * Called when history exceeds the active window size (15 messages).
 * Returns { rollingSummary, activeWindow }.
 */

import { chat } from "../../../ai/model.js";

type Message = { role: "user" | "assistant"; content: string };

export const ACTIVE_WINDOW_SIZE = 15;

const SYSTEM_PROMPT = `You are summarizing a text message conversation for context injection.
Produce a 2-4 sentence summary capturing:
- The main topics discussed
- The emotional trajectory (how the conversation has evolved emotionally)
- Any key moments: confessions, arguments, breakthroughs, unanswered questions
- The current emotional state entering the active window

Be specific. "They argued about jealousy and she went cold after he deflected twice" is useful.
"They talked about their relationship" is not.

Return ONLY the summary text. No preamble, no labels.`;

export async function buildRollingSummary(
  allHistory: Message[],
  existingSummary?: string
): Promise<{ rollingSummary: string; activeWindow: Message[] }> {
  if (allHistory.length <= ACTIVE_WINDOW_SIZE) {
    return { rollingSummary: "", activeWindow: allHistory };
  }

  const olderMessages = allHistory.slice(0, allHistory.length - ACTIVE_WINDOW_SIZE);
  const activeWindow = allHistory.slice(-ACTIVE_WINDOW_SIZE);

  // Format older messages for summarization
  const formatted = olderMessages
    .map((m) => `${m.role === "user" ? "User" : "Them"}: ${m.content}`)
    .join("\n");

  const userContent = existingSummary
    ? `Previous summary: ${existingSummary}\n\nNew messages to incorporate:\n${formatted}`
    : `Conversation to summarize:\n${formatted}`;

  try {
    const { text } = await chat({
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
      maxTokens: 200,
    });
    return { rollingSummary: text.trim(), activeWindow };
  } catch {
    // Graceful fallback: keyword-based summary
    const topics = new Set<string>();
    const topicWords = ["love", "miss", "fight", "plans", "trust", "space", "jealous", "future"];
    for (const m of olderMessages) {
      const lower = m.content.toLowerCase();
      for (const w of topicWords) {
        if (lower.includes(w)) topics.add(w);
      }
    }
    const topicList = [...topics].slice(0, 3).join(", ") || "earlier topics";
    return {
      rollingSummary: `Earlier in the conversation, they discussed ${topicList}.`,
      activeWindow,
    };
  }
}
