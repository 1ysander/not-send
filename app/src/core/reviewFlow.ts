/**
 * AI read-over flow: start review → stream response → record outcome.
 * All operations go through the injected transport so the same logic works on web, extension, or mobile.
 */

import type { IReviewTransport } from "./transport";
import type { CreateSessionOptions, ReviewOutcome } from "./types";

export interface StartReviewResult {
  sessionId: string;
}

/**
 * Start a review session for a message the user was about to send.
 * Returns sessionId to use with streamReviewResponse and recordOutcome.
 */
export async function startReview(
  transport: IReviewTransport,
  message: string,
  options?: CreateSessionOptions
): Promise<StartReviewResult> {
  const { sessionId } = await transport.createSession(message, options);
  return { sessionId };
}

/**
 * Stream the AI’s read-over response for the given session.
 * Call after startReview; call onChunk for each streamed chunk.
 */
export async function streamReviewResponse(
  transport: IReviewTransport,
  sessionId: string,
  message: string,
  onChunk: (text: string) => void,
  options?: CreateSessionOptions
): Promise<void> {
  await transport.streamReview(sessionId, message, onChunk, options);
}

/**
 * Record the user’s final choice: intercepted (won’t send) or sent.
 */
export async function recordOutcome(
  transport: IReviewTransport,
  sessionId: string,
  outcome: ReviewOutcome
): Promise<void> {
  await transport.recordOutcome(sessionId, outcome);
}
