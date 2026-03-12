/**
 * Shared types for sessions, conversation history, and future closure/partner context.
 * Used for intervention (talk user out of texting) and eventual closure flow
 * (simulate texting ex for closure without reaching out).
 */

export type SessionOutcome = "intercepted" | "sent" | "draft";

export type Sentiment = "distress" | "longing" | "anger" | "neutral";

export interface Session {
  id: string;
  messageAttempted: string;
  outcome: SessionOutcome;
  createdAt: number;
}

/** One turn in an intervention or closure conversation (for history + API tokens). */
export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

/** Where you usually talk to your ex – used to tailor intervention quality (SMS, IG, etc.). */
export type ConversationContextType = "sms" | "instagram" | "whatsapp" | "generic";

/** Optional context about the user/breakup for intervention prompts. */
export interface UserContext {
  /** Free text: how the breakup happened, how long ago, etc. */
  breakupSummary?: string;
  /** Days since no contact started – used to personalize urgency in prompts. */
  noContactDays?: number;
  /** Partner's name (ex) for personalization. */
  partnerName?: string;
  /** Channel (SMS, Instagram, WhatsApp) so content fits the context. */
  conversationContext?: ConversationContextType;
}

/** Optional context about the ex for closure flow: simulate their voice without reaching out. */
export interface PartnerContext {
  partnerName: string;
  /**
   * Sample messages from the ex (user-uploaded or pasted).
   * Used to condition the model so closure replies match tone/style.
   * Token-heavy; apply limits in production.
   */
  sampleMessages?: Array<{ fromPartner: boolean; text: string }>;
}

/** Request body for intervention chat: can include history and context for richer prompts. */
export interface InterventionChatBody {
  sessionId: string;
  messageAttempted: string;
  messages: Array<{ role: string; content: string }>;
  /** Previous intervention turns (for continuity and token usage). */
  conversationHistory?: ConversationTurn[];
  userContext?: UserContext;
}

/** Request body for closure chat: simulate texting the ex for closure. */
export interface ClosureChatBody {
  messages: Array<{ role: string; content: string }>;
  userContext?: UserContext;
  partnerContext: PartnerContext;
}
