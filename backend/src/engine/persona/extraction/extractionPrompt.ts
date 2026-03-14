/**
 * extractionPrompt — build the LLM call that turns statistical data + message samples
 * into a fully structured PersonaJSON. One call per upload.
 */

import type { StatisticalProfile, AttributedMessage, PersonaJSON } from "../models/PersonaTypes.js";
import { chat } from "../../../ai/model.js";

const SYSTEM_PROMPT = `You are a conversational psychologist and linguistics expert. Your job is to create an extremely detailed communication profile of a specific person based on their text messages.

CRITICAL RULES:
- Be SPECIFIC, not generic. "Uses humor" is useless. "Deploys 'lol' to deflect emotional vulnerability when asked direct questions about feelings" is useful.
- Document ABSENCE as much as presence. If they NEVER use exclamation marks, that is as important as someone who always does.
- Capture INCONSISTENCIES. Most people text differently depending on mood, topic, and time of day. Document these behavioral mode shifts explicitly.
- Be honest about negative patterns. If they are avoidant, dismissive, passive-aggressive, or emotionally unavailable — document it accurately. The simulation must replicate the real person, not an idealized version.
- Return ONLY valid JSON. No markdown fences, no explanation text, nothing outside the JSON object.`;

function buildUserMessage(
  targetName: string,
  stats: StatisticalProfile,
  targetMessages: string[],
  conversationPairs: Array<{ userMessage: string; targetReply: string }>
): string {
  const abbrevSummary = Object.entries(stats.abbreviations)
    .filter(([, v]) => v.count >= 2)
    .map(([k, v]) => `${k} (${v.count}x, always=${v.alwaysUsed})`)
    .join(", ") || "none detected";

  const sampleMessages = targetMessages.slice(0, 80).map((m) => `• ${m}`).join("\n");

  const pairs = conversationPairs.slice(0, 30).map((p, i) =>
    `${i + 1}. User: "${p.userMessage}" → ${targetName}: "${p.targetReply}"`
  ).join("\n");

  return `## Pre-computed statistics for ${targetName}:

Capitalization: ${Math.round(stats.pctStartsUppercase * 100)}% start uppercase, ${Math.round(stats.pctICapitalized * 100)}% capitalize "I"
Message length: avg ${stats.avgWordCount} words, median ${stats.medianWordCount}, variance ${stats.lengthVariance}
One-word responses: ${Math.round(stats.pctOneWordResponses * 100)}% | Paragraph responses: ${Math.round(stats.pctParagraphResponses * 100)}%
Double texting: ${Math.round(stats.doubleTextFrequency * 100)}% frequency, avg burst ${stats.avgBurstLength} messages
Emoji: ${Math.round(stats.emojiFrequency * 100)}% of messages, top: ${stats.topEmojis.slice(0, 5).join(" ")} | Emoji-only messages: ${stats.emojiOnlyMessages}
Punctuation: ${Math.round(stats.pctEndsPeriod * 100)}% end with period, ${Math.round(stats.pctUsesQuestionMark * 100)}% use ?, ${Math.round(stats.pctUsesExclamation * 100)}% use !, ${Math.round(stats.pctUsesEllipsis * 100)}% use ...
Abbreviations: ${abbrevSummary}
Total messages: ${stats.totalTargetMessages} from ${targetName}, ${stats.totalUserMessages} from user
${stats.avgResponseTimeSeconds != null ? `Average response time: ${Math.round(stats.avgResponseTimeSeconds / 60)} minutes` : ""}

## Sample of ${targetName}'s messages (up to 80):
${sampleMessages}

## Conversation pairs — how ${targetName} responds (up to 30):
${pairs}

## Generate this exact JSON structure (return ONLY the JSON, nothing else):

{
  "meta": {
    "name": "${targetName}",
    "messageCountAnalyzed": ${stats.totalTargetMessages},
    "personaVersion": "1.0",
    "extractionDate": "${new Date().toISOString()}"
  },
  "surfaceStyle": {
    "capitalization": "none | minimal | standard | proper",
    "capitalizationNotes": "specific observation about when they capitalize",
    "punctuationStyle": "none | minimal | standard | heavy",
    "periodUsageMeaning": "what does a period signal from this person? irritation? formality? nothing?",
    "avgMessageLength": "short | medium | long",
    "messageLengthVariance": "consistent | moderate_variation | extreme_variation",
    "whenTheySendLongMessages": "description of what triggers longer messages",
    "doubleTexting": {
      "frequency": "never | rare | sometimes | often | always",
      "pattern": "description of their double-texting behavior"
    }
  },
  "vocabulary": {
    "abbreviationsAlwaysUsed": ["abbreviations they use 90%+ of the time"],
    "abbreviationsSometimesUsed": ["abbreviations used 30-90% of the time"],
    "abbreviationsNeverUsed": ["common abbreviations this person specifically avoids"],
    "slangTerms": ["non-abbreviation slang they use regularly"],
    "fillerWords": ["like", "honestly", "literally", "etc"],
    "uniqueMisspellings": ["intentional or consistent misspellings"],
    "wordsTheyOveruse": ["words used disproportionately often"],
    "vocabularyLevel": "simple | moderate | advanced | mixed"
  },
  "emojiProfile": {
    "usageLevel": "none | rare | moderate | heavy",
    "primaryEmojis": ["top 5 most used in order"],
    "emojiCombinations": ["common emoji combos they use"],
    "emojiAsResponse": "do they reply with only emoji? which ones?",
    "emojiMeaningMap": { "emoji": "what it signals when THIS person uses it" }
  },
  "emotionalPatterns": {
    "happinessExpression": "exactly how they express positive emotions",
    "frustrationExpression": "exactly how frustration manifests in text",
    "sadnessExpression": "how sadness shows up, or if it doesnt",
    "affectionExpression": "how they show warmth or care, or if they dont",
    "anxietyExpression": "how anxiety manifests — over-explaining? apologizing?",
    "emotionalAvailability": "low | moderate | high",
    "vulnerabilityCeiling": "the deepest emotional level they go to over text"
  },
  "defenseMechanisms": {
    "primaryDeflectionMethod": "humor | topic_change | minimizing | non_answer | silence",
    "deflectionTriggers": "what topics or emotional depths trigger deflection",
    "humorAsShield": "how they use humor to avoid vulnerability",
    "minimizingPhrases": ["exact phrases: 'it's fine', 'don't worry about it'"],
    "avoidancePatterns": "how they avoid topics they don't want to discuss",
    "passiveAggressionMarkers": "phrases or patterns signaling passive aggression, if any"
  },
  "conflictBehavior": {
    "fightStyle": "confrontational | avoidant | passive_aggressive | solution_oriented | shutdown",
    "escalationTriggers": "what causes them to escalate",
    "deEscalationMethod": "how they try to end arguments",
    "apologyStyle": "explicit | deflective | over_apologetic | never_apologizes",
    "recoveryPattern": "how conversations return to normal after conflict",
    "silentTreatment": "do they go quiet during conflict? for how long?"
  },
  "conversationalDynamics": {
    "initiativeLevel": "usually_initiates | balanced | usually_responds",
    "conversationStarters": ["how they typically open conversations"],
    "conversationEnders": ["how they typically close conversations"],
    "engagementIndicators": "what signals genuine engagement vs going through the motions",
    "disengagementIndicators": "what signals they want to stop talking",
    "questionAsking": "do they ask follow-up questions? what kind?"
  },
  "contextDependentModes": [
    {
      "modeName": "descriptive name",
      "trigger": "what activates this mode",
      "styleChanges": "how their texting shifts in this mode",
      "example": "a representative message from this mode"
    }
  ],
  "verbalIdentity": {
    "catchphrases": ["phrases repeated often enough to be signature"],
    "sentenceStarters": ["words/phrases they commonly begin messages with"],
    "reactionExpressions": ["go-to reactions: 'no way', 'thats crazy', 'im dead'"],
    "signOffs": ["how they end conversations or say goodbye"],
    "humorStyle": "sarcastic | self_deprecating | absurdist | observational | dry | playful",
    "storytellingStyle": "how they tell stories or relay events over text"
  },
  "simulationRules": {
    "neverDo": ["things the simulation must NEVER do that would break character"],
    "alwaysDo": ["things the simulation must ALWAYS do to maintain accuracy"],
    "accuracyWarnings": ["areas where LLM might default to generic behavior instead of this persons actual patterns"]
  },
  "sampleResponses": {
    "toCasualGreeting": "how theyd respond to 'hey'",
    "toDirectQuestion": "how theyd respond to 'how are you feeling about us?'",
    "toMakingPlans": "how theyd respond to 'want to hang out friday?'",
    "toEmotionalMessage": "how theyd respond to 'ive been really stressed lately'",
    "toConflict": "how theyd respond to 'you never listen to me'",
    "toGoodNews": "how theyd respond to 'i got the job!'",
    "toBoringMessage": "how theyd respond to a low-effort one-word message"
  }
}`;
}

export async function runExtractionCall(
  targetName: string,
  stats: StatisticalProfile,
  allMessages: AttributedMessage[]
): Promise<PersonaJSON> {
  const targetMessages = allMessages
    .filter((m) => m.role === "target" && !m.isHoldout)
    .map((m) => m.text);

  const conversationPairs: Array<{ userMessage: string; targetReply: string }> = [];
  const active = allMessages.filter((m) => !m.isHoldout);
  for (let i = 0; i < active.length - 1; i++) {
    if (active[i].role === "user" && active[i + 1].role === "target") {
      conversationPairs.push({
        userMessage: active[i].text,
        targetReply: active[i + 1].text,
      });
    }
  }

  const userMessage = buildUserMessage(targetName, stats, targetMessages, conversationPairs);

  const { text } = await chat({
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 4000,
  });

  let personaJson: PersonaJSON;
  try {
    const cleaned = text.replace(/```json?/gi, "").replace(/```/g, "").trim();
    personaJson = JSON.parse(cleaned) as PersonaJSON;
  } catch (err) {
    console.error("[extractionPrompt] Failed to parse extraction JSON:", text.slice(0, 300));
    throw new Error("Persona extraction failed: LLM returned invalid JSON");
  }

  return personaJson;
}
