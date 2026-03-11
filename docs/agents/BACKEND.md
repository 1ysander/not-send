# BACKEND Agent — NOTSENT Express API

> **Start here every session:** Read `CLAUDE.md` first, then this file. Do not touch `app/`.

---

## Your job

You own everything in `backend/src/`. When given a task:
1. Read `CLAUDE.md` → understand architecture constraints
2. Read this file top-to-bottom → understand patterns
3. Grep the specific files you're about to change before editing
4. Build. Do not ask for confirmation.

---

## Stack

- Node.js + Express 4 + TypeScript (strict)
- `"type": "module"` — ESM throughout. All imports end in `.js` (TS ESM convention)
- `@anthropic-ai/sdk` — streaming only, never `create` without stream
- Socket.io — post-stream realtime push
- `tsx` for dev (`tsx watch src/index.ts`), `tsc` for build
- In-memory store (`src/store.ts`) — Maps that reset on restart — MVP only

---

## Entry point — `backend/src/index.ts` ONLY

```
backend/server.js     ← DEAD — never import, never run
backend/server.ts     ← DEAD — never import, never run
backend/connectors/   ← DEAD — top-level, not in src/
backend/engine/       ← DEAD — top-level, not in src/
```

All live code: `backend/src/`.

### `index.ts` responsibilities (and only these):
1. Create Express app + HTTP server
2. Mount Socket.io on the HTTP server via `setIO(io)`
3. Register middleware: CORS, `express.json()`, rate limit
4. Mount all routers under `/api/`
5. Start `server.listen`

No business logic ever goes in `index.ts`.

---

## Route map (full)

| Method | Path | File | What it does |
|---|---|---|---|
| GET | `/health` | `index.ts` | Returns `{ status: "OK", api: "notsent" }` |
| GET | `/api/health` | `index.ts` | Same |
| POST | `/api/session` | `routes/session.ts` | Creates session in store, returns `{ sessionId }` |
| PATCH | `/api/session/:id` | `routes/session.ts` | Updates outcome: intercepted / sent |
| GET | `/api/stats` | `routes/stats.ts` | Returns `{ interceptionsCount, messagesNeverSentCount }` |
| POST | `/api/chat` | `routes/chat.ts` | Intervention SSE stream |
| POST | `/api/chat/closure` | `routes/chat.ts` | Closure SSE stream |
| POST | `/api/chat/support` | `routes/chat.ts` | Support SSE stream |
| PUT | `/api/context/user` | `routes/context.ts` | Upsert user context by deviceId |
| GET | `/api/context/user` | `routes/context.ts` | Get user context by deviceId |
| PUT | `/api/context/partner` | `routes/context.ts` | Upsert partner context by deviceId |
| GET | `/api/context/partner` | `routes/context.ts` | Get partner context by deviceId |

---

## SSE pattern — exact (copy for every streaming endpoint)

```ts
chatRoutes.post("/your-endpoint", async (req, res) => {
  // 1. Validate body first — return 400 before anything else
  const { messages, sessionId } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages (array) required" });
    return;
  }

  // 2. Set SSE headers and flush immediately
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // 3. Stream via engine function — engine writes nothing to res directly
  try {
    await streamSomething(
      { messages, sessionId },
      (text) => res.write(`data: ${JSON.stringify({ text })}\n\n`)
    );
  } catch (err) {
    console.error("[stream error]", err);
    res.write(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
  }

  // 4. Always end with [DONE]
  res.write("data: [DONE]\n\n");
  res.end();
});
```

The `(text: string) => void` callback is the ONLY way engine code writes to the response. Never pass `res` into engine functions.

---

## Anthropic SDK — exact streaming pattern

```ts
// backend/src/ai/run-prompt.ts
import Anthropic from "@anthropic-ai/sdk";
import { MODEL, MAX_TOKENS } from "./model.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function runStreamingPrompt(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  onToken: (text: string) => void
): Promise<void> {
  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages,
  });

  for await (const chunk of stream) {
    if (
      chunk.type === "content_block_delta" &&
      chunk.delta.type === "text_delta"
    ) {
      onToken(chunk.delta.text);
    }
  }

  // Log token usage for future billing
  const final = await stream.finalMessage();
  console.log(`[tokens] in:${final.usage.input_tokens} out:${final.usage.output_tokens}`);
}
```

```ts
// backend/src/ai/model.ts — ONLY place the model string lives
export const MODEL = "claude-sonnet-4-6";
export const MAX_TOKENS = 1024;
```

Never hardcode `"claude-sonnet-4-6"` anywhere else. Always import `MODEL` from `ai/model.js`.

---

## Prompt engineering rules

All prompts live in `backend/src/prompts/`. Each prompt is a pure function → string.

### Intervention prompt (`prompts/intervention.ts`)

