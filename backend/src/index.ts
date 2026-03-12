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

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT ?? 3001;

const CORS_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
];

const io = new SocketServer(server, {
  cors: { origin: CORS_ORIGINS, credentials: true },
});
setIO(io);

// CORS: allow app origin (Vite default)
app.use(
  cors({
    origin: CORS_ORIGINS,
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

server.listen(PORT, () => {
  console.log(`NOTSENT backend running at http://localhost:${PORT}`);
});
