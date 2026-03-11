/**
 * Portable AI read-over (intervention) core.
 * Import this from the website, Chrome extension, or mobile app; provide your own transport.
 */

export type { UserContext, ReviewOutcome, CreateSessionOptions, ReviewSession } from "./types";
export type { IReviewTransport } from "./transport";
export {
  startReview,
  streamReviewResponse,
  recordOutcome,
} from "./reviewFlow";
export type { StartReviewResult } from "./reviewFlow";
