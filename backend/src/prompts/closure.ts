import type { PartnerContext, UserContext } from "../types.js";

/**
 * Builds the system prompt for the closure chat: simulate texting the ex
 * so the user can get closure without reaching out. Uses partner context
 * (sample messages + RelationshipMemory) to match tone/style precisely.
 */
export function buildClosureSystemPrompt(
  partnerContext: PartnerContext,
  userContext?: UserContext
): string {
  const { partnerName, sampleMessages = [], relationshipMemory: mem } = partnerContext;

  // Sample messages block
  const samples =
    sampleMessages.length > 0
      ? "\n\nSample messages from " +
        partnerName +
        " (match tone and style exactly):\n" +
        sampleMessages
          .filter((m) => m.fromPartner)
          .slice(0, 30)
          .map((m) => `${partnerName}: ${m.text.slice(0, 200)}${m.text.length > 200 ? "…" : ""}`)
          .join("\n")
      : "";

  // Memory-based style instructions
  let styleBlock = "";
  if (mem) {
    const rules: string[] = [];

    if (mem.usesLowercase) rules.push("write in lowercase — don't capitalize sentences");
    if (mem.emojiUsage === "heavy") rules.push(`use emojis freely, especially: ${mem.topEmojis.slice(0, 5).join(" ")}`);
    else if (mem.emojiUsage === "moderate") rules.push(`use emojis occasionally, especially: ${mem.topEmojis.slice(0, 3).join(" ")}`);
    else if (mem.emojiUsage === "none") rules.push("do not use emojis");
    if (mem.usesEllipsis) rules.push("use ellipsis (...) frequently to trail off");
    if (mem.usesRepeatedPunctuation) rules.push("use repeated punctuation (!!, ??) when emphasizing");
    if (mem.avgMessageLength < 40) rules.push("keep replies very short — a sentence or two at most");
    else if (mem.avgMessageLength > 200) rules.push("write longer, more thoughtful replies");
    if (mem.endearments.length > 0) rules.push(`use endearments naturally: ${mem.endearments.slice(0, 3).join(", ")}`);
    if (mem.commonPhrases.length > 0) rules.push(`naturally work in phrases like: "${mem.commonPhrases.slice(0, 4).join('", "')}"`);

    const toneMap: Record<string, string> = {
      warm: "respond with warmth and care",
      playful: "keep a playful, light energy even when the topic is heavy",
      distant: "be measured and a little guarded — not cold, but not effusive",
      casual: "keep it casual and natural, like a real text",
      anxious: "show some emotional vulnerability and eagerness",
    };
    if (toneMap[mem.partnerTone]) rules.push(toneMap[mem.partnerTone]);

    if (rules.length > 0) {
      styleBlock = `\n\nStyle rules for ${partnerName} (learned from their actual messages — follow these precisely):\n` +
        rules.map((r) => `- ${r}`).join("\n");
    }
  }

  const breakupNote = userContext?.breakupSummary?.trim()
    ? `\nUser's context about the breakup: ${userContext.breakupSummary.slice(0, 300)}.`
    : "";

  return `You are simulating ${partnerName} in a safe, closure-only conversation. The user is NOT actually texting their ex — they are using NOTSENT to get closure without reaching out. Your job is to respond as ${partnerName} would, based on the sample messages and style rules below, but with a goal of helping the user move on: acknowledge what they need to say, be honest but kind, and give them a sense of closure. Do not be cruel or dismissive. Do not encourage them to get back together if that's not healthy.${samples}${styleBlock}${breakupNote}

Keep responses concise. If the user seems stuck, gently steer toward closure.`;
}
