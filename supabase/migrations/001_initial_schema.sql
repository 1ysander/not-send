-- NOTSENT — Full initial schema
-- Paste entire file into Supabase → SQL Editor → New query → Run
-- All 9 tables, RLS enabled on every table.

-- ─────────────────────────────────────────────
-- 1. Profiles (mirrors auth.users)
-- ─────────────────────────────────────────────
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

-- Auto-create profile row when a user signs up
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


-- ─────────────────────────────────────────────
-- 2. Flagged contacts
-- ─────────────────────────────────────────────
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


-- ─────────────────────────────────────────────
-- 3. Sessions
-- ─────────────────────────────────────────────
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


-- ─────────────────────────────────────────────
-- 4. Conversation turns
-- ─────────────────────────────────────────────
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


-- ─────────────────────────────────────────────
-- 5. User contexts
-- ─────────────────────────────────────────────
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


-- ─────────────────────────────────────────────
-- 6. Partner contexts
-- ─────────────────────────────────────────────
create table public.partner_contexts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  contact_id uuid references public.flagged_contacts(id) on delete cascade,  -- null = global default
  partner_name text not null,
  sample_messages jsonb default '[]'::jsonb,
  updated_at timestamptz default now() not null,
  unique(user_id, contact_id)
);

alter table public.partner_contexts enable row level security;

create policy "users see own partner contexts" on public.partner_contexts
  for select using (auth.uid() = user_id);
create policy "users upsert own partner contexts" on public.partner_contexts
  for insert with check (auth.uid() = user_id);
create policy "users update own partner contexts" on public.partner_contexts
  for update using (auth.uid() = user_id);


-- ─────────────────────────────────────────────
-- 7. Token usage
-- ─────────────────────────────────────────────
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

create policy "users see own token usage" on public.token_usage
  for select using (auth.uid() = user_id);
-- Backend service key handles inserts (bypasses RLS)


-- ─────────────────────────────────────────────
-- 8. Contact AI chat history
-- ─────────────────────────────────────────────
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


-- ─────────────────────────────────────────────
-- 9. Mood log
-- ─────────────────────────────────────────────
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
