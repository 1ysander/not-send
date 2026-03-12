# NOTSENT — Master Agent Instructions

## What this is — two products, one engine

### Product 1: NOTSENT (Personal web app)

A website that helps people process the impulse to text their ex — without actually doing it. The entry point is **uploading an exported iMessage conversation** (.txt file from iPhone), which gives the AI full context about the relationship.

Three AI modes:
1. **Intervention** — user types a message they *want* to send; AI talks them through the impulse in real time before it goes anywhere
2. **Closure** — AI plays the ex's voice (trained on the uploaded conversation) so the user can have the conversation they need without real contact
3. **Support** — general emotional support chat, no specific message trigger

**No real-time iMessage integration.** The iMessage bridge is a file upload, not a live hook. User exports the chat from their iPhone as a `.txt` file, uploads it to NOTSENT, and the app parses it to extract the conversation history + the ex's sample messages. That context feeds all three AI modes.

**This is a website, not a phone app.** The UI must look exceptional — emotionally designed, visually polished, full-page web experience. The product *is* the website.

### Product 2: Enterprise Compliance Layer (separate product, shared engine)

A browser/email plugin businesses install to scan outbound messages before sending. Flags legal liability, harassment, GDPR data leakage, defamatory language, and tone issues. Uses the same Claude backend but a completely different prompt path (`business` mode) and different UI.

**Status:** Not yet built. Personal app ships first. When building the compliance layer, add a `streamCompliance()` engine function and `buildComplianceSystemPrompt()` — do not reuse or modify the personal app prompts.

---

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | React 18 + Vite + TypeScript, React Router v6, shadcn/ui, Tailwind |
| Backend | Node.js + Express + TypeScript (ESM, `"type": "module"`), Socket.io |
| AI | Anthropic SDK (`claude-sonnet-4-6`), streaming SSE |
| Storage (current) | In-memory (backend) + localStorage (frontend) |
| Storage (target) | Supabase (Postgres + Auth + Realtime) |
| Tests | Playwright (E2E) |

---

## Monorepo layout

```
Breakupfix/
  app/           React SPA (Vite)
  backend/       Express API
  website/       Static landing page
  docs/
    agents/      ← Agent instruction files (load the relevant one per task)
```

---

## Agent routing — read this first

Before writing any code:
1. Read `docs/agents/CRORR.md` — documented past mistakes. Every agent, every session.
2. Load the relevant domain agent file below.

| Task domain | Load this file |
|---|---|
| Any frontend / React / UI / screens / routing | `docs/agents/FRONTEND.md` |
| Chat UI — bubbles, streaming, interception overlay | `docs/agents/FRONTEND.md` + `docs/agents/sub/FRONTEND_CHAT.md` |
| Upload flow, settings, stats, layout | `docs/agents/FRONTEND.md` + `docs/agents/sub/FRONTEND_SETTINGS.md` |
| Any backend / API / routes / AI prompts / engine | `docs/agents/BACKEND.md` |
| AI prompts / model client / streaming / risk analysis | `docs/agents/BACKEND.md` + `docs/agents/sub/AI_ENGINE.md` |
| iMessage parsing / file upload / data ingestion | `docs/agents/BACKEND.md` + `docs/agents/sub/DATA_INGESTION.md` |
| Interception pipeline / middleware chain | `docs/agents/BACKEND.md` + `docs/agents/sub/INTERCEPTION_PIPELINE.md` |
| Database / auth / persistence / Supabase migration | `docs/agents/SUPABASE.md` |
| Supabase schema design / RLS / migration files | `docs/agents/SUPABASE.md` + `docs/agents/sub/DATABASE_SCHEMA.md` |
| E2E tests / Playwright / test coverage | `docs/agents/PLAYWRIGHT.md` |
| Code cleanup / dead code / refactor / consolidation | `docs/agents/REFACTOR.md` |
| Roadmap / task tracking / Notion sync | `docs/agents/NOTION.md` |
| Agent made a mistake / user corrected direction | `docs/agents/CRORR.md` |
| Product idea or core mechanic is changing | `docs/agents/PRODUCT_PIVOT.md` |
| Multi-agent coordination / parallel execution | `docs/agents/ORCHESTRATION.md` |

