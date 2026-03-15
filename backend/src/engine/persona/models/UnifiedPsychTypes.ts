/**
 * UnifiedPsychTypes — types for the 9-section unified psychological profile.
 * Synthesizes Big Five, LIWC-22, Gottman SPAFF, ECR-R Attachment,
 * SEANCE emotion, Perry DMRS defense mechanisms, and Dark Triad patterns
 * into one comprehensive extraction output.
 */

// ─── Meta ─────────────────────────────────────────────────────────────────────

export type DataQuality = "sparse" | "moderate" | "rich";

export interface ProfileMeta {
  total_messages_analyzed: number;
  contact_messages_analyzed: number;
  date_range: string;
  data_quality: DataQuality;
  overall_confidence: number;
}

// ─── Section 1: Personality (Big Five / OCEAN) ───────────────────────────────

export interface OceanTrait {
  score: number;             // 1.0–5.0
  confidence: number;        // 0.0–1.0
  linguistic_evidence: {
    indicators_found: string[];
    example_messages: string[];
  };
}

export interface PersonalityProfile {
  openness: OceanTrait;
  conscientiousness: OceanTrait;
  extraversion: OceanTrait;
  agreeableness: OceanTrait;
  neuroticism: OceanTrait;
}

// ─── Section 2: Psycholinguistic (LIWC-Derived) ──────────────────────────────

export type CognitiveDensity = "low" | "moderate" | "high";
export type PronounDensity = "low" | "moderate" | "high";
export type InquiryFrequency = "rare" | "occasional" | "frequent";
export type TemporalOrientation = "past" | "present" | "future" | "mixed";
export type AuthenticityLevel = "low" | "moderate" | "high";

export interface PsycholinguisticProfile {
  cognitive_complexity: {
    analytical_thinking: CognitiveDensity;
    causal_reasoning_frequency: string;
    insight_language: string;
    certainty_vs_tentativeness: "certain" | "balanced" | "tentative";
    evidence: string[];
  };
  social_orientation: {
    self_focus: {
      i_language_density: PronounDensity;
      pattern: string;
      evidence: string[];
    };
    other_focus: {
      you_language_density: PronounDensity;
      inquiry_about_partner: InquiryFrequency;
      evidence: string[];
    };
    we_language: {
      we_vs_i_ratio: string;
      contexts_where_we_appears: string[];
      evidence: string[];
    };
  };
  emotional_language: {
    positive_emotion_density: string;
    negative_emotion_density: string;
    dominant_negative_emotion: "anxiety" | "anger" | "sadness" | "mixed";
    emotional_range: "narrow" | "moderate" | "wide";
    emotion_trajectory_across_conversation: Array<{
      segment: "early" | "middle" | "late";
      dominant_tone: string;
      evidence: string[];
    }>;
  };
  authenticity_markers: {
    overall_authenticity: AuthenticityLevel;
    contexts_where_authenticity_drops: string[];
    evidence: string[];
  };
  temporal_focus: {
    dominant_temporal_orientation: TemporalOrientation;
    past_references_context: "nostalgic" | "regretful" | "factual";
    future_references_context: "hopeful" | "anxious" | "planning";
    evidence: string[];
  };
}

// ─── Section 3: Gottman Interaction Patterns ─────────────────────────────────

export type GottmanFrequency = "absent" | "rare" | "occasional" | "frequent";

export interface GottmanPatterns {
  four_horsemen: {
    criticism: {
      frequency: GottmanFrequency;
      examples: string[];
      typical_trigger: string;
      who_initiates: "contact" | "user" | "both";
    };
    contempt: {
      frequency: GottmanFrequency;
      style: "sarcasm" | "mockery" | "dismissiveness" | "hostile_humor";
      examples: string[];
      escalation_role: string;
    };
    defensiveness: {
      frequency: GottmanFrequency;
      style: "counter_attack" | "victimhood" | "denial" | "cross_complaining";
      examples: string[];
      response_to_what: string;
    };
    stonewalling: {
      frequency: GottmanFrequency;
      text_manifestation: string;
      duration_pattern: string;
      what_breaks_it: string;
      examples: string[];
    };
  };
  repair_attempts: {
    contact_makes_repairs: boolean;
    repair_style: "humor" | "affection" | "apology" | "topic_change" | "meta_communication";
    repair_examples: string[];
    repair_success_rate: string;
    user_repair_acceptance: string;
  };
  positive_sentiment_override: {
    present: boolean;
    direction: "positive_override" | "negative_override";
    evidence: Array<{
      user_message: string;
      contact_interpretation: string;
      override_type: string;
    }>;
  };
}

// ─── Section 4: Attachment (ECR-R Dimensional) ───────────────────────────────

export interface AttachmentDimension {
  score: number;             // 1.0–7.0
  confidence: number;        // 0.0–1.0
  behavioral_evidence: Array<{
    indicator: string;
    examples: string[];
    frequency: string;
  }>;
}

export interface AttachmentAnxiety extends AttachmentDimension {
  activation_moments: Array<{
    trigger: string;
    response: string;
    messages: string[];
  }>;
}

export interface AttachmentAvoidance extends AttachmentDimension {
  deactivation_moments: Array<{
    trigger: string;
    response: string;
    messages: string[];
  }>;
}

export type AttachmentStyle =
  | "secure"
  | "anxious_preoccupied"
  | "dismissive_avoidant"
  | "fearful_avoidant";

