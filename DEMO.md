# NOTSENT — Demo & run guide

Use this to run the stack locally and to record a video demo for funders.  
**Agent prompts** (Agent 1 → 2 → 3) and **architecture** are in `docs/`: see `docs/AGENT_PROMPTS_VIDEO_DEMO.md` and `docs/ARCHITECTURE.md`.

---

## How to run

### Backend
```bash
cd backend && npm install && npm run dev
```
Set `ANTHROPIC_API_KEY` in your environment (e.g. in `.env` or export before running).

### App
```bash
cd app && npm install && npm run dev
```
App runs at the URL shown (e.g. `http://localhost:5173`).

### Website (landing page)
Full one-page site: hero, how it works, “Try the demo” (links to app), for-funders section.
```bash
cd website
```
Open `index.html` in a browser, or run:
```bash
npx serve .
```
Then open the URL shown (e.g. http://localhost:3000). The “Try the demo” link points to the app (default http://localhost:5173); change it when you deploy.

---

## Video demo flow (step-by-step)

1. Open the app.
2. **Onboarding:** Add your ex’s contact (name + phone number), then “Open NOTSENT”.
3. **Chat:** Type a message (e.g. “I miss you”) and hit **Send**.
4. **Intervention:** The intervention screen loads and the AI responds. Click **“I won’t send it”**.
5. **Stats:** Go to the Stats tab and show **“Messages stopped”** (and “Messages never sent”) increased.

Repeat once with **“Send anyway”** if you want to show both outcomes.

---

## One-liner for pitch

> NOTSENT intercepts the message before it sends and replaces it with an AI conversation so they process the impulse instead of sending.

---

## Metrics to mention to funders

- **DAU/MAU** — daily and monthly active users
- **Interception rate** — share of send attempts that are intercepted and go to intervention
- **Override rate** — share of interventions where the user chooses “Send anyway”
- **D7 / D30 retention** — users still using the app after 7 and 30 days

(No need to implement these in the MVP; use for the pitch.)

---

## Stats in the app

The Stats screen should show:

- **Messages stopped** — from backend `GET /api/stats` (`interceptionsCount` or equivalent) when the app can reach the backend; otherwise count from `localStorage` `sessions` where `outcome` is `'intercepted'` or `'draft'`.
- **Messages never sent** — from `GET /api/stats` (`messagesNeverSentCount`) when available; otherwise same localStorage fallback.

One line each is enough.
