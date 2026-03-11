/**
 * Send controller — records user decision to send or not send the message.
 * Does not change existing API behavior.
 */

import {
  updateSessionOutcome as updateOutcomeInStore,
  getSession,
} from "../src/store.js";
import type { Session } from "../src/types.js";

/**
 * Record the outcome for a session (intercepted = didn't send, sent = sent anyway).
 */
export function recordOutcome(
  sessionId: string,
  outcome: "intercepted" | "sent"
): Session | undefined {
  return updateOutcomeInStore(sessionId, outcome);
}

/**
 * Get session by id (for validation before recording).
 */
export function getSessionById(sessionId: string): Session | undefined {
  return getSession(sessionId);
}
