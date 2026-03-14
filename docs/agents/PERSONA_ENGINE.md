# PERSONA_ENGINE Agent — Persona Extraction, Simulation & Learning System

> **Scope:** `backend/src/engine/persona/` + `backend/src/prompts/` + Supabase persona tables
> **Load order:** CLAUDE.md → BACKEND.md → AI_ENGINE.md → this file
> **Related schema:** DATABASE_SCHEMA.md (add persona tables from Section 9 of this file)

---

## Role

You build and maintain the persona intelligence layer: parsing uploaded conversations into structured profiles, extracting deep behavioral fingerprints, simulating a specific person's texting style, and accumulating user feedback to improve accuracy over time.

You do **not** touch routes, AppShell, or any frontend beyond what's already in `ContactAIChatScreen.tsx` and `ClosureScreen.tsx`. All persona logic lives in `backend/src/engine/persona/`.

---

## Product context

This engine is what makes NOTSENT uncannily accurate. When a user uploads a conversation with their ex:
1. The **parser** turns raw text into structured, attributed messages
2. The **extractor** analyses those messages and produces a JSON persona profile — not just style (emoji, abbreviations) but deep behavioral patterns (deflection, conflict style, emotional availability ceiling)
3. The **simulator** uses that profile as a conditioning system prompt to generate responses in the person's voice
4. The **training loop** collects user feedback after every simulation to refine accuracy
5. The **holdout scorer** gives users a quantitative "accuracy %" for their persona model

This same engine powers both Closure mode (AI plays the ex) and the AI Support chat (AI understands the ex to give better support). It is the core defensible IP of the product.

---

## Three-tier architecture

The engine has three tiers. **Tier 1 is built now.** Tiers 2 and 3 are specification-only — interfaces are defined now so Tier 2/3 can swap in without refactoring.

| Tier | What it is | When to build |
|------|-----------|---------------|
| **1** | LLM API wrapper (Anthropic Claude) | Now |
| **2** | Fine-tuned open-source base model (Llama 3 / Mistral 7B) | Post 5,000 corrections + $1k/mo API cost |
| **3** | Per-persona LoRA adapters on top of Tier 2 base | Post-seed funding |

Define the `PersonaSimulator` interface now. Both Tier 1 and future tiers implement it. The route layer never calls Claude directly — it calls the interface.

---

## Directory structure

```
backend/src/engine/persona/
  index.ts                   ← exports all public functions
  parser/
    formatDetector.ts        ← detects iMessage / structured / unstructured
    regexParser.ts           ← parses structured formats locally (no LLM)
    senderDisambiguator.ts   ← attributes messages to TARGET or USER
    llmAssistedParser.ts     ← LLM fallback for unstructured raw text
  extraction/
    statisticalAnalyzer.ts   ← local stats: capitalization, emoji, abbrevs, length
    personaExtractor.ts      ← orchestrates: stats → LLM extraction → store
    extractionPrompt.ts      ← builds the extraction LLM call prompt
  simulation/
    PersonaSimulator.ts      ← interface definition (Tier 1/2/3 swappable)
    AnthropicSimulator.ts    ← Tier 1 implementation (implements PersonaSimulator)
    systemPromptBuilder.ts   ← builds per-turn system prompt from persona JSON
    contextInjector.ts       ← detects topic / emotional temp / mode per turn
    conversationManager.ts   ← trims history to token budget
    responsePostProcessor.ts ← style verification / drift detection
  training/
    calibrationGenerator.ts  ← generates A/B style calibration pairs
    correctionProcessor.ts   ← stores and applies user feedback
    accuracyScorer.ts        ← holdout testing against real responses
  models/
    PersonaProfile.ts        ← TypeScript interfaces for all persona types
    ContextSignals.ts        ← topic / emotion / mode types
    SimulatedResponse.ts     ← simulator output type
    CorrectionRecord.ts      ← user feedback record type
```

**Never put persona logic in:** `conversationEngine.ts` (existing engine), `store.ts`, or routes. Persona engine is a clean dependency that routes call.

---

## Module 1: Conversation Parser

> **Rule:** Zero LLM calls in this module except for UNSTRUCTURED_RAW fallback.

### 1.1 Format detection

```ts
export type FormatType = "IMESSAGE_EXPORT" | "STRUCTURED_COPYPASTE" | "UNSTRUCTURED_RAW";

export function detectFormat(rawText: string): FormatType
```

