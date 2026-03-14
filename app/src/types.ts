export interface FlaggedContact {
  id: string;
  name: string;
  phoneNumber: string;
  dateAdded: number;
  avatarUrl?: string;
}

export interface LocalSession {
  id: string;
  contactId: string;
  timestamp: number;
  messageAttempted: string;
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
  responseDelayProfile: "instant" | "quick" | "slow" | "unpredictable";
  typicalDelaySeconds: number;
  readsWithoutReplying: boolean;
}

/** For closure flow: simulate ex's voice. Sample messages from partner. */
export interface PartnerContext {
  partnerName: string;
  sampleMessages?: Array<{ fromPartner: boolean; text: string }>;
  relationshipMemory?: RelationshipMemory;
}

/** All per-contact context — breakup info + partner voice. This is the single editable "file" for each contact. */
export interface ContactProfile {
  /** What happened — used to personalise every AI prompt for this contact. */
  breakupSummary?: string;
  /** Days since last contact — used to frame urgency in interventions. */
  noContactDays?: number;
  /** Channel context so AI tone fits the medium. */
  conversationContext?: ConversationContextType;
  /** Sample messages from the partner (from iMessage upload). Used for closure voice simulation. */
  sampleMessages?: Array<{ fromPartner: boolean; text: string }>;
  /** Writing-style fingerprint extracted from uploaded conversation. */
  relationshipMemory?: RelationshipMemory;
  /** Epoch ms of last manual save. */
  lastUpdated?: number;
}

/** Date range from a parsed conversation export. */
export interface ConversationDateRange {
  from: string; // ISO date string
  to: string;   // ISO date string
}

/** One daily mood check-in entry. */
export interface MoodEntry {
  date: string;     // YYYY-MM-DD
  score: number;    // 1–10
  note?: string;    // optional short caption, max 50 words
  journal?: string; // optional long-form journal entry, no limit
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