For cross-cutting tasks (e.g. adding a new feature end-to-end), load both `FRONTEND.md` and `BACKEND.md` plus the relevant sub-agent files. See `docs/agents/ORCHESTRATION.md` for the full agent hierarchy and parallel execution patterns.

---

## Canonical file map

### Frontend (`app/src/`)

```
App.tsx                          ← route tree, guards
main.tsx                         ← entry, providers
types.ts                         ← ALL frontend types (single source)
api.ts                           ← ALL backend calls (single source)
lib/storage.ts                   ← ALL localStorage access (single source)
lib/utils.ts                     ← cn() and shared helpers
screens/
  Home/HomeScreen                ← landing page / hero with upload CTA
  Upload/UploadScreen            ← file picker + upload + parse progress
  Chat/ChatScreen                ← parsed conversation view + "Intercept" / "Talk to [name]" actions
  Intervention/InterventionChat  ← AI intervention on a draft message (full-screen, no nav)
  Closure/ClosureScreen          ← AI plays the ex's voice (full-screen, no nav)
  AIChat/AIChatScreen            ← general support chat
  Stats/StatsScreen              ← messages intercepted / never sent
  Settings/SettingsScreen        ← breakup context, uploaded conversation management
  Login/LoginScreen              ← Google OAuth (future)
components/
  AppShell.tsx                   ← tab bar + outlet
  ui/                            ← shadcn/ui primitives only
contexts/
  ConversationSocketContext.tsx  ← socket.io client provider
```

### Backend (`backend/src/`)

```
index.ts                         ← Express entry, CORS, rate limit, route mount
socket.ts                        ← socket.io server instance
store.ts                         ← in-memory state (sessions, history, context)
types.ts                         ← ALL backend types (single source)
routes/
  session.ts                     ← POST /api/session, PATCH /api/session/:id
  chat.ts                        ← POST /api/chat (intervention), /chat/closure, /chat/support
  context.ts                     ← PUT/GET /api/context/user, /context/partner
  stats.ts                       ← GET /api/stats
  parse.ts                       ← POST /api/parse-imessage (multipart, iMessage .txt parser)
  engine.ts                      ← engine control routes
engine/
  conversationEngine.ts          ← streamIntervention, streamClosure, streamSupport
  riskAnalysis.ts
  imessageParser.ts              ← parseIMExport(buffer) → { partnerName, sampleMessages[], history[] }
  sendController.ts
  creditUsage.ts
ai/
  model.ts                       ← Anthropic client + model config
  run-prompt.ts                  ← streaming helper
  config.ts
prompts/
  intervention.ts                ← buildInterventionSystemPrompt()
  closure.ts                     ← buildClosureSystemPrompt()
connectors/
  imessage.ts
```

---

## Hard constraints (all agents must follow these)

1. **Single entry points.** Backend entry is `backend/src/index.ts` only. Frontend entry is `app/src/main.tsx` only. Never create new entry files.
2. **Single source of truth per concern.** All frontend API calls go through `app/src/api.ts`. All localStorage goes through `app/src/lib/storage.ts`. All frontend types live in `app/src/types.ts`. All backend types live in `backend/src/types.ts`.
3. **Screens only, no pages.** All route-level components live in `app/src/screens/`. The `app/src/pages/` directory is dead — do not add to it.
4. **No new top-level backend files.** All backend logic lives in `backend/src/`. The `backend/connectors/`, `backend/engine/`, `backend/server.js`, and `backend/server.ts` at the root are legacy dead code — ignore them.
5. **TypeScript everywhere.** No `.js` logic files. All new files are `.ts` or `.tsx`.
6. **ESM only on backend.** `"type": "module"` in `backend/package.json`. All imports use `.js` extension (TypeScript ESM convention).
7. **Streaming AI responses.** All AI chat endpoints return `text/event-stream` SSE. Never use non-streaming for chat.
8. **No auth bypass.** The `OnboardingGuard` in `App.tsx` gates all main app routes. Never remove or weaken it.
9. **Mobile-first UI.** The app is mobile-first. Never design for desktop-first layouts. Max width containers, tab navigation, full-bleed screens.
10. **No in-memory state in production.** The current `store.ts` Map-based state is dev/MVP only. All persistence work targets Supabase.