- Check for iMessage timestamp pattern: `\[?\d{4}-\d{2}-\d{2}` or `\[\d{1,2}/\d{1,2}/\d{2,4}`
- Check what % of non-empty lines match `SomeName: message` (sender colon pattern)
- If timestamp detected → `IMESSAGE_EXPORT`
- If >40% of lines match sender pattern → `STRUCTURED_COPYPASTE`
- Else → `UNSTRUCTURED_RAW`

### 1.2 Regex parsing

```ts
export function parseStructured(rawText: string, format: FormatType): ParsedMessage[]
// ParsedMessage = { sender: string; text: string; timestamp?: string }
```

Patterns to support (in priority order):
- iMessage: `\[?([\d\-/]+[\s,]+[\d:]+(?:\s*[AP]M)?)\]?\s+([^:\n]+?):\s*(.+)`
- Structured copy-paste: `^([^:\n]{1,30}):\s*(.+)`
- Multi-line continuation: line that matches no sender pattern → append to previous message's text

### 1.3 Sender disambiguation

```ts
export function attributeMessages(
  messages: ParsedMessage[],
  targetName: string
): AttributedMessage[]
// AttributedMessage = ParsedMessage & { role: "target" | "user" | "other" }
```

- Fuzzy-match sender field against `targetName` (lowercase, trim, partial match)
- Handle "Sarah", "sarah", "S", "Sarah B." all matching "Sarah"
- If exactly 2 unique senders: auto-assign non-target as `user`
- If 3+ senders (group chat): tag all non-target as `other`
- Reserve 20% of conversation pairs as holdout: set `isHoldout: true` (never include in extraction)

### 1.4 LLM-assisted parsing (UNSTRUCTURED_RAW only)

```ts
export async function llmAssistedParse(
  rawText: string,
  targetName: string
): Promise<AttributedMessage[]>
```

Single non-streaming call with `max_tokens: 2000`. Prompt structure:

```
Parse this conversation text into structured messages.
The target person is "${targetName}".

Raw text:
${rawText.slice(0, 3000)}

Output a JSON array. Each element:
- "sender": "${targetName}" | "User"
- "text": the message content

Determine sender from: conversational flow, style differences, question/answer patterns,
"Delivered"/"Read" markers. Return ONLY the JSON array.
```

Always show result to user for confirmation before proceeding to extraction.

---

## Module 2: Persona Extraction Engine

