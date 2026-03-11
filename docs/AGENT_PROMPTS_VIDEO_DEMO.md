# NOTSENT — 3 Agent Prompts (Video Demo MVP)

**Use in order:** Agent 1 → Agent 2 → Agent 3. Copy each prompt below into a new Cursor agent chat and run. Goal: ship a recordable MVP and landing page for funding ASAP.

---

## AGENT 1 — App shell + fake send (run first)

Copy everything between the quotes into the agent.

---

Build the NOTSENT MVP app shell and fake message flow. This is for a video demo to get funding — ship fast, no overbuilding.

**Context:** NOTSENT is a breakup intervention app. User adds their ex's contact; when they "send" a message in the app, it never sends — instead they go to an AI chat that helps them process the impulse.

**Tech:** React (Vite) + TypeScript. All in the Breakupfix repo. Create these folders at repo root: `app/`, `backend/`, `website/`.

**1. Onboarding (2 screens, localStorage only)**  
- Screen 1: "Add your ex's contact" — inputs for name and phone number. On submit save to `localStorage` as `flaggedContacts`: `[{ id, name, phoneNumber, dateAdded }]`.  
- Screen 2: "You're set" — short line of copy, one button "Open NOTSENT" that navigates into the main app.  
- If `flaggedContacts` already has at least one entry on load, skip onboarding and go straight to main app.

