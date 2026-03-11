# SUPABASE Agent — NOTSENT Database, Auth & Migration

> **Start here every session:** Read `CLAUDE.md` first, then this file. You will touch both `app/` and `backend/`.

---

## Your job

Migrate NOTSENT from in-memory + localStorage to Supabase without breaking existing behavior. The migration is phased — complete each phase fully before starting the next.

---

## Tech

- `@supabase/supabase-js` v2 — client library for both frontend and backend
- Supabase Auth — Google OAuth (primary), email/password (fallback)
- Supabase Postgres — main database
- Supabase Realtime — replace Socket.io after Phase 3
- Row Level Security (RLS) — mandatory on every table
- Service role key — backend only, never expose to frontend

---

## Full target schema (run in Supabase SQL editor in order)

### 1. Profiles (auto-created from auth.users)

```sql
-- Mirrors auth.users for app-level queries
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  name text,
  picture text,
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "users see own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "users update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile when user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, picture)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### 2. Flagged contacts

```sql
create table public.flagged_contacts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  phone_number text not null,
  date_added timestamptz default now() not null
);

alter table public.flagged_contacts enable row level security;

create policy "users see own contacts" on public.flagged_contacts
  for select using (auth.uid() = user_id);
create policy "users insert own contacts" on public.flagged_contacts
  for insert with check (auth.uid() = user_id);
create policy "users delete own contacts" on public.flagged_contacts
  for delete using (auth.uid() = user_id);
```

### 3. Sessions

```sql
create table public.sessions (
  id text primary key,  -- format: "sess_<timestamp>_<random>"
  user_id uuid references public.profiles(id) on delete cascade not null,
  contact_id uuid references public.flagged_contacts(id) on delete set null,
  message_attempted text not null,
  outcome text not null default 'draft' check (outcome in ('draft', 'intercepted', 'sent')),
  created_at timestamptz default now() not null
);

alter table public.sessions enable row level security;

create policy "users see own sessions" on public.sessions
  for select using (auth.uid() = user_id);
create policy "users insert own sessions" on public.sessions
  for insert with check (auth.uid() = user_id);
create policy "users update own sessions" on public.sessions
  for update using (auth.uid() = user_id);
```

### 4. Conversation turns

```sql
create table public.conversation_turns (
  id bigserial primary key,
  session_id text references public.sessions(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now() not null
);

alter table public.conversation_turns enable row level security;

create policy "users see own turns" on public.conversation_turns
  for select using (auth.uid() = user_id);
create policy "users insert own turns" on public.conversation_turns
  for insert with check (auth.uid() = user_id);
```

### 5. User contexts

```sql
create table public.user_contexts (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  breakup_summary text,
  partner_name text,
  no_contact_days integer,
  conversation_context text check (conversation_context in ('sms', 'instagram', 'whatsapp', 'generic')),
  updated_at timestamptz default now() not null
);

alter table public.user_contexts enable row level security;

create policy "users see own context" on public.user_contexts
  for select using (auth.uid() = user_id);
create policy "users upsert own context" on public.user_contexts
  for insert with check (auth.uid() = user_id);
create policy "users update own context" on public.user_contexts
  for update using (auth.uid() = user_id);
```

### 6. Partner contexts

```sql
create table public.partner_contexts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  contact_id uuid references public.flagged_contacts(id) on delete cascade,  -- null = global default
  partner_name text not null,
  sample_messages jsonb default '[]'::jsonb,
  updated_at timestamptz default now() not null,
  unique(user_id, contact_id)  -- one context per user per contact
);

alter table public.partner_contexts enable row level security;

create policy "users see own partner contexts" on public.partner_contexts
  for select using (auth.uid() = user_id);
create policy "users upsert own partner contexts" on public.partner_contexts
  for insert with check (auth.uid() = user_id);
create policy "users update own partner contexts" on public.partner_contexts
  for update using (auth.uid() = user_id);
```

### 7. Token usage (add now for future billing)

```sql
create table public.token_usage (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  session_id text,
  mode text not null check (mode in ('intervention', 'closure', 'support')),
  model text not null,
  input_tokens integer not null,
  output_tokens integer not null,
  created_at timestamptz default now() not null
);

