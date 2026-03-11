# NOTSENT app — architecture (sound & linear)

## Route flow

1. **Onboarding** (unauthenticated)  
   - `/onboarding` — Add ex’s contact  
   - `/onboarding/set` — “You’re set” → enter app  

2. **Main app** (after onboarding; tab bar)  
   - `/` — **Chats** — list of threads (one per flagged contact)  
   - `/chat/:contactId` — thread with that contact; Send → intervention  
   - `/conversations` — **Conversations** — manage history (view/clear per contact or all)  
   - `/stats` — **Stats** — messages stopped / never sent  
   - `/settings` — **Settings** — breakup context, “Manage contacts”, redo onboarding  

3. **Reachable only from within the app**  
   - `/contacts` — **Manage contacts** (add/remove); linked from Settings only, not in tab bar  
   - `/intervention` — AI intervention screen; reached when user hits Send in a thread  

4. **Catch‑all**  
   - `*` → redirect to `/`  

## Data flow

- **Storage:** `lib/storage` — single place for localStorage (contacts, sessions, deviceId, userContext).  
- **API:** `api.ts` — single place for backend calls (session, stats, chat, context).  
- **Types:** `types.ts` — shared types (FlaggedContact, LocalSession, UserContext, etc.).  

Screens import from `lib/storage`, `api`, and `types` only. No circular dependencies.

## Tab order (linear)

**Chats** → **Conversations** → **Stats** → **Settings**

Contacts are managed via Settings → “Manage contacts” → `/contacts`; they are not a top-level tab.
