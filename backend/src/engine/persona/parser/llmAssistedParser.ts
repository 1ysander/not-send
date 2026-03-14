/**
 * llmAssistedParser — parse unstructured raw text using LLM.
 * Only called for UNSTRUCTURED_RAW format when regex parsing fails.
 * One non-streaming call. Result must be confirmed by user before proceeding.
 */

import { chat } from "../../../ai/model.js";
import type { AttributedMessage } from "../models/PersonaTypes.js";

interface RawParsedMessage {
  sender: string;
  text: string;
}

export async function llmAssistedParse(
  rawText: string,
  targetName: string
): Promise<AttributedMessage[]> {
  const truncated = rawText.slice(0, 3000);

  const systemPrompt = `You are a conversation parser. Your only job is to parse raw text into structured JSON. Return ONLY a valid JSON array — no markdown, no explanation, no code fences.`;

  const userMessage = `Parse this conversation text into structured messages.
The target person is "${targetName}".

Raw text:
${truncated}

Output a JSON array where each element has:
- "sender": "${targetName}" for the target person, or "User" for the other person
- "text": the message content (verbatim)

Determine sender from: conversational flow, style differences between speakers,
question/answer patterns, and any context clues ("Delivered", "Read" markers).

Return ONLY the JSON array.`;

  const { text } = await chat({
    systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 2000,
  });

  let parsed: RawParsedMessage[];
  try {
    // Strip any accidental markdown fences
    const cleaned = text.replace(/```json?/gi, "").replace(/```/g, "").trim();
    parsed = JSON.parse(cleaned) as RawParsedMessage[];
  } catch {
    console.error("[llmAssistedParser] Failed to parse LLM JSON response:", text.slice(0, 200));
    return [];
  }

  return parsed.map((m) => ({
    sender: m.sender,
    text: m.text,
    role: m.sender === targetName ? "target" : "user" as "target" | "user",
    isHoldout: false,
  }));
}
