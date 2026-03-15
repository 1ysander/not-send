/**
 * unifiedExtractor — the single Groq pass that produces a full 9-section
 * psychological profile. Uses llama-3.3-70b-versatile (free tier, 128k context).
 *
 * One call per contact. Result stored on PersonaProfile.unifiedPsych.
 * Cost: $0 (Groq free tier, rate limited to 6000 TPM).
 *
 * Falls back gracefully if GROQ_API_KEY is not set (returns null).
 */

import { chatGroq, GROQ_EXTRACTION_MODEL } from "../../../ai/groq.js";
import { segmentConversation, formatSegmentsForPrompt } from "./conversationSegmenter.js";
import type { AttributedMessage } from "../models/PersonaTypes.js";
import type { UnifiedPsychProfile } from "../models/UnifiedPsychTypes.js";

const SYSTEM_PROMPT = `You are performing a comprehensive psychological analysis of a person based on their text message conversation data. You integrate multiple validated psychological frameworks to build a complete behavioral and psychological profile.

You are not diagnosing. You are identifying observable patterns in language and behavior, mapping them to established psychological constructs, and providing the evidence from the conversation data.

This profile will be used to create a realistic simulation of this person in text conversation. Every pattern you identify must be actionable — meaning it must tell us something about how this person would BEHAVE in a new conversation.

EVIDENCE CHAIN RULE: Framework claim → Linguistic indicator → Specific message(s) from data. If ANY link is missing, the claim does not exist.

CONTEXTUAL INTELLIGENCE: "Fine" after a conflict is NOT positive emotion. "Lol" after a tense message is NOT humor. "Whatever" is NOT agreement. Use context, not dictionary lookup.

THE GAPS ARE DATA: If someone NEVER uses positive emotion language in a romantic conversation, that IS the finding.

You output ONLY the JSON object. No commentary before or after. No markdown fences.`;

