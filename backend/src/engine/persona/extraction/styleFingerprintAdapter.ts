/**
 * styleFingerprintAdapter — converts a full PersonaJSON into the compact
 * StyleFingerprint used in style engine prompts. Target output: < 500 tokens.
 */

import type { PersonaJSON } from "../models/PersonaTypes.js";
import type { StyleFingerprint } from "../models/StyleEngineTypes.js";

function mapCasing(cap: PersonaJSON["surfaceStyle"]["capitalization"]): StyleFingerprint["casing"] {
  switch (cap) {
    case "none": return "lowercase";
    case "minimal": return "mixed";
    case "standard": return "standard";
    case "proper": return "standard";
    default: return "standard";
  }
}

function mapDoubleText(
  freq: PersonaJSON["surfaceStyle"]["doubleTexting"]["frequency"]
): StyleFingerprint["double_text_frequency"] {
  if (freq === "never" || freq === "rare") return "never";
  if (freq === "always" || freq === "often") return "often";
  return "sometimes";
}

function mapAvgLength(len: PersonaJSON["surfaceStyle"]["avgMessageLength"]): number {
  switch (len) {
    case "short": return 6;
    case "medium": return 14;
    case "long": return 30;
    default: return 10;
  }
}

function mapConfrontation(
  style: PersonaJSON["conflictBehavior"]["fightStyle"]
): StyleFingerprint["confrontation_style"] {
  switch (style) {
    case "confrontational": return "direct";
    case "passive_aggressive": return "passive_aggressive";
    case "avoidant": case "shutdown": return "avoidant";
    case "solution_oriented": return "direct";
    default: return "avoidant";
  }
}

function mapAffection(em: PersonaJSON["emotionalPatterns"]): StyleFingerprint["affection_style"] {
  const avail = em.emotionalAvailability;
  if (avail === "low") return "minimal";
  const expr = em.affectionExpression.toLowerCase();
  if (expr.includes("playful") || expr.includes("teas")) return "playful";
  if (expr.includes("word") || expr.includes("say") || expr.includes("tell")) return "verbal";
  return "minimal";
}

function deriveHumorMarkers(vi: PersonaJSON["verbalIdentity"], d: PersonaJSON["defenseMechanisms"]): string[] {
  const markers: string[] = [];
  markers.push(vi.humorStyle);
  if (d.humorAsShield && d.humorAsShield !== "none" && d.humorAsShield.length < 60) {
    markers.push("humor_as_shield");
  }
  return markers.slice(0, 4);
}

function deriveGrammarQuirks(v: PersonaJSON["vocabulary"], s: PersonaJSON["surfaceStyle"]): string[] {
  const quirks: string[] = [];
  if (s.capitalization === "none") quirks.push("no_capitalization");
  if (s.punctuationStyle === "none") quirks.push("no_punctuation");
  if (s.doubleTexting.frequency !== "never") quirks.push("double_texts");
  quirks.push(...v.uniqueMisspellings.slice(0, 2));
  return quirks.slice(0, 5);
}

export function toStyleFingerprint(persona: PersonaJSON): StyleFingerprint {
  const s = persona.surfaceStyle;
  const v = persona.vocabulary;
  const e = persona.emojiProfile;
  const c = persona.conflictBehavior;
  const vi = persona.verbalIdentity;
  const d = persona.defenseMechanisms;
  const em = persona.emotionalPatterns;
  const cd = persona.conversationalDynamics;

  return {
    casing: mapCasing(s.capitalization),
    avg_message_length_words: mapAvgLength(s.avgMessageLength),
    punctuation_frequency: s.punctuationStyle,
    common_punctuation: [],  // derived from style notes — not directly available, keep empty
    emoji_usage: e.usageLevel,
    top_emojis: e.primaryEmojis.slice(0, 5),
    filler_words: v.fillerWords.slice(0, 6),
    slang_vocabulary: [...v.abbreviationsAlwaysUsed, ...v.slangTerms].slice(0, 8),
    double_text_frequency: mapDoubleText(s.doubleTexting.frequency),
    avg_response_time_pattern: "variable",  // not tracked statistically yet
    question_style: cd.questionAsking.toLowerCase().includes("direct") ? "direct"
      : cd.questionAsking.toLowerCase().includes("rhetorical") ? "rhetorical"
      : cd.questionAsking.toLowerCase().includes("avoid") ? "avoidant"
      : "rare",
    confrontation_style: mapConfrontation(c.fightStyle),
    affection_style: mapAffection(em),
    humor_markers: deriveHumorMarkers(vi, d),
    opening_patterns: cd.conversationStarters.slice(0, 4),
    closing_patterns: [...vi.signOffs, ...cd.conversationEnders].slice(0, 4),
    unique_phrases: [...vi.catchphrases, ...vi.reactionExpressions].slice(0, 6),
    grammar_quirks: deriveGrammarQuirks(v, s),
  };
}
