create table if not exists public.funds (
  code text primary key,
  name text not null,
  fund_type text not null,
  manager text not null,
  inception_date date not null,
  latest_nav numeric(16, 6),
  latest_nav_date date,
  asset_size_billion numeric(16, 2),
  updated_at timestamptz not null default now()
);

create table if not exists public.fund_nav (
  code text not null references public.funds(code) on delete cascade,
  date date not null,
  nav numeric(16, 6) not null,
  accumulated_nav numeric(16, 6),
  primary key (code, date)
);

create table if not exists public.fund_metrics_cache (
  code text primary key references public.funds(code) on delete cascade,
  total_return numeric(16, 8) not null,
  annualized_return numeric(16, 8) not null,
  max_drawdown numeric(16, 8) not null,
  volatility numeric(16, 8) not null,
  sharpe_ratio numeric(16, 8) not null,
  rolling_returns jsonb not null,
  calculated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = coalesce(excluded.display_name, public.profiles.display_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table if not exists public.watchlist (
  user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null references public.funds(code) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, code)
);

create table if not exists public.compare_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  codes text[] not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.watchlist enable row level security;
alter table public.compare_lists enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "watchlist_crud_own" on public.watchlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "compare_lists_crud_own" on public.compare_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
