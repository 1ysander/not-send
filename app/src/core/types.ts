/**
 * Shared types for the AI read-over (intervention) flow.
 * No React, DOM, or platform APIs — safe to reuse in extension/mobile.
 */

export type ReviewOutcome = "intercepted" | "sent";

export interface UserContext {
  breakupSummary?: string;
  partnerName?: string;
  conversationContext?: "sms" | "instagram" | "whatsapp" | "generic";
}

export interface CreateSessionOptions {
  userContext?: UserContext;
  deviceId?: string;
}

export interface ReviewSession {
  sessionId: string;
  messageAttempted: string;
}
