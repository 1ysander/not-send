export interface FlaggedContact {
  id: string;
  name: string;
  phoneNumber: string;
  dateAdded: number;
}

export type SessionOutcome = "draft" | "intercepted" | "sent";

export interface LocalSession {
  id: string;
  contactId: string;
  timestamp: number;
  messageAttempted: string;
  outcome: SessionOutcome;
}

export interface Stats {
  interceptionsCount: number;
  messagesNeverSentCount: number;
}

export const STORAGE_KEYS = {
  FLAGGED_CONTACTS: "notsent_flaggedContacts",
  SESSIONS: "notsent_sessions",
} as const;

export const INTERVENTION_STORAGE = "notsent_intervention";

export interface InterventionState {
  sessionId: string;
  messageAttempted: string;
  contactId?: string;
}

/** Where you usually talk to your ex – used to tailor intervention quality (SMS, IG, etc.). */
export type ConversationContextType = "sms" | "instagram" | "whatsapp" | "generic";

/** Optional context for intervention prompts (breakup, partner name). */
export interface UserContext {
  breakupSummary?: string;
  noContactDays?: number;
  partnerName?: string;
  /** Channel (SMS, Instagram, WhatsApp) so content fits the context. */
  conversationContext?: ConversationContextType;
}

/** Writing style + communication patterns extracted from uploaded conversation. */
export interface RelationshipMemory {
  avgMessageLength: number;
  usesLowercase: boolean;
  emojiUsage: "heavy" | "moderate" | "rare" | "none";
  topEmojis: string[];
  endearments: string[];
  commonPhrases: string[];
  usesEllipsis: boolean;
  usesRepeatedPunctuation: boolean;
  recurringTopics: string[];
  partnerTone: "warm" | "playful" | "distant" | "casual" | "anxious";
  partnerMessageCount: number;
  userMessageCount: number;
}

/** For closure flow: simulate ex's voice. Sample messages from partner. */
export interface PartnerContext {
  partnerName: string;
  sampleMessages?: Array<{ fromPartner: boolean; text: string }>;
  relationshipMemory?: RelationshipMemory;
}

/** A single message in an AI chat thread. */
export interface AIChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Signed-in Google account (from OAuth credential). */
export interface AuthUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}
