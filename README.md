# NOTSENT — AI Breakup Intervention App

> **This is a public shell / reference architecture.** All API keys, credentials, and personal data have been removed. The project is shared for reference and learning purposes only — it is not a deployable product in its current state.

---

## What this is

NOTSENT is an AI-powered web app that helps people process the impulse to text their ex — without actually doing it. Users upload an exported iMessage conversation (`.txt` from iPhone), and the AI uses that context to power three modes:

1. **Intervention** — You write the message you *want* to send. The AI talks you through the impulse before it goes anywhere.
2. **Closure** — The AI plays your ex's voice (trained on the uploaded conversation) so you can have the conversation you need without real contact.
3. **Support** — General emotional support chat.

No live iMessage integration. No real contact. Just processing.

---

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | React 18 + Vite + TypeScript, React Router v6, shadcn/ui, Tailwind |
| Backend | Node.js + Express + TypeScript (ESM) |
| AI | Anthropic Claude / Groq / Gemini (switchable via `AI_PROVIDER` env var) |
| Streaming | Server-Sent Events (SSE) |
| Storage | In-memory (dev) → Supabase Postgres (prod target) |
| Auth | Supabase Auth (Google OAuth) |

---

## Project structure

```
Breakupfix/
  app/           React SPA (Vite)
  backend/       Express API
  website/       Static landing page
  supabase/      Database migrations
  docs/          Agent instruction files + build plan
```

---

## Setup

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/) and/or [Groq API key](https://console.groq.com/)
- Optionally: a [Supabase](https://supabase.com/) project for persistence

### 1. Clone

```bash
git clone https://github.com/1ysander/Breakupfix.git
cd Breakupfix
```

### 2. Install dependencies

```bash
cd app && npm install
cd ../backend && npm install
```

### 3. Configure environment variables

```bash
# Frontend
cp app/.env.example app/.env

# Backend
cp backend/.env.example backend/.env
```

Fill in your own API keys in both `.env` files. See the `.env.example` files for all required variables.

### 4. Run

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd app && npm run dev
```

Frontend runs on `http://localhost:5173`, backend on `http://localhost:3001`.

---

## AI provider

Set `AI_PROVIDER` in `backend/.env` to switch between providers:

| Value | Provider | Model |
|---|---|---|
| `anthropic` | Anthropic | claude-sonnet-4-6 |
| `groq` | Groq | llama-3.3-70b-versatile |
| `gemini` | Google Gemini | gemini-1.5-pro |

---

## Key architecture decisions

- **Single API entrypoint:** All frontend calls go through `app/src/api.ts`
- **Single localStorage layer:** All local persistence goes through `app/src/lib/storage.ts`
- **SSE streaming:** All AI chat responses use Server-Sent Events — never polling
- **Persona engine:** One-time extraction from uploaded iMessage file produces a compressed style fingerprint stored per contact — not re-extracted on every call
- **Memory engine:** Rolling window + compression to keep context costs low across long conversations

---

## What's missing to make this deployable

- [ ] Real API keys (see Setup above)
- [ ] Supabase project with migrations applied (`supabase/migrations/`)
- [ ] Google OAuth client configured in Supabase dashboard
- [ ] Deployment config (Vercel for frontend, Railway/Render for backend)

---

## License

MIT — use freely, build on it, don't sue anyone.
