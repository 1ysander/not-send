/**
 * Conversation engine: analyze draft messages for risk and recommend delay/send/review.
 * Integrates local credit usage so each analysis consumes credits (and can be capped).
 */

import {
  consumeCredits,
  getCreditUsageInfo,
  CREDITS_PER_ANALYSIS,
  type CreditUsageInfo,
} from "./creditUsage.js";

// --- Types ---

export type Recommendation = "delay" | "send" | "review";

export interface AnalyzeMessageResult {
  riskScore: number;
  recommendation: Recommendation;
  /** Credit usage after this analysis (if deviceId was provided). */
  creditUsage?: CreditUsageInfo;
}

export interface AnalyzeMessageOptions {
  /** Client device id for per-device credit tracking. */
  deviceId?: string;
  /** If true, skip consuming credits (e.g. dry run or preview). */
  consumeCredit?: boolean;
}

// --- Heuristics (local, no LLM) ---

const DELAY_KEYWORDS = [
  "miss you",
  "come back",
  "still love",
  "need you",
  "can we talk",
  "why did you",
  "i hate that",
  "i'm sorry",
  "please",
  "one more",
  "last time",
  "final",
  "drunk",
  "thinking about you",
  "can't stop",
];

const REVIEW_KEYWORDS = [
  "?",
  "how are you",
  "hope you",
  "just wanted",
  "closure",
  "need to say",
];

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

function keywordRisk(text: string, keywords: string[]): number {
  const n = normalize(text);
  let count = 0;
  for (const kw of keywords) {
    if (n.includes(kw)) count++;
  }
  return Math.min(1, count * 0.25);
}

function lengthRisk(text: string): number {
  const len = text.length;
  if (len <= 40) return 0.1;
  if (len <= 120) return 0.2;
  if (len <= 400) return 0.35;
  return 0.5;
}

function exclamationRisk(text: string): number {
  const exclamations = (text.match(/!+/g) ?? []).length;
  return Math.min(0.3, exclamations * 0.1);
}

/**
 * Analyze a draft message and return risk score and recommendation.
 * Uses local credit usage when deviceId is provided and consumeCredit is not false.
 */
export function analyzeMessage(
  message: string,
  options: AnalyzeMessageOptions = {}
): AnalyzeMessageResult {
  const { deviceId, consumeCredit = true } = options;

  if (consumeCredit) {
    const result = consumeCredits(deviceId, CREDITS_PER_ANALYSIS);
    if (!result.ok) {
      throw new Error(result.reason === "DEVICE_CREDIT_LIMIT"
        ? "Device credit limit reached"
        : "Global credit limit reached");
    }
  }

  const trimmed = (message ?? "").trim();
  if (!trimmed) {
    return {
      riskScore: 0,
      recommendation: "send",
      ...(deviceId && { creditUsage: getCreditUsageInfo(deviceId) }),
    };
  }

  const delayScore = keywordRisk(trimmed, DELAY_KEYWORDS);
  const reviewScore = keywordRisk(trimmed, REVIEW_KEYWORDS);
  const lenScore = lengthRisk(trimmed);
  const exclamScore = exclamationRisk(trimmed);

  const riskScore = Math.min(
    1,
    Math.round((delayScore * 0.5 + lenScore * 0.3 + exclamScore + reviewScore * 0.2) * 100) / 100
  );

  let recommendation: Recommendation;
  if (riskScore >= 0.6) recommendation = "delay";
  else if (riskScore >= 0.35) recommendation = "review";
  else recommendation = "send";

  return {
    riskScore,
    recommendation,
    ...(deviceId && { creditUsage: getCreditUsageInfo(deviceId) }),
  };
}

// Re-export credit helpers so callers can check usage before/after
export {
  getCreditUsage,
  getCreditUsageInfo,
  getGlobalCreditUsage,
  setDeviceCap,
  setGlobalCap,
  CREDITS_PER_ANALYSIS,
} from "./creditUsage.js";
