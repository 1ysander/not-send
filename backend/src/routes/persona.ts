/**
 * /api/persona — persona extraction, simulation, calibration, and feedback routes.
 *
 * POST /api/persona/extract        — upload raw text → extract persona
 * POST /api/persona/simulate       — one chat turn in the persona's voice (SSE stream)
 * GET  /api/persona/:id            — get persona profile
 * GET  /api/persona/contact/:cid   — get persona by contactId
 * POST /api/persona/:id/calibrate  — generate A/B calibration pairs
 * POST /api/persona/:id/correct    — record user feedback on a simulation turn
 * GET  /api/persona/:id/score      — run holdout accuracy test
 */

import { Router } from "express";
import {
  extractPersona,
  defaultSimulator,
  detectContextSignals,
  generateCalibrationPairs,
  recordCorrection,
  getCorrections,
  scorePersonaAccuracy,
  storeHoldoutPairs,
  getPersonaById,
  getPersonaByContact,
  contactPersonaIndex,
  STAGE_LABELS,
} from "../engine/persona/index.js";

export const personaRoutes = Router();

// ─── POST /api/persona/extract ───────────────────────────────────────────────

personaRoutes.post("/extract", async (req, res) => {
  const { rawText, targetName, contactId, userId } = req.body ?? {};

  if (typeof rawText !== "string" || !rawText.trim()) {
    res.status(400).json({ error: "rawText (string) is required" });
    return;
  }
  if (typeof targetName !== "string" || !targetName.trim()) {
    res.status(400).json({ error: "targetName (string) is required" });
    return;
  }

  try {
    const result = await extractPersona({ rawText, targetName, contactId, userId });

    // Index by contactId if provided
    if (contactId) contactPersonaIndex.set(contactId, result.persona.id);

    // Store holdout pairs for accuracy testing
    if (result.holdoutPairs.length > 0) {
      storeHoldoutPairs(result.persona.id, result.holdoutPairs);
    }

    res.json({
      personaId: result.persona.id,
      targetName: result.persona.targetName,
      messageCount: result.messageCount,
      accuracyStage: result.persona.accuracyStage,
      stageLabel: STAGE_LABELS[result.persona.accuracyStage],
      usedLlmParsing: result.usedLlmParsing,
      /** If usedLlmParsing=true, caller must show parsed result to user for confirmation */
      requiresConfirmation: result.usedLlmParsing,
    });
  } catch (err) {
    console.error("[persona/extract]", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── POST /api/persona/simulate (SSE) ────────────────────────────────────────

personaRoutes.post("/simulate", async (req, res) => {
  const { personaId, contactId, messages } = req.body ?? {};

  const persona = personaId
    ? getPersonaById(personaId)
    : contactId
    ? getPersonaByContact(contactId)
    : undefined;

  if (!persona) {
    res.status(404).json({ error: "Persona not found. Extract one first." });
    return;
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages (array) is required" });
    return;
  }

  const history = messages.filter(
    (m: unknown) => m && typeof m === "object" &&
      (m as { role?: string }).role === "user" || (m as { role?: string }).role === "assistant"
  ) as Array<{ role: "user" | "assistant"; content: string }>;

  const signals = detectContextSignals(history, persona.personaJson);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const result = await defaultSimulator.generateResponse(
      persona,
      history,
      signals,
      (chunk) => res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`)
    );

    // Signal double-text splits to frontend
    if (result.messages.length > 1) {
      res.write(`data: ${JSON.stringify({ splits: result.messages })}\n\n`);
    }
  } catch (err) {
    console.error("[persona/simulate]", err);
    res.write(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
  }

  res.write("data: [DONE]\n\n");
  res.end();
});

// ─── GET /api/persona/:id ─────────────────────────────────────────────────────

personaRoutes.get("/:id", (req, res) => {
  const persona = getPersonaById(req.params.id);
  if (!persona) { res.status(404).json({ error: "Persona not found" }); return; }

  res.json({
    id: persona.id,
    targetName: persona.targetName,
    accuracyStage: persona.accuracyStage,
    stageLabel: STAGE_LABELS[persona.accuracyStage],
    accuracyScore: persona.accuracyScore,
    correctionCount: persona.correctionCount,
    personaVersion: persona.personaVersion,
    createdAt: persona.createdAt,
    updatedAt: persona.updatedAt,
  });
});

// ─── GET /api/persona/contact/:contactId ─────────────────────────────────────

personaRoutes.get("/contact/:contactId", (req, res) => {
  const persona = getPersonaByContact(req.params.contactId);
  if (!persona) { res.status(404).json({ error: "No persona for this contact" }); return; }

  res.json({
    id: persona.id,
    targetName: persona.targetName,
    accuracyStage: persona.accuracyStage,
    stageLabel: STAGE_LABELS[persona.accuracyStage],
    accuracyScore: persona.accuracyScore,
    correctionCount: persona.correctionCount,
  });
});

// ─── POST /api/persona/:id/calibrate ─────────────────────────────────────────

personaRoutes.post("/:id/calibrate", async (req, res) => {
  const persona = getPersonaById(req.params.id);
  if (!persona) { res.status(404).json({ error: "Persona not found" }); return; }

  try {
    const pairs = await generateCalibrationPairs(persona.personaJson);
    res.json({ pairs });
  } catch (err) {
    console.error("[persona/calibrate]", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── POST /api/persona/:id/correct ───────────────────────────────────────────

personaRoutes.post("/:id/correct", (req, res) => {
  const { userMessage, aiResponse, correctionType, userAlternative } = req.body ?? {};

  if (!userMessage || !aiResponse || !correctionType) {
    res.status(400).json({ error: "userMessage, aiResponse, correctionType are required" });
    return;
  }

  try {
    const { accuracyStage } = recordCorrection({
      personaId: req.params.id,
      userMessage,
      aiResponse,
      correctionType,
      userAlternative,
    });

    res.json({
      recorded: true,
      accuracyStage,
      stageLabel: STAGE_LABELS[accuracyStage],
    });
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

// ─── GET /api/persona/:id/score ───────────────────────────────────────────────

personaRoutes.get("/:id/score", async (req, res) => {
  try {
    const score = await scorePersonaAccuracy(req.params.id);
    if (!score) {
      res.status(404).json({ error: "No holdout data available for scoring" });
      return;
    }
    res.json(score);
  } catch (err) {
    console.error("[persona/score]", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── GET /api/persona/:id/corrections ────────────────────────────────────────

personaRoutes.get("/:id/corrections", (req, res) => {
  const corrections = getCorrections(req.params.id);
  res.json({ count: corrections.length, corrections });
});
