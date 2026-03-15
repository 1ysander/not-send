# Supabase Migration Sprint

> 3-agent parallel build plan. Read this + `CLAUDE.md` + `docs/agents/SUPABASE.md` before starting any task.
> Full schema reference: `docs/agents/sub/DATABASE_SCHEMA.md`

---

## What you (the human) must do first — blockers

These cannot be automated. Do these before running any agent.

### Step 1 — Create Supabase project
1. Go to [supabase.com](https://supabase.com) → New project
2. Name: `notsent-prod` (or `notsent-dev` for a local dev project)
3. Region: closest to you
4. Save the database password somewhere safe

### Step 2 — Get your keys
In your Supabase project → **Settings → API**:
- Copy `Project URL` → this is `SUPABASE_URL`
- Copy `anon / public` key → this is `SUPABASE_ANON_KEY`
- Copy `service_role` key → this is `SUPABASE_SERVICE_KEY` (never expose to frontend)

### Step 3 — Enable Google OAuth
In Supabase → **Authentication → Providers → Google**:
1. Enable it
2. Add your Google OAuth Client ID + Secret (from Google Cloud Console)
3. Add authorized redirect URI: `http://localhost:5173` (dev) + your prod domain when ready
4. Save

### Step 4 — Add env vars

**`app/.env`** (create if missing):
```
VITE_SUPABASE_URL=https://<your-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_API_URL=http://localhost:3001
VITE_GOOGLE_CLIENT_ID=<google-client-id>
```

**`backend/.env`** (create if missing):
```
ANTHROPIC_API_KEY=<existing-key>
PORT=3001
SUPABASE_URL=https://<your-ref>.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key>
```

### Step 5 — Run the schema SQL
After Agent 1 finishes, it will output a single SQL file at `supabase/migrations/001_initial_schema.sql`.
Paste the entire contents into **Supabase → SQL Editor → New query → Run**.
Verify all 7 tables appear in **Table Editor**.

---

## Agent assignments

These 3 agents run in this order:
1. **Agent 1** runs alone first (writes SQL + client setup)
2. **Agent 2 + Agent 3** run in parallel after Agent 1 is done and you've run the SQL

---

## Agent 1 — Infrastructure Setup

**Load:** `SUPABASE.md` + `sub/DATABASE_SCHEMA.md`
**Owns:** SQL migrations, Supabase client files, env validation
**Runs:** First, alone. Nothing else can start until this is done.

### Tasks

- [ ] **1.1** Install `@supabase/supabase-js` in both `app/` and `backend/`
  ```bash
  cd app && npm install @supabase/supabase-js
  cd ../backend && npm install @supabase/supabase-js
  ```

- [ ] **1.2** Create `app/src/lib/supabase.ts`
  - Export `supabase` client using anon key + `VITE_SUPABASE_URL`
  - Throw clear error if env vars missing

- [ ] **1.3** Create `backend/src/lib/supabase.ts`
  - Export `supabaseAdmin` using service key (bypasses RLS)
  - `auth: { autoRefreshToken: false, persistSession: false }`
  - Throw on missing env vars at startup

- [ ] **1.4** Write `supabase/migrations/001_initial_schema.sql`
  Full schema in order:
  1. `profiles` table + auto-create trigger from `auth.users`
  2. `flagged_contacts` + RLS
  3. `sessions` + RLS
  4. `conversation_turns` + RLS
  5. `user_contexts` + RLS
  6. `partner_contexts` + RLS
  7. `token_usage` + RLS

- [ ] **1.5** Add `contact_ai_chat_history` table to migration
  ```sql
  create table public.contact_ai_chat_history (
    id bigserial primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    contact_id uuid references public.flagged_contacts(id) on delete cascade not null,
    role text not null check (role in ('user', 'assistant')),
    content text not null,
    created_at timestamptz default now() not null
  );
  alter table public.contact_ai_chat_history enable row level security;
  create policy "users see own chat history" on public.contact_ai_chat_history
    for select using (auth.uid() = user_id);
  create policy "users insert own chat history" on public.contact_ai_chat_history
    for insert with check (auth.uid() = user_id);
  ```

- [ ] **1.6** Add `mood_log` table to migration
  ```sql
  create table public.mood_log (
    id bigserial primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    date date not null,
    score integer not null check (score between 1 and 10),
    note text,
    journal text,
    unique(user_id, date)
  );
  alter table public.mood_log enable row level security;
  create policy "users see own mood" on public.mood_log
    for select using (auth.uid() = user_id);
  create policy "users insert own mood" on public.mood_log
    for insert with check (auth.uid() = user_id);
  create policy "users update own mood" on public.mood_log
    for update using (auth.uid() = user_id);
  ```

- [ ] **1.7** Verify: check all 9 tables have RLS enabled before handing off

**Handoff:** Tell the user to run `supabase/migrations/001_initial_schema.sql` in the SQL editor. Then Agents 2 + 3 can start.

---

## Agent 2 — Backend Migration

**Load:** `BACKEND.md` + `SUPABASE.md`
**Owns:** `backend/src/store.ts`, `backend/src/routes/`
**Runs:** In parallel with Agent 3, after Agent 1 is done and SQL is run.
**Hard rule:** Keep all function signatures identical — only replace internals.

### Tasks

- [ ] **2.1** Replace `createSession` in `store.ts`
  - Accept `userId: string` as required param
  - Insert into `sessions` table via `supabaseAdmin`
  - Return same `Session` shape as before

- [ ] **2.2** Replace `getSession` in `store.ts`
  - Query `sessions` by `id` via `supabaseAdmin`
  - Return `Session | undefined`

- [ ] **2.3** Replace `getAllSessions` in `store.ts`
  - Query all sessions for a `userId`
  - Update `GET /api/stats` route to pass `userId`

- [ ] **2.4** Replace `appendConversationTurn` in `store.ts`
  - Insert into `conversation_turns` via `supabaseAdmin`
  - Accept `userId: string` as new required param

- [ ] **2.5** Replace `getConversationHistory` in `store.ts`
  - Query `conversation_turns` by `session_id` ordered by `created_at`

- [ ] **2.6** Replace `setUserContext` / `getUserContext` in `store.ts`
  - Upsert into `user_contexts` via `supabaseAdmin` with `onConflict: "user_id"`
  - Return mapped `UserContext` shape

- [ ] **2.7** Replace `setPartnerContext` / `getPartnerContext` in `store.ts`
  - Upsert into `partner_contexts` via `supabaseAdmin`

- [ ] **2.8** Add token logging in `backend/src/engine/conversationEngine.ts`
  - After each `stream.finalMessage()`, insert into `token_usage`
  - Fields: `user_id`, `session_id`, `mode`, `model`, `input_tokens`, `output_tokens`

- [ ] **2.9** Update `POST /api/session` route
  - Expect `userId` in request body
  - Pass to `createSession()`

- [ ] **2.10** Update `GET /api/stats` route
  - Accept `userId` query param
  - Query `sessions` table counts by outcome

- [ ] **2.11** Delete the 4 in-memory Maps from `store.ts` once all functions are replaced
  - `sessions`, `conversationHistoryBySession`, `userContextByDevice`, `partnerContextByDevice`

### Verification
- Restart backend → contacts and sessions persist across restarts
- `GET /api/stats?userId=<id>` returns real counts

---

## Agent 3 — Frontend Migration

**Load:** `FRONTEND.md` + `SUPABASE.md` + `sub/FRONTEND_AUTH.md`
**Owns:** `app/src/lib/storage.ts`, `app/src/context/AuthContext.tsx`, `app/src/api.ts`
**Runs:** In parallel with Agent 2, after Agent 1 is done and SQL is run.
**Hard rule:** Never query Supabase directly from components — all reads/writes go through `storage.ts` or `api.ts`.

### Subtasks

#### Auth
- [ ] **3.1** Update `AuthContext.tsx` to use Supabase session
  - Replace any device-ID-based auth with `supabase.auth.getSession()`
  - `onAuthStateChange` listener to keep session reactive
  - Expose `user.id` (UUID) as the canonical user identifier everywhere auth context is consumed

- [ ] **3.2** Update `LoginScreen.tsx`
  - Use `supabase.auth.signInWithOAuth({ provider: "google" })` (already partially wired)
  - After login success, read product mode from localStorage (already stored)

#### Contacts
- [ ] **3.3** Add `addFlaggedContactRemote()` to `storage.ts`
  - Insert into `flagged_contacts` via `supabase` client
  - Keep localStorage write as cache fallback
  - Return `FlaggedContact` with Supabase-generated UUID

- [ ] **3.4** Add `getFlaggedContactsRemote()` to `storage.ts`
  - Query `flagged_contacts` for authenticated user
  - Merge with localStorage cache (Supabase is source of truth)

- [ ] **3.5** Add `removeFlaggedContactRemote()` to `storage.ts`
  - Delete from `flagged_contacts` by id
  - Also clear localStorage cache entry

- [ ] **3.6** Update `AddContactScreen.tsx` + `ContactProfileScreen.tsx` to use remote functions
  - Replace `addFlaggedContact()` → `addFlaggedContactRemote()`
  - Propagate `userId` from auth context

#### Chat history
- [ ] **3.7** Add `getContactAIChatHistoryRemote()` to `storage.ts`
  - Query `contact_ai_chat_history` by `contact_id` ordered by `created_at`
  - Map rows → `AIChatMessage[]`

- [ ] **3.8** Add `appendContactAIChatMessageRemote()` to `storage.ts`
  - Insert single `AIChatMessage` into `contact_ai_chat_history`
  - Called after each message (user send + assistant stream complete)

- [ ] **3.9** Update `ChatScreen.tsx` to use remote history functions
  - Load history from Supabase on mount
  - Persist messages to Supabase after each turn

#### Mood log
- [ ] **3.10** Add `logMoodRemote()` to `storage.ts`
  - Upsert into `mood_log` with `onConflict: "user_id,date"`

- [ ] **3.11** Add `getMoodLogRemote()` to `storage.ts`
  - Query all `mood_log` rows for user, ordered by date

- [ ] **3.12** Update `StatsScreen.tsx` to use remote mood functions

#### Contact profiles
- [ ] **3.13** Add `getContactProfileRemote()` + `setContactProfileRemote()` to `storage.ts`
  - Read/write to `partner_contexts` table via `api.ts` (backend proxies Supabase for RLS safety)
  - Keep localStorage write as cache

#### Cleanup
- [ ] **3.14** Remove `getDeviceId()` from `storage.ts` once all `userId` calls use Supabase auth
- [ ] **3.15** Remove `setFlaggedContacts()` direct localStorage writes from all call sites
  - Replace with remote + cache pattern

### Verification
- Sign out → sign back in → contacts + chat history reloads from Supabase
- Two different browsers show same data for same Google account

---

## Parallel execution summary

```
YOU                    Agent 1              Agent 2         Agent 3
─────────────────────────────────────────────────────────────────────
Create Supabase proj
Get keys + env vars
Enable Google OAuth
Add env vars to both   →  Install packages
                          Write supabase.ts
                          Write migration SQL
                          ↓
Run SQL in dashboard   →  (waits for SQL)
                          Verify tables + RLS
                          ✅ HANDOFF
                                               ↓               ↓
                                            Replace         Update auth
                                            store.ts        + storage.ts
                                            Maps            remote fns
                                            ↓               ↓
                                            ✅              ✅
```

---

## Acceptance criteria (all 3 agents done when these pass)

- [ ] Sign in with Google → `profiles` row created automatically
- [ ] Add a contact → row in `flagged_contacts`, survives page refresh + backend restart
- [ ] Send a chat message → row in `contact_ai_chat_history`
- [ ] Log a mood → row in `mood_log`
- [ ] Sign out, sign back in → all data reloads from Supabase, nothing lost
- [ ] Second Google account cannot see first account's data (RLS working)
- [ ] `GET /api/stats` returns real counts from database
- [ ] No `.env` secrets in frontend bundle (verify with `npm run build` + inspect `dist/`)
