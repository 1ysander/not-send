# NOTSENT — Master Build Plan

> **How to use this document:** Load this before starting any new session. It is the single source of truth for what we are building, in what order, and which agents own which pieces. It sits above all domain agent files in authority. When this document and a domain agent file conflict, this document wins — update the domain file.

---

## What we are building

Two products. One codebase. One AI engine.

### Product 1 — NOTSENT Personal

An emotionally intelligent web app that helps people process the urge to contact their ex — without actually doing it.

**Core loop:**
1. User uploads an exported iMessage conversation (`.txt` from iPhone)
2. AI parses the conversation → learns the ex's writing style, tone, vocabulary
3. Three AI modes available:
   - **Intercept** — user types a message they want to send; AI intervenes in real time before it goes anywhere
   - **Closure** — AI plays the ex's voice (trained on uploaded messages) so the user can have the conversation they never got
   - **AI Support** — general emotional support chat, grounded in the uploaded context

**What makes it different:** No fake advice. No journaling prompts. The AI knows *this* specific person and *this* specific relationship — because it read the actual messages.

### Product 2 — NOTSENT Enterprise (Compliance Layer)

A browser/email plugin businesses install to scan outbound messages before sending. Uses the same Claude backend but a completely separate prompt path.

**What it flags:**
- Legal liability language
- Harassment or hostile tone
- GDPR data leakage (PII in emails)
- Defamatory claims
- Regulatory violations (financial, healthcare)

**Status:** Not yet built. Personal ships first. When building enterprise:
- Add `streamCompliance()` in `backend/src/engine/conversationEngine.ts`
- Add `buildComplianceSystemPrompt()` in `backend/src/prompts/compliance.ts`
- Add `POST /api/chat/compliance` route in `backend/src/routes/chat.ts`
- **Never reuse or modify personal app prompts for compliance**

---

## Authentication and product routing

### The login screen (`/login`)

This is the first thing any user sees. It does two jobs:

1. **Product selection** — before authenticating, the user chooses which product they are using:
   - Personal ("I need to stop texting my ex")
   - Enterprise ("I'm setting up compliance scanning for my team")
2. **Google OAuth** — single sign-on via Supabase Auth

**Design intent:** The product selection should feel like a choice, not a form. Two large cards, emotionally differentiated. Personal is warm, intimate, slightly melancholy. Enterprise is clean, professional, authoritative. User clicks a card → OAuth flow starts → redirect back with product mode set.

**Implementation:**
- Route: `/login` → `screens/Login/LoginScreen.tsx`
- Product mode stored in localStorage after auth: `notsent_product_mode: "personal" | "enterprise"`
- After login + mode selection → `AuthGuard` redirects to the correct root:
  - Personal → `/` (existing tab app)
  - Enterprise → `/enterprise` (future — placeholder for now)
- Supabase Google OAuth is already wired in `lib/supabase.ts` — use `supabase.auth.signInWithOAuth({ provider: "google" })`

### Guard logic (already in `App.tsx`)

```
/login              → LoginScreen (public, always accessible)
/onboarding         → AddContactScreen (requires auth, no onboarding yet)
/                   → AppShell (requires auth + onboarding complete)
/enterprise         → EnterprisePlaceholder (requires auth, product mode = "enterprise")
```

---

## The website (marketing landing page)

> The website is separate from the app. It lives at `website/` in the monorepo and will be deployed to the apex domain. The app lives at `app.notsent.com` (or a subdomain).

### Design direction — non-negotiable

This website must be remarkable. It is the first impression for users, investors, and press.

- **No generic UI.** Not shadcn defaults. Not Bootstrap. Not any template you've seen before.
- **Emotional design.** The product is about heartbreak and restraint. The website should feel like it understands that — calm, intimate, slightly heavy. Think: quiet hotel lobby at 2am, not a SaaS dashboard.
- **Typography-first.** Large, confident headlines. Generous line height. One or two typefaces maximum.
- **Full-viewport sections.** Each scroll beat is its own world. No cramped dashboards.
- **Motion with purpose.** Subtle parallax or fade-in on scroll. Nothing flashy. Nothing that distracts from the words.
- **Dark mode native.** The app is dark. The website should match — or have a deliberate light/dark toggle.

