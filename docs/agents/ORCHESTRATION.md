# ORCHESTRATION — NOTSENT Multi-Agent System

> How to assign work across agents and sub-agents. Read this when a task spans multiple domains or when you need to spawn sub-agents.

---

## Agent hierarchy

```
CLAUDE.md (master instructions — every agent reads this first)
│
├── BACKEND.md           ← owns backend/src/
│   ├── sub/AI_ENGINE.md            ← backend/src/ai/ + backend/src/prompts/
│   ├── sub/DATA_INGESTION.md       ← backend/src/engine/imessageParser.ts + routes/parse.ts
│   └── sub/INTERCEPTION_PIPELINE.md ← engine/conversationEngine.ts + pipeline design
│
├── FRONTEND.md          ← owns app/src/
│   ├── sub/FRONTEND_CHAT.md        ← components/chat/ + screens/Chat/ + AIChat/ + Intervention/ + Closure/
│   └── sub/FRONTEND_SETTINGS.md   ← screens/Home/ + Upload/ + Settings/ + Stats/ + components/layout/
│
├── SUPABASE.md          ← owns database schema + auth + migration phases
│   └── sub/DATABASE_SCHEMA.md     ← full target schema, RLS policies, migration files
│
├── PLAYWRIGHT.md        ← owns E2E tests
├── REFACTOR.md          ← dead code cleanup
├── CRORR.md             ← past mistakes — read before every session
├── NOTION.md            ← roadmap / task tracking
├── PRODUCT_PIVOT.md     ← use when core mechanic changes
└── VERCEL.md            ← deployment
```

---

## Agent routing — which file to load

| Task | Load |
|------|------|
| Building AI prompts / model layer / streaming | BACKEND.md + sub/AI_ENGINE.md |
| Parsing iMessage files / upload API | BACKEND.md + sub/DATA_INGESTION.md |
| Interception flow / pipeline architecture | BACKEND.md + sub/INTERCEPTION_PIPELINE.md |
| Any backend route, store, or type not above | BACKEND.md |
| Chat UI (bubbles, streaming, overlay) | FRONTEND.md + sub/FRONTEND_CHAT.md |
| Upload flow / settings / stats / layout | FRONTEND.md + sub/FRONTEND_SETTINGS.md |
| Any frontend route, hook, or component not above | FRONTEND.md |
| Supabase schema / RLS / migrations | SUPABASE.md + sub/DATABASE_SCHEMA.md |
| Code cleanup / dead file removal | REFACTOR.md |
| E2E test coverage | PLAYWRIGHT.md |
| Agent made a mistake / user corrected | CRORR.md (read + add entry) |
| Product vision is changing | PRODUCT_PIVOT.md |

For cross-cutting features (e.g. "add a new AI mode end-to-end"): load BACKEND.md + sub/AI_ENGINE.md + FRONTEND.md + sub/FRONTEND_CHAT.md.

---

## Parallel sub-agent execution

Independent domains can run in parallel. Use this when the task has clear boundaries:

```
# Example: add "Support mode" end-to-end

Parallel batch 1 (no dependencies between them):
  Agent A (AI_ENGINE):    Build buildSupportSystemPrompt() + streamSupport()
  Agent B (FRONTEND_CHAT): Build AIChatScreen with streaming support mode

Sequential (depends on batch 1):
  Agent C (BACKEND):      Wire POST /api/chat/support route → calls streamSupport()
  Agent D (PLAYWRIGHT):   Write E2E test for the full support chat flow
```

---

## Sub-agent isolation rules

Each sub-agent owns a strict file boundary. Violations cause merge conflicts and regression bugs.