export interface AttachmentProfile {
  anxiety_dimension: AttachmentAnxiety;
  avoidance_dimension: AttachmentAvoidance;
  attachment_style_inference: {
    primary_style: AttachmentStyle;
    secondary_tendencies: string;
    style_stability: "consistent" | "context_dependent" | "shifting";
    confidence: number;
  };
  attachment_in_action: {
    when_feeling_close: string;
    when_feeling_threatened: string;
    when_partner_pulls_away: string;
    when_partner_moves_closer: string;
    evidence_for_each: {
      close: string[];
      threatened: string[];
      partner_pulls_away: string[];
      partner_moves_closer: string[];
    };
  };
}

// ─── Section 5: Emotional Trajectory (SEANCE / NRC) ─────────────────────────

export type PlutchikEmotion =
  | "joy" | "anger" | "sadness" | "fear"
  | "surprise" | "disgust" | "trust" | "anticipation";

export interface EmotionalSegment {
  segment_id: number;
  time_range: string;
  dominant_emotions: PlutchikEmotion[];
  emotional_intensity: number;   // 0.0–1.0
  valence: number;               // -1.0 to 1.0
  arousal: number;               // 0.0–1.0
  representative_messages: string[];
}

export interface EmotionalTrajectory {
  per_segment_emotions: EmotionalSegment[];
  emotional_volatility: {
    overall_volatility: "stable" | "moderate" | "volatile";
    largest_swing: {
      from: string;
      to: string;
      trigger: string;
      messages_around_swing: string[];
    };
  };
  emotional_decay_curve: {
    pre_breakup_trajectory: string;
    breakup_moment_emotions: string[];
    post_breakup_trajectory: string;
    current_inferred_state: string;
  };
}

// ─── Section 6: Defense Mechanisms (Perry DMRS-Adapted) ─────────────────────

export type DefenseMaturity = "mature" | "neurotic" | "immature";
export type DefenseFrequency = "rare" | "occasional" | "frequent" | "pervasive";

export interface DefenseMechanism {
  mechanism: string;
  maturity_level: DefenseMaturity;
  frequency: DefenseFrequency;
  what_they_defend_against: string;
  how_it_manifests_in_text: string;
  example_sequences: Array<{
    trigger_message: string;
    defensive_response: string;
    what_was_being_avoided: string;
  }>;
}

export interface DefenseProfile {
  observed_mechanisms: DefenseMechanism[];
  defensive_profile_summary: {
    primary_defense_style: string;
    overall_maturity: DefenseMaturity | "mixed";
    rigidity: "flexible" | "moderate" | "rigid";
    implications_for_simulation: string;
  };
}

// ─── Section 7: Manipulation / Dark Triad ────────────────────────────────────

export type ConcernLevel = "none" | "low" | "moderate" | "high";

export interface ManipulationPattern {
  pattern: string;
  mechanism: string;
  frequency: string;
  evidence: Array<{
    context: string;
    manipulative_message: string;
    intended_effect: string;
    actual_result: string;
  }>;
}

export interface ManipulationProfile {
  observed_patterns: ManipulationPattern[];
  safety_assessment: {
    concern_level: ConcernLevel;
    patterns_of_concern: string[];
    recommendation: string;
  };
}

// ─── Section 8: Behavioral States (Emergent) ─────────────────────────────────

export interface BehavioralState {
  state_name: string;
  trait_activation: {
    big_five_emphasis: string;
    attachment_activation: string;
    defenses_active: string[];
    gottman_horseman: string;
  };
  linguistic_signature: {
    message_length_pattern: string;
    emotional_tone: string;
    pronoun_shift: string;
    vocabulary_cluster: string;
    timing_pattern: string;
  };
  entry_triggers: string[];
  exit_triggers: string[];
  example_messages: string[];
  frequency_in_data: string;
}

export interface StateTransition {
  from: string;
  to: string;
  trigger: string;
  transition_speed: "instant" | "gradual";
  example: string[];
}

export interface BehavioralStates {
  discovered_states: BehavioralState[];
  state_transition_map: StateTransition[];
}

// ─── Dyadic Patterns (optional, v2 feature) ──────────────────────────────────

export interface DyadicPatterns {
  pursue_withdraw_cycles: {
    pursuer: "user" | "contact";
    withdrawer: "user" | "contact";
    cycle_examples: string[];
  };
  demand_withdraw_pattern: {
    present: boolean;
    demander: string;
    withdrawer: string;
  };
  emotional_co_regulation: {
    pattern: "co-regulate" | "de-regulate" | "independent";
    evidence: string[];
  };
  communication_style_mismatch: {
    mismatches: Array<{
      dimension: string;
      user_style: string;
      contact_style: string;
      friction_it_causes: string;
    }>;
  };
}

// ─── Full unified profile ─────────────────────────────────────────────────────

export interface UnifiedPsychProfile {
  meta: ProfileMeta;
  personality: PersonalityProfile;
  psycholinguistic: PsycholinguisticProfile;
  gottman_patterns: GottmanPatterns;
  attachment: AttachmentProfile;
  emotional_trajectory: EmotionalTrajectory;
  defenses: DefenseProfile;
  manipulation_patterns: ManipulationProfile;
  behavioral_states: BehavioralStates;
  /** Plain-English simulation brief. Max 1000 tokens. Fed directly into the simulation prompt. */
  simulation_brief: string;
  /** Optional: profile of the user (same structure) */
  user_profile?: Partial<UnifiedPsychProfile>;
  /** Optional: dyadic interaction patterns (v2) */
  dyadic_patterns?: DyadicPatterns;
}