**Two-phase approach:** local stats first (cheap, fast, accurate on measurable patterns) → single LLM call with pre-computed data (LLM handles what stats can't: tone, deflection, humor as shield).

### 2.1 Statistical analyzer (no LLM — runs locally)

```ts
export function computeStatisticalProfile(messages: AttributedMessage[]): StatisticalProfile
```

Compute from target's messages only:

**Capitalization:**
- `pctStartsUppercase` — % messages starting with capital
- `pctICapitalized` — % of times standalone "I" is capitalized

**Message length:**
- `avgWordCount`, `medianWordCount`, `lengthVariance`
- `pctOneWordResponses`, `pctParagraphResponses` (>30 words)

**Double texting:**
- `doubleTextFrequency` — % of times target sends consecutive messages
- `avgBurstLength` — average burst size when they do

**Emoji:**
- `emojiFrequency` — messages with emoji / total
- `topEmojis` — ranked list with counts (extract all Unicode emoji ranges)
- `emojiOnlyMessages` — count of emoji-only messages

**Abbreviations:** scan against known list: `u, ur, rn, ngl, tbh, idk, smth, idc, nvm, lol, lmao, omg, brb, imo, pls, thx, bc, w, abt, rlly, sm, v`
- Per abbreviation: `{ count, alwaysUsed: boolean }` (always = >90% of opportunities)

**Punctuation:**
- `pctEndsPeriod`, `pctUsesQuestionMark`, `pctUsesExclamation`, `pctUsesEllipsis`

**Response timing** (if timestamps parsed):
- `avgResponseTimeSeconds`

### 2.2 LLM extraction call (one call per upload)

This is a non-streaming call because the output is structured JSON, not a chat response. Use `max_tokens: 4000`.

```ts
export async function extractPersona(
  targetName: string,
  targetMessages: string[],
  conversationPairs: Array<{ userMessage: string; targetReply: string }>,
  stats: StatisticalProfile
): Promise<PersonaJSON>
```

System prompt:
```
You are a conversational psychologist and linguistics expert. Create an extremely detailed
communication profile of a person based on their text messages.

CRITICAL RULES:
- Be SPECIFIC, not generic. "Uses humor" is useless. "Deploys 'lol' to deflect emotional
  vulnerability when asked direct questions about feelings" is useful.
- Document ABSENCE as much as presence. If they NEVER use exclamation marks, say so.
- Capture INCONSISTENCIES. Document behavioral mode shifts explicitly.
- Be honest about negative patterns: avoidance, dismissiveness, passive aggression.
  The simulation must replicate the real person, not an idealized version.
```

User message: pass `stats` as JSON + up to 80 target messages + up to 30 conversation pairs. Request the full `PersonaJSON` schema (see Section 8).

### 2.3 Persona storage

After extraction:
- Store full persona JSON in `personas` table (see schema Section 9)
- Store attributed messages (with `is_holdout` flag) in `parsed_messages` table
- Return the persona ID to the caller

---

## Module 3: Simulation Engine

### 3.1 Interface (defines the Tier 1/2/3 swap point)

```ts
// backend/src/engine/persona/simulation/PersonaSimulator.ts

export interface SimulatedResponse {
  messages: string[];      // split on [SPLIT] for double texting
  rawResponse: string;
}

export interface PersonaSimulator {
  generateResponse(
    persona: PersonaProfile,
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
    signals: ContextSignals
  ): Promise<SimulatedResponse>;
}

// Tier 1 implementation:
export class AnthropicSimulator implements PersonaSimulator { ... }

// Tier 2 stub (do not implement yet):
// export class SelfHostedSimulator implements PersonaSimulator { ... }
```

### 3.2 System prompt construction

Built from persona JSON every turn. Keep under 1500 tokens. Template:

```
You are simulating ${name}'s texting style. Respond EXACTLY how ${name} would —
matching their tone, length, vocabulary, and emotional patterns with total accuracy.

## Style rules:
- Capitalization: ${capitalization} — ${capitalizationNotes}
- Punctuation: ${punctuationStyle}. ${periodUsageMeaning}
- Message length: ${avgMessageLength}, variance: ${messageLengthVariance}
- Double texting: ${doubleTexting.frequency}. Separate with [SPLIT] markers.

## Vocabulary:
- Always abbreviates: ${abbreviationsAlwaysUsed}
- Never abbreviates: ${abbreviationsNeverUsed}
- Signature slang: ${slangTerms}
- Filler words: ${fillerWords}

## Emoji:
- Usage: ${emojiUsage}
- Primary: ${primaryEmojis}
- Meanings: ${emojiMeaningMap}

## Emotional patterns:
- Availability: ${emotionalAvailability}
- Deflection: ${primaryDeflectionMethod} triggered by: ${deflectionTriggers}
- Conflict: ${fightStyle}, apology: ${apologyStyle}

## Voice:
- Catchphrases: ${catchphrases}
- Reaction expressions: ${reactionExpressions}
- Humor: ${humorStyle}

## Current context:
- Topic: ${signals.topic}
- Emotional temp: ${signals.emotionalTemperature}
- Active mode: ${signals.activeMode}

## NEVER:
${simulationRules.neverDo}
- NEVER be more emotionally available than ${name} actually is
- NEVER use vocabulary ${name} wouldn't use
- NEVER break character or acknowledge you're an AI

## Accuracy traps: ${simulationRules.accuracyWarnings}

Respond as ${name}. Message only.
```

### 3.3 Context injection (per-turn dynamic signals)

```ts
export function detectContextSignals(
  history: Array<{ role: string; content: string }>,
  persona: PersonaProfile
): ContextSignals
// ContextSignals = { topic, emotionalTemperature, activeMode }
```

- **Topic** (keyword heuristic): planning | emotional | logistical | flirting | arguing | banter | support_seeking | catching_up
- **Emotional temperature** (heuristic): cold | neutral | warm | heated
  - heated: exclamation spike + negative keywords + short message burst
  - warm: terms of endearment + emoji increase + longer messages
- **Active mode**: match conversation signals against persona's `contextDependentModes` array triggers

### 3.4 Memory management

- Always include full system prompt (~1500 tokens)
- Keep last 20 messages of conversation history (~2000 tokens)
- If history > 20 messages, prepend a 2-sentence summary: "Earlier you discussed [topics]. Emotional tone was [tone]."
- Target budget: system ~1500 + history ~2000 + generation ~500 = ~4000 tokens/call

### 3.5 Response post-processing

After LLM response:
1. Split on `[SPLIT]` → array of message bubbles (double texting)
2. Check message length: if >3× persona's `avgWordCount`, flag and truncate
3. Check capitalization: if persona is all-lowercase and response has unexpected caps → lowercase it
4. Check always-used abbreviations: quick regex scan

These are guardrails, not hard rules. They catch obvious drift, not subtle variance.

---

## Module 4: Interactive Training Loop

### 4.1 A/B style calibration (post-upload)

After extraction, generate 12 calibration pairs to let the user override extracted patterns where the LLM guessed wrong.

```ts
export async function generateCalibrationPairs(
  persona: PersonaJSON,
  targetName: string
): Promise<CalibrationPair[]>
// CalibrationPair = { dimensionTested, context, optionA, optionB, extractedPrediction }
```

Dimensions to test across 12 pairs:
- Abbreviation preference (2 pairs)
- Capitalization (1)
- Punctuation (1)
- Emoji usage (2)
- Message length (1)
- Emotional tone / deflection (2)
- Conflict response (1)
- Humor style (2)

User selections stored in `calibrations` table. They override extracted patterns in the persona JSON.

### 4.2 Per-message feedback

After every simulated response, the UI shows: thumbs up / thumbs down.

Thumbs down reveals: "Too long" | "Too short" | "Too formal" | "Too casual" | "Wrong tone" | "They wouldn't say this" (+ optional free text: "They'd actually say...")

Every feedback record stored in `corrections` table. This data is training data for Tier 2.

### 4.3 Progressive accuracy stages

| Stage | Trigger | UI label |
|-------|---------|----------|
| 1 | Upload only | "Learning {name}'s style..." |
| 2 | A/B calibration complete | "{name}'s model calibrated" |
| 3 | 10+ message corrections | "{name}'s model refined" |
| 4 | 30+ corrections | "{name}'s model highly tuned" |

Stage transitions re-trigger extraction with corrections included as additional context. This is a background re-extraction call, not a blocking operation.

---

## Module 5: Holdout Accuracy Testing

### 5.1 Holdout split

During parsing (Module 1), reserve 20% of conversation pairs as holdout. Store with `is_holdout = true`. Never include in extraction input.

### 5.2 Accuracy scoring

After extraction, run the simulator against holdout pairs silently:

```ts
export async function scorePersonaAccuracy(
  persona: PersonaProfile,
  holdoutPairs: Array<{ userMessage: string; actualReply: string }>
): Promise<AccuracyScore>
// AccuracyScore = { overall: number; breakdown: { length, vocabulary, tone, style } }
```

Score each dimension 0–100:
- **Length similarity:** AI word count within 50% of actual
- **Vocabulary overlap:** % of distinctive words that appear in both
- **Tone match:** emotional register aligned
- **Style match:** capitalization, punctuation, emoji consistent

Display to user: "Based on your upload, your {name} model is X% accurate." Update the `accuracy_score` column in the `personas` table.

---

## Persona JSON schema (full)

The target shape for extraction output. Store verbatim in `personas.persona_json`:

```ts
interface PersonaJSON {
  meta: {
    name: string;
    messageCountAnalyzed: number;
    personaVersion: string;
    extractionDate: string;
  };
  surfaceStyle: {
    capitalization: "none" | "minimal" | "standard" | "proper";
    capitalizationNotes: string;
    punctuationStyle: "none" | "minimal" | "standard" | "heavy";
    periodUsageMeaning: string;
    avgMessageLength: "short" | "medium" | "long";
    messageLengthVariance: "consistent" | "moderate_variation" | "extreme_variation";
    whenTheySendLongMessages: string;
    doubleTexting: { frequency: "never" | "rare" | "sometimes" | "often" | "always"; pattern: string };
  };
  vocabulary: {
    abbreviationsAlwaysUsed: string[];
    abbreviationsSometimesUsed: string[];
    abbreviationsNeverUsed: string[];
    slangTerms: string[];
    fillerWords: string[];
    uniqueMisspellings: string[];
    wordsTheyOveruse: string[];
    vocabularyLevel: "simple" | "moderate" | "advanced" | "mixed";
  };
  emojiProfile: {
    usageLevel: "none" | "rare" | "moderate" | "heavy";
    primaryEmojis: string[];
    emojiCombinations: string[];
    emojiAsResponse: string;
    emojiMeaningMap: Record<string, string>;
  };
  emotionalPatterns: {
    happinessExpression: string;
    frustrationExpression: string;
    sadnessExpression: string;
    affectionExpression: string;
    anxietyExpression: string;
    emotionalAvailability: "low" | "moderate" | "high";
    vulnerabilityCeiling: string;
  };
  defenseMechanisms: {
    primaryDeflectionMethod: "humor" | "topic_change" | "minimizing" | "non_answer" | "silence";
    deflectionTriggers: string;
    humorAsShield: string;
    minimizingPhrases: string[];
    avoidancePatterns: string;
    passiveAggressionMarkers: string;
  };
  conflictBehavior: {
    fightStyle: "confrontational" | "avoidant" | "passive_aggressive" | "solution_oriented" | "shutdown";
    escalationTriggers: string;
    deEscalationMethod: string;
    apologyStyle: "explicit" | "deflective" | "over_apologetic" | "never_apologizes";
    recoveryPattern: string;
    silentTreatment: string;
  };
  conversationalDynamics: {
    initiativeLevel: "usually_initiates" | "balanced" | "usually_responds";
    conversationStarters: string[];
    conversationEnders: string[];
    engagementIndicators: string;
    disengagementIndicators: string;
    questionAsking: string;
  };
  contextDependentModes: Array<{
    modeName: string;
    trigger: string;
    styleChanges: string;
    example: string;
  }>;
  verbalIdentity: {
    catchphrases: string[];
    sentenceStarters: string[];
    reactionExpressions: string[];
    signOffs: string[];
    humorStyle: "sarcastic" | "self_deprecating" | "absurdist" | "observational" | "dry" | "playful";
    storytellingStyle: string;
  };
  simulationRules: {
    neverDo: string[];
    alwaysDo: string[];
    accuracyWarnings: string[];
  };
  sampleResponses: {
    toCasualGreeting: string;
    toDirectQuestion: string;
    toMakingPlans: string;
    toEmotionalMessage: string;
    toConflict: string;
    toGoodNews: string;
    toBoringMessage: string;
  };
}
```

---

## Database schema additions (add to DATABASE_SCHEMA.md migrations)

```sql
-- Extracted persona profiles
create table public.personas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  contact_id uuid references public.contacts(id) on delete cascade,
  target_name text not null,
  persona_json jsonb not null,
  persona_version text not null default '1.0',
  adapter_id text,                         -- null until Tier 3 LoRA adapters
  correction_count integer not null default 0,
  accuracy_stage integer not null default 1,  -- 1-4 progressive refinement
  accuracy_score real,                      -- from holdout testing (0-100)
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.personas enable row level security;
create policy "users see own personas" on public.personas for select using (auth.uid() = user_id);
create policy "users insert own personas" on public.personas for insert with check (auth.uid() = user_id);
create policy "users update own personas" on public.personas for update using (auth.uid() = user_id);
create policy "users delete own personas" on public.personas for delete using (auth.uid() = user_id);

-- Individual parsed messages (Tier 2 training data + holdout set)
create table public.parsed_messages (
  id bigserial primary key,
  persona_id uuid references public.personas(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  sender text not null check (sender in ('target', 'user', 'other')),
  message_text text not null,
  message_timestamp timestamptz,
  is_holdout boolean not null default false    -- reserved for accuracy testing
);

alter table public.parsed_messages enable row level security;
create policy "users see own parsed messages" on public.parsed_messages for select using (auth.uid() = user_id);
create policy "users insert own parsed messages" on public.parsed_messages for insert with check (auth.uid() = user_id);
create index on public.parsed_messages (persona_id, sender, is_holdout);

-- User corrections on simulation quality (Tier 2 training data)
create table public.corrections (
  id bigserial primary key,
  persona_id uuid references public.personas(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  user_message text not null,
  ai_response text not null,
  correction_type text not null check (correction_type in ('too_long', 'too_short', 'too_formal', 'too_casual', 'wrong_tone', 'wouldnt_say_this', 'thumbs_up')),
  user_alternative text,                       -- what they said the person would actually say
  created_at timestamptz default now() not null
);

alter table public.corrections enable row level security;
create policy "users see own corrections" on public.corrections for select using (auth.uid() = user_id);
create policy "users insert own corrections" on public.corrections for insert with check (auth.uid() = user_id);
create index on public.corrections (persona_id, created_at desc);

-- A/B calibration selections
create table public.calibrations (
  id bigserial primary key,
  persona_id uuid references public.personas(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  dimension_tested text not null,
  option_a text not null,
  option_b text not null,
  user_selected text not null check (user_selected in ('a', 'b')),
  created_at timestamptz default now() not null
);

alter table public.calibrations enable row level security;
create policy "users see own calibrations" on public.calibrations for select using (auth.uid() = user_id);
create policy "users insert own calibrations" on public.calibrations for insert with check (auth.uid() = user_id);
```

**Also add `call_type` to `token_usage` table:**
```sql
alter table public.token_usage add column call_type text check (
  call_type in ('extraction', 'simulation', 'calibration', 'parsing', 'accuracy_scoring', 'stage_reextraction')
);
```

---

## Build order

**Phase 1 (Parser + basic extraction):**
1. `formatDetector.ts` + `regexParser.ts` + `senderDisambiguator.ts`
2. `statisticalAnalyzer.ts` (local stats, no LLM)
3. `extractionPrompt.ts` + `personaExtractor.ts` (one LLM call per upload)
4. Store persona in `personas` table, messages in `parsed_messages` (with holdout flag)

**Phase 2 (Simulation):**
1. `PersonaSimulator.ts` interface + `AnthropicSimulator.ts` Tier 1 implementation
2. `systemPromptBuilder.ts` from persona JSON
3. `contextInjector.ts` (heuristic topic/emotion/mode detection)
4. `conversationManager.ts` (20-message window + summary)
5. `responsePostProcessor.ts` (length/cap/abbrev guardrails)
6. Wire into `ClosureScreen` and `ContactAIChatScreen` via new backend route

**Phase 3 (Training loop + accuracy):**
1. `calibrationGenerator.ts` + UI for A/B picker
2. Per-message thumbs up/down feedback → `corrections` table
3. `accuracyScorer.ts` → run against holdout pairs post-extraction
4. Progressive accuracy stage display in contact profile UI
5. Stage 3/4 re-extraction triggered by correction count thresholds

**Phase 4 (Tier 2 prep — do not build yet):**
1. Export correction + calibration + holdout data as JSONL training format
2. Scaffold `SelfHostedSimulator` class (empty implementation of `PersonaSimulator`)
3. Toggle in `config.ts` to switch simulator: `SIMULATOR=anthropic | self_hosted`

---

## Cost tracking (add to every LLM call in this engine)

Every API call in this engine must log to `token_usage` with `call_type` set:
- `extraction` — one-time persona build
- `simulation` — per chat turn
- `calibration` — A/B pair generation
- `parsing` — unstructured text fallback
- `accuracy_scoring` — holdout evaluation
- `stage_reextraction` — re-run triggered by correction count

This gives real unit economics: cost per persona created, cost per active user per month, cost per correction-driven improvement. You need these numbers before any investor conversation.

---

## Integration points with existing engine

- **Closure mode** (`ClosureScreen` → `/api/chat/closure`): currently uses `partnerContext.sampleMessages`. When persona engine is live, swap `buildClosureSystemPrompt()` to use the full `PersonaJSON` from the `personas` table instead. Backward-compatible: fall back to sample messages if no persona exists.
- **Support mode** (`ContactAIChatScreen` → `/api/chat/support`): currently passes `partnerContext.relationshipMemory`. When persona engine is live, pass the full `PersonaJSON` and use `systemPromptBuilder.ts` to build a richer conditioning context.
- **Intervention mode**: persona context enriches the intervention prompt — knowing that the ex is avoidant and deflects with humor changes what the AI should say about why sending is or isn't a good idea.

---

## What NOT to build in this agent

- Do not build a Tier 2 fine-tuned model or any GPU infrastructure
- Do not build iOS/Android native app integration (this is a web API)
- Do not build Tier 3 LoRA adapter files or inference hot-swapping
- Do not modify `conversationEngine.ts`, `store.ts`, or any route file unless adding a new `/api/persona/*` route
- Do not touch frontend screens directly — coordinate with FRONTEND.md agent

---

## Tier 2 interface specification (reference only — do not build)

```ts
// When Tier 2 arrives, this is all that changes:
// AnthropicSimulator is swapped for SelfHostedSimulator
// The PersonaSimulator interface, systemPromptBuilder, contextInjector,
// conversationManager, and responsePostProcessor are ALL unchanged.

// Privacy claim that becomes possible with Tier 3:
// "Your persona model is yours. adapter_id points to a file containing only
// your data. Base model was trained on anonymized aggregates. Deleting your
// account deletes your adapter."

data PersonaProfile {
  id: string
  targetName: string
  personaJson: PersonaJSON
  personaVersion: string
  adapterId: string | null    // null until Tier 3
  correctionCount: number
  accuracyStage: 1 | 2 | 3 | 4
  accuracyScore: number | null
  createdAt: number
  updatedAt: number
}
```
