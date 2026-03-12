-- Phase 3: Conversation turns + user/partner contexts
-- Run after 002_contacts_sessions.sql

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
