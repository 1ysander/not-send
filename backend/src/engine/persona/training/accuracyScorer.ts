/**
 * accuracyScorer — run simulation against holdout pairs to produce accuracy %.
 * Runs post-extraction, silently. Result stored on persona.accuracyScore.
 * No LLM for scoring itself — pure text similarity heuristics.
 */

import { defaultSimulator } from "../simulation/AnthropicSimulator.js";
import { detectContextSignals } from "../simulation/contextInjector.js";
import { personaStore, holdoutStore } from "../personaStore.js";
import type { PersonaProfile, AccuracyScore } from "../models/PersonaTypes.js";

interface HoldoutPair {
  userMessage: string;
  actualReply: string;
}

function wordSet(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = [...a].filter((w) => b.has(w)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function scoreLengthSimilarity(aiWords: number, actualWords: number): number {
  if (actualWords === 0) return 100;
  const ratio = aiWords / actualWords;
  // Within 50% = full score, degrades linearly
  if (ratio >= 0.5 && ratio <= 1.5) return 100;
  if (ratio < 0.5) return Math.max(0, ratio * 200);
  return Math.max(0, (3 - ratio) * 50);
}

async function scoreOnePair(
  persona: PersonaProfile,
  pair: HoldoutPair
): Promise<{ length: number; vocabulary: number }> {
  const history: Array<{ role: "user" | "assistant"; content: string }> = [
    { role: "user", content: pair.userMessage },
  ];

  const signals = detectContextSignals(history, persona.personaJson);

  let aiResponse = "";
  await defaultSimulator.generateResponse(
    persona,
    history,
    signals,
    (chunk) => { aiResponse += chunk; }
  );

  const aiWords = aiResponse.trim().split(/\s+/).length;
  const actualWords = pair.actualReply.trim().split(/\s+/).length;

  const lengthScore = scoreLengthSimilarity(aiWords, actualWords);
  const vocabScore = jaccardSimilarity(wordSet(aiResponse), wordSet(pair.actualReply)) * 100;

  return { length: Math.round(lengthScore), vocabulary: Math.round(vocabScore) };
}

export async function scorePersonaAccuracy(personaId: string): Promise<AccuracyScore | null> {
  const persona = personaStore.get(personaId);
  if (!persona) return null;

  const pairs = holdoutStore.get(personaId) ?? [];
  if (pairs.length === 0) return null;

  const sample = pairs.slice(0, 5); // Score on up to 5 pairs to control cost
  const scores: Array<{ length: number; vocabulary: number }> = [];

  for (const pair of sample) {
    try {
      const s = await scoreOnePair(persona, pair);
      scores.push(s);
    } catch {
      // Skip failed pairs
    }
  }

  if (scores.length === 0) return null;

  const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

  const breakdown = {
    length: avg(scores.map((s) => s.length)),
    vocabulary: avg(scores.map((s) => s.vocabulary)),
    tone: 70,   // Placeholder — Tier 2 will use a trained classifier
    style: 70,  // Placeholder — Tier 2 will use a trained classifier
  };

  const overall = Math.round(
    breakdown.length * 0.3 + breakdown.vocabulary * 0.3 + breakdown.tone * 0.2 + breakdown.style * 0.2
  );

  const result: AccuracyScore = { overall, breakdown };

  // Persist to persona
  persona.accuracyScore = overall;
  persona.updatedAt = Date.now();
  personaStore.set(personaId, persona);

  return result;
}

export function storeHoldoutPairs(
  personaId: string,
  pairs: Array<{ userMessage: string; targetReply: string }>
): void {
  holdoutStore.set(personaId, pairs.map((p) => ({
    userMessage: p.userMessage,
    actualReply: p.targetReply,
  })));
}