```ts
export function buildInterventionSystemPrompt(
  messageAttempted: string,
  options: {
    userContext?: UserContext;
    conversationHistory?: ConversationTurn[];
    maxHistoryTurns?: number;
  } = {}
): string {
  const { userContext, conversationHistory = [], maxHistoryTurns = 10 } = options;

  // Build context block
  let contextBlock = `The user was about to send: "${messageAttempted}"`;
  if (userContext?.partnerName) contextBlock += `\nTheir ex's name is ${userContext.partnerName}.`;
  if (userContext?.breakupSummary?.trim()) contextBlock += `\nAbout their breakup: ${userContext.breakupSummary.trim()}`;
  if (userContext?.noContactDays) contextBlock += `\nThey've been no-contact for ${userContext.noContactDays} days.`;

  // Cap history to control token cost
  const historyBlock = conversationHistory.length > 0
    ? "\n\nPrior NOTSENT conversations (for continuity — don't repeat yourself):\n" +
      conversationHistory
        .slice(-maxHistoryTurns)
        .map(t => `${t.role === "user" ? "User" : "NOTSENT"}: ${t.content.slice(0, 400)}`)
        .join("\n")
    : "";

  return `You are a calm, non-judgmental AI that intercepts messages people are about to send their ex. Your job is to help them process the impulse in real time — not to lecture.

Start by acknowledging what they were going to say. Then gently explore: what outcome they're hoping for, whether sending it would get them there, and what they actually need right now. Ask questions. Be warm and brief. Never tell them what to do. If they still want to send after the conversation, help them write a version they won't regret.

${contextBlock}${historyBlock}`;
}
```

### Closure prompt (`prompts/closure.ts`)

Goal: simulate the ex's voice for a safe closure conversation. AI plays the ex — warm but subtly orienting toward letting go.

```ts
export function buildClosureSystemPrompt(
  partnerContext: PartnerContext,
  userContext?: UserContext
): string {
  const sampleBlock = partnerContext.sampleMessages?.length
    ? "\n\nSample messages from this person (match their tone and vocabulary):\n" +
      partnerContext.sampleMessages
        .slice(0, 20) // cap at 20 messages
        .map(m => `${m.fromPartner ? partnerContext.partnerName : "User"}: ${m.text.slice(0, 200)}`)
        .join("\n")
    : "";

  return `You are simulating ${partnerContext.partnerName} in a private closure conversation. This is NOT a real conversation — the user is talking to an AI to process their feelings and find closure without reaching out to their real ex.

Respond as ${partnerContext.partnerName} would: match their tone and style from the sample messages if provided. Be warm but honest. Your responses should help the user feel heard and gently move them toward acceptance and closure — not toward rekindling. Never break character to say you're an AI unless the user explicitly asks.${sampleBlock}${userContext?.breakupSummary ? `\n\nContext about the breakup: ${userContext.breakupSummary}` : ""}`;
}
```

### Adding a new prompt

1. Create `backend/src/prompts/[name].ts`
2. Export one `build[Name]SystemPrompt()` function
3. Call it from the engine function (`src/engine/conversationEngine.ts`), not from the route handler
4. Never interpolate user input unsanitized — use template string wrapping (e.g. `"${value}"`) to contain it

---

## Engine layer (`src/engine/conversationEngine.ts`)

The engine sits between routes and AI. Routes call engine functions; engine calls `runStreamingPrompt` and `store`.

```ts
export async function streamIntervention(
  params: {
    sessionId?: string;
    messageAttempted: string;
    messages: Array<{ role: string; content: string }>;
    conversationHistory?: ConversationTurn[];
    userContext?: UserContext;
    deviceId?: string;
  },
  onToken: (text: string) => void
): Promise<void> {
  const { sessionId, messageAttempted, messages, deviceId } = params;

  // Load context from store if deviceId provided (supplement body params)
  let userContext = params.userContext;
  if (!userContext && deviceId) {
    userContext = getUserContext(deviceId);
  }

  // Load history from store if sessionId provided
  let history = params.conversationHistory ?? [];
  if (!history.length && sessionId) {
    history = getConversationHistory(sessionId);
  }

  const systemPrompt = buildInterventionSystemPrompt(messageAttempted, {
    userContext,
    conversationHistory: history,
  });

  // Cast messages to correct type
  const typedMessages = messages.map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  await runStreamingPrompt(systemPrompt, typedMessages, (text) => {
    onToken(text);
  });

  // Persist this turn to history for continuity
  if (sessionId) {
    const lastUserMsg = typedMessages.filter(m => m.role === "user").pop();
    if (lastUserMsg) appendConversationTurn(sessionId, "user", lastUserMsg.content);
    // Note: to capture full assistant response, collect tokens in route and append after stream
  }
}
```

---

## Store API (complete reference)

From `src/store.ts` — import these in engine/routes, never access Maps directly:

```ts
// Sessions
createSession(messageAttempted: string, userContext?: UserContext, deviceId?: string): Session
updateSessionOutcome(id: string, outcome: "intercepted" | "sent"): Session | undefined
getSession(id: string): Session | undefined
getAllSessions(): Session[]

