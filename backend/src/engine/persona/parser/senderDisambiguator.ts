/**
 * senderDisambiguator — attribute ParsedMessage[] to "target" | "user" | "other".
 * Also splits messages into active set + holdout set (20%).
 * No LLM calls.
 */

import type { ParsedMessage, AttributedMessage } from "../models/PersonaTypes.js";

const SELF_IDENTIFIERS = ["me", "you", "i", "myself", "self"];

function normalizeName(name: string): string {
  return name.toLowerCase().trim();
}

/** Fuzzy match: does candidateSender look like targetName? */
function isSenderMatch(candidateSender: string, targetName: string): boolean {
  const c = normalizeName(candidateSender);
  const t = normalizeName(targetName);

  if (c === t) return true;
  if (c.startsWith(t.slice(0, 3)) && t.length > 3) return true; // "sarah" matches "sar"
  if (t.startsWith(c) || c.startsWith(t)) return true;

  // Initial match: "S" matches "Sarah"
  if (c.length === 1 && t.startsWith(c)) return true;

  return false;
}

function isSelfIdentifier(sender: string): boolean {
  return SELF_IDENTIFIERS.includes(normalizeName(sender));
}

export interface DisambiguationResult {
  messages: AttributedMessage[];
  holdoutPairs: Array<{ userMessage: string; targetReply: string }>;
  uniqueSenders: string[];
}

export function attributeMessages(
  messages: ParsedMessage[],
  targetName: string
): DisambiguationResult {
  const uniqueSenders = [...new Set(messages.map((m) => m.sender))];

  // Attribute each message
  const attributed: AttributedMessage[] = messages.map((m) => {
    let role: AttributedMessage["role"];

    if (isSenderMatch(m.sender, targetName)) {
      role = "target";
    } else if (isSelfIdentifier(m.sender)) {
      role = "user";
    } else if (uniqueSenders.length === 2) {
      // Two-person chat: non-target is always user
      role = "user";
    } else {
      role = "other";
    }

    return { ...m, role, isHoldout: false };
  });

  // Build conversation pairs (user → target reply) for holdout sampling
  const pairs: Array<{ userMessage: string; targetReply: string }> = [];
  for (let i = 0; i < attributed.length - 1; i++) {
    if (attributed[i].role === "user" && attributed[i + 1].role === "target") {
      pairs.push({
        userMessage: attributed[i].text,
        targetReply: attributed[i + 1].text,
      });
    }
  }

  // Reserve 20% as holdout — evenly spaced
  const holdoutCount = Math.max(1, Math.floor(pairs.length * 0.2));
  const step = Math.floor(pairs.length / holdoutCount);
  const holdoutPairs: Array<{ userMessage: string; targetReply: string }> = [];

  for (let i = 0; i < holdoutCount; i++) {
    const idx = i * step;
    if (pairs[idx]) holdoutPairs.push(pairs[idx]);
  }

  // Mark holdout messages in attributed array
  const holdoutReplies = new Set(holdoutPairs.map((p) => p.targetReply));
  const result = attributed.map((m) => ({
    ...m,
    isHoldout: m.role === "target" && holdoutReplies.has(m.text),
  }));

  return { messages: result, holdoutPairs, uniqueSenders };
}
