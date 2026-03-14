/**
 * statisticalAnalyzer — compute StatisticalProfile from attributed messages.
 * No LLM. All metrics computed locally. Extends memoryBuilder with deeper stats.
 */

import type { AttributedMessage, StatisticalProfile, AbbreviationStat } from "../models/PersonaTypes.js";

const EMOJI_REGEX =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

const ABBREVIATION_LIST = [
  "u", "ur", "rn", "ngl", "tbh", "idk", "smth", "idc", "nvm", "lol",
  "lmao", "omg", "brb", "imo", "pls", "thx", "bc", "abt", "rlly",
  "sm", "smh", "imo", "ikr", "irl", "fyi", "btw", "imo", "rip",
  "lmk", "hmu", "ttyl", "afk", "gg", "fr", "no cap", "lowkey",
];

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function stdDev(nums: number[]): number {
  if (nums.length === 0) return 0;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / nums.length;
  return Math.sqrt(variance);
}

function hasEmoji(text: string): boolean {
  return EMOJI_REGEX.test(text);
}

function extractEmojis(text: string): string[] {
  return [...(text.match(EMOJI_REGEX) ?? [])];
}

function isEmojiOnly(text: string): boolean {
  const stripped = text.replace(EMOJI_REGEX, "").trim();
  return stripped.length === 0 && hasEmoji(text);
}

function computeAbbreviations(messages: AttributedMessage[]): Record<string, AbbreviationStat> {
  const result: Record<string, AbbreviationStat> = {};

  for (const abbr of ABBREVIATION_LIST) {
    const abbrRegex = new RegExp(`\\b${abbr.replace(/\s+/g, "\\s+")}\\b`, "gi");

    let count = 0;
    for (const m of messages) {
      const matches = m.text.match(abbrRegex);
      if (matches) count += matches.length;
    }

    if (count > 0) {
      // "alwaysUsed" = appears in >90% of messages where the opportunity exists
      // Simplified: alwaysUsed = count >= 3 (meaningful usage)
      result[abbr] = { count, alwaysUsed: count >= 3 };
    }
  }

  return result;
}

function detectDoubleTexting(
  allMessages: AttributedMessage[]
): { frequency: number; avgBurstLength: number } {
  let burstCount = 0;
  let totalBurstLength = 0;
  let i = 0;

  while (i < allMessages.length) {
    if (allMessages[i].role !== "target") { i++; continue; }

    let burstLength = 1;
    while (i + burstLength < allMessages.length && allMessages[i + burstLength].role === "target") {
      burstLength++;
    }

    if (burstLength > 1) {
      burstCount++;
      totalBurstLength += burstLength;
    }

    i += burstLength;
  }

  const targetMessages = allMessages.filter((m) => m.role === "target");
  const frequency = targetMessages.length > 0 ? burstCount / targetMessages.length : 0;
  const avgBurstLength = burstCount > 0 ? totalBurstLength / burstCount : 1;

  return { frequency, avgBurstLength };
}

function computeResponseTimes(messages: AttributedMessage[]): number | undefined {
  const withTimestamps = messages.filter((m) => m.timestamp);
  if (withTimestamps.length < 4) return undefined;

  const times: number[] = [];
  for (let i = 1; i < withTimestamps.length; i++) {
    const prev = withTimestamps[i - 1];
    const curr = withTimestamps[i];
    if (prev.role === "user" && curr.role === "target" && prev.timestamp && curr.timestamp) {
      const prevMs = new Date(prev.timestamp).getTime();
      const currMs = new Date(curr.timestamp).getTime();
      if (!isNaN(prevMs) && !isNaN(currMs) && currMs > prevMs) {
        times.push((currMs - prevMs) / 1000);
      }
    }
  }

  if (times.length === 0) return undefined;
  return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
}

export function computeStatisticalProfile(
  messages: AttributedMessage[]
): StatisticalProfile {
  const targetMsgs = messages.filter((m) => m.role === "target" && !m.isHoldout);
  const userMsgs = messages.filter((m) => m.role === "user");

  if (targetMsgs.length === 0) {
    return {
      pctStartsUppercase: 0, pctICapitalized: 0,
      avgWordCount: 0, medianWordCount: 0, lengthVariance: 0,
      pctOneWordResponses: 0, pctParagraphResponses: 0,
      doubleTextFrequency: 0, avgBurstLength: 1,
      emojiFrequency: 0, topEmojis: [], emojiOnlyMessages: 0,
      abbreviations: {},
      pctEndsPeriod: 0, pctUsesQuestionMark: 0, pctUsesExclamation: 0, pctUsesEllipsis: 0,
      totalTargetMessages: 0, totalUserMessages: userMsgs.length,
    };
  }

  // Capitalization
  const startsUpper = targetMsgs.filter((m) => /^[A-Z]/.test(m.text)).length;
  const iInstances = targetMsgs.filter((m) => / I /.test(m.text) || m.text.startsWith("I ")).length;
  const iCapitalized = targetMsgs.filter((m) => !/ i /.test(m.text)).length;

  // Message length
  const wordCounts = targetMsgs.map((m) => countWords(m.text));
  const avgWordCount = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length;

  // Emoji
  const withEmoji = targetMsgs.filter((m) => hasEmoji(m.text)).length;
  const emojiOnly = targetMsgs.filter((m) => isEmojiOnly(m.text)).length;
  const allEmojis: string[] = [];
  for (const m of targetMsgs) allEmojis.push(...extractEmojis(m.text));
  const emojiFreq = new Map<string, number>();
  for (const e of allEmojis) emojiFreq.set(e, (emojiFreq.get(e) ?? 0) + 1);
  const topEmojis = [...emojiFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([e]) => e);

  // Punctuation
  const endsPeriod = targetMsgs.filter((m) => /\.$/.test(m.text.trim())).length;
  const usesQuestion = targetMsgs.filter((m) => m.text.includes("?")).length;
  const usesExclamation = targetMsgs.filter((m) => m.text.includes("!")).length;
  const usesEllipsis = targetMsgs.filter((m) => m.text.includes("...")).length;

  const pct = (n: number) => Math.round((n / targetMsgs.length) * 100) / 100;

  const { frequency: doubleTextFrequency, avgBurstLength } = detectDoubleTexting(messages);

  return {
    pctStartsUppercase: pct(startsUpper),
    pctICapitalized: iInstances > 0 ? pct(iCapitalized) : 1,
    avgWordCount: Math.round(avgWordCount * 10) / 10,
    medianWordCount: median(wordCounts),
    lengthVariance: Math.round(stdDev(wordCounts) * 10) / 10,
    pctOneWordResponses: pct(wordCounts.filter((w) => w === 1).length),
    pctParagraphResponses: pct(wordCounts.filter((w) => w > 30).length),
    doubleTextFrequency: Math.round(doubleTextFrequency * 100) / 100,
    avgBurstLength: Math.round(avgBurstLength * 10) / 10,
    emojiFrequency: pct(withEmoji),
    topEmojis,
    emojiOnlyMessages: emojiOnly,
    abbreviations: computeAbbreviations(targetMsgs),
    pctEndsPeriod: pct(endsPeriod),
    pctUsesQuestionMark: pct(usesQuestion),
    pctUsesExclamation: pct(usesExclamation),
    pctUsesEllipsis: pct(usesEllipsis),
    avgResponseTimeSeconds: computeResponseTimes(messages),
    totalTargetMessages: targetMsgs.length,
    totalUserMessages: userMsgs.length,
  };
}
