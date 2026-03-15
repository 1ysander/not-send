-- Phase 5: Contact AI chat history + mood log
-- Run after 004_token_usage.sql

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
