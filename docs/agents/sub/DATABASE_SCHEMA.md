# DATABASE_SCHEMA Sub-Agent — NOTSENT Supabase Schema & RLS

> **Parent agent:** SUPABASE
> **Scope:** Supabase SQL schema, RLS policies, edge functions, migration files
> **Load order:** CLAUDE.md → SUPABASE.md → this file

---

## Role

You design and implement the database schema. You write SQL migrations, RLS policies, and Supabase Edge Functions. You do **not** touch frontend components or backend Express routes — you only define the data layer that both consume.

---

## Multi-product schema design principle

The schema must support two products without mixing their data:
- **Personal** — breakup/emotional support
- **Enterprise** — communication compliance (Phase 3)

The `contact_type` and `context_type` columns on key tables provide this separation. Never query across types without an explicit filter.

---

## Full target schema

### 1. Users / Profiles

```sql
-- Mirrors auth.users — app-level profile data
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  name text,
  picture text,
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "users see own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "users update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create profile on signup
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

### 2. Contacts

```sql
-- People the user is monitoring / no-contact tracking
create table public.contacts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  phone text,
  is_flagged boolean not null default true,
  contact_type text not null default 'personal' check (contact_type in ('personal', 'professional')),
  created_at timestamptz default now() not null
);

alter table public.contacts enable row level security;

create policy "users see own contacts" on public.contacts
  for select using (auth.uid() = user_id);
create policy "users insert own contacts" on public.contacts
  for insert with check (auth.uid() = user_id);
create policy "users update own contacts" on public.contacts
  for update using (auth.uid() = user_id);
create policy "users delete own contacts" on public.contacts
  for delete using (auth.uid() = user_id);
```

### 3. AI Contexts

```sql
-- User-provided situational context (breakup description, company policies, etc.)
create table public.ai_contexts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  context_text text not null,
  context_type text not null default 'breakup' check (context_type in ('breakup', 'compliance_policy', 'custom')),
  created_at timestamptz default now() not null,
  unique (user_id, context_type)  -- one context per type per user
);

alter table public.ai_contexts enable row level security;

create policy "users see own contexts" on public.ai_contexts
  for select using (auth.uid() = user_id);
create policy "users insert own contexts" on public.ai_contexts
  for insert with check (auth.uid() = user_id);
create policy "users update own contexts" on public.ai_contexts
  for update using (auth.uid() = user_id);
create policy "users delete own contexts" on public.ai_contexts
  for delete using (auth.uid() = user_id);
```

### 4. Conversation Messages (uploaded history)

```sql
-- Ingested from .txt uploads or future API connectors
create table public.conversation_messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  contact_id uuid references public.contacts(id) on delete cascade,
  sender text not null check (sender in ('user', 'partner')),
  content text not null,
  message_timestamp timestamptz,     -- original timestamp from source
  source text not null default 'txt_upload' check (source in ('txt_upload', 'gmail', 'slack', 'imessage')),
  created_at timestamptz default now() not null
);

alter table public.conversation_messages enable row level security;

create policy "users see own messages" on public.conversation_messages
  for select using (auth.uid() = user_id);
create policy "users insert own messages" on public.conversation_messages
  for insert with check (auth.uid() = user_id);
create policy "users delete own messages" on public.conversation_messages
  for delete using (auth.uid() = user_id);

-- Index for fast lookup by contact
create index on public.conversation_messages (user_id, contact_id, message_timestamp desc);
```

### 5. Chat Messages (AI conversation turns)

```sql
-- Turns in AI support / intervention / closure chats
create table public.chat_messages (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  session_id text,               -- links to interceptions.id when in intervention mode
  mode text not null check (mode in ('intervention', 'closure', 'support', 'compliance')),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now() not null
);

alter table public.chat_messages enable row level security;

create policy "users see own chat" on public.chat_messages
  for select using (auth.uid() = user_id);
create policy "users insert own chat" on public.chat_messages
  for insert with check (auth.uid() = user_id);

