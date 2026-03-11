# NOTSENT — AI conversation architecture & closure flow

This doc describes how the AI is used for (1) **intervention** (talk the user out of texting their ex), (2) **conversation history and breakup context**, and (3) the future **closure** flow (simulate texting the ex for closure without reaching out). It also covers **API token usage** and how user/partner data is used to train or condition the model.

---

## 1. Intervention conversation (current)

**Goal:** When the user is about to send a message to their ex, the app intercepts and opens an AI chat that helps them process the impulse instead of sending.

**Flow:**
- User types in the fake thread and hits Send → `POST /api/session` (optional: `userContext`, `deviceId`) → navigate to `/intervention`.
- Intervention screen calls `POST /api/chat` with `sessionId`, `messageAttempted`, `messages`, and optionally `userContext`, `deviceId`, `conversationHistory`.
- Backend builds a **system prompt** that includes:
  - The message they were about to send.
  - Optional **user context**: breakup summary, no-contact days, partner name (so the AI can reference the breakup and their situation).
  - Optional **conversation history**: recent turns from past interventions (so the AI has continuity and doesn’t repeat itself).

**Prompt design:** The intervention prompt is in `backend/src/prompts/intervention.ts`. It tells the model to be calm and non-judgmental, acknowledge what they were going to say, and gently explore what outcome they want and what they need that isn’t their ex. It can reference the breakup and no-contact when provided.

**Token usage:** Each request sends system prompt + `messages`. Adding `userContext` and `conversationHistory` increases tokens. History is capped (e.g. last 10 turns) to limit cost. Conversation turns are persisted per session for continuity and for future token accounting.

---

## 2. User data and conversation history

**Stored for the AI (and eventual token/billing):**

| Data | Where | Use |
|------|--------|-----|
| **User context** | Backend: `userContextByDevice[deviceId]`. App: `localStorage` `notsent_userContext`. | Breakup summary, no-contact days, partner name. Sent with session create and chat so the intervention prompt can reference the breakup. |
| **Conversation history** | Backend: `conversationHistoryBySession[sessionId]`. | Each intervention turn (user + assistant) is appended after the stream. Next request can send this as `conversationHistory` so the model has continuity. |
| **Partner context** | Backend: `partnerContextByDevice[deviceId]`. | For the **closure** flow: partner name + optional sample messages from the ex. |

**API for context:**
- `PUT /api/context/user` — body: `{ deviceId, userContext }`. Saves breakup summary, noContactDays, partnerName.
- `GET /api/context/user?deviceId=` — returns saved user context.
- `PUT /api/context/partner` — body: `{ deviceId, partnerContext }`. Saves partner name and optional `sampleMessages` (for closure).
- `GET /api/context/partner?deviceId=` — returns saved partner context.

The app generates a stable **device id** (`getDeviceId()` in `app/src/lib/storage.ts`) and sends it with session and chat requests so the backend can load user/partner context without accounts.

---

## 3. Closure flow: simulate texting the ex (without reaching out)

**Goal:** Let the user “text” their ex in a safe way to get closure — the AI simulates the ex’s voice (optionally conditioned on sample messages) so the user can say what they need to say and get a response that helps them let go, without actually contacting the ex.

**How it works:**
- **Endpoint:** `POST /api/chat/closure`.
- **Body:** `messages` (conversation so far), `partnerContext` (required: `partnerName`; optional: `sampleMessages` from the ex), and optionally `userContext`, `deviceId`.
- **System prompt:** Built in `backend/src/prompts/closure.ts`. It tells the model it is simulating the partner for a closure-only conversation: respond in character (using sample messages for tone/style), but with the goal of helping the user move on. Not the real ex; no real send.

**Training / conditioning the model on the partner:**
- We do **not** fine-tune the model. We use **prompt conditioning**:
  - **Partner context** includes optional `sampleMessages`: past texts from the ex that the user uploads or pastes. These are injected into the system prompt so the model can match tone and style.
  - More samples = more tokens per request; in production you’d cap count and length and track usage for billing.

**Applying eventual usage for API tokens:**
- All AI calls (intervention and closure) go through the same backend and use the same API key. To apply token-based usage/billing later:
  - Log request/response token counts (e.g. from Anthropic’s usage in the response).
  - Associate usage with `deviceId` (or user id when you add accounts).
  - Enforce limits or charge per device/user based on that usage.

---

## 4. File reference

| Area | Files |
|------|--------|
| **Intervention prompt** | `backend/src/prompts/intervention.ts` |
| **Closure prompt** | `backend/src/prompts/closure.ts` |
| **Chat routes** | `backend/src/routes/chat.ts` (intervention + closure) |
| **Context routes** | `backend/src/routes/context.ts` (user + partner context) |
| **Store** | `backend/src/store.ts` (sessions, conversation history, user/partner context by device) |
| **Types** | `backend/src/types.ts` (`UserContext`, `PartnerContext`, `ConversationTurn`) |
| **App context** | `app/src/lib/storage.ts` (deviceId, getUserContext, setUserContextLocal) |
| **App API** | `app/src/api/client.ts` (createSession, streamChat, streamClosureChat, saveUserContextToBackend) |
| **Settings UI** | `app/src/screens/Settings/SettingsScreen.tsx` (breakup summary, no-contact days, save context) |

---

## 5. Summary

- **Intervention:** AI talks the user out of sending, with optional breakup context and conversation history for continuity. History is stored per session and can be sent with the next request; token usage grows with history and context.
- **User/partner data:** User context (breakup, no-contact, partner name) and partner context (name + sample messages) are stored by `deviceId` and sent to the API so the model can be conditioned on the user’s situation and, for closure, on the ex’s voice.
- **Closure:** Separate endpoint and prompt simulate the ex for a closure conversation; no real message is sent. Partner “training” is done via prompt conditioning (sample messages), not model fine-tuning.
- **API tokens:** Architecture is set up to log and attribute token usage by device (or user) so you can apply limits or billing later.
