# AI_ENGINE Sub-Agent — NOTSENT Prompt Service & Model Layer

> **Parent agent:** BACKEND
> **Scope:** `backend/src/ai/` + `backend/src/prompts/` + `backend/src/engine/conversationEngine.ts`
> **Load order:** CLAUDE.md → BACKEND.md → this file

---

## Role

You own the intelligence layer. You build prompt templates, maintain the model client, parse structured AI responses, and define emotional rule sets. You do **not** touch routes, store, or frontend code.

---

## Directory ownership

```
backend/src/
  ai/
    model.ts            ← model constant + max tokens — ONLY place model string lives
    run-prompt.ts       ← streaming helper — wraps Anthropic SDK
    config.ts           ← shared AI config (temperature, system limits)
  prompts/
    intervention.ts     ← buildInterventionSystemPrompt()
    closure.ts          ← buildClosureSystemPrompt()
    support.ts          ← buildSupportSystemPrompt()
    [future]
      compliance.ts     ← enterprise mode (DO NOT build yet)
  engine/
    conversationEngine.ts ← streamIntervention, streamClosure, streamSupport
    riskAnalysis.ts       ← analyzeRisk() — pre-analysis score before main stream
```

**Never touch:** routes/, store.ts, index.ts, types.ts (read only), frontend files.

---

## The prompt service contract

Every prompt builder is a **pure function** — takes context, returns a string. No side effects, no imports from store.

```ts
// Signature pattern for all prompt builders
export function build[Name]SystemPrompt(
  primaryInput: string,        // the message or trigger (always first param)
  options: {
    userContext?: UserContext;
    partnerContext?: PartnerContext;
    conversationHistory?: ConversationTurn[];
    maxHistoryTurns?: number;  // default 10
  } = {}
): string
```

Rules:
1. Cap conversation history at `maxHistoryTurns` (default 10) to control token cost
2. Cap any single history turn at 400 chars in the prompt (`.slice(0, 400)`)
3. Wrap all interpolated user input in quotes: `"${value}"` — never raw interpolation
4. Never call the Anthropic SDK from a prompt file — only build strings

---

## Model client (`ai/run-prompt.ts`) — canonical pattern

```ts
import Anthropic from "@anthropic-ai/sdk";
import { MODEL, MAX_TOKENS } from "./model.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function runStreamingPrompt(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  onToken: (text: string) => void,
  meta?: { mode?: string; userId?: string; sessionId?: string }
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

  const final = await stream.finalMessage();

  // Structured usage log — future: persist to token_usage table
  console.log(JSON.stringify({
    event: "ai_tokens",
    model: MODEL,
    mode: meta?.mode ?? "unknown",
    userId: meta?.userId ?? "anonymous",
    sessionId: meta?.sessionId ?? null,
    inputTokens: final.usage.input_tokens,
    outputTokens: final.usage.output_tokens,
    timestamp: new Date().toISOString(),
  }));
}
```

---

## Model swappability rule

The brief requires model-agnostic design. When the model changes (Anthropic → Gemini → any other), only `ai/model.ts` and `ai/run-prompt.ts` should change. To enforce this:

1. `MODEL` constant in `ai/model.ts` — import everywhere, hardcode nowhere
2. `run-prompt.ts` wraps all SDK-specific streaming — engine code never calls SDK directly
3. The `onToken` callback pattern is model-agnostic — it just receives text chunks

If a future model uses a different SDK, replace the internals of `run-prompt.ts` only. The `runStreamingPrompt(systemPrompt, messages, onToken, meta)` signature must stay stable.

---

## Three AI modes — prompt design rules

### Mode: Intervention

Goal: intercept the impulse, not the user.

Persona: calm, non-judgmental, curious. Never lecturing. Asks 1–2 questions max per response. Never tells them what to do. Validates the feeling, redirects the action.

Required context injected:
- `messageAttempted` — the message they were about to send (always included)
- `userContext.partnerName` — their ex's name (if available)
- `userContext.breakupSummary` — freeform situation description
- `userContext.noContactDays` — days since last contact (shows streak progress)
- `conversationHistory` — last N turns (continuity across this session)

Response length: 2–4 sentences, then a question. Never monologue.

### Mode: Closure

Goal: simulate the ex's voice for safe, private processing.

Persona: AI plays the ex — warm, using their vocabulary and communication style. Responses orient subtly toward acceptance and letting go — not rekindling. Never breaks character unless explicitly asked.

Required context:
- `partnerContext.sampleMessages[]` — up to 20 messages to match tone/vocab
- `partnerContext.partnerName` — name to use
- `userContext.breakupSummary` — for context about what happened

Response style: match the ex's message length and register from samples. If no samples, use warm and direct adult voice.

### Mode: Support

Goal: unconditional emotional support chatbot.

Persona: empathetic, warm, never clinical. Draws on emotional intelligence. References the user's situation from context if available, but can operate without it.

Required context (all optional): `userContext` (all fields)

Response length: varies — match emotional register of the user's message. Short if they're brief, longer if they share a lot.

---

## Risk analysis (`engine/riskAnalysis.ts`)

Pre-analysis step before intervention streaming. Runs a lightweight, non-streaming prompt to score the urgency of the message.

```ts
export interface RiskScore {
  level: "low" | "medium" | "high";
  reason: string;   // one-line internal label — not shown to user
}

export async function analyzeRisk(
  messageAttempted: string,
  userContext?: UserContext
): Promise<RiskScore>
```

High risk signals: declaration of love, "I miss you", "can we talk", "I've been thinking about you", mentions of specific memories. Medium: casual check-in, vague reach-out. Low: factual/logistical.

Use `max_tokens: 50` and non-streaming for this call — it's a classifier, not a conversation. Pass the risk score to `buildInterventionSystemPrompt()` as an `options.riskLevel` field so the prompt can calibrate its opening warmth.

---

## Adding a new AI mode (step-by-step)

1. Create `backend/src/prompts/[name].ts` → `build[Name]SystemPrompt()`
2. Add `stream[Name]()` to `engine/conversationEngine.ts`
3. Add a new route in `routes/chat.ts` for the SSE endpoint
4. Mount in `index.ts` if a new router is needed
5. Add mode to the token usage log `mode` field check list in `run-prompt.ts`
6. **For enterprise compliance:** `prompts/compliance.ts` only — never modify personal prompts

---

## What to build (priority order)

1. **Support prompt** — `prompts/support.ts` → `buildSupportSystemPrompt()` (P0, not yet built)
2. **Risk analysis** — `engine/riskAnalysis.ts` → `analyzeRisk()` (P1)
3. **meta param in run-prompt** — add `meta` to usage log (P1, needed for billing)
4. **Compliance stub** — `prompts/compliance.ts` empty export with `TODO` comment (P3 — do not implement yet, just scaffold)