-- Index for session history lookup
create index on public.chat_messages (user_id, session_id, created_at asc);
```

### 6. Interceptions (the core event log)

```sql
-- Every time the AI analyzes a draft message
create table public.interceptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  contact_id uuid references public.contacts(id) on delete set null,
  draft_content text not null,
  ai_response text not null,
  action_taken text not null check (action_taken in ('sent', 'warned', 'blocked', 'edited')),
  created_at timestamptz default now() not null
);

alter table public.interceptions enable row level security;

create policy "users see own interceptions" on public.interceptions
  for select using (auth.uid() = user_id);
create policy "users insert own interceptions" on public.interceptions
  for insert with check (auth.uid() = user_id);

-- Index for stats queries
create index on public.interceptions (user_id, action_taken, created_at desc);
```

### 7. No-Contact Streaks

```sql
create table public.no_contact_streaks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  contact_id uuid references public.contacts(id) on delete cascade,
  start_date date not null,
  last_reset date,
  current_days integer not null default 0,
  unique (user_id, contact_id)
);

alter table public.no_contact_streaks enable row level security;

create policy "users see own streaks" on public.no_contact_streaks
  for select using (auth.uid() = user_id);
create policy "users insert own streaks" on public.no_contact_streaks
  for insert with check (auth.uid() = user_id);
create policy "users update own streaks" on public.no_contact_streaks
  for update using (auth.uid() = user_id);
```

### 8. Token Usage

```sql
create table public.token_usage (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  session_id text,
  mode text not null check (mode in ('intervention', 'closure', 'support', 'compliance')),
  model text not null,
  input_tokens integer not null,
  output_tokens integer not null,
  created_at timestamptz default now() not null
);

alter table public.token_usage enable row level security;

create policy "users see own token usage" on public.token_usage
  for select using (auth.uid() = user_id);
-- Backend service key inserts only — no client-side insert policy
```

---

## RLS verification matrix

For every table, run these checks after each phase with a secondary test user:

| Check | Expected |
|-------|----------|
| SELECT own rows | ✓ returns rows |
| SELECT other user's rows | ✗ returns empty |
| INSERT with own user_id | ✓ succeeds |
| INSERT with other user's user_id | ✗ blocked |
| UPDATE own rows | ✓ succeeds |
| UPDATE other user's rows | ✗ blocked |
| Service key SELECT | ✓ bypasses RLS |

---

## Migration file naming convention

```
supabase/migrations/
  20260301000000_create_profiles.sql
  20260301000001_create_contacts.sql
  20260301000002_create_ai_contexts.sql
  20260301000003_create_conversation_messages.sql
  20260301000004_create_chat_messages.sql
  20260301000005_create_interceptions.sql
  20260301000006_create_no_contact_streaks.sql
  20260301000007_create_token_usage.sql
```

Use `supabase migration new <name>` to create. Never hand-edit timestamp prefixes.

---

## Useful queries for the stats API

```sql
-- Total interceptions for user
select count(*) from public.interceptions
where user_id = $1 and action_taken in ('warned', 'blocked', 'edited');

-- Messages never sent (intercepted + stayed in AI chat without sending)
select count(*) from public.interceptions
where user_id = $1 and action_taken != 'sent';

-- Current no-contact streak days
select current_days from public.no_contact_streaks
where user_id = $1
order by current_days desc
limit 1;

-- Monthly token cost estimate (at $3/M input, $15/M output for Sonnet)
select
  sum(input_tokens) / 1e6 * 3 + sum(output_tokens) / 1e6 * 15 as estimated_cost_usd
from public.token_usage
where user_id = $1
  and created_at >= date_trunc('month', now());
```

---

## What to build (migration priority order)

1. **`profiles` table + trigger** — Phase 1 auth (P0)
2. **`contacts` table** — replace `flagged_contacts` with this unified schema (P0)
3. **`ai_contexts` table** — replace `user_contexts` + `partner_contexts` (P1)
4. **`conversation_messages` table** — store parsed uploads (P1)
5. **`chat_messages` table** — replace `conversation_turns` (P1)
6. **`interceptions` table** — replace sessions + add full logging (P1)
7. **`no_contact_streaks` table** — move from localStorage (P2)
8. **`token_usage` table** — billing foundation (P2)
