# NOTSENT — Repo architecture

Single repo for the NOTSENT MVP: app, backend, landing site, and docs.

---

## Folder map

| Folder | Purpose | Run |
|--------|---------|-----|
| **`app/`** | React (Vite + TypeScript) SPA. Onboarding, conversation list, fake message thread per contact, intervention chat, stats, settings. | `npm run dev` |
| **`backend/`** | Express API. Sessions, stats, Claude intervention (and optional closure) chat. Entry: `server.js`. | `npm run dev` (set `ANTHROPIC_API_KEY`) |
| **`website/`** | Static landing page (HTML/CSS). Hero, how it works, for funders, footer. | Open `index.html` or `npx serve .` |
| **`docs/`** | Run guide, demo script, agent prompts, AI/closure architecture. | — |

---

## App (`app/`)

- **Entry:** `src/App.tsx` — routes for onboarding, `/`, `/chat/:contactId`, `/stats`, `/settings`, `/intervention`.
- **Screens:** `src/screens/` — Onboarding (AddContact, YoureSet), Chat (ConversationList, FakeMessageThread), Intervention (InterventionChat), Stats (StatsScreen), Settings (SettingsScreen).
- **Data:** `src/lib/storage.ts` — localStorage (flagged contacts, sessions, device id, user/partner context). Single source for all storage.
- **API:** `src/api.ts` — single module for backend calls (session, stats, chat, closure, context). Uses `VITE_API_URL` when set.
- **Types:** `src/types.ts` — shared types (FlaggedContact, LocalSession, UserContext, etc.).

No duplicate API or storage modules; no unused `pages/` layer.

---

## Backend (`backend/`)

- **Entry:** `server.js` — Express app, CORS, rate limit, routes: `/health`, `/api/session`, `/api/stats`, `/api/chat`. Optional TypeScript sources in `src/` for prompts and AI logic.
- **Data:** In-memory sessions (MVP); optional persistence later.

---

## Docs

| File | Purpose |
|------|---------|
| **`DEMO.md`** (root) | How to run app, backend, website; video demo flow; pitch one-liner; metrics for funders. |
| **`docs/AGENT_PROMPTS_VIDEO_DEMO.md`** | Copy-paste prompts for Agent 1 → 2 → 3 (app shell, backend + AI, landing + demo). |
| **`docs/MVP_3_AGENT_PLAN.md`** | 3-agent MVP plan, scope, and file structure. |
| **`docs/ARCHITECTURE_AI_AND_CLOSURE.md`** | AI intervention vs closure flow, context, tokens. |

---

## Data flow (MVP)

1. User adds flagged contact → `localStorage` (app).
2. User types in thread and hits Send → `POST /api/session` → sessionStorage (sessionId, messageAttempted) → navigate to `/intervention`.
3. Intervention screen → `POST /api/chat` (stream) → user chooses “I won’t send it” or “Send anyway” → `PATCH /api/session/:id` → back to chat; stats from `GET /api/stats` or localStorage fallback.
