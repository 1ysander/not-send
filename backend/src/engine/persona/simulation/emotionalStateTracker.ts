/**
 * emotionalStateTracker — detect per-turn emotional state from conversation history.
 * Heuristic-only. Tracks mood, unresolved tensions, and active threads.
 * Updated after each turn; result is passed into the style enforcer prompt.
 */

import type { PersonaJSON } from "../models/PersonaTypes.js";
import type { EmotionalState } from "../models/StyleEngineTypes.js";

type Message = { role: "user" | "assistant"; content: string };

// ─── User mood detection ─────────────────────────────────────────────────────

const USER_MOOD_SIGNALS: Record<string, string[]> = {
  nostalgic:  ["remember when", "used to", "miss those", "back when", "i miss"],
  desperate:  ["please", "i need you", "don't do this", "come back", "i'm begging"],
  angry:      ["fuck", "hate", "sick of", "done with", "unbelievable", "always do this"],
  sad:        ["crying", "tears", "hurts", "heartbroken", "can't stop thinking", "why"],
  hopeful:    ["maybe we", "could we", "what if we", "i've been thinking", "do you think"],
  testing:    ["do you even", "did you miss", "have you thought", "do you care"],
  casual:     ["lol", "haha", "anyway", "so what's up", "just checking"],
};

function detectUserMood(messages: Message[]): string {
  const recentUser = messages
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content.toLowerCase())
    .join(" ");

  for (const [mood, signals] of Object.entries(USER_MOOD_SIGNALS)) {
    if (signals.some((s) => recentUser.includes(s))) return mood;
  }
  return "neutral";
}

// ─── Persona mood inference ──────────────────────────────────────────────────

function inferPersonaMood(
  messages: Message[],
  persona: PersonaJSON,
  previousMood: string
): string {
  const recentAssistant = messages
    .filter((m) => m.role === "assistant")
    .slice(-3)
    .map((m) => m.content.toLowerCase())
    .join(" ");

  const temp = detectTemperature(messages);

  if (temp === "heated") return "defensive";
  if (temp === "warm") {
    // Check for emotional availability
    if (persona.emotionalPatterns.emotionalAvailability === "low") return "guarded_but_present";
    return "open";
  }
  if (temp === "cold") return "withdrawn";

  // Detect deflection markers
  const deflectors = persona.defenseMechanisms.minimizingPhrases;
  if (deflectors.some((p) => recentAssistant.includes(p.toLowerCase()))) {
    return "deflecting";
  }

  // Default: carry forward previous mood with slight drift
  const neutralMoods = ["neutral", "present", "measured"];
  if (neutralMoods.includes(previousMood)) return previousMood;
  return "neutral";
}

function detectTemperature(messages: Message[]): "cold" | "neutral" | "warm" | "heated" {
  const recent = messages.slice(-4).map((m) => m.content).join(" ").toLowerCase();
  const heatedWords = ["always", "never", "hate", "stop", "sick of", "whatever", "fine"];
  const warmWords = ["love", "miss", "care", "babe", "baby", "❤️", "🥰"];

  const heatedScore = heatedWords.filter((w) => recent.includes(w)).length;
  const warmScore = warmWords.filter((w) => recent.includes(w)).length;
  const exclamations = (recent.match(/!/g) ?? []).length;

  if (heatedScore >= 2 || exclamations >= 3) return "heated";
  if (warmScore >= 2) return "warm";

  const avgLen = messages.slice(-3).reduce((a, m) => a + m.content.length, 0) / 3;
  if (avgLen < 15 && messages.length > 3) return "cold";
  return "neutral";
}

// ─── Tension / thread detection ──────────────────────────────────────────────

const TENSION_TOPICS: Record<string, string[]> = {
  "the breakup":     ["broke up", "break up", "ended things", "it's over", "we're done"],
  "communication":   ["never listen", "don't hear me", "you don't respond", "leaving me on read"],
  "trust":           ["lie", "lied", "cheat", "behind my back", "can't trust"],
  "the future":      ["what are we", "where is this going", "us in the future", "be together"],
  "space/distance":  ["need space", "too much", "distance", "suffocating"],
  "jealousy":        ["who is", "were you with", "why were you", "saw you", "jealous"],
};

function detectUnresolvedTensions(messages: Message[], previous: string[]): string[] {
  const allText = messages.map((m) => m.content.toLowerCase()).join(" ");
  const found: string[] = [];

  for (const [topic, signals] of Object.entries(TENSION_TOPICS)) {
    if (signals.some((s) => allText.includes(s))) {
      found.push(topic);
    }
  }

  // Merge with previous unresolved tensions (topics persist unless explicitly resolved)
  const merged = [...new Set([...previous, ...found])];
  return merged.slice(0, 4);
}

function detectActiveThreads(messages: Message[]): string[] {
  const recent = messages.slice(-6).map((m) => m.content.toLowerCase()).join(" ");
  const threads: string[] = [];

  if (recent.match(/\?/g)?.length ?? 0 >= 2) threads.push("unanswered_questions");
  if (recent.includes("remember") || recent.includes("used to")) threads.push("reminiscing");
  if (recent.includes("now") || recent.includes("tonight") || recent.includes("today")) {
    threads.push("present_moment_focus");
  }
  if (recent.includes("us") || recent.includes("we ") || recent.includes("our")) {
    threads.push("relationship_identity");
  }

  return threads.slice(0, 3);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function detectEmotionalState(
  messages: Message[],
  persona: PersonaJSON,
  previous?: EmotionalState
): EmotionalState {
  const previousMood = previous?.simulatedPersonMood ?? "neutral";
  const previousTensions = previous?.unresolvedTensions ?? [];

  return {
    simulatedPersonMood: inferPersonaMood(messages, persona, previousMood),
    userMood: detectUserMood(messages),
    unresolvedTensions: detectUnresolvedTensions(messages, previousTensions),
    activeEmotionalThreads: detectActiveThreads(messages),
  };
}