### Tech stack for the website

```
website/
  index.html          ← entry
  src/
    main.ts           ← Vite entry
    styles/           ← Tailwind + custom CSS
    components/       ← Vanilla TS or lightweight React components
    sections/         ← Hero, HowItWorks, ForWho, Pricing, Footer
```

Dependencies:
- Vite + TypeScript
- Tailwind CSS (full config, custom design tokens)
- shadcn/ui primitives (Button, Card) — only where needed
- GSAP or Framer Motion for scroll animations — pick one, commit
- Google Fonts or Fontsource — Geist, Inter, or a more editorial choice
- Vercel for deployment (already in `VERCEL.md`)

### Sections to build (in order)

1. **Hero** — Headline, subheadline, one CTA ("Start free"), product screenshot or motion graphic
2. **How it works** — Three steps: Upload → Intercept → Move on. Visual, not a wall of text.
3. **For who** — Emotional resonance section. "You know who this is for."
4. **The AI** — What the AI actually does, explained without jargon. "It read your messages. It knows them."
5. **Enterprise** — Brief section linking to enterprise waitlist
6. **Footer** — Logo, links, legal

---

## Tech stack (full app)

| Layer | Stack | Notes |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | Strict mode |
| UI components | shadcn/ui (Radix primitives) | Custom theme, not default |
| Styling | Tailwind CSS v3 | Utility-only, no inline styles |
| Routing | React Router v6 | Nested routes, Outlet pattern |
| State | useState + useContext | No Redux. Supabase Realtime for live sync |
| Auth | Supabase Auth (Google OAuth) | Already wired in `lib/supabase.ts` |
| Database | Supabase (Postgres + RLS) | In-memory store is dev-only |
| Realtime | Socket.io (dev) → Supabase Realtime (prod) | Migration in SUPABASE.md |
| AI | Anthropic SDK, `claude-sonnet-4-6`, SSE streaming | Config in `backend/src/ai/model.ts` |
| Backend | Node.js + Express + TypeScript (ESM) | `"type": "module"` |
| Tests | Playwright E2E | See PLAYWRIGHT.md |
| Deploy | Vercel (frontend + website) + Railway (backend) | See VERCEL.md |

---

## Agent hierarchy

Every agent reads `CLAUDE.md` first. Then this file. Then their domain file.

```
CLAUDE.md  ←  master constraints (never violate)
BUILDPLAN.md  ←  what we're building + priority order (this file)
│
├── FRONTEND.md              owns app/src/
│   ├── sub/FRONTEND_CHAT.md         chat bubbles, streaming, intercept overlay
│   ├── sub/FRONTEND_SETTINGS.md     home, upload, settings, stats
│   └── [NEW] sub/FRONTEND_AUTH.md  login screen, product routing, OAuth flow
│
├── BACKEND.md               owns backend/src/
│   ├── sub/AI_ENGINE.md             prompts, model client, streaming
│   ├── sub/DATA_INGESTION.md        iMessage parser, parse route
│   ├── sub/INTERCEPTION_PIPELINE.md intervention pipeline
│   └── [NEW] sub/ENTERPRISE.md     compliance prompt + route (when ready)
│
├── SUPABASE.md              owns database, auth, migrations
│   └── sub/DATABASE_SCHEMA.md      full schema, RLS policies
│
├── [NEW] WEBSITE.md         owns website/ marketing site
│
├── PLAYWRIGHT.md            owns E2E tests
├── REFACTOR.md              dead code cleanup
├── CRORR.md                 documented past mistakes — read every session
├── ORCHESTRATION.md         multi-agent coordination patterns
├── PRODUCT_PIVOT.md         when core mechanic changes
├── NOTION.md                roadmap sync
└── VERCEL.md                deployment
```

