import { Router } from "express";
import { getStats } from "../store.js";

export const statsRoutes = Router();

statsRoutes.get("/stats", (_req, res) => {
  const { interceptionsCount, messagesNeverSentCount } = getStats();
  res.json({ interceptionsCount, messagesNeverSentCount });
});
