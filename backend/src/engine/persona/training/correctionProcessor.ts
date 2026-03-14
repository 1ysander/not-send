/**
 * correctionProcessor — store user feedback on simulation quality.
 * Every correction is future Tier 2 training data.
 * Tracks accuracy stage progression (1→4) by correction count.
 */

import { personaStore, correctionStore } from "../personaStore.js";
import type { CorrectionRecord, CorrectionType } from "../models/PersonaTypes.js";

export interface CorrectionInput {
  personaId: string;
  userMessage: string;
  aiResponse: string;
  correctionType: CorrectionType;
  userAlternative?: string;
}

/** Store a correction. Returns updated accuracy stage. */
export function recordCorrection(input: CorrectionInput): { accuracyStage: 1 | 2 | 3 | 4 } {
  const persona = personaStore.get(input.personaId);
  if (!persona) throw new Error(`Persona ${input.personaId} not found`);

  const record: CorrectionRecord = {
    id: `corr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    personaId: input.personaId,
    userMessage: input.userMessage,
    aiResponse: input.aiResponse,
    correctionType: input.correctionType,
    userAlternative: input.userAlternative,
    createdAt: Date.now(),
  };

  // Append to correction store
  const existing = correctionStore.get(input.personaId) ?? [];
  existing.push(record);
  correctionStore.set(input.personaId, existing);

  // Update correction count and accuracy stage on persona
  const correctionCount = existing.filter((c) => c.correctionType !== "thumbs_up").length;
  const accuracyStage: 1 | 2 | 3 | 4 =
    correctionCount >= 30 ? 4
    : correctionCount >= 10 ? 3
    : correctionCount >= 1 ? 2
    : 1;

  persona.correctionCount = correctionCount;
  persona.accuracyStage = accuracyStage;
  persona.updatedAt = Date.now();
  personaStore.set(input.personaId, persona);

  return { accuracyStage };
}

/** Stage labels for UI display */
export const STAGE_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: "Learning style...",
  2: "Model calibrated",
  3: "Model refined",
  4: "Highly tuned",
};

export function getCorrections(personaId: string): CorrectionRecord[] {
  return correctionStore.get(personaId) ?? [];
}
