import { Router } from "express";
import {
  createSession,
  getSession,
  setUserContext,
} from "../store.js";
import type { UserContext } from "../types.js";

export const sessionRoutes = Router();

sessionRoutes.post("/", (req, res) => {
  const { messageAttempted, userContext, deviceId } = req.body ?? {};
  if (typeof messageAttempted !== "string" || !messageAttempted.trim()) {
    res.status(400).json({ error: "messageAttempted is required" });
    return;
  }
  const uc: UserContext | undefined =
    userContext && typeof userContext === "object"
      ? {
          breakupSummary: userContext.breakupSummary,
          partnerName: userContext.partnerName,
        }
      : undefined;
  if (deviceId && typeof deviceId === "string" && uc) {
    setUserContext(deviceId, uc);
  }
  const session = createSession(messageAttempted.trim(), uc, deviceId);
  res.status(201).json({ sessionId: session.id });
});


sessionRoutes.get("/:id", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});
