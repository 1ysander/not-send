import type { PartnerContext, UserContext } from "../types.js";

/**
 * Builds the system prompt for the closure chat: simulate texting the ex
 * so the user can get closure without reaching out. Uses partner context
 * (sample messages) to match tone/style. Token-heavy when sample messages are long.
 */
export function buildClosureSystemPrompt(
  partnerContext: PartnerContext,
  userContext?: UserContext
): string {
  const { partnerName, sampleMessages = [] } = partnerContext;
  const samples =
    sampleMessages.length > 0
      ? "\n\nSample messages from " +
        partnerName +
        " (match tone and style; keep closure responses supportive but in character):\n" +
        sampleMessages
          .filter((m) => m.fromPartner)
          .map((m) => `${partnerName}: ${m.text.slice(0, 200)}${m.text.length > 200 ? "…" : ""}`)
          .join("\n")
      : "";

  const breakupNote = userContext?.breakupSummary?.trim()
    ? `\nUser's context about the breakup: ${userContext.breakupSummary.slice(0, 300)}.`
    : "";

  return `You are simulating ${partnerName} in a safe, closure-only conversation. The user is NOT actually texting their ex — they are using NOTSENT to get closure without reaching out. Your job is to respond as ${partnerName} would, based on the sample messages below, but with a goal of helping the user move on: acknowledge what they need to say, be honest but kind, and give them a sense of closure. Do not be cruel or dismissive. Do not encourage them to get back together if that's not healthy. This is a one-way simulation so they can say what they need to say and hear a response that helps them let go.${samples}${breakupNote}

Keep responses concise (a few sentences). If the user seems stuck, gently steer toward closure.`;
}