---

## Current state vs. target state

| Area | Now | Target |
|---|---|---|
| Entry point | Mobile-first tab nav SPA | Upload-first full-page website |
| iMessage bridge | Simulated / manual contact add | Parse exported .txt file from iPhone |
| Persistence | localStorage + in-memory backend | Supabase (Postgres) |
| Auth | Device ID (no accounts) | Supabase Auth (Google OAuth + email) |
| Realtime | Socket.io (in-process) | Supabase Realtime |
| Deploy | Local dev only | Vercel (frontend) + Railway/Render (backend) |
| Tests | None | Playwright E2E covering critical flows |
| AI model | claude-sonnet-4-6 | claude-sonnet-4-6 (keep unless cost requires haiku) |
| Products | 1 (personal) | 2 (personal + enterprise compliance) |

---

## Data flow (canonical)

### Upload flow (entry point for personal app)
```
User lands on homepage
  → clicks "Upload your conversation"
  → selects iMessage .txt export file
  → POST /api/parse-imessage (multipart) → backend parses .txt
  → returns { partnerName, messageCount, sampleMessages[], conversationHistory[] }
  → stored in localStorage via setPartnerContextLocal() + setConversationHistoryLocal()
  → navigate to /chat — user sees parsed conversation summary
```

### Intervention flow (user has a message they want to send)
```
User types draft on /chat → hits "Intercept"
  → POST /api/session → sessionId stored in sessionStorage
  → navigate to /intervention
  → InterventionChat reads sessionStorage → POST /api/chat (SSE stream)
  → backend builds system prompt (intervention.ts) with uploadedContext + history
  → stream to UI → user picks "I won't send it" (intercepted) or "Send anyway" (sent)
  → PATCH /api/session/:id → updateLocalSessionOutcome() → back to /chat
```

### Closure flow
```
User clicks "Talk to [name]" on /chat
  → navigate to /closure
  → ClosureScreen reads partnerContext from localStorage
  → POST /api/chat/closure (SSE) with partnerContext (sample messages from upload)
  → AI plays the ex's voice — free chat toward closure
```

---

## Environment variables

### Frontend (`app/.env`)
```
VITE_API_URL=http://localhost:3001
VITE_GOOGLE_CLIENT_ID=<google_oauth_client_id>
```

### Backend (`backend/.env`)
```
ANTHROPIC_API_KEY=<key>
PORT=3001
SUPABASE_URL=<url>         # when migrated
SUPABASE_SERVICE_KEY=<key> # when migrated
```

---

## AI model config

- Model: `claude-sonnet-4-6`
- Streaming: yes (SSE)
- Max tokens: 1024 per response
- History cap: last 10 turns per session (token cost control)
- Prompt files: `backend/src/prompts/intervention.ts`, `backend/src/prompts/closure.ts`
- Never hardcode the model string outside `backend/src/ai/model.ts`

---

## Naming conventions

- React components: PascalCase, one per file, filename matches component name
- Hooks: `use` prefix, camelCase (`useConversations`, `useFlaggedContacts`)
- Backend route files: camelCase noun (`session.ts`, `chat.ts`, `context.ts`)
- Types: PascalCase interfaces, no `I` prefix
- localStorage keys: `notsent_*` prefix (defined as constants in `storage.ts`)
- Supabase table names: snake_case plural (`sessions`, `user_contexts`, `conversation_turns`)

