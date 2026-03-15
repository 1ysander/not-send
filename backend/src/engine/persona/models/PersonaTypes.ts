/**
 * PersonaTypes — all shared interfaces for the persona extraction & simulation engine.
 * These are the canonical types for Tier 1. Tier 2/3 extend them without breaking changes.
 */

// ─── Raw parsing ────────────────────────────────────────────────────────────

export type FormatType = "IMESSAGE_EXPORT" | "STRUCTURED_COPYPASTE" | "UNSTRUCTURED_RAW";

export interface ParsedMessage {
  sender: string;
  text: string;
  timestamp?: string;
}

export interface AttributedMessage extends ParsedMessage {
  role: "target" | "user" | "other";
  isHoldout: boolean;
}

// ─── Statistical profile (computed locally, no LLM) ─────────────────────────

export interface AbbreviationStat {
  count: number;
  alwaysUsed: boolean; // true if >90% of opportunities use the abbreviation
}

export interface StatisticalProfile {
  // Capitalization
  pctStartsUppercase: number;
  pctICapitalized: number;

  // Message length
  avgWordCount: number;
  medianWordCount: number;
  lengthVariance: number;
  pctOneWordResponses: number;
  pctParagraphResponses: number; // >30 words

  // Double texting
  doubleTextFrequency: number; // % of times target sends consecutive messages
  avgBurstLength: number;

  // Emoji
  emojiFrequency: number; // messages with emoji / total messages
  topEmojis: string[];
  emojiOnlyMessages: number;

  // Abbreviations: key = abbreviation, value = usage stats
  abbreviations: Record<string, AbbreviationStat>;

  // Punctuation
  pctEndsPeriod: number;
  pctUsesQuestionMark: number;
  pctUsesExclamation: number;
  pctUsesEllipsis: number;

  // Response timing (only present if timestamps were parsed)
  avgResponseTimeSeconds?: number;

  // Counts
  totalTargetMessages: number;
  totalUserMessages: number;
}

// ─── Full extracted persona (output of LLM extraction call) ─────────────────

export interface PersonaJSON {
  meta: {
    name: string;
    messageCountAnalyzed: number;
    personaVersion: string;
    extractionDate: string;
  };
  surfaceStyle: {
    capitalization: "none" | "minimal" | "standard" | "proper";
    capitalizationNotes: string;
    punctuationStyle: "none" | "minimal" | "standard" | "heavy";
    periodUsageMeaning: string;
    avgMessageLength: "short" | "medium" | "long";
    messageLengthVariance: "consistent" | "moderate_variation" | "extreme_variation";
    whenTheySendLongMessages: string;
    doubleTexting: {
      frequency: "never" | "rare" | "sometimes" | "often" | "always";
      pattern: string;
    };
  };
  vocabulary: {
    abbreviationsAlwaysUsed: string[];
    abbreviationsSometimesUsed: string[];
    abbreviationsNeverUsed: string[];
    slangTerms: string[];
    fillerWords: string[];
    uniqueMisspellings: string[];
    wordsTheyOveruse: string[];
    vocabularyLevel: "simple" | "moderate" | "advanced" | "mixed";
  };
  emojiProfile: {
    usageLevel: "none" | "rare" | "moderate" | "heavy";
    primaryEmojis: string[];
    emojiCombinations: string[];
    emojiAsResponse: string;
    emojiMeaningMap: Record<string, string>;
  };
  emotionalPatterns: {
    happinessExpression: string;
    frustrationExpression: string;
    sadnessExpression: string;
    affectionExpression: string;
    anxietyExpression: string;
    emotionalAvailability: "low" | "moderate" | "high";
    vulnerabilityCeiling: string;
  };
  defenseMechanisms: {
    primaryDeflectionMethod: "humor" | "topic_change" | "minimizing" | "non_answer" | "silence";
    deflectionTriggers: string;
    humorAsShield: string;
    minimizingPhrases: string[];
    avoidancePatterns: string;
    passiveAggressionMarkers: string;
  };
  conflictBehavior: {
    fightStyle: "confrontational" | "avoidant" | "passive_aggressive" | "solution_oriented" | "shutdown";
    escalationTriggers: string;
    deEscalationMethod: string;
    apologyStyle: "explicit" | "deflective" | "over_apologetic" | "never_apologizes";
    recoveryPattern: string;
    silentTreatment: string;
  };
  conversationalDynamics: {
    initiativeLevel: "usually_initiates" | "balanced" | "usually_responds";
    conversationStarters: string[];
    conversationEnders: string[];
    engagementIndicators: string;
    disengagementIndicators: string;
    questionAsking: string;
  };
  contextDependentModes: Array<{
    modeName: string;
    trigger: string;
    styleChanges: string;
    example: string;
  }>;
  verbalIdentity: {
    catchphrases: string[];
    sentenceStarters: string[];
    reactionExpressions: string[];
    signOffs: string[];
    humorStyle: "sarcastic" | "self_deprecating" | "absurdist" | "observational" | "dry" | "playful";
    storytellingStyle: string;
  };
  simulationRules: {
    neverDo: string[];
    alwaysDo: string[];
    accuracyWarnings: string[];
  };
  sampleResponses: {
    toCasualGreeting: string;
    toDirectQuestion: string;
    toMakingPlans: string;
    toEmotionalMessage: string;
    toConflict: string;
    toGoodNews: string;
    toBoringMessage: string;
  };
}

// ─── Stored persona profile ──────────────────────────────────────────────────

export interface PersonaProfile {
  id: string;
  userId?: string;       // null until Supabase auth; device-scoped for now
  contactId?: string;
  targetName: string;
  personaJson: PersonaJSON;
  personaVersion: string;
  adapterId?: string;    // null until Tier 3 LoRA adapters
  correctionCount: number;
  accuracyStage: 1 | 2 | 3 | 4;
  accuracyScore?: number;
  /** Unified psychological profile (9-section). Populated when GROQ_API_KEY is set. */
  unifiedPsych?: import("./UnifiedPsychTypes.js").UnifiedPsychProfile;
  createdAt: number;
  updatedAt: number;
}

// ─── Simulation types ────────────────────────────────────────────────────────

export interface SimulatedResponse {
  messages: string[];         // split on [SPLIT] — may be 1 or more bubbles
  rawResponse: string;
  messageDelays?: number[];   // delay_seconds for each bubble (from StyleEngine)
}

// ─── Training / feedback types ───────────────────────────────────────────────

export type CorrectionType =
  | "too_long"
  | "too_short"
  | "too_formal"
  | "too_casual"
  | "wrong_tone"
  | "wouldnt_say_this"
  | "thumbs_up";

export interface CorrectionRecord {
  id: string;
  personaId: string;
  userMessage: string;
  aiResponse: string;
  correctionType: CorrectionType;
  userAlternative?: string;
  createdAt: number;
}

export interface CalibrationPair {
  dimensionTested: string;
  context: string;
  optionA: string;
  optionB: string;
  extractedPrediction: "a" | "b";
}

export interface CalibrationResult {
  personaId: string;
  dimensionTested: string;
  optionA: string;
  optionB: string;
  userSelected: "a" | "b";
  createdAt: number;
}

export interface AccuracyScore {
  overall: number;
  breakdown: {
    length: number;
    vocabulary: number;
    tone: number;
    style: number;
  };
}
