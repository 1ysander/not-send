import { Router } from "express";
import { getAllSessions, getConversationHistory } from "../store.js";

export const statsRoutes = Router();

statsRoutes.get("/stats", (_req, res) => {
  const sessions = getAllSessions();
  let totalMessages = 0;
  for (const session of sessions) {
    const history = getConversationHistory(session.id);
    totalMessages += history.length;
  }
  res.json({ sessionCount: sessions.length, totalMessages });
});