function buildExtractionPrompt(
  contactName: string,
  relationshipStatus: string,
  segmentedData: string,
  totalMessages: number
): string {
  return `Analyze this person's text messages and produce a complete psychological profile.

Contact name: ${contactName}
Relationship context: ${relationshipStatus}
Total messages in dataset: ${totalMessages}

CONVERSATION DATA (temporally segmented):
${segmentedData}

---

Produce a single JSON object with ALL of the following sections. For EVERY claim, provide message evidence from the data above.

If a section has insufficient data, include it with a "confidence": "insufficient_data" flag.

OUTPUT STRUCTURE:

{
  "meta": {
    "total_messages_analyzed": <number>,
    "contact_messages_analyzed": <number>,
    "date_range": "<string>",
    "data_quality": "sparse" | "moderate" | "rich",
    "overall_confidence": <0.0-1.0>
  },

  "personality": {
    "openness": { "score": <1.0-5.0>, "confidence": <0.0-1.0>, "linguistic_evidence": { "indicators_found": ["..."], "example_messages": ["..."] } },
    "conscientiousness": { "score": <1.0-5.0>, "confidence": <0.0-1.0>, "linguistic_evidence": { "indicators_found": ["..."], "example_messages": ["..."] } },
    "extraversion": { "score": <1.0-5.0>, "confidence": <0.0-1.0>, "linguistic_evidence": { "indicators_found": ["..."], "example_messages": ["..."] } },
    "agreeableness": { "score": <1.0-5.0>, "confidence": <0.0-1.0>, "linguistic_evidence": { "indicators_found": ["..."], "example_messages": ["..."] } },
    "neuroticism": { "score": <1.0-5.0>, "confidence": <0.0-1.0>, "linguistic_evidence": { "indicators_found": ["..."], "example_messages": ["..."] } }
  },

  "psycholinguistic": {
    "cognitive_complexity": {
      "analytical_thinking": "low" | "moderate" | "high",
      "causal_reasoning_frequency": "<description>",
      "insight_language": "<description>",
      "certainty_vs_tentativeness": "certain" | "balanced" | "tentative",
      "evidence": ["..."]
    },
    "social_orientation": {
      "self_focus": { "i_language_density": "low" | "moderate" | "high", "pattern": "<description>", "evidence": ["..."] },
      "other_focus": { "you_language_density": "low" | "moderate" | "high", "inquiry_about_partner": "rare" | "occasional" | "frequent", "evidence": ["..."] },
      "we_language": { "we_vs_i_ratio": "<description>", "contexts_where_we_appears": ["..."], "evidence": ["..."] }
    },
    "emotional_language": {
      "positive_emotion_density": "<description>",
      "negative_emotion_density": "<description>",
      "dominant_negative_emotion": "anxiety" | "anger" | "sadness" | "mixed",
      "emotional_range": "narrow" | "moderate" | "wide",
      "emotion_trajectory_across_conversation": [
        {"segment": "early", "dominant_tone": "<string>", "evidence": ["..."]},
        {"segment": "middle", "dominant_tone": "<string>", "evidence": ["..."]},
        {"segment": "late", "dominant_tone": "<string>", "evidence": ["..."]}
      ]
    },
    "authenticity_markers": {
      "overall_authenticity": "low" | "moderate" | "high",
      "contexts_where_authenticity_drops": ["..."],
      "evidence": ["..."]
    },
    "temporal_focus": {
      "dominant_temporal_orientation": "past" | "present" | "future" | "mixed",
      "past_references_context": "nostalgic" | "regretful" | "factual",
      "future_references_context": "hopeful" | "anxious" | "planning",
      "evidence": ["..."]
    }
  },

  "gottman_patterns": {
    "four_horsemen": {
      "criticism": { "frequency": "absent" | "rare" | "occasional" | "frequent", "examples": ["..."], "typical_trigger": "<string>", "who_initiates": "contact" | "user" | "both" },
      "contempt": { "frequency": "absent" | "rare" | "occasional" | "frequent", "style": "sarcasm" | "mockery" | "dismissiveness" | "hostile_humor", "examples": ["..."], "escalation_role": "<string>" },
      "defensiveness": { "frequency": "absent" | "rare" | "occasional" | "frequent", "style": "counter_attack" | "victimhood" | "denial" | "cross_complaining", "examples": ["..."], "response_to_what": "<string>" },
      "stonewalling": { "frequency": "absent" | "rare" | "occasional" | "frequent", "text_manifestation": "<string>", "duration_pattern": "<string>", "what_breaks_it": "<string>", "examples": ["..."] }
    },
    "repair_attempts": {
      "contact_makes_repairs": <boolean>,
      "repair_style": "humor" | "affection" | "apology" | "topic_change" | "meta_communication",
      "repair_examples": ["..."],
      "repair_success_rate": "<string>",
      "user_repair_acceptance": "<string>"
    },
    "positive_sentiment_override": {
      "present": <boolean>,
      "direction": "positive_override" | "negative_override",
      "evidence": [{"user_message": "...", "contact_interpretation": "...", "override_type": "..."}]
    }
  },

  "attachment": {
    "anxiety_dimension": {
      "score": <1.0-7.0>,
      "confidence": <0.0-1.0>,
      "behavioral_evidence": [{"indicator": "...", "examples": ["..."], "frequency": "..."}],
      "activation_moments": [{"trigger": "...", "response": "...", "messages": ["..."]}]
    },
    "avoidance_dimension": {
      "score": <1.0-7.0>,
      "confidence": <0.0-1.0>,
      "behavioral_evidence": [{"indicator": "...", "examples": ["..."], "frequency": "..."}],
      "deactivation_moments": [{"trigger": "...", "response": "...", "messages": ["..."]}]
    },
    "attachment_style_inference": {
      "primary_style": "secure" | "anxious_preoccupied" | "dismissive_avoidant" | "fearful_avoidant",
      "secondary_tendencies": "<string>",
      "style_stability": "consistent" | "context_dependent" | "shifting",
      "confidence": <0.0-1.0>
    },
    "attachment_in_action": {
      "when_feeling_close": "<string>",
      "when_feeling_threatened": "<string>",
      "when_partner_pulls_away": "<string>",
      "when_partner_moves_closer": "<string>",
      "evidence_for_each": {
        "close": ["..."],
        "threatened": ["..."],
        "partner_pulls_away": ["..."],
        "partner_moves_closer": ["..."]
      }
    }
  },

  "emotional_trajectory": {
    "per_segment_emotions": [
      {
        "segment_id": <N>,
        "time_range": "<string>",
        "dominant_emotions": ["joy" | "anger" | "sadness" | "fear" | "surprise" | "disgust" | "trust" | "anticipation"],
        "emotional_intensity": <0.0-1.0>,
        "valence": <-1.0 to 1.0>,
        "arousal": <0.0-1.0>,
        "representative_messages": ["..."]
      }
    ],
    "emotional_volatility": {
      "overall_volatility": "stable" | "moderate" | "volatile",
      "largest_swing": { "from": "<string>", "to": "<string>", "trigger": "<string>", "messages_around_swing": ["..."] }
    },
    "emotional_decay_curve": {
      "pre_breakup_trajectory": "<string>",
      "breakup_moment_emotions": ["..."],
      "post_breakup_trajectory": "<string>",
      "current_inferred_state": "<string>"
    }
  },

  "defenses": {
    "observed_mechanisms": [
      {
        "mechanism": "<name>",
        "maturity_level": "mature" | "neurotic" | "immature",
        "frequency": "rare" | "occasional" | "frequent" | "pervasive",
        "what_they_defend_against": "<string>",
        "how_it_manifests_in_text": "<string>",
        "example_sequences": [{"trigger_message": "...", "defensive_response": "...", "what_was_being_avoided": "..."}]
      }
    ],
    "defensive_profile_summary": {
      "primary_defense_style": "<string>",
      "overall_maturity": "mature" | "mixed" | "immature",
      "rigidity": "flexible" | "moderate" | "rigid",
      "implications_for_simulation": "<string>"
    }
  },

  "manipulation_patterns": {
    "observed_patterns": [
      {
        "pattern": "<string>",
        "mechanism": "<string>",
        "frequency": "<string>",
        "evidence": [{"context": "...", "manipulative_message": "...", "intended_effect": "...", "actual_result": "..."}]
      }
    ],
    "safety_assessment": {
      "concern_level": "none" | "low" | "moderate" | "high",
      "patterns_of_concern": ["..."],
      "recommendation": "<string>"
    }
  },

  "behavioral_states": {
    "discovered_states": [
      {
        "state_name": "<string>",
        "trait_activation": {
          "big_five_emphasis": "<string>",
          "attachment_activation": "<string>",
          "defenses_active": ["..."],
          "gottman_horseman": "<string>"
        },
        "linguistic_signature": {
          "message_length_pattern": "<string>",
          "emotional_tone": "<string>",
          "pronoun_shift": "<string>",
          "vocabulary_cluster": "<string>",
          "timing_pattern": "<string>"
        },
        "entry_triggers": ["..."],
        "exit_triggers": ["..."],
        "example_messages": ["..."],
        "frequency_in_data": "<string>"
      }
    ],
    "state_transition_map": [
      { "from": "<string>", "to": "<string>", "trigger": "<string>", "transition_speed": "instant" | "gradual", "example": ["..."] }
    ]
  },

  "simulation_brief": "<plain English simulation brief, max 1000 tokens. Cover: voice mechanics, personality expression, emotional patterns, relational behavior, defense patterns, behavioral states. Include 5-8 real message examples.>"
}`;
}

