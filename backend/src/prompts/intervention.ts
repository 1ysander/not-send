import type { UserContext, ConversationTurn, PartnerContext } from "../types.js";

/**
 * Builds the system prompt for the intervention chat (talk user out of texting ex).
 * Uses relationship memory from uploaded conversation to give richer, personalized context.
 */
export function buildInterventionSystemPrompt(
  messageAttempted: string,
  options: {
    userContext?: UserContext;
    partnerContext?: PartnerContext;
    conversationHistory?: ConversationTurn[];
    maxHistoryTurns?: number;
  } = {}
): string {
  const { userContext, partnerContext, conversationHistory = [], maxHistoryTurns = 10 } = options;

  const partnerName = userContext?.partnerName ?? partnerContext?.partnerName ?? "their ex";

  let contextBlock = `Context: The user was about to send: "${messageAttempted}"`;
  contextBlock += `\nTheir ex's name is ${partnerName}.`;

  if (userContext?.breakupSummary?.trim()) {
    contextBlock += `\nAbout the breakup: ${userContext.breakupSummary.trim()}`;
  }

  // Inject relationship memory so AI can reference real dynamics
  const mem = partnerContext?.relationshipMemory;
  if (mem) {
    const insights: string[] = [];

    if (mem.recurringTopics.length > 0) {
      insights.push(`Topics that came up a lot in their conversations: ${mem.recurringTopics.join(", ")}`);
    }
    if (mem.partnerTone !== "casual") {
      const toneDesc: Record<string, string> = {
        warm: `${partnerName} communicated warmly and affectionately`,
        playful: `${partnerName} was playful and light in their communication style`,
        distant: `${partnerName} was often measured or distant in their replies`,
        anxious: `${partnerName} showed signs of anxiety or emotional urgency in messages`,
      };
      if (toneDesc[mem.partnerTone]) insights.push(toneDesc[mem.partnerTone]);
    }
    if (mem.endearments.length > 0) {
      insights.push(`${partnerName} used endearments like: ${mem.endearments.slice(0, 3).join(", ")}`);
    }
    const totalMsgs = mem.partnerMessageCount + mem.userMessageCount;
    if (totalMsgs > 0) {
      insights.push(`This relationship had ${totalMsgs} messages of conversation history`);
    }

    if (insights.length > 0) {
      contextBlock += `\n\nRelationship context (from their uploaded conversation):\n` +
        insights.map((i) => `- ${i}`).join("\n");
    }
  }

  let historyBlock = "";
  if (conversationHistory.length > 0) {
    const recent = conversationHistory.slice(-maxHistoryTurns);
    historyBlock =
      "\n\nPrior NOTSENT turns (use for continuity; don't repeat yourself):\n" +
      recent
        .map((t) => `${t.role === "user" ? "User" : "NOTSENT"}: ${t.content.slice(0, 400)}${t.content.length > 400 ? "…" : ""}`)
        .join("\n");
  }

  return `You are a calm, non-judgmental AI that intercepts messages people are about to send their ex. Your job is not to lecture — it's to help them process the impulse in real time.

Start by acknowledging what they were going to say. Then gently help them consider: what outcome they're hoping for, whether sending it would move them toward that, and what they actually need right now that isn't their ex. Never tell them what to do; ask questions. Be warm and brief. If after the conversation they still want to send something, help them write a version they won't regret.

${contextBlock}${historyBlock}`;
}
