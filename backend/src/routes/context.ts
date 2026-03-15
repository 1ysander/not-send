import { Router } from "express";
import {
  setUserContext,
  getUserContext,
  setPartnerContext,
  getPartnerContext,
} from "../store.js";
import type { UserContext, PartnerContext } from "../types.js";

export const contextRoutes = Router();

contextRoutes.put("/user", async (req, res) => {
  const { deviceId, userId, userContext } = req.body ?? {};
  const effectiveId = (typeof userId === "string" ? userId : undefined) ??
    (typeof deviceId === "string" ? deviceId : undefined);
  if (!effectiveId || !userContext || typeof userContext !== "object") {
    res.status(400).json({ error: "userId (or deviceId) and userContext (object) required" });
    return;
  }
  const uc: UserContext = {
    breakupSummary: userContext.breakupSummary,
    partnerName: userContext.partnerName,
    noContactDays: userContext.noContactDays,
    conversationContext: userContext.conversationContext,
  };
  try {
    await setUserContext(effectiveId, uc);
    res.json({ ok: true });
  } catch (err) {
    console.error("setUserContext error:", err);
    res.status(500).json({ error: "Failed to save user context" });
  }
});

contextRoutes.get("/user", async (req, res) => {
  const id = (req.query.userId ?? req.query.deviceId) as string | undefined;
  if (!id) {
    res.status(400).json({ error: "userId (or deviceId) query param required" });
    return;
  }
  try {
    const ctx = await getUserContext(id);
    res.json(ctx ?? {});
  } catch (err) {
    console.error("getUserContext error:", err);
    res.status(500).json({ error: "Failed to fetch user context" });
  }
});

contextRoutes.put("/partner", async (req, res) => {
  const { deviceId, userId, partnerContext } = req.body ?? {};
  const effectiveId = (typeof userId === "string" ? userId : undefined) ??
    (typeof deviceId === "string" ? deviceId : undefined);
  if (!effectiveId || !partnerContext?.partnerName) {
    res.status(400).json({ error: "userId (or deviceId) and partnerContext.partnerName required" });
    return;
  }
  const pc: PartnerContext = {
    partnerName: partnerContext.partnerName,
    sampleMessages: Array.isArray(partnerContext.sampleMessages)
      ? partnerContext.sampleMessages
      : undefined,
    relationshipMemory: partnerContext.relationshipMemory,
  };
  try {
    await setPartnerContext(effectiveId, pc);
    res.json({ ok: true });
  } catch (err) {
    console.error("setPartnerContext error:", err);
    res.status(500).json({ error: "Failed to save partner context" });
  }
});

contextRoutes.get("/partner", async (req, res) => {
  const id = (req.query.userId ?? req.query.deviceId) as string | undefined;
  if (!id) {
    res.status(400).json({ error: "userId (or deviceId) query param required" });
    return;
  }
  try {
    const ctx = await getPartnerContext(id);
    res.json(ctx ?? {});
  } catch (err) {
    console.error("getPartnerContext error:", err);
    res.status(500).json({ error: "Failed to fetch partner context" });
  }
});
