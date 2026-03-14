/**
 * personaStore — in-memory stores for dev/MVP.
 * Replace with Supabase queries when the persona tables migration runs.
 * All maps keyed by personaId.
 */

import type { PersonaProfile, CorrectionRecord } from "./models/PersonaTypes.js";

/** Primary persona storage: personaId → PersonaProfile */
export const personaStore = new Map<string, PersonaProfile>();

/** Per-persona corrections: personaId → CorrectionRecord[] */
export const correctionStore = new Map<string, CorrectionRecord[]>();

/** Per-persona holdout pairs: personaId → { userMessage, actualReply }[] */
export const holdoutStore = new Map<string, Array<{ userMessage: string; actualReply: string }>>();

/** Per-contact index: contactId → personaId (one active persona per contact) */
export const contactPersonaIndex = new Map<string, string>();

export function getPersonaByContact(contactId: string): PersonaProfile | undefined {
  const personaId = contactPersonaIndex.get(contactId);
  if (!personaId) return undefined;
  return personaStore.get(personaId);
}

export function getPersonaById(personaId: string): PersonaProfile | undefined {
  return personaStore.get(personaId);
}

export function listPersonas(): PersonaProfile[] {
  return [...personaStore.values()];
}
