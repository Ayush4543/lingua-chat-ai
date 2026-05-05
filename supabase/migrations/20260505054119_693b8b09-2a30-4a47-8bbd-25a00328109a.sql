
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "view own profile" on public.profiles for select using (auth.uid() = id);
create policy "insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "update own profile" on public.profiles for update using (auth.uid() = id);

-- messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  detected_language text,
  confidence numeric,
  top_predictions jsonb,
  translation text,
  target_language text,
  ai_reply text,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create policy "view own messages" on public.messages for select using (auth.uid() = user_id);
create policy "insert own messages" on public.messages for insert with check (auth.uid() = user_id);
create policy "delete own messages" on public.messages for delete using (auth.uid() = user_id);
create index on public.messages(user_id, created_at);

-- auto-create profile
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