### New sub-agents to create

| File | Owns | When to load |
|---|---|---|
| `docs/agents/sub/FRONTEND_AUTH.md` | `screens/Login/LoginScreen.tsx`, `context/AuthContext.tsx`, product mode routing | Any login / auth / product-selection UI work |
| `docs/agents/sub/ENTERPRISE.md` | `backend/src/prompts/compliance.ts`, `routes/chat.ts` compliance route, `screens/Enterprise/` | Enterprise product work |
| `docs/agents/WEBSITE.md` | `website/` directory entirely | Marketing site work |

---

## Parallel agent execution — build phases

### Phase 0 — Foundation (do this first, nothing else depends on it)

Run in parallel:

```
Agent A (FRONTEND + sub/FRONTEND_AUTH):
  Build the new LoginScreen with product selection (Personal / Enterprise)
  Wire Google OAuth via supabase.auth.signInWithOAuth
  Store product mode in localStorage after auth
  Route to correct root on success

Agent B (SUPABASE + sub/DATABASE_SCHEMA):
  Verify Supabase Auth is correctly configured for Google OAuth
  Add product_mode column to user profile table if needed
  Ensure RLS policies are correct for personal vs enterprise users
```

### Phase 1 — Personal app polish (parallel after Phase 0)

```
Agent A (FRONTEND + sub/FRONTEND_CHAT):
  Polish ChatScreen — unified Intercept + AI Support tabs (already built)
  Improve empty states, loading indicators, error handling
  Ensure mobile-first layout is pixel-perfect

Agent B (FRONTEND + sub/FRONTEND_SETTINGS):
  Build HomeScreen hero and upload CTA
  Polish UploadScreen — progress indicator, parse result preview
  Polish SettingsScreen — breakup context form, no-contact counter

Agent C (BACKEND + sub/AI_ENGINE):
  Audit and improve all three system prompts (intervention, closure, support)
  Add relationship memory context to all prompts
  Improve streaming reliability
```

### Phase 2 — Website (parallel, no app dependencies)

```
Agent (WEBSITE):
  Build website/ from scratch
  Hero → How it works → For who → The AI → Enterprise teaser → Footer
  Tailwind custom theme, motion, dark mode
  Deploy to Vercel apex domain
```

### Phase 3 — Enterprise (after Phase 1 ships)

```
Agent A (BACKEND + sub/ENTERPRISE):
  buildComplianceSystemPrompt()
  streamCompliance()
  POST /api/chat/compliance route

Agent B (FRONTEND):
  EnterpriseScreen placeholder with waitlist form
  Route guard for product_mode === "enterprise"
```

### Phase 4 — Production hardening (final phase)

```
Agent A (SUPABASE):
  Full Supabase migration — replace in-memory store + localStorage
  Row-level security for all tables
  Supabase Realtime replacing Socket.io

Agent B (PLAYWRIGHT):
  E2E coverage for: upload flow, intercept flow, closure flow, login, stats

Agent C (REFACTOR):
  Remove all dead code (backend/server.js, connectors/, engine/ at root)
  Audit and remove unused imports, dead screens, stale localStorage keys
```

---

## Current app state — what works today

| Feature | Status | Notes |
|---|---|---|
| Contact management | ✅ Working | Add/remove contacts, profiles |
| Intercept chat | ✅ Working | AI intervention + outcome recording |
| AI Support chat | ✅ Working | Merged into ChatScreen (Intercept / AI Support tabs) |
| iMessage upload + parse | ✅ Working | POST /api/parse-imessage |
| Closure mode | ✅ Working | `/closure/:contactId` |
| Stats | ✅ Working | Interception counts |
| Google OAuth | ✅ Wired | Supabase Auth configured |
| Login screen | ⚠️ Exists | Needs product-selection redesign |
| Website | ❌ Not built | Static placeholder only |
| Enterprise | ❌ Not built | — |
| Supabase persistence | ⚠️ Partial | Auth works; data still in-memory + localStorage |
| E2E tests | ❌ None | — |