alter table public.token_usage enable row level security;

-- Users can see own usage (for future "you used X tokens this month" UI)
create policy "users see own token usage" on public.token_usage
  for select using (auth.uid() = user_id);
-- Backend service key inserts
```

---

## Environment variables

### Frontend (`app/.env`)
```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_public_key>
```

### Backend (`backend/.env`)
```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>   # NEVER expose to client
```

---

## Supabase client setup

### Frontend (`app/src/lib/supabase.ts`)

```ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

### Backend (`backend/src/lib/supabase.ts`)

```ts
import { createClient } from "@supabase/supabase-js";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required");
}

// Service key bypasses RLS — backend only, never expose
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
```

---

## Migration phases (complete in order, do NOT skip)

### Phase 1 — Auth

**Goal:** Replace device ID with real Google accounts.

**Steps:**
1. `cd app && npm install @supabase/supabase-js`
2. Create `app/src/lib/supabase.ts` (above)
3. Enable Google OAuth in Supabase dashboard → Authentication → Providers → Google
4. Update `LoginScreen` to use Supabase:

```tsx
// app/src/screens/Login/LoginScreen.tsx
import { supabase } from "@/lib/supabase";

async function handleGoogleLogin() {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
}
```

5. Replace `OnboardingGuard` with auth + onboarding check:

```tsx
// app/src/App.tsx
function AuthGuard({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (isLoading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  if (!hasCompletedOnboarding()) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}
```

6. Run SQL: create `profiles` table + trigger (from schema above)
7. Verify: sign in with Google → profile row created automatically

---

### Phase 2 — Sessions + contacts

**Goal:** Persist flagged contacts and sessions in Supabase.

**Steps:**
1. `cd backend && npm install @supabase/supabase-js`
2. Create `backend/src/lib/supabase.ts` (above)
3. Run SQL: create `flagged_contacts` and `sessions` tables with RLS
4. Replace `store.ts` session functions — keep same signatures:

```ts
// backend/src/store.ts — replace createSession
export async function createSession(
  messageAttempted: string,
  userId: string,          // now required — passed from session route
  contactId?: string,
  userContext?: UserContext
): Promise<Session> {
  const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .insert({ id, user_id: userId, contact_id: contactId ?? null, message_attempted: messageAttempted, outcome: "draft" })
    .select()
    .single();
  if (error) throw error;
  return { id: data.id, messageAttempted: data.message_attempted, outcome: data.outcome, createdAt: new Date(data.created_at).getTime() };
}
```

5. Update session route to pass `userId` from request body (sent by frontend using `supabase.auth.getSession().user.id`)
6. Replace `addFlaggedContact` in frontend `lib/storage.ts`:

```ts
// app/src/lib/storage.ts
export async function addFlaggedContactRemote(
  contact: Omit<FlaggedContact, "id" | "dateAdded">
): Promise<FlaggedContact> {
  const { data, error } = await supabase
    .from("flagged_contacts")
    .insert({ name: contact.name, phone_number: contact.phoneNumber })
    .select()
    .single();
  if (error) throw error;
  // Keep localStorage in sync as cache
  const local: FlaggedContact = { id: data.id, name: data.name, phoneNumber: data.phone_number, dateAdded: new Date(data.date_added).getTime() };
  addFlaggedContactLocal(local);
  return local;
}
```

7. Verify: add contact → row appears in Supabase dashboard → restart server → contact still exists

---

### Phase 3 — Conversation history + contexts

**Goal:** Persist AI conversation turns and user/partner context.

**Steps:**
1. Run SQL: create `conversation_turns`, `user_contexts`, `partner_contexts` tables
2. Replace `appendConversationTurn` in `store.ts`:

```ts
export async function appendConversationTurn(
  sessionId: string,
  userId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  await supabaseAdmin
    .from("conversation_turns")
    .insert({ session_id: sessionId, user_id: userId, role, content });
}
```

3. Replace `setUserContext` / `getUserContext`:

```ts
export async function setUserContext(userId: string, context: UserContext): Promise<void> {
  await supabaseAdmin
    .from("user_contexts")
    .upsert({
      user_id: userId,
      breakup_summary: context.breakupSummary,
      partner_name: context.partnerName,
      no_contact_days: context.noContactDays,
      conversation_context: context.conversationContext,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
}

export async function getUserContext(userId: string): Promise<UserContext | undefined> {
  const { data } = await supabaseAdmin
    .from("user_contexts")
    .select()
    .eq("user_id", userId)
    .single();
  if (!data) return undefined;
  return {
    breakupSummary: data.breakup_summary ?? undefined,
    partnerName: data.partner_name ?? undefined,
    noContactDays: data.no_contact_days ?? undefined,
    conversationContext: data.conversation_context ?? undefined,
  };
}
```

---

### Phase 4 — Token usage + remove in-memory store

**Goal:** Log AI token usage. Delete in-memory Maps.

**Steps:**
1. Run SQL: create `token_usage` table
2. Add token logging in `runStreamingPrompt`:

```ts
const final = await stream.finalMessage();
await supabaseAdmin.from("token_usage").insert({
  user_id: userId,
  session_id: sessionId,
  mode,
  model: MODEL,
  input_tokens: final.usage.input_tokens,
  output_tokens: final.usage.output_tokens,
});
```

3. Delete the four Maps from `store.ts`
4. Remove `localStorage` writes for sessions/contacts (keep as read cache if offline support needed)
5. Update `GET /api/stats` to query Supabase:

```ts
statsRoutes.get("/stats", async (req, res) => {
  const { userId } = req.query;
  const [{ count: interceptionsCount }, { count: messagesNeverSentCount }] = await Promise.all([
    supabaseAdmin.from("sessions").select("*", { count: "exact", head: true })
      .eq("user_id", userId).eq("outcome", "intercepted"),
    supabaseAdmin.from("sessions").select("*", { count: "exact", head: true })
      .eq("user_id", userId).in("outcome", ["intercepted", "draft"]),
  ]);
  res.json({ interceptionsCount: interceptionsCount ?? 0, messagesNeverSentCount: messagesNeverSentCount ?? 0 });
});
```

---

### Phase 5 — Replace Socket.io with Supabase Realtime

**Goal:** Remove Socket.io dependency.

```ts
// Frontend: subscribe to new conversation turns
const channel = supabase
  .channel(`session:${sessionId}`)
  .on("postgres_changes", {
    event: "INSERT",
    schema: "public",
    table: "conversation_turns",
    filter: `session_id=eq.${sessionId}`,
  }, (payload) => {
    const turn = payload.new as { role: string; content: string };
    if (turn.role === "assistant") appendTokenToStream(turn.content);
  })
  .subscribe();

// Cleanup
return () => { supabase.removeChannel(channel); };
```

After verifying all screens use Realtime correctly:
- Remove `socket.io-client` from `app/package.json`
- Remove `socket.io` from `backend/package.json`
- Delete `backend/src/socket.ts`
- Delete `app/src/contexts/ConversationSocketContext.tsx`

---

## RLS checklist (verify before shipping each phase)

For every table, test with a second test account that these are true:
- [ ] Cannot select rows owned by another user
- [ ] Cannot insert rows with another user's `user_id`
- [ ] Cannot update rows owned by another user
- [ ] Backend service key CAN bypass RLS for all tables

---

## Local Supabase CLI (for dev without cloud)

```bash
# Install
npm install -g supabase

# Init in project root
supabase init

# Start local Supabase (Postgres + Auth + Studio)
supabase start

# Generates .env with local keys
# Studio at http://localhost:54323

# Run migrations
supabase db push

# Stop
supabase stop
```

Create migration files in `supabase/migrations/` — one per phase. Commit them to git.

---

## Hard rules

1. `SUPABASE_SERVICE_KEY` never leaves `backend/` — not in frontend, not in logs
2. RLS on every table — no exceptions
3. Use `upsert` with `onConflict` for context tables
4. Keep `store.ts` function signatures identical during migration — only internals change
5. Always use `supabaseAdmin` (service key) in backend; `supabase` (anon key) in frontend
6. Never query Supabase directly from React components — go through `lib/storage.ts` or `api.ts`
