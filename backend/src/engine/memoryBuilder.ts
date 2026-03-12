/**
 * memoryBuilder — extract RelationshipMemory from parsed conversation messages.
 * Pure analysis, no LLM. Called after iMessage parse to build context for prompts.
 */

import type { RelationshipMemory } from "../types.js";

type ParsedMessage = { fromPartner: boolean; text: string };

// Emoji regex (matches most emoji ranges)
const EMOJI_REGEX =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E0}-\u{1F1FF}]/gu;

const ENDEARMENT_PATTERNS = [
  "babe", "baby", "bae", "love", "lovely", "honey", "hun", "boo",
  "sweetheart", "darling", "angel", "gorgeous", "beautiful", "cutie",
  "bb", "bbs", "luv", "my love", "mi amor", "my everything",
];

const TOPIC_KEYWORDS: Record<string, string[]> = {
  work: ["work", "job", "boss", "meeting", "office", "colleague", "shift", "project", "deadline"],
  food: ["eat", "food", "hungry", "dinner", "lunch", "breakfast", "restaurant", "cook", "coffee", "drinks"],
  family: ["mom", "dad", "sister", "brother", "parents", "family", "home"],
  emotions: ["feel", "feeling", "sad", "happy", "upset", "miss", "love", "hate", "nervous", "anxious", "scared", "lonely"],
  future: ["plan", "plans", "later", "tonight", "tomorrow", "next week", "someday", "when we", "future"],
  conflict: ["fight", "argue", "upset", "angry", "hurt", "sorry", "apologize", "blame", "fault"],
  hangout: ["hang", "come over", "visit", "meet", "see you", "chill", "together"],
};

function extractEmojis(text: string): string[] {
  return [...(text.match(EMOJI_REGEX) ?? [])];
}

function countEmojis(messages: ParsedMessage[]): { count: number; topEmojis: string[] } {
  const freq = new Map<string, number>();
  let total = 0;
  for (const m of messages) {
    for (const e of extractEmojis(m.text)) {
      freq.set(e, (freq.get(e) ?? 0) + 1);
      total++;
    }
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  return {
    count: total,
    topEmojis: sorted.slice(0, 8).map(([e]) => e),
  };
}

function detectEndearments(messages: ParsedMessage[]): string[] {
  const found = new Set<string>();
  for (const m of messages) {
    const lower = m.text.toLowerCase();
    for (const e of ENDEARMENT_PATTERNS) {
      if (lower.includes(e)) found.add(e);
    }
  }
  return [...found];
}

function getCommonPhrases(messages: ParsedMessage[]): string[] {
  // Find 2-3 word sequences that appear more than once
  const bigrams = new Map<string, number>();
  for (const m of messages) {
    const words = m.text
      .toLowerCase()
      .replace(/[^a-z0-9'\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      // skip generic stop-word bigrams
      if (isStopBigram(bigram)) continue;
      bigrams.set(bigram, (bigrams.get(bigram) ?? 0) + 1);
    }
  }
  return [...bigrams.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase]) => phrase);
}

const STOP_BIGRAMS = new Set([
  "i am", "i was", "it is", "it was", "do you", "are you", "i don't", "i didn't",
  "to the", "in the", "of the", "and the", "on the", "for the", "at the",
  "i know", "i think", "you know", "you can", "i can",
]);

function isStopBigram(b: string): boolean {
  return STOP_BIGRAMS.has(b);
}

function detectRecurringTopics(messages: ParsedMessage[]): string[] {
  const scores = new Map<string, number>();
  const allText = messages.map((m) => m.text.toLowerCase()).join(" ");
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, "g");
      const matches = allText.match(regex);
      if (matches) score += matches.length;
    }
    if (score >= 3) scores.set(topic, score);
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
}

function detectTone(messages: ParsedMessage[]): RelationshipMemory["partnerTone"] {
  const text = messages.map((m) => m.text.toLowerCase()).join(" ");
  const warmWords = ["love", "miss", "care", "heart", "sweet", "beautiful", "amazing", "wonderful"];
  const playfulWords = ["lol", "lmao", "haha", "😂", "😄", "jk", "funny", "hehe", "omg", "😜"];
  const distantWords = ["fine", "ok", "okay", "sure", "whatever", "idk", "k", "no worries"];
  const anxiousWords = ["sorry", "please", "wait", "worried", "just", "need", "have to", "must"];

  const score = (words: string[]) =>
    words.reduce((acc, w) => acc + (text.split(w).length - 1), 0);

  const scores = {
    warm: score(warmWords),
    playful: score(playfulWords),
    distant: score(distantWords),
    anxious: score(anxiousWords),
    casual: 0,
  };

  // casual is the default/fallback
  const max = Math.max(...Object.values(scores));
  if (max < 3) return "casual";

  return (Object.entries(scores).find(([, v]) => v === max)?.[0] ??
    "casual") as RelationshipMemory["partnerTone"];
}

/**
 * Build a RelationshipMemory from parsed conversation messages.
 * Only looks at partner messages for style analysis.
 */
export function buildRelationshipMemory(
  allMessages: ParsedMessage[]
): RelationshipMemory {
  const partnerMsgs = allMessages.filter((m) => m.fromPartner);
  const userMsgs = allMessages.filter((m) => !m.fromPartner);

  if (partnerMsgs.length === 0) {
    return {
      avgMessageLength: 0,
      usesLowercase: false,
      emojiUsage: "none",
      topEmojis: [],
      endearments: [],
      commonPhrases: [],
      usesEllipsis: false,
      usesRepeatedPunctuation: false,
      recurringTopics: [],
      partnerTone: "casual",
      partnerMessageCount: 0,
      userMessageCount: userMsgs.length,
    };
  }

  const totalChars = partnerMsgs.reduce((acc, m) => acc + m.text.length, 0);
  const avgMessageLength = Math.round(totalChars / partnerMsgs.length);

  // Lowercase detection: >60% of messages start with lowercase
  const lowercaseCount = partnerMsgs.filter(
    (m) => m.text.length > 0 && m.text[0] === m.text[0].toLowerCase() && /[a-z]/.test(m.text[0])
  ).length;
  const usesLowercase = lowercaseCount / partnerMsgs.length > 0.6;

  // Emoji analysis
  const { count: emojiCount, topEmojis } = countEmojis(partnerMsgs);
  const emojisPerMessage = emojiCount / partnerMsgs.length;
  let emojiUsage: RelationshipMemory["emojiUsage"];
  if (emojisPerMessage > 1.5) emojiUsage = "heavy";
  else if (emojisPerMessage > 0.4) emojiUsage = "moderate";
  else if (emojisPerMessage > 0.05) emojiUsage = "rare";
  else emojiUsage = "none";

  // Endearments
  const endearments = detectEndearments(partnerMsgs);

  // Common phrases
  const commonPhrases = getCommonPhrases(partnerMsgs);

  // Punctuation patterns
  const partnerText = partnerMsgs.map((m) => m.text).join(" ");
  const usesEllipsis = (partnerText.match(/\.\.\./g) ?? []).length > 2;
  const usesRepeatedPunctuation = /[!?]{2,}/.test(partnerText);

  // Topics (full conversation)
  const recurringTopics = detectRecurringTopics(allMessages);

  // Tone
  const partnerTone = detectTone(partnerMsgs);

  return {
    avgMessageLength,
    usesLowercase,
    emojiUsage,
    topEmojis,
    endearments,
    commonPhrases,
    usesEllipsis,
    usesRepeatedPunctuation,
    recurringTopics,
    partnerTone,
    partnerMessageCount: partnerMsgs.length,
    userMessageCount: userMsgs.length,
  };
}
