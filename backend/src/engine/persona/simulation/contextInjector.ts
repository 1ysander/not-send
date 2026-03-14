/**
 * contextInjector — detect topic, emotional temperature, and active mode
 * from conversation history. Heuristic-only, no LLM. Called before each turn.
 */

import type { PersonaJSON } from "../models/PersonaTypes.js";
import type { ContextSignals, ConversationTopic, EmotionalTemperature } from "../models/ContextSignals.js";

type Message = { role: "user" | "assistant"; content: string };

const TOPIC_KEYWORDS: Record<ConversationTopic, string[]> = {
  planning:       ["tonight", "tomorrow", "weekend", "plans", "let's", "wanna", "want to", "free"],
  emotional:      ["feel", "feeling", "sad", "hurt", "miss", "love", "hate", "scared", "anxious", "crying", "upset"],
  logistical:     ["when", "where", "time", "address", "pick up", "drop off", "send me", "can you"],
  flirting:       ["cute", "hot", "beautiful", "gorgeous", "thinking about you", "miss you", "kiss", "babe"],
  arguing:        ["always", "never", "you don't", "you never", "stop", "that's not fair", "why do you", "every time"],
  banter:         ["lol", "lmao", "haha", "omg", "no way", "shut up", "seriously", "dead 💀"],
  support_seeking:["hard time", "stressed", "struggling", "going through", "don't know what to do", "can't handle"],
  catching_up:    ["how are you", "what's up", "been a while", "haven't talked", "how have you been", "what's new"],
  unknown:        [],
};

const HEATED_WORDS = ["always", "never", "hate", "sick of", "stop", "leave me alone", "whatever", "fine"];
const WARM_WORDS = ["love", "miss", "care", "babe", "baby", "so happy", "glad", "❤️", "🥰", "😍"];

function detectTopic(messages: Message[]): ConversationTopic {
  const recent = messages.slice(-6).map((m) => m.content.toLowerCase()).join(" ");

  let bestTopic: ConversationTopic = "unknown";
  let bestScore = 0;

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS) as [ConversationTopic, string[]][]) {
    if (topic === "unknown") continue;
    const score = keywords.reduce((acc, kw) => acc + (recent.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; bestTopic = topic; }
  }

  return bestTopic;
}

function detectTemperature(messages: Message[]): EmotionalTemperature {
  const recent = messages.slice(-4).map((m) => m.content).join(" ");
  const lower = recent.toLowerCase();

  const heatedScore = HEATED_WORDS.reduce((acc, w) => acc + (lower.includes(w) ? 1 : 0), 0);
  const warmScore = WARM_WORDS.reduce((acc, w) => acc + (lower.includes(w) ? 1 : 0), 0);

  // Check for exclamation spam (heated signal)
  const exclamations = (recent.match(/!/g) ?? []).length;

  if (heatedScore >= 2 || exclamations >= 3) return "heated";
  if (warmScore >= 2) return "warm";

  // Short clipped responses = cold
  const avgLength = messages.slice(-3).reduce((a, m) => a + m.content.length, 0) / 3;
  if (avgLength < 15 && messages.length > 3) return "cold";

  return "neutral";
}

function detectActiveMode(messages: Message[], persona: PersonaJSON): string | null {
  const recentText = messages.slice(-4).map((m) => m.content.toLowerCase()).join(" ");

  for (const mode of persona.contextDependentModes) {
    const triggerWords = mode.trigger.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 3);
    const matches = triggerWords.filter((w) => recentText.includes(w)).length;
    if (matches >= 2) return mode.modeName;
  }

  return null;
}

export function detectContextSignals(
  messages: Message[],
  persona: PersonaJSON
): ContextSignals {
  return {
    topic: detectTopic(messages),
    emotionalTemperature: detectTemperature(messages),
    activeMode: detectActiveMode(messages, persona),
  };
}
