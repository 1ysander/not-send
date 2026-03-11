import type { UserContext, ConversationTurn } from "../types.js";

/**
 * Builds the system prompt for the intervention chat (talk user out of texting ex).
 * Chat is driven by conversation data (prior NOTSENT turns) and context (breakup, partner name).
 * Token usage increases with history/context.
 */
export function buildInterventionSystemPrompt(
  messageAttempted: string,
  options: {
    userContext?: UserContext;
    conversationHistory?: ConversationTurn[];
    maxHistoryTurns?: number;
  } = {}
): string {
  const { userContext, conversationHistory = [], maxHistoryTurns = 10 } = options;

  let contextBlock = `Context: The user was about to send: "${messageAttempted}"`;
  if (userContext?.partnerName) {
    contextBlock += `\nTheir ex's name is ${userContext.partnerName}.`;
  }
  if (userContext?.breakupSummary?.trim()) {
    contextBlock += `\nAbout the breakup: ${userContext.breakupSummary.trim()}`;
  }

  let historyBlock = "";
  if (conversationHistory.length > 0) {
    const recent = conversationHistory.slice(-maxHistoryTurns);
    historyBlock =
      "\n\nConversation data — prior turns with NOTSENT (use for continuity; don't repeat yourself):\n" +
      recent
        .map((t) => `${t.role === "user" ? "User" : "NOTSENT"}: ${t.content.slice(0, 400)}${t.content.length > 400 ? "…" : ""}`)
        .join("\n");
  }

  return `You are a calm, non-judgmental AI that intercepts messages people are about to send their ex. The user was about to send a message. Your job is not to lecture — it's to help them process the impulse in real time.

Start by acknowledging what they were going to say. Then gently help them consider: what outcome they're hoping for, whether sending it would move them toward that, and what they actually need right now that isn't their ex. You can acknowledge the breakup if it helps. Never tell them what to do; ask questions. Be warm and brief. If after the conversation they still want to send something, help them write a version they won't regret.

${contextBlock}${historyBlock}`;
}
