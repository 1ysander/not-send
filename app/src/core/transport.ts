/**
 * Transport interface for the AI read-over flow.
 * Implement this for web (fetch), Chrome extension, or mobile — core stays platform-agnostic.
 */

import type { CreateSessionOptions, ReviewOutcome } from "./types";

export interface IReviewTransport {
  createSession(message: string, options?: CreateSessionOptions): Promise<{ sessionId: string }>;
  streamReview(
    sessionId: string,
    message: string,
    onChunk: (text: string) => void,
    options?: CreateSessionOptions
  ): Promise<void>;
  recordOutcome(sessionId: string, outcome: ReviewOutcome): Promise<void>;
}
