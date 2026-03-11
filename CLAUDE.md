# NOTSENT — Master Agent Instructions

## What this app is

NOTSENT intercepts messages people are about to send their ex and replaces the send with an AI conversation that helps them process the impulse instead of sending. Three AI modes:

1. **Intervention** — when user hits Send, AI talks them through it in real time
2. **Closure** — simulate texting the ex (AI plays the ex's voice using sample messages) for closure without actually reaching out
3. **Support** — general emotional support chat, no message-interception trigger

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

Before writing any code, load the relevant agent file from `docs/agents/`:

| Task domain | Load this file |
|---|---|
| Any frontend / React / UI / screens / routing | `docs/agents/FRONTEND.md` |
| Any backend / API / routes / AI prompts / engine | `docs/agents/BACKEND.md` |
| Database / auth / persistence / Supabase migration | `docs/agents/SUPABASE.md` |
| E2E tests / Playwright / test coverage | `docs/agents/PLAYWRIGHT.md` |
| Code cleanup / dead code / refactor / consolidation | `docs/agents/REFACTOR.md` |
| Roadmap / task tracking / Notion sync | `docs/agents/NOTION.md` |

For cross-cutting tasks (e.g. adding a new feature end-to-end), load both `FRONTEND.md` and `BACKEND.md`.

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
  Onboarding/AddContactScreen    ← add ex's contact
  Onboarding/YoureSetScreen      ← post-onboarding confirmation
  Login/LoginScreen              ← Google OAuth login
  Chat/ConversationList          ← list of flagged contact threads (tab: Chats)
  Chat/ChatScreen                ← message thread for one contact
  Intervention/InterventionChat  ← AI intervention after hitting Send
  Conversations/ManageConversationsScreen ← view/clear conversation history (tab)
  AIChat/AIChatScreen            ← general AI support chat (tab: AI Chat)
  Stats/StatsScreen              ← messages stopped / never sent (tab: Stats)
  Settings/SettingsScreen        ← breakup context, manage contacts (tab: Settings)
  Contacts/ContactsScreen        ← add/remove contacts (linked from Settings)
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
  engine.ts                      ← engine control routes
engine/
  conversationEngine.ts          ← streamIntervention, streamClosure, streamSupport
  riskAnalysis.ts
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
| Persistence | localStorage + in-memory backend | Supabase (Postgres) |
| Auth | Device ID (no accounts) | Supabase Auth (Google OAuth + email) |
| Realtime | Socket.io (in-process) | Supabase Realtime |
| Deploy | Local dev only | Vercel (frontend) + Railway/Render (backend) or Edge Functions |
| Tests | None | Playwright E2E covering critical flows |
| AI model | claude-sonnet-4-6 | claude-sonnet-4-6 (keep unless cost requires haiku) |

---

## Data flow (canonical)

```
User types → ChatScreen (localStorage write) → hits Send
  → POST /api/session → sessionId stored in sessionStorage
  → navigate to /intervention
  → InterventionChat reads sessionStorage → POST /api/chat (SSE stream)
  → backend builds system prompt (intervention.ts) with userContext + history
  → stream to UI → user picks "I won't send it" (intercepted) or "Send anyway" (sent)
  → PATCH /api/session/:id → updateLocalSessionOutcome() → back to ChatScreen
  → StatsScreen reads GET /api/stats or localStorage fallback
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