// Conversation history
appendConversationTurn(sessionId: string, role: "user" | "assistant", content: string): void
getConversationHistory(sessionId: string): ConversationTurn[]
getRecentHistoryForDevice(deviceId: string, limit?: number): ConversationTurn[]

// User / partner context
setUserContext(deviceId: string, context: UserContext): void
getUserContext(deviceId: string): UserContext | undefined
setPartnerContext(deviceId: string, context: PartnerContext): void
getPartnerContext(deviceId: string): PartnerContext | undefined
```

---

## Types (`src/types.ts`) — complete

```ts
type SessionOutcome = "intercepted" | "sent" | "draft";

interface Session {
  id: string;
  messageAttempted: string;
  outcome: SessionOutcome;
  createdAt: number;
}

interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

interface UserContext {
  breakupSummary?: string;
  partnerName?: string;
  noContactDays?: number;           // sync with frontend types.ts
  conversationContext?: string;     // "sms" | "instagram" | "whatsapp" | "generic"
}

interface PartnerContext {
  partnerName: string;
  sampleMessages?: Array<{ fromPartner: boolean; text: string }>;
}

interface InterventionChatBody {
  sessionId?: string;
  messageAttempted: string;
  messages: Array<{ role: string; content: string }>;
  conversationHistory?: ConversationTurn[];
  userContext?: UserContext;
  deviceId?: string;
}

interface ClosureChatBody {
  messages: Array<{ role: string; content: string }>;
  userContext?: UserContext;
  partnerContext: PartnerContext;
  deviceId?: string;
}
```

---

## Adding a new route (exact steps)

1. Add types to `src/types.ts` for the request body
2. Add store functions to `src/store.ts` if new data is persisted
3. Add engine function to `src/engine/conversationEngine.ts`
4. Add prompt function to `src/prompts/[name].ts` if AI is involved
5. Add route handler to existing or new `src/routes/[name].ts`
6. Mount router in `src/index.ts`: `app.use("/api/[path]", [name]Routes)`
7. Test: `curl -X POST http://localhost:3001/api/[path] -H "Content-Type: application/json" -d '{...}'`

---

## Environment variable validation

Add this to `src/index.ts` startup — fail fast if required keys are missing:

```ts
const REQUIRED_ENV = ["ANTHROPIC_API_KEY"] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}
```

---

## Error handling rules

1. **Route handlers**: validate body fields first, return 400 before any logic
2. **Engine functions**: wrap `runStreamingPrompt` in try/catch, re-throw to route
3. **Routes catch engine errors**: emit `data: {"error":"..."}` via SSE then `[DONE]`
4. **Never** let a stream hang without `[DONE]` — use `finally` to guarantee it
5. **Never** send stack traces to client — only `(err as Error).message`
6. **Log** all errors to console with context: `console.error("[intervention error]", { sessionId, err })`

---

## Rate limiting

Current: 20 req/min per IP, in-memory Map. Do not change the limit without product reason.

When on Supabase: move to a Redis-backed rate limiter or use Supabase Edge Functions with Upstash.

---

## Token usage logging (add this now)

After every AI call in `runStreamingPrompt`, log usage. When Supabase is live, persist to a `token_usage` table:

```ts
console.log(JSON.stringify({
  event: "ai_tokens",
  model: MODEL,
  mode: "intervention" | "closure" | "support",
  deviceId: deviceId ?? "unknown",
  inputTokens: final.usage.input_tokens,
  outputTokens: final.usage.output_tokens,
  timestamp: new Date().toISOString(),
}));
```

---

## What to build next (in order)

### 1. Sync `UserContext` types with frontend (P0)
- Add `noContactDays?: number` and `conversationContext?: string` to `src/types.ts`
- Update `buildInterventionSystemPrompt` to use both fields

### 2. Token usage logging (P1)
- Add structured log line after every `runStreamingPrompt` call
- Later: persist to `token_usage` Supabase table

### 3. Risk analysis hook (P2)
- In `streamIntervention`, before streaming, call `analyzeRisk(messageAttempted)`
- `analyzeRisk` scores urgency (0–1) and returns `{ urgency, sentiment }`
- Pass score to prompt builder so high-urgency messages get a gentler, slower opening

### 4. Contact-level partner context (P2)
- Add `partnerContextByContact: Map<string, PartnerContext>` to store
- Add `setPartnerContextForContact(contactId, context)` and `getPartnerContextForContact(contactId)`
- New routes: `PUT /api/context/partner/:contactId`, `GET /api/context/partner/:contactId`

### 5. Supabase migration (P1)
- See `SUPABASE.md` for full plan
- Migration order: Auth → Sessions → History → Context → Remove Maps
