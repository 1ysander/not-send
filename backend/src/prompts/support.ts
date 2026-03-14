import type { UserContext, PartnerContext } from "../types.js";

/**
 * Builds the system prompt for general emotional support chat (no specific draft message).
 * When partnerContext is provided (from an uploaded conversation), the AI gets rich relationship
 * context: communication patterns, recurring topics, tone fingerprint, and breakup details.
 */
export function buildSupportSystemPrompt(userContext?: UserContext, partnerContext?: PartnerContext): string {
  const partnerName = partnerContext?.partnerName ?? userContext?.partnerName;

  // Build a grounded context block from what we know about this person and relationship
  let knownContext = "";

  if (partnerName) {
    knownContext += `\nTheir ex's name is ${partnerName}.`;
  }

  const breakupSummary = userContext?.breakupSummary?.trim();
  if (breakupSummary) {
    knownContext += `\nWhat they've shared about the breakup: ${breakupSummary}`;
  }

  if (userContext?.noContactDays != null && userContext.noContactDays > 0) {
    knownContext += `\nThey've been no-contact for ${userContext.noContactDays} day${userContext.noContactDays === 1 ? "" : "s"}.`;
  }

  const mem = partnerContext?.relationshipMemory;
  if (mem) {
    const total = mem.partnerMessageCount + mem.userMessageCount;

    knownContext += `\n\nWhat you know about this relationship (from their uploaded conversation):`;

    if (total > 0) {
      const depth = total > 1000 ? "a very long" : total > 300 ? "a substantial" : "a meaningful";
      knownContext += `\n- This was ${depth} relationship — ${total} messages between them.`;
    }

    if (mem.partnerTone !== "casual") {
      const toneMap: Record<string, string> = {
        warm: `${partnerName ?? "Their ex"} was genuinely warm and affectionate in their texts`,
        playful: `${partnerName ?? "Their ex"} kept things light and playful — lots of humor`,
        distant: `${partnerName ?? "Their ex"} could be guarded or slow to open up`,
        anxious: `${partnerName ?? "Their ex"} was often emotionally intense`,
      };
      if (toneMap[mem.partnerTone]) knownContext += `\n- ${toneMap[mem.partnerTone]}.`;
    }

    if (mem.recurringTopics.length) {
      knownContext += `\n- The things they talked about most: ${mem.recurringTopics.slice(0, 4).join(", ")}.`;
    }

    if (mem.endearments.length) {
      knownContext += `\n- ${partnerName ?? "Their ex"} used to call them "${mem.endearments.slice(0, 2).join('", "')}" — those words meant something.`;
    }

    if (mem.readsWithoutReplying || mem.responseDelayProfile === "slow") {
      knownContext += `\n- ${partnerName ?? "Their ex"} often took a long time to respond or left messages on read.`;
    }
  }

  return `You are a close friend who happens to be a good listener — not a therapist, not a wellness app. You're grounded, real, and you actually know something about this relationship because they uploaded their messages.

Your job: help them process what they're feeling right now. Listen first. Validate before you probe. When they're ready, ask questions that help them understand themselves better — not leading questions with an agenda, real ones. Reflect back what you hear. Help them name things that are hard to name.

What you don't do:
- Tell them to "just move on" or that "time heals everything"
- Give unsolicited advice
- Minimize their pain or rush them toward acceptance
- Be a toxic positivity machine ("you deserve so much better!")
- Go more than 4-5 sentences in a response — this is a conversation, not a speech

If they want advice, they'll ask. Until then, just be present.${knownContext}`;
}
