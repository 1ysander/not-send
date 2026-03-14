/**
 * Shared types for sessions, conversation history, and future closure/partner context.
 * Used for intervention (talk user out of texting) and eventual closure flow
 * (simulate texting ex for closure without reaching out).
 */

export type Sentiment = "distress" | "longing" | "anger" | "neutral";

export interface Session {
  id: string;
  messageAttempted: string;
  createdAt: number;
  outcome?: "intercepted" | "sent";
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

/**
 * Extracted writing style and communication patterns from the uploaded conversation.
 * Built by memoryBuilder.ts from parsed messages — no LLM required.
 */
export interface RelationshipMemory {
  /** Partner's average message length in characters */
  avgMessageLength: number;
  /** Does the partner typically skip sentence-starting capitals? */
  usesLowercase: boolean;
  /** How often the partner uses emojis */
  emojiUsage: "heavy" | "moderate" | "rare" | "none";
  /** Top emojis the partner used */
  topEmojis: string[];
  /** Nicknames / endearments the partner used for the user */
  endearments: string[];
  /** Frequent phrases or sentence openers the partner used */
  commonPhrases: string[];
  /** Does the partner use ellipsis (...) a lot? */
  usesEllipsis: boolean;
  /** Does the partner use repeated punctuation (!! ??) */
  usesRepeatedPunctuation: boolean;
  /** Recurring topics detected in the conversation */
  recurringTopics: string[];
  /** Partner's dominant emotional tone */
  partnerTone: "warm" | "playful" | "distant" | "casual" | "anxious";
  /** Number of messages from the partner in the upload */
  partnerMessageCount: number;
  /** Number of messages from the user in the upload */
  userMessageCount: number;
  /** Classified response speed based on measured reply gaps */
  responseDelayProfile: "instant" | "quick" | "slow" | "unpredictable";
  /** Median partner response time in seconds (0 if timestamps unavailable) */
  typicalDelaySeconds: number;
  /** True if the partner often took >15 min to reply — "leaves on read" behaviour */
  readsWithoutReplying: boolean;
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
  /**
   * Structured writing-style analysis extracted from the uploaded conversation.
   * Used to generate language-specific, style-accurate AI responses.
   */
  relationshipMemory?: RelationshipMemory;
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
