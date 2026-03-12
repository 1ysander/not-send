# INTERCEPTION_PIPELINE Sub-Agent — NOTSENT Message Analysis Middleware

> **Parent agent:** BACKEND
> **Scope:** `backend/src/engine/conversationEngine.ts` + `backend/src/engine/riskAnalysis.ts` + pipeline middleware pattern
> **Load order:** CLAUDE.md → BACKEND.md → this file

---

## Role

You own the analysis pipeline that runs between "user drafts a message" and "AI responds". You design the middleware chain, insert new analysis steps, and ensure the pipeline is extensible without rewiring. You call the AI_ENGINE functions — you do not build prompts yourself.

---

## The pipeline (canonical)

```
Draft Message (from route handler)
  │
  ▼
[1] Context Loader
    → pulls UserContext + PartnerContext from store (or Supabase later)
    → attaches to pipeline context object
  │
  ▼
[2] Rule Selector
    → determines which ruleset applies: "breakup" | "compliance" | "custom"
    → loads appropriate prompt builder
  │
  ▼
[3] Risk Analyzer (P1 — optional step, insert before AI call)
    → analyzeRisk(messageAttempted, userContext)
    → returns { level: "low" | "medium" | "high", reason: string }
    → passes riskLevel to prompt builder
  │
  ▼
[4] AI Analysis
    → calls appropriate stream[Mode]() from conversationEngine.ts
    → prompt builder receives: messageAttempted + userContext + riskLevel + history
    → onToken callback streams to route handler
  │
  ▼
[5] Action Router (P2 — future)
    → for non-streaming analysis modes: parse structured response
    → decide: "let through" | "warn" | "block" | "suggest_alternative"
    → for streaming chat: action router is implicit (AI decides in response)
```

---

## Pipeline context object

Pass this object through all middleware steps. Never mutate it after passing — each step extends it.

```ts
interface PipelineContext {
  // Set by route handler
  sessionId?: string;
  deviceId?: string;
  mode: "intervention" | "closure" | "support" | "compliance";
  messageAttempted?: string;           // intervention only
  messages: Array<{ role: string; content: string }>;

  // Set by Context Loader (step 1)
  userContext?: UserContext;
  partnerContext?: PartnerContext;
  conversationHistory?: ConversationTurn[];

  // Set by Rule Selector (step 2)
  ruleset?: "breakup" | "compliance" | "custom";

  // Set by Risk Analyzer (step 3, P1)
  riskScore?: { level: "low" | "medium" | "high"; reason: string };
}
```

---

## Current implementation (`engine/conversationEngine.ts`)

The pipeline is currently implicit inside `streamIntervention`, `streamClosure`, `streamSupport`. Steps 1–4 happen sequentially inside each function. The pipeline object doesn't exist yet as a formal type.

**Phase 1 task:** Make the pipeline explicit by extracting steps into named helpers:

```ts
// Step 1: Context Loader
async function loadPipelineContext(
  params: { deviceId?: string; sessionId?: string }
): Promise<Pick<PipelineContext, "userContext" | "partnerContext" | "conversationHistory">>

// Step 2: Rule Selector
function selectRuleset(userContext?: UserContext): "breakup" | "compliance" | "custom"

// Step 3: Risk Analyzer (P1)
async function runRiskAnalysis(
  messageAttempted: string,
  userContext?: UserContext
): Promise<{ level: "low" | "medium" | "high"; reason: string }>

// Main pipeline entry points
export async function streamIntervention(params: PipelineContext, onToken: (text: string) => void): Promise<void>
export async function streamClosure(params: PipelineContext, onToken: (text: string) => void): Promise<void>
export async function streamSupport(params: PipelineContext, onToken: (text: string) => void): Promise<void>
```

---

## Adding a new pipeline step

This is the key extensibility requirement. To add a new step between existing ones:

1. Create a typed helper function in `conversationEngine.ts` that takes `PipelineContext` and returns an enriched version
2. Insert it between existing steps — do not modify the steps before or after it
3. Add the new field to `PipelineContext` interface
4. Pass the enriched context forward

Example: adding a sentiment scorer between Risk Analyzer and AI Analysis:

```ts
// New step: Sentiment Scorer
async function scoreSentiment(
  messageAttempted: string
): Promise<{ sentimentScore: number; dominantEmotion: string }> {
  // Lightweight analysis — could be a regex heuristic or small model call
  // Returns a score 0-1 (0 = very negative, 1 = very positive)
}

// Insert in streamIntervention:
const riskScore = await runRiskAnalysis(params.messageAttempted, context.userContext);
const sentiment = await scoreSentiment(params.messageAttempted);  // ← new step here
const systemPrompt = buildInterventionSystemPrompt(params.messageAttempted, {
  ...context,
  riskScore,
  sentiment,  // ← passed to prompt builder
});
```

---

## Action router (P2 — when non-streaming analysis is needed)

For the enterprise compliance mode, the AI response is structured JSON, not a stream. The action router parses it and decides what to surface in the UI:

```ts
interface InterceptionAction {
  decision: "allow" | "warn" | "block" | "suggest";
  reason?: string;
  suggestedAlternative?: string;
  flaggedSegments?: Array<{ text: string; issue: string }>;
}

export function parseInterceptionAction(aiResponse: string): InterceptionAction {
  // Parse structured JSON from compliance AI response
  // Personal app: always "warn" with the AI's message — no hard blocks in Phase 1
  // Enterprise: return structured decision
}
```

**Phase 1 note:** Personal app intervention never hard-blocks. The "action" is the AI conversation itself — the user decides. Only enterprise compliance needs the structured action router.

---

## Session persistence (after Supabase migration)

After each completed pipeline run:
1. Append conversation turns to `conversation_turns` table
2. Log the interception event to `interceptions` table:

```ts
// Future: persist to interceptions table
await supabaseAdmin.from("interceptions").insert({
  user_id: userId,
  contact_id: contactId,
  draft_content: params.messageAttempted,
  ai_response: fullAssistantResponse,      // collected from onToken callbacks
  action_taken: sessionOutcome,             // "intercepted" | "sent" | "draft"
  created_at: new Date().toISOString(),
});
```

---

## Interceptions table schema (target Supabase)

```sql
create table public.interceptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  contact_id uuid references public.flagged_contacts(id) on delete set null,
  draft_content text not null,
  ai_response text not null,
  action_taken text not null check (action_taken in ('sent', 'warned', 'blocked', 'edited')),
  created_at timestamptz default now() not null
);

alter table public.interceptions enable row level security;

create policy "users see own interceptions" on public.interceptions
  for select using (auth.uid() = user_id);
create policy "users insert own interceptions" on public.interceptions
  for insert with check (auth.uid() = user_id);
```

---

## What to build (priority order)

1. **Formalize `PipelineContext` type in `backend/src/types.ts`** (P0)
2. **Extract `loadPipelineContext()` helper** in `conversationEngine.ts` (P1)
3. **Extract `selectRuleset()` helper** (P1)
4. **Wire `analyzeRisk()` into `streamIntervention()`** as step 3 (P2)
5. **`interceptions` table + logging** after Supabase migration (P2)
6. **`parseInterceptionAction()`** — only when enterprise compliance is being built (P3)
