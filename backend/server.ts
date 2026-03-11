/**
 * NOTSENT backend entry — Express app with session, chat, stats, context API.
 * Uses engine and routes; API behavior unchanged.
 */

import express from "express";
import cors from "cors";
import { sessionRoutes } from "./src/routes/session.js";
import { statsRoutes } from "./src/routes/stats.js";
import { chatRoutes } from "./src/routes/chat.js";
import { contextRoutes } from "./src/routes/context.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
    ],
    credentials: true,
  })
);

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;

function rateLimitMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const ip = (req.ip ?? req.socket.remoteAddress ?? "unknown").toString();
  const now = Date.now();
  let entry = rateLimit.get(ip);
  if (!entry) {
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateLimit.set(ip, entry);
  }
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_WINDOW_MS;
  }
  entry.count++;
  if (entry.count > RATE_MAX) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }
  next();
}

app.use(express.json());
app.use(rateLimitMiddleware);

app.get("/health", (_req, res) => {
  res.json({ status: "OK", api: "notsent" });
});
app.get("/api/health", (_req, res) => {
  res.json({ status: "OK", api: "notsent" });
});

app.use("/api/session", sessionRoutes);
app.use("/api", statsRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/context", contextRoutes);

app.listen(PORT, () => {
  console.log(`NOTSENT backend running at http://localhost:${PORT}`);
});
