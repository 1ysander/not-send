import { Router } from "express";
import { getAllSessions, getConversationHistory } from "../store.js";
import { supabaseAdmin, supabaseEnabled } from "../lib/supabase.js";

export const statsRoutes = Router();

statsRoutes.get("/stats", async (req, res) => {
  const userId = req.query.userId as string | undefined;

  // Supabase path: query counts directly
  if (supabaseEnabled && supabaseAdmin && userId) {
    try {
      const [interceptedResult, notSentResult] = await Promise.all([
        supabaseAdmin
          .from("sessions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("outcome", "intercepted"),
        supabaseAdmin
          .from("sessions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .in("outcome", ["intercepted", "draft"]),
      ]);
      res.json({
        sessionCount: notSentResult.count ?? 0,
        totalMessages: notSentResult.count ?? 0,
        interceptionsCount: interceptedResult.count ?? 0,
        messagesNeverSentCount: notSentResult.count ?? 0,
      });
      return;
    } catch (err) {
      console.error("stats Supabase error:", err);
      res.status(500).json({ error: "Failed to fetch stats" });
      return;
    }
  }

  // In-memory fallback
  const sessions = await getAllSessions(userId);
  let totalMessages = 0;
  for (const session of sessions) {
    const history = await getConversationHistory(session.id);
    totalMessages += history.length;
  }
  res.json({ sessionCount: sessions.length, totalMessages });
});
