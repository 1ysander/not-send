import http from "http";
import express from "express";
import cors from "cors";
import { Server as SocketServer } from "socket.io";

import { setIO } from "./socket.js";
import { sessionRoutes } from "./routes/session.js";
import { statsRoutes } from "./routes/stats.js";
import { chatRoutes } from "./routes/chat.js";
import { contextRoutes } from "./routes/context.js";
import { engineRoutes } from "./routes/engine.js";
import { parseRoutes } from "./routes/parse.js";
import { personaRoutes } from "./routes/persona.js";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT ?? 3001;

// Allow any localhost/127.0.0.1 origin in dev (Vite picks a free port each run)
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

const io = new SocketServer(server, {
  cors: { origin: isAllowedOrigin, credentials: true },
});
setIO(io);

// CORS: allow any localhost origin (Vite port varies)
app.use(
  cors({
    origin: isAllowedOrigin,
    credentials: true,
  })
);

// Rate limit: 20 req/min per IP (simple in-memory)
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
app.use("/api/engine", engineRoutes);
app.use("/api/parse-imessage", parseRoutes);
app.use("/api/persona", personaRoutes);

server.listen(PORT, () => {
  console.log(`NOTSENT backend running at http://localhost:${PORT}`);
});
