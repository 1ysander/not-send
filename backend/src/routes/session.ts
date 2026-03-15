import { Router } from "express";
import {
  createSession,
  getSession,
  setUserContext,
} from "../store.js";
import type { UserContext } from "../types.js";

export const sessionRoutes = Router();

sessionRoutes.post("/", async (req, res) => {
  const { messageAttempted, userContext, deviceId, userId } = req.body ?? {};
  if (typeof messageAttempted !== "string" || !messageAttempted.trim()) {
    res.status(400).json({ error: "messageAttempted is required" });
    return;
  }
  // userId (Supabase auth UUID) takes precedence; fall back to deviceId for dev/legacy
  const effectiveId: string | undefined =
    (typeof userId === "string" ? userId : undefined) ??
    (typeof deviceId === "string" ? deviceId : undefined);

  const uc: UserContext | undefined =
    userContext && typeof userContext === "object"
      ? {
          breakupSummary: userContext.breakupSummary,
          partnerName: userContext.partnerName,
        }
      : undefined;

  if (effectiveId && uc) {
    await setUserContext(effectiveId, uc);
  }

  try {
    const session = await createSession(messageAttempted.trim(), uc, effectiveId);
    res.status(201).json({ sessionId: session.id });
  } catch (err) {
    console.error("createSession error:", err);
    res.status(500).json({ error: "Failed to create session" });
  }
});

sessionRoutes.get("/:id", async (req, res) => {
  try {
    const session = await getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json(session);
  } catch (err) {
    console.error("getSession error:", err);
    res.status(500).json({ error: "Failed to fetch session" });
  }
});
