-- Phase 4: Token usage tracking (for future billing/limits)
-- Run after 003_contexts_turns.sql

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

-- Users can see their own usage (for future "you used X tokens" UI)
create policy "users see own token usage" on public.token_usage
  for select using (auth.uid() = user_id);

-- Backend service key inserts (no insert policy needed — service key bypasses RLS)