---

## Login screen — detailed spec

### Layout

```
Full-page centered layout, dark background.

Top: NOTSENT logo (wordmark, not icon)

Middle: Headline
  "Which one is you?"
  or
  "What are you protecting?"

Two cards side-by-side (or stacked on mobile):

┌─────────────────────────┐  ┌─────────────────────────┐
│  💔  Personal           │  │  🏢  Enterprise          │
│                         │  │                         │
│  "Stop texting them."   │  │  "Protect your company  │
│                         │  │   from what gets sent." │
│  Breakup intervention,  │  │                         │
│  AI closure, emotional  │  │  Compliance scanning,   │
│  support — for you.     │  │  legal review, tone     │
│                         │  │  checking — for teams.  │
│  [Continue with Google] │  │  [Join waitlist]        │
└─────────────────────────┘  └─────────────────────────┘

Bottom: "Private & confidential. We don't store your messages."
```

### Behavior

1. User lands on `/login`
2. They click **Personal** → Google OAuth popup → on success:
   - Set `notsent_product_mode = "personal"` in localStorage
   - If onboarding not complete → `/onboarding`
   - If onboarding complete → `/`
3. They click **Enterprise** → "Join waitlist" form (email capture) → no OAuth yet, just collect email + redirect to thank-you state
   - When enterprise product is built, replace with OAuth → `/enterprise`

### File

- `app/src/screens/Login/LoginScreen.tsx` — already exists, needs redesign
- No new types needed — `notsent_product_mode` key goes in `lib/storage.ts`

---

## Design system — personal app

These tokens are non-negotiable. Every screen must use these.

```css
/* Brand purple */
--color-brand: #bf5af2;
--color-brand-dim: rgba(191, 90, 242, 0.15);

/* Status */
--color-intercepted: #30d158;   /* green — message blocked */
--color-sent: #ff453a;          /* red — message sent anyway */

/* Surfaces — dark mode */
--color-bg: #0a0a0a;
--color-card: #111111;
--color-border: rgba(255,255,255,0.08);

/* Text */
--color-foreground: #f5f5f5;
--color-muted: #6b6b6b;
```

Typography:
- Body: `text-[15px]` / `leading-relaxed`
- Labels: `text-[11px] uppercase tracking-wider font-bold`
- Headings: `text-[22px]` or larger, `font-semibold`
- All text `text-sm` minimum — never smaller for readable content

---

## Hard constraints — repeat from CLAUDE.md

These apply to every agent, every session, no exceptions:

1. **Single entry points.** `backend/src/index.ts` and `app/src/main.tsx` only.
2. **Single source of truth.** All API calls → `api.ts`. All localStorage → `storage.ts`. All types → `types.ts`.
3. **Screens only, no pages.** `app/src/screens/` only. `app/src/pages/` is dead.
4. **No new top-level backend files.** Everything under `backend/src/`.
5. **TypeScript everywhere.** No `.js` logic files.
6. **ESM only on backend.** `.js` extension on all imports.
7. **Streaming AI.** All chat endpoints are SSE. Never non-streaming for chat.
8. **Mobile-first.** Max-width containers, tab navigation, full-bleed.
9. **No in-memory state in production.** `store.ts` is MVP only — target is Supabase.
10. **Never touch enterprise prompt paths from personal code and vice versa.**

---

## What to do next (ordered by impact)

1. **Redesign `LoginScreen`** — product selection (Personal / Enterprise), Google OAuth, polished dark UI
2. **Build `HomeScreen`** — hero, upload CTA, emotional headline, product pitch
3. **Polish `UploadScreen`** — parse progress, result preview ("Found 847 messages with Alex")
4. **Website** — full marketing site build
5. **Enterprise placeholder** — route + waitlist form
6. **Supabase persistence** — migrate from in-memory/localStorage
7. **E2E tests** — Playwright coverage for all critical flows
8. **Refactor** — remove dead code
