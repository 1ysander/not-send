-- Phase 2: Flagged contacts + sessions
-- Run after 001_profiles.sql

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
