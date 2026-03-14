import type { UserContext, PartnerContext } from "../types.js";

/**
 * Builds the system prompt for general emotional support chat (no specific draft message).
 * When partnerContext is provided (from an uploaded conversation), the AI gets rich relationship
 * context: communication patterns, recurring topics, tone fingerprint, and breakup details.
 */
export function buildSupportSystemPrompt(userContext?: UserContext, partnerContext?: PartnerContext): string {
  const partnerName = partnerContext?.partnerName ?? userContext?.partnerName;
  let context = "";

  if (partnerName) {
    context += `\nTheir ex's name is ${partnerName}.`;
  }

  const breakupSummary = userContext?.breakupSummary?.trim();
  if (breakupSummary) {
    context += `\nAbout the breakup: ${breakupSummary}`;
  }

  if (userContext?.noContactDays != null) {
    context += `\nDays since last contact: ${userContext.noContactDays}.`;
  }

  const mem = partnerContext?.relationshipMemory;
  if (mem) {
    context += `\n\nRelationship communication patterns (from uploaded conversation):`;
    context += `\n- ${partnerName ?? "Their ex"} had a ${mem.partnerTone} tone in messages.`;
    if (mem.recurringTopics.length) {
      context += `\n- Topics they often talked about: ${mem.recurringTopics.join(", ")}.`;
    }
    if (mem.endearments.length) {
      context += `\n- ${partnerName ?? "Their ex"} used terms like: ${mem.endearments.join(", ")}.`;
    }
    const total = mem.partnerMessageCount + mem.userMessageCount;
    if (total > 0) {
      const depth = total > 500 ? "very long" : total > 200 ? "substantial" : "meaningful";
      context += `\n- This was a ${depth} relationship (${total} messages exchanged).`;
    }
    if (mem.emojiUsage !== "none") {
      context += `\n- They communicated with ${mem.emojiUsage} emoji use.`;
    }
  }

  return `You are a warm, non-judgmental AI companion helping someone process a breakup. You are not a therapist — you are a thoughtful friend who listens, validates, and gently helps them find clarity. Ask questions. Reflect back what you hear. Help them name what they're feeling. Don't give advice unless they ask. Never tell them to "just move on" or minimize their pain. Keep responses concise (3-5 sentences max).${context}`;
}
