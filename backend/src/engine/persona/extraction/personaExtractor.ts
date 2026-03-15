/**
 * personaExtractor — orchestrates the full extraction pipeline:
 * parse → stats → LLM extraction → store persona.
 */

import { detectFormat } from "../parser/formatDetector.js";
import { parseStructured } from "../parser/regexParser.js";
import { attributeMessages } from "../parser/senderDisambiguator.js";
import { llmAssistedParse } from "../parser/llmAssistedParser.js";
import { computeStatisticalProfile } from "./statisticalAnalyzer.js";
import { runExtractionCall } from "./extractionPrompt.js";
import { runUnifiedExtraction } from "./unifiedExtractor.js";
import { personaStore } from "../personaStore.js";
import type { PersonaProfile, AttributedMessage } from "../models/PersonaTypes.js";

export interface ExtractionInput {
  rawText: string;
  targetName: string;
  contactId?: string;
  userId?: string;
}

export interface ExtractionResult {
  persona: PersonaProfile;
  /** Messages reserved for accuracy testing — never used in extraction */
  holdoutPairs: Array<{ userMessage: string; targetReply: string }>;
  /** How many target messages were analyzed */
  messageCount: number;
  /** True if LLM-assisted parsing was used (needs user confirmation) */
  usedLlmParsing: boolean;
}

export async function extractPersona(input: ExtractionInput): Promise<ExtractionResult> {
  const { rawText, targetName, contactId, userId } = input;

  // Step 1: detect format
  const format = detectFormat(rawText);
  let attributed: AttributedMessage[];
  let usedLlmParsing = false;

  if (format === "UNSTRUCTURED_RAW") {
    // LLM-assisted fallback — caller must confirm result with user
    const llmParsed = await llmAssistedParse(rawText, targetName);
    attributed = llmParsed.map((m) => ({ ...m, isHoldout: false }));
    usedLlmParsing = true;
  } else {
    const parsed = parseStructured(rawText, format);
    const { messages } = attributeMessages(parsed, targetName);
    attributed = messages;
  }

  // Step 2: holdout split (already done in attributeMessages for structured, redo here for LLM path)
  if (usedLlmParsing) {
    const { messages, holdoutPairs: hp } = attributeMessages(attributed, targetName);
    attributed = messages;
  }

  // Re-run attribution to get holdout pairs properly
  const rawParsed = format !== "UNSTRUCTURED_RAW"
    ? parseStructured(rawText, format)
    : attributed;

  const { messages: finalMessages, holdoutPairs } = usedLlmParsing
    ? { messages: attributed, holdoutPairs: [] }
    : attributeMessages(rawParsed.map((m) => ({ ...m, role: "user" as const, isHoldout: false })), targetName);

  const messagesToUse = usedLlmParsing ? attributed : finalMessages;

  // Step 3: compute local stats
  const stats = computeStatisticalProfile(messagesToUse);

  // Step 4: run both extractions in parallel
  // - runExtractionCall: existing style/behavior extraction (uses configured AI provider)
  // - runUnifiedExtraction: deep psychological extraction (always uses Groq — free tier)
  const [personaJson, unifiedPsych] = await Promise.all([
    runExtractionCall(targetName, stats, messagesToUse),
    runUnifiedExtraction(targetName, messagesToUse),
  ]);

  // Step 5: store persona
  const now = Date.now();
  const persona: PersonaProfile = {
    id: `persona_${now}_${Math.random().toString(36).slice(2, 9)}`,
    userId,
    contactId,
    targetName,
    personaJson,
    personaVersion: "1.0",
    correctionCount: 0,
    accuracyStage: 1,
    ...(unifiedPsych != null && { unifiedPsych }),
    createdAt: now,
    updatedAt: now,
  };

  personaStore.set(persona.id, persona);

  return {
    persona,
    holdoutPairs: usedLlmParsing ? [] : holdoutPairs,
    messageCount: stats.totalTargetMessages,
    usedLlmParsing,
  };
}
