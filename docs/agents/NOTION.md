# NOTION Agent — NOTSENT Roadmap & Task Tracking

> Load this file when syncing tasks, roadmap, or product decisions with Notion. Read `CLAUDE.md` first.

---

## Purpose

This file defines how development work maps to Notion so that code changes and product decisions stay in sync. The agent using this file is responsible for translating code state into Notion tasks and vice versa.

---

## Notion database structure

### `NOTSENT Tasks` database

| Property | Type | Values |
|---|---|---|
| Name | Title | Task name |
| Status | Select | `Backlog`, `In Progress`, `Done`, `Blocked` |
| Area | Multi-select | `Frontend`, `Backend`, `Supabase`, `AI/Prompts`, `Tests`, `Infra`, `Design` |
| Priority | Select | `P0 — Critical`, `P1 — High`, `P2 — Normal`, `P3 — Low` |
| Sprint | Select | Current sprint label (e.g. `Sprint 1`) |
| Notes | Text | Context, links to files, decisions |

### `NOTSENT Decisions` database

| Property | Type |
|---|---|
| Decision | Title |
| Date | Date |
| Context | Text |
| Outcome | Text |
| Area | Multi-select |

---

## Current roadmap (translate to Notion tasks)

### P0 — Critical (blocking demo/launch)

| Task | Area | Notes |
|---|---|---|
| Delete all dead code (server.js, top-level connectors/, pages/) | Backend, Frontend | See `REFACTOR.md` for full list |
| Fix backend entry point to src/index.ts only | Backend | server.js and server.ts must be removed |
| Verify intervention flow works end to end | Frontend, Backend | Test: type → Send → intervention → choose outcome → stats update |
| Deploy frontend to Vercel | Infra | Set `VITE_API_URL` to production backend |
| Deploy backend to Railway or Render | Infra | Set `ANTHROPIC_API_KEY` and CORS origin |

### P1 — High (next milestone)

| Task | Area | Notes |
|---|---|---|
| Supabase auth (Google OAuth) | Supabase, Frontend | Replace device ID with real accounts |
| Supabase sessions table | Supabase, Backend | Replace in-memory sessions Map |
| Supabase conversation history | Supabase, Backend | Replace conversationHistoryBySession Map |
| Closure screen UI | Frontend | `/closure/:contactId` route, uses `/api/chat/closure` |
| Token usage logging | Backend | Log input/output tokens per AI call, store by user_id |
| Playwright tests: intervention flow (P0 flows) | Tests | See `PLAYWRIGHT.md` |

### P2 — Normal (growth features)

| Task | Area | Notes |
|---|---|---|
| No-contact streak counter | Frontend, Backend | Days without sending, shown on Stats |
| Push notifications | Infra, Backend | Remind user before they open their ex's chat |
| Partner context per contact | Frontend, Backend, Supabase | Not global — per flagged contact |
| Risk analysis on messageAttempted | Backend, AI/Prompts | Score urgency/sentiment to personalize intervention |
| Closure: sample message upload | Frontend | User pastes ex's texts into Settings |

### P3 — Low (polish)

| Task | Area | Notes |
|---|---|---|
| Onboarding polish | Frontend, Design | Animation, better empty state |
| Dark mode | Frontend, Design | Tailwind dark: classes |
| Analytics (Posthog or Amplitude) | Infra | DAU, interception rate, override rate |
| Share stats card | Frontend | "I stopped X messages this month" shareable image |

---

## Sprint cadence

Each sprint = 1 week. At start of sprint:
1. Pull all `Backlog` P0/P1 tasks → set to `In Progress`
2. At end of sprint: set completed tasks to `Done`, move blocked to `Blocked` with note

---

## How to create a Notion task from code

When a new task is identified during coding:

1. Title: clear action verb + noun (`Add Supabase sessions table`, not `Supabase stuff`)
2. Area: tag every relevant domain
3. Priority: use these rules:
   - P0: blocks demo, launch, or another P0 task
   - P1: needed for next release milestone
   - P2: improves product materially but not blocking
   - P3: polish, nice-to-have
4. Notes: include the relevant file path(s) and a 1-line description of what changes

---

## Architecture decisions to document in Notion

Add these to the `NOTSENT Decisions` database:

| Decision | Outcome |
|---|---|
| In-memory store for MVP | Accepted; Supabase migration planned for Phase 1 |
| Device ID instead of accounts | Accepted for MVP; Google OAuth via Supabase is next |
| claude-sonnet-4-6 as default model | Accepted; downgrade to haiku only if cost is unsustainable |
| SSE streaming for all AI chat | Accepted; do not switch to polling |
| No fine-tuning — prompt conditioning only | Accepted; sample messages injected into system prompt |
| ESM on backend | Accepted; all imports use .js extension |
| shadcn/ui for component library | Accepted; do not mix with other component libraries |

---

## Notion ↔ Code sync rules

1. Every file in `docs/agents/` maps to a Notion `Area` — when these files change, update affected tasks
2. When a `P0` task is completed in code, mark it `Done` in Notion immediately
3. When a new architectural constraint is added to `CLAUDE.md`, add a corresponding Decision record in Notion
4. The `REFACTOR.md` checklist maps directly to tasks in Notion under `Area: Backend + Frontend`, `Priority: P0`