| Sub-agent | May write to | May read from |
|-----------|-------------|---------------|
| AI_ENGINE | `backend/src/ai/`, `backend/src/prompts/`, `engine/conversationEngine.ts` | `backend/src/types.ts` (read-only), `engine/riskAnalysis.ts` |
| DATA_INGESTION | `backend/src/engine/imessageParser.ts`, `backend/src/routes/parse.ts` | `backend/src/types.ts` (read-only) |
| INTERCEPTION_PIPELINE | `backend/src/engine/conversationEngine.ts` (shared with AI_ENGINE — coordinate) | All backend/src/ (read-only except owned files) |
| FRONTEND_CHAT | `app/src/components/chat/`, chat-related screens | `app/src/api.ts`, `app/src/lib/storage.ts`, `app/src/types.ts` (read-only) |
| FRONTEND_SETTINGS | `app/src/screens/{Home,Upload,Settings,Stats}/`, `app/src/components/layout/` | Same as FRONTEND_CHAT |
| DATABASE_SCHEMA | `supabase/migrations/` | `SUPABASE.md`, existing schemas |

**Shared file contention:** `conversationEngine.ts` is owned by both AI_ENGINE and INTERCEPTION_PIPELINE. If both agents are active simultaneously, the INTERCEPTION_PIPELINE agent owns the function signatures and pipeline structure; AI_ENGINE owns the prompt-building calls inside those functions.

---

## Cross-agent data contracts

These interfaces are the contracts between agents. Changing them requires coordinating both sides.

### Backend → Frontend (API response types)

```ts
// ParsedConversation — returned by POST /api/parse-imessage
// Defined in: backend/src/engine/imessageParser.ts
// Consumed by: FRONTEND_SETTINGS (UploadScreen)
interface ParsedConversation {
  partnerName: string;
  messageCount: number;
  sampleMessages: Array<{ fromPartner: boolean; text: string; timestamp: string }>;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
}

// SSE chat token — emitted by all /api/chat/* endpoints
// Defined in: backend/src/routes/chat.ts
// Consumed by: FRONTEND_CHAT (all chat screens)
// Format: "data: {\"text\":\"...\"}\n\n" or "data: [DONE]\n\n"
```

### Frontend storage → Backend request body

```ts
// UserContext — stored in localStorage, sent in chat request bodies
// Defined in: app/src/types.ts (frontend) + backend/src/types.ts (backend)
// These must be kept in sync — any field added to one must be added to the other
interface UserContext {
  breakupSummary?: string;
  partnerName?: string;
  noContactDays?: number;
  conversationContext?: string;
}
```

---

## Feature implementation checklist (cross-agent)

When adding a new feature end-to-end:

```
[ ] 1. Types updated in backend/src/types.ts
[ ] 2. Types updated/synced in app/src/types.ts
[ ] 3. Backend: store function added to store.ts (if new data persisted)
[ ] 4. Backend: prompt function added to prompts/[name].ts (if AI involved)
[ ] 5. Backend: engine function added to conversationEngine.ts
[ ] 6. Backend: route handler added to routes/[name].ts
[ ] 7. Backend: route mounted in index.ts
[ ] 8. Frontend: API call added to api.ts
[ ] 9. Frontend: storage function added to lib/storage.ts (if localStorage needed)
[ ] 10. Frontend: UI component built in components/ or screens/
[ ] 11. Frontend: route added to App.tsx if new screen
[ ] 12. E2E test added in Playwright covering the critical path
[ ] 13. CRORR.md updated if anything went wrong during implementation
```

---

## Current build priorities (Phase 1 MVP)

Ordered by dependency and impact:

1. **Upload flow** — `parseIMExport()` + `POST /api/parse-imessage` + `UploadScreen` (DATA_INGESTION + FRONTEND_SETTINGS)
2. **Support chat** — `buildSupportSystemPrompt()` + `streamSupport()` + `AIChatScreen` (AI_ENGINE + FRONTEND_CHAT)
3. **Home screen** — `HomeScreen` hero + upload CTA (FRONTEND_SETTINGS)
4. **Web layout** — `Layout` + `Sidebar` (FRONTEND_SETTINGS)
5. **Risk analysis** — `analyzeRisk()` wired into intervention flow (AI_ENGINE + INTERCEPTION_PIPELINE)
6. **Settings** — AI context form + no-contact counter (FRONTEND_SETTINGS + SUPABASE)
7. **Stats** — streak + interception count (FRONTEND_SETTINGS + BACKEND)
8. **Supabase migration** — Phase 1 auth (SUPABASE + DATABASE_SCHEMA)
