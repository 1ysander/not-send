/**
 * Risk analysis — determines whether to intercept a message.
 * Does not change existing API behavior; currently always recommends intercept.
 */

export interface RiskResult {
  shouldIntercept: boolean;
  /** Optional score 0–1 (higher = riskier to send). */
  score?: number;
}

/**
 * Analyze whether the message should be intercepted for intervention.
 * Stub: always returns shouldIntercept true (preserves current behavior).
 */
export function analyzeRisk(_messageAttempted: string): RiskResult {
  return { shouldIntercept: true };
}
