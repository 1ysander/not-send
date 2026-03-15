/**
 * Persona engine public API — everything routes need, nothing they don't.
 */

export { extractPersona } from "./extraction/personaExtractor.js";
export { defaultSimulator } from "./simulation/AnthropicSimulator.js";
export { detectContextSignals } from "./simulation/contextInjector.js";
export { generateCalibrationPairs } from "./training/calibrationGenerator.js";
export { recordCorrection, getCorrections, STAGE_LABELS } from "./training/correctionProcessor.js";
export { scorePersonaAccuracy, storeHoldoutPairs } from "./training/accuracyScorer.js";
export { personaStore, getPersonaByContact, getPersonaById, contactPersonaIndex } from "./personaStore.js";

export type { PersonaProfile, PersonaJSON, SimulatedResponse, CorrectionType, CalibrationPair, AccuracyScore } from "./models/PersonaTypes.js";
export type { ContextSignals } from "./models/ContextSignals.js";
export type { PersonaSimulator } from "./simulation/PersonaSimulator.js";
export type { UnifiedPsychProfile } from "./models/UnifiedPsychTypes.js";
export { runUnifiedExtraction } from "./extraction/unifiedExtractor.js";
