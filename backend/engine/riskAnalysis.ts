/**
 * Risk analysis — scores urgency and sentiment of a draft message.
 * Used to adapt the intervention prompt tone before streaming.
 * No LLM calls — pure heuristics, runs synchronously.
 */

export type Sentiment = "distress" | "longing" | "anger" | "neutral";

export interface RiskResult {
  shouldIntercept: boolean;
  /** Urgency score 0–1 (higher = more distressed, needs gentler opening). */
  urgency: number;
  /** Dominant emotional tone of the message. */
  sentiment: Sentiment;
  /** Alias for urgency — kept for backwards compat. */
  score?: number;
}

// Keywords grouped by emotional tone
const DISTRESS_KEYWORDS = [
  "i can't do this",
  "can't stop crying",
  "i need you",
  "please come back",
  "i'm begging",
  "please don't leave",
  "i'm falling apart",
  "i'm broken",
  "can't breathe",
  "drunk",
  "crying",
  "hurts so much",
  "so much pain",
  "can't eat",
  "can't sleep",
];

const LONGING_KEYWORDS = [
  "miss you",
  "thinking about you",
  "still love",
  "i love you",
  "can't stop thinking",
  "dream about",
  "i still",
  "remember when",
  "come back",
  "i need to see",
  "one more chance",
  "last time",
];

const ANGER_KEYWORDS = [
  "i hate you",
  "you ruined",
  "you destroyed",
  "fuck you",
  "never forgive",
  "you're terrible",
  "you always",
  "you never",
  "worst",
  "disgusting",
];

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

function countMatches(text: string, keywords: string[]): number {
  const n = normalize(text);
  return keywords.reduce((count, kw) => count + (n.includes(kw) ? 1 : 0), 0);
}

function lengthUrgency(text: string): number {
  const len = text.length;
  if (len <= 30) return 0.05;
  if (len <= 100) return 0.1;
  if (len <= 300) return 0.2;
  return 0.35; // long walls of text = high emotional investment
}

function exclamationUrgency(text: string): number {
  return Math.min(0.2, (text.match(/!+/g) ?? []).length * 0.07);
}

function capsUrgency(text: string): number {
  const words = text.split(/\s+/);
  const capsRatio = words.filter((w) => w.length > 2 && w === w.toUpperCase()).length / Math.max(words.length, 1);
  return Math.min(0.2, capsRatio * 0.6);
}

/**
 * Analyze a draft message and return urgency (0–1) + dominant sentiment.
 * Always returns shouldIntercept: true — app intercepts all messages to the ex.
 */
export function analyzeRisk(messageAttempted: string): RiskResult {
  const text = (messageAttempted ?? "").trim();
  if (!text) {
    return { shouldIntercept: true, urgency: 0, sentiment: "neutral", score: 0 };
  }

  const distressCount = countMatches(text, DISTRESS_KEYWORDS);
  const longingCount = countMatches(text, LONGING_KEYWORDS);
  const angerCount = countMatches(text, ANGER_KEYWORDS);

  const distressScore = Math.min(1, distressCount * 0.35);
  const longingScore = Math.min(1, longingCount * 0.25);
  const angerScore = Math.min(1, angerCount * 0.3);

  // Urgency = weighted blend; distress weighs heaviest (needs gentlest response)
  const urgency = Math.min(
    1,
    Math.round(
      (distressScore * 0.45 +
        longingScore * 0.25 +
        angerScore * 0.15 +
        lengthUrgency(text) +
        exclamationUrgency(text) +
        capsUrgency(text)) *
        100
    ) / 100
  );

  // Dominant sentiment = whichever category has the most keyword matches
  let sentiment: Sentiment = "neutral";
  const max = Math.max(distressCount, longingCount, angerCount);
  if (max > 0) {
    if (distressCount === max) sentiment = "distress";
    else if (longingCount === max) sentiment = "longing";
    else sentiment = "anger";
  }

  return { shouldIntercept: true, urgency, sentiment, score: urgency };
}
