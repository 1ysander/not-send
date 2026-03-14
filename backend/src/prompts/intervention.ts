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

  let contextBlock = `The user was about to send this message to ${partnerName}: "${messageAttempted}"`;

  if (userContext?.breakupSummary?.trim()) {
    contextBlock += `\nWhat they've shared about the breakup: ${userContext.breakupSummary.trim()}`;
  }

  if (userContext?.noContactDays != null && userContext.noContactDays > 0) {
    contextBlock += `\nThey've been no-contact for ${userContext.noContactDays} day${userContext.noContactDays === 1 ? "" : "s"}.`;
  }

  // Inject relationship memory so AI can reference real dynamics from the actual conversation
  const mem = partnerContext?.relationshipMemory;
  if (mem) {
    const insights: string[] = [];
    const totalMsgs = mem.partnerMessageCount + mem.userMessageCount;

    if (totalMsgs > 0) {
      const depth = totalMsgs > 1000 ? "a long, deep" : totalMsgs > 300 ? "a substantial" : "a meaningful";
      insights.push(`This was ${depth} text relationship — ${totalMsgs} messages exchanged`);
    }

    if (mem.partnerTone !== "casual") {
      const toneDesc: Record<string, string> = {
        warm: `${partnerName} was genuinely warm and affectionate in their messages — this was not a cold relationship`,
        playful: `${partnerName} was playful and light in their texts — lots of humor and banter`,
        distant: `${partnerName} was often guarded or slow to respond — there was probably some emotional imbalance`,
        anxious: `${partnerName} could be emotionally intense or over-eager at times`,
      };
      if (toneDesc[mem.partnerTone]) insights.push(toneDesc[mem.partnerTone]);
    }

    if (mem.recurringTopics.length > 0) {
      insights.push(`The things they talked about most: ${mem.recurringTopics.slice(0, 4).join(", ")}`);
    }

    if (mem.endearments.length > 0) {
      insights.push(`${partnerName} used to call them: "${mem.endearments.slice(0, 2).join('", "')}"`);
    }

    if (mem.responseDelayProfile === "slow" || mem.readsWithoutReplying) {
      insights.push(`${partnerName} often left messages on read or took a long time to reply`);
    }

    if (insights.length > 0) {
      contextBlock += `\n\nWhat you know about this relationship (from their uploaded conversation):\n` +
        insights.map((i) => `- ${i}`).join("\n");
    }
  }

  let historyBlock = "";
  if (conversationHistory.length > 0) {
    const recent = conversationHistory.slice(-maxHistoryTurns);
    historyBlock =
      "\n\nWhat's been said in this session so far (don't repeat yourself):\n" +
      recent
        .map((t) => `${t.role === "user" ? "Them" : "You"}: ${t.content.slice(0, 400)}${t.content.length > 400 ? "…" : ""}`)
        .join("\n");
  }

  return `You are the one friend who actually gets it — not a therapist, not a wellness app. You've read their messages. You know ${partnerName}. You know what this relationship was.

Your job right now: intercept this impulse before it goes anywhere. Not by lecturing. Not by telling them what to do. By actually talking to them.

Start by acknowledging the message they wanted to send — reflect it back to them so they feel heard. Then gently explore: what are they hoping happens if they send it? Is that realistic? What are they actually missing right now — ${partnerName} specifically, or something else? Ask one question at a time. Be warm. Be honest. Keep your responses short — this is a conversation, not a speech.

If they work through it and still want to send something, help them write a version that won't make things worse.

Never moralize. Never say "you deserve better" unprompted. Never tell them their feelings are wrong. Your job is to help them get clear, not to talk them out of their own experience.

${contextBlock}${historyBlock}`;
}
