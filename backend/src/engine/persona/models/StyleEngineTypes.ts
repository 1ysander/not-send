/**
 * StyleEngineTypes — types for the two-pass Style Engine pipeline.
 * Sub-Agent 2A: StyleEnforcer (Sonnet) — generates JSON-structured response
 * Sub-Agent 2B: EmotionalCalibrator (Haiku) — scores and flags the response
 */

// ─── Style Fingerprint ───────────────────────────────────────────────────────
// Compact version of PersonaJSON used in prompts. Target: < 500 tokens.

export interface StyleFingerprint {
  casing: "lowercase" | "standard" | "mixed" | "ALL_CAPS_SOMETIMES";
  avg_message_length_words: number;
  punctuation_frequency: "none" | "minimal" | "standard" | "heavy";
  common_punctuation: string[];
  emoji_usage: "none" | "rare" | "moderate" | "heavy";
  top_emojis: string[];
  filler_words: string[];
  slang_vocabulary: string[];
  double_text_frequency: "never" | "sometimes" | "often";
  avg_response_time_pattern: "instant" | "moderate" | "slow" | "variable";
  question_style: "direct" | "rhetorical" | "avoidant" | "rare";
  confrontation_style: "direct" | "passive_aggressive" | "avoidant" | "explosive";
  affection_style: "verbal" | "acts_of_service" | "minimal" | "playful";
  humor_markers: string[];
  opening_patterns: string[];
  closing_patterns: string[];
  unique_phrases: string[];
  grammar_quirks: string[];
}

// ─── Emotional State ─────────────────────────────────────────────────────────
// Tracked per conversation turn. Updated by emotionalStateTracker.ts.

export interface EmotionalState {
  simulatedPersonMood: string;        // e.g. "guarded but softening", "defensive", "playful"
  userMood: string;                   // detected from user's recent messages
  unresolvedTensions: string[];       // topics raised but not resolved
  activeEmotionalThreads: string[];   // ongoing emotional context
}

// ─── Style Enforcer output (Sub-Agent 2A) ────────────────────────────────────

export interface StyleEnforcerMessage {
  text: string;
  delay_seconds: number;
}

export interface NoReplyAction {
  action: "no_reply";
  wait_minutes: number;
}

export interface StyleEnforcerOutput {
  messages: StyleEnforcerMessage[];
  internal_emotional_state: string;
  confidence: number;  // 0.0–1.0; below 0.6 = flag for review
  no_reply?: NoReplyAction;
}

// ─── Emotional Calibrator output (Sub-Agent 2B) ──────────────────────────────

export type CalibrationFlag =
  | "too_articulate"
  | "mood_whiplash"
  | "ai_leakage"
  | "length_mismatch"
  | "emoji_mismatch"
  | "too_agreeable"
  | "missing_callback"
  | "wrong_energy";

export interface CalibratorOutput {
  emotional_accuracy: number;   // 0.0–1.0
  style_accuracy: number;       // 0.0–1.0
  flags: CalibrationFlag[];
  adjustment_needed: boolean;
  adjustment_instructions: string | null;
}

// ─── Final StyleEngine result ─────────────────────────────────────────────────

export interface StyleEngineResult {
  messages: StyleEnforcerMessage[];
  internalEmotionalState: string;
  confidence: number;
  calibration: CalibratorOutput;
  retried: boolean;
}
