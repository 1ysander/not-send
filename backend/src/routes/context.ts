import { Router } from "express";
import {
  setUserContext,
  getUserContext,
  setPartnerContext,
  getPartnerContext,
} from "../store.js";
import type { UserContext, PartnerContext } from "../types.js";

export const contextRoutes = Router();

contextRoutes.put("/user", (req, res) => {
  const { deviceId, userContext } = req.body ?? {};
  if (typeof deviceId !== "string" || !userContext || typeof userContext !== "object") {
    res.status(400).json({ error: "deviceId (string) and userContext (object) required" });
    return;
  }
  const uc: UserContext = {
    breakupSummary: userContext.breakupSummary,
    partnerName: userContext.partnerName,
  };
  setUserContext(deviceId, uc);
  res.json({ ok: true });
});

contextRoutes.get("/user", (req, res) => {
  const deviceId = req.query.deviceId;
  if (typeof deviceId !== "string") {
    res.status(400).json({ error: "deviceId query required" });
    return;
  }
  const ctx = getUserContext(deviceId);
  res.json(ctx ?? {});
});

contextRoutes.put("/partner", (req, res) => {
  const { deviceId, partnerContext } = req.body ?? {};
  if (typeof deviceId !== "string" || !partnerContext?.partnerName) {
    res.status(400).json({ error: "deviceId and partnerContext.partnerName required" });
    return;
  }
  const pc: PartnerContext = {
    partnerName: partnerContext.partnerName,
    sampleMessages: Array.isArray(partnerContext.sampleMessages)
      ? partnerContext.sampleMessages
      : undefined,
    relationshipMemory: partnerContext.relationshipMemory,
  };
  setPartnerContext(deviceId, pc);
  res.json({ ok: true });
});

contextRoutes.get("/partner", (req, res) => {
  const deviceId = req.query.deviceId;
  if (typeof deviceId !== "string") {
    res.status(400).json({ error: "deviceId query required" });
    return;
  }
  const ctx = getPartnerContext(deviceId);
  res.json(ctx ?? {});
});