**2. Main app (after onboarding)**  
- **Tabs:** Chat (default), Stats, Settings.  
- **Chat tab:**  
  - Header shows the first flagged contact's name.  
  - iMessage-style thread: dark background (#0a0a0a), accent #8B5CF6, message bubbles, timestamps.  
  - Text input + Send at bottom.  
  - On Send: do NOT send anywhere. (1) Add the message to the thread as a grey "draft" bubble with a small "never sent" label. (2) Append to `localStorage` `sessions`: `[{ id, timestamp, messageAttempted, outcome: 'draft' }]`. (3) Navigate to route `/intervention`.  
  - The `/intervention` page can be a simple stub for now: title "Intervention" and a back link to Chat.  
- **Stats tab:** One number: "Messages stopped: X" — count of `sessions` where `outcome` is `'intercepted'` or `'draft'`.  
- **Settings tab:** List flagged contacts; add another; remove; "Redo onboarding" (clear `flaggedContacts` and redirect to onboarding).

**3. Data**  
- Only `localStorage`: `flaggedContacts`, `sessions`. No backend calls in this step.

**4. Placeholders**  
- `backend/`: minimal Express app with a single GET route (e.g. `/health` returning OK) so the folder exists.  
- `website/`: single `index.html` with "NOTSENT — Coming soon" so the folder exists.

**5. Style**  
- Dark (#0a0a0a), purple accent (#8B5CF6), system font, minimal. Utility / product feel, not wellness branding.

**Deliver:** App runnable with `npm run dev` in `app/`. Onboarding → Chat → type message → Send → see draft in thread + navigate to stub Intervention page. Stats and Settings work from localStorage.

---

## AGENT 2 — Backend + AI intervention (run after Agent 1)

Copy everything between the quotes into the agent.

---

Wire up the NOTSENT backend and real AI intervention so the video demo shows a live "message intercepted → AI chat" flow.

**Context:** The React app in `app/` already has: onboarding, fake iMessage thread that on Send writes to `sessions` and navigates to `/intervention`, Stats, Settings. `/intervention` is currently a stub. Backend in `backend/` is a placeholder. Your job: real backend APIs + replace the stub with a working Intervention Chat that calls Claude.

**1. Backend (Express, TypeScript) in `backend/`**  
- **POST /api/session** — Body: `{ messageAttempted }`. Create a session in memory (id, messageAttempted, outcome, createdAt). Return `{ sessionId }`.  
- **PATCH /api/session/:id** — Body: `{ outcome }` (`'intercepted'` or `'sent'`). Update that session's outcome.  
- **GET /api/stats** — Return `{ interceptionsCount, messagesNeverSentCount }` from in-memory sessions (interceptions = outcome intercepted; neverSent = intercepted + draft).  
- **POST /api/chat** — Body: `{ sessionId, messageAttempted, messages }` (messages = array of { role, content }). Call Anthropic Claude API (streaming preferred) with the system prompt below; return stream or full text. Use `ANTHROPIC_API_KEY` from env.  
- CORS allow the app origin. Add a simple rate limit (e.g. 20 req/min per IP).  
- **System prompt for Claude (use exactly):**  
  "You are a calm, non-judgmental AI that intercepts messages people are about to send their ex. The user was about to send a message. Your job is not to lecture — it's to help them process the impulse in real time. Start by acknowledging what they were going to say. Then gently help them consider: what outcome they're hoping for, whether sending it would move them toward that, and what they actually need right now that isn't their ex. Never tell them what to do; ask questions. Be warm and brief. If after the conversation they still want to send something, help them write a version they won't regret. Context: the user was about to send: [insert messageAttempted here]."

**2. Intervention Chat screen (`/intervention` in the React app)**  
- Get `sessionId` and `messageAttempted` from route state or sessionStorage (the fake thread should set these when navigating here).  
- On mount: call POST /api/chat with the sessionId, messageAttempted, and messages: `[{ role: 'user', content: 'I was about to send: ' + messageAttempted }]`. Show the AI reply (streamed if you implemented streaming; otherwise show when done). Show a typing indicator while waiting.  
- Two buttons: **"I won't send it"** — call PATCH /api/session/:id with outcome `intercepted`, then navigate back to Chat and refresh stats. **"Send anyway"** — PATCH outcome `sent`, navigate back to Chat.  
- Style: same dark + purple as the rest of the app; readable, minimal.

**3. Wire the fake thread to the backend**  
- When user hits Send in the Chat thread: (1) Call POST /api/session with `messageAttempted`, get `sessionId`. (2) Save `sessionId` and `messageAttempted` to sessionStorage (or pass via route state). (3) Navigate to `/intervention`.  
- Ensure the Intervention Chat reads sessionId and messageAttempted from that storage/state and uses them for the first message and for PATCH.

**Deliver:** Backend runs with `ANTHROPIC_API_KEY` set; app flow: type message → Send → intervention page loads → AI responds → "I won't send it" or "Send anyway" updates session and returns to Chat. Stats (from GET /api/stats or localStorage fallback) reflect the outcome.

---

## AGENT 3 — Landing site + demo script (run after Agent 2, or in parallel)

Copy everything between the quotes into the agent.

---

Create the NOTSENT landing page and video-demo materials so we can show funders the product and how to run it.

**Context:** NOTSENT has a React app in `app/` (onboarding, fake thread, intervention chat, stats, settings) and an Express backend in `backend/` (sessions, Claude chat, stats). You're adding: a public landing site and a clear demo script for recording and pitching.

**1. Landing website in `website/`**  
- Single page.  
- **Hero:** Headline "Stop yourself from texting your ex." Subhead: one line on NOTSENT intercepting the message and opening an AI chat instead.  
- **How it works:** 3 short steps: (1) Flag your ex's number in the app, (2) When you want to text them, open NOTSENT and type there instead, (3) We intercept send and open a calm AI chat so you process the impulse instead of sending.  
- **For funders:** Section "Try the demo" with a link to the running app (e.g. localhost or a URL you'll replace later). Bullet list "Metrics we care about": interceptions, messages never sent, retention.  
- **Footer:** "Request demo" or "Apply for access" and a placeholder contact.  
- **Design:** Dark background (#0a0a0a), purple accent (#8B5CF6), same vibe as the app. No pink, not cheesy.  
- Use plain HTML/CSS/JS or a minimal static generator so it's easy to deploy (e.g. Vercel/Netlify). Replace the placeholder `website/index.html` if it exists.

**2. Stats in the app**  
- Ensure the Stats screen shows "Messages stopped" and "Messages never sent" from backend GET /api/stats when the app can reach it; otherwise fall back to counts from localStorage `sessions`. One line each is enough.

**3. DEMO.md at repo root**  
- **How to run:**  
  - Backend: `cd backend && npm install && npm run dev`, set `ANTHROPIC_API_KEY`.  
  - App: `cd app && npm install && npm run dev`.  
  - Website: `cd website &&` open `index.html` or run a simple static server.  
- **Video demo flow (step-by-step):** Open app → Add ex's contact (name + number) → Open Chat → Type a message (e.g. "I miss you") → Hit Send → Intervention screen loads and AI responds → Click "I won't send it" → Go to Stats and show "Messages stopped" increased.  
- **One-liner for pitch:** "NOTSENT intercepts the message before it sends and replaces it with an AI conversation so they process the impulse instead of sending."  
- **Metrics to mention to funders:** DAU/MAU, interception rate, override rate, D7/D30 retention (no need to implement; just list for the pitch).

**Deliver:** Landing page in `website/` that looks on-brand and explains the product; DEMO.md with run instructions and a repeatable demo script for recording and funding conversations.

---

## Quick reference

| Agent | When to run | Output |
|-------|-------------|--------|
| **1** | First | `app/` (React), stub `backend/` & `website/`, onboarding + fake thread + stub intervention |
| **2** | After 1 | Real backend (session, stats, Claude), working `/intervention` chat, thread wired to API |
| **3** | After 1 (or 2) | Landing page in `website/`, DEMO.md, Stats using API when available |

After all three: you have a recordable flow (onboarding → type → send → AI → "I won't send it" → stats) and a landing page + demo script for funding.
