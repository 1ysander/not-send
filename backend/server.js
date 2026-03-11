import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
const PORT = process.env.PORT || 3001;

// Consistent API error response
function sendError(res, status, message, code = null) {
  const body = code ? { error: message, code } : { error: message };
  res.status(status).json(body);
}

const SYSTEM_PROMPT_TEMPLATE = `You are a calm, non-judgmental AI that intercepts messages people are about to send their ex. The user was about to send a message. Start by saying something like "Hey, are you sure you're going to do this?" and acknowledge what they were going to say. Frame the conversation as a journey of self-help: you're here to support them, not to judge. Gently help them consider: what outcome they're hoping for, whether sending it would move them toward that, and what they actually need right now that isn't their ex. Never tell them what to do; ask questions. Be warm and brief. If after the conversation they still want to send something, help them write a version they won't regret. Context: the user was about to send: [insert messageAttempted here].`;

const MAX_MESSAGE_LENGTH = 10_000;

// Canned response when no API key — "are you sure?" + self-help journey (varied openings)
function getCannedInterventionResponse(messageAttempted) {
  const openings = [
    "Hey, are you sure you're going to do this?",
    "Hold on — are you sure you want to send this right now?",
    "Before you hit send: are you sure this is what you need?",
  ];
  const opening = openings[Math.floor(Math.random() * openings.length)];
  const preview =
    messageAttempted.length > 120
      ? messageAttempted.slice(0, 117) + "..."
      : messageAttempted;
  return `${opening}

You were about to send: "${preview}"

Sending it might not give you what you're really looking for. We're here to support you on a journey of self-help — one step at a time. What do you actually need right now that isn't your ex? Take a breath. You've got this.`;
}

// In-memory session store
const sessions = new Map();

// Rate limit: 20 req/min per IP
const rateLimit = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;

function rateLimitMiddleware(req, res, next) {
  if (req.path === "/health" || req.path === "/api/health") return next();
  const ip = (req.ip || req.socket.remoteAddress || "unknown").toString();
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
    sendError(res, 429, "Too many requests", "RATE_LIMITED");
    return;
  }
  next();
}

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());
app.use(rateLimitMiddleware);

app.get("/health", (_req, res) => {
  res.json({ status: "OK", api: "notsent", version: "1" });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "OK", api: "notsent", version: "1" });
});

// POST /api/session
app.post("/api/session", (req, res) => {
  const { messageAttempted } = req.body ?? {};
  if (typeof messageAttempted !== "string") {
    sendError(res, 400, "messageAttempted is required", "VALIDATION_ERROR");
    return;
  }
  const trimmed = messageAttempted.trim();
  if (!trimmed) {
    sendError(res, 400, "messageAttempted cannot be empty", "VALIDATION_ERROR");
    return;
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    sendError(res, 400, `messageAttempted must be at most ${MAX_MESSAGE_LENGTH} characters`, "VALIDATION_ERROR");
    return;
  }
  const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const session = {
    id,
    messageAttempted: trimmed,
    outcome: "draft",
    createdAt: Date.now(),
  };
  sessions.set(id, session);
  res.status(201).json({ sessionId: id });
});

// PATCH /api/session/:id
app.patch("/api/session/:id", (req, res) => {
  const { id } = req.params;
  const { outcome } = req.body ?? {};
  if (outcome !== "intercepted" && outcome !== "sent") {
    sendError(res, 400, "outcome must be 'intercepted' or 'sent'", "VALIDATION_ERROR");
    return;
  }
  const session = sessions.get(id);
  if (!session) {
    sendError(res, 404, "Session not found", "NOT_FOUND");
    return;
  }
  session.outcome = outcome;
  res.json({ sessionId: session.id, outcome: session.outcome });
});

// GET /api/stats
app.get("/api/stats", (_req, res) => {
  const all = Array.from(sessions.values());
  const interceptionsCount = all.filter((s) => s.outcome === "intercepted").length;
  const messagesNeverSentCount = all.filter(
    (s) => s.outcome === "intercepted" || s.outcome === "draft"
  ).length;
  res.json({ interceptionsCount, messagesNeverSentCount });
});

// Validate chat request body
function validateMessages(messages) {
  if (!Array.isArray(messages)) return false;
  return messages.every(
    (m) => m && typeof m.role === "string" && typeof m.content === "string"
  );
}

// POST /api/chat — stream Claude response, or canned response when no API key
app.post("/api/chat", async (req, res) => {
  const { messageAttempted, messages } = req.body ?? {};
  if (typeof messageAttempted !== "string" || !messageAttempted.trim()) {
    sendError(res, 400, "messageAttempted (string) is required", "VALIDATION_ERROR");
    return;
  }
  const trimmedMsg = messageAttempted.trim();
  if (trimmedMsg.length > MAX_MESSAGE_LENGTH) {
    sendError(res, 400, `messageAttempted must be at most ${MAX_MESSAGE_LENGTH} characters`, "VALIDATION_ERROR");
    return;
  }
  if (!validateMessages(messages)) {
    sendError(res, 400, "messages must be an array of { role, content }", "VALIDATION_ERROR");
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // No API key: return canned "are you sure?" + self-help response (same SSE format)
  if (!apiKey) {
    const canned = getCannedInterventionResponse(trimmedMsg);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ text: canned })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }

  const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace(
    "[insert messageAttempted here]",
    trimmedMsg
  );

  const anthropic = new Anthropic({ apiKey });

  try {
    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: String(m.content).slice(0, MAX_MESSAGE_LENGTH),
      })),
      stream: true,
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta?.type === "text_delta" &&
        event.delta.text
      ) {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Claude stream error:", err);
    sendError(res, 500, err.message || "Claude request failed", "CHAT_FAILED");
  }
});

// 404 for unknown routes
app.use((req, res) => {
  sendError(res, 404, "Not found", "NOT_FOUND");
});

app.listen(PORT, () => {
  console.log(`NOTSENT backend running at http://localhost:${PORT}`);
});
