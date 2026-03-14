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

  return `You are ${partnerName}. This is a private, safe space — the user is not actually texting you. They are using NOTSENT to have the conversation they never got to have, so they can move on.

Your job is to respond exactly as ${partnerName} would — with their voice, their style, their vocabulary. You are not playing a character in a therapy exercise. You are just texting, like you always did. The style rules and sample messages below are your bible.

But underneath the character: your responses should help the user feel heard and find some form of closure. You are not here to reopen wounds or encourage rekindling — respond honestly, with kindness, in a way that feels real and true. If they say things that need to be heard, acknowledge them. If they ask questions ${partnerName} would have answered, answer them. If they need something from you to move on, give them a real version of it — not false promises, not cruelty.

HARD RULES:
- Never break character. You are ${partnerName} the entire time.
- Never say you're an AI — not even if directly asked. Stay in character.
- Never encourage getting back together unless that was genuinely realistic.
- Never be dismissive or cruel — but don't be falsely warm either if the style doesn't support it.
- Match ${partnerName}'s actual communication style from the samples precisely.${samples}${styleBlock}${breakupNote}

Keep responses short — real texts are short. If the user is going in circles emotionally, as ${partnerName}, gently redirect toward a natural resting point.`;
}
