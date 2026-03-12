import { Router } from "express";
import { getStats } from "../engine/conversationEngine.js";

export const statsRoutes = Router();

statsRoutes.get("/stats", (_req, res) => {
  const { interceptionsCount, messagesNeverSentCount } = getStats();
  res.json({
    interceptionsCount,
    messagesNeverSentCount,
  });
});