export async function runUnifiedExtraction(
  contactName: string,
  attributed: AttributedMessage[],
  relationshipStatus = "romantic partner / ex"
): Promise<UnifiedPsychProfile | null> {
  // Graceful no-op if Groq not configured
  if (!process.env.GROQ_API_KEY) {
    console.info("[unifiedExtractor] GROQ_API_KEY not set — skipping unified extraction");
    return null;
  }

  const segments = segmentConversation(attributed);
  if (segments.length === 0) {
    console.warn("[unifiedExtractor] No segments produced — insufficient message data");
    return null;
  }

  const segmentedData = formatSegmentsForPrompt(segments);
  const totalMessages = attributed.filter((m) => !m.isHoldout).length;

  const userMessage = buildExtractionPrompt(
    contactName,
    relationshipStatus,
    segmentedData,
    totalMessages
  );

  try {
    const { text } = await chatGroq({
      model: GROQ_EXTRACTION_MODEL,
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      maxTokens: 7000,
      temperature: 0.2,
    });

    const cleaned = text.replace(/```json?/gi, "").replace(/```/g, "").trim();

    // Handle cases where the model wraps output in extra text
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("No JSON object found in response");
    }

    const profile = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1)) as UnifiedPsychProfile;
    return profile;
  } catch (err) {
    console.error(
      "[unifiedExtractor] Failed to parse unified extraction response:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
