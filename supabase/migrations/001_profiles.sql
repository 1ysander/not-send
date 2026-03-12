-- Phase 1: Profiles (mirrors auth.users for app-level queries)
-- Run in Supabase SQL editor FIRST

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

-- Auto-create profile row when a user signs up via Supabase Auth
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
