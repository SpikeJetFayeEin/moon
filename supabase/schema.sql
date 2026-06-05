create table if not exists public.funds (
  code text primary key,
  name text not null,
  full_name text,
  fund_type text not null,
  manager text not null,
  fund_manager text,
  custodian text,
  benchmark text,
  investment_strategy text,
  investment_target text,
  rating_source text,
  rating text,
  inception_date date not null,
  latest_nav numeric(16, 6),
  latest_nav_date date,
  asset_size_billion numeric(16, 2),
  updated_at timestamptz not null default now()
);

alter table public.funds
  add column if not exists full_name text,
  add column if not exists fund_manager text,
  add column if not exists custodian text,
  add column if not exists benchmark text,
  add column if not exists investment_strategy text,
  add column if not exists investment_target text,
  add column if not exists rating_source text,
  add column if not exists rating text;

create table if not exists public.fund_nav (
  code text not null references public.funds(code) on delete cascade,
  date date not null,
  nav numeric(16, 6) not null,
  accumulated_nav numeric(16, 6),
  primary key (code, date)
);

create table if not exists public.fund_performance (
  code text not null references public.funds(code) on delete cascade,
  performance_type text not null,
  period text not null,
  return_rate numeric(16, 8),
  max_drawdown numeric(16, 8),
  rank text,
  updated_at timestamptz not null default now(),
  primary key (code, performance_type, period)
);

create table if not exists public.fund_metrics_cache (
  code text primary key references public.funds(code) on delete cascade,
  total_return numeric(16, 8) not null,
  annualized_return numeric(16, 8) not null,
  max_drawdown numeric(16, 8) not null,
  volatility numeric(16, 8) not null,
  sharpe_ratio numeric(16, 8) not null,
  downside_volatility numeric(16, 8) not null default 0,
  sortino_ratio numeric(16, 8) not null default 0,
  calmar_ratio numeric(16, 8) not null default 0,
  positive_day_rate numeric(16, 8) not null default 0,
  best_daily_return numeric(16, 8) not null default 0,
  worst_daily_return numeric(16, 8) not null default 0,
  value_at_risk_95 numeric(16, 8) not null default 0,
  conditional_value_at_risk_95 numeric(16, 8) not null default 0,
  rolling_returns jsonb not null,
  yearly_returns jsonb not null default '{}'::jsonb,
  holding_analysis jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now()
);

alter table public.fund_metrics_cache
  add column if not exists holding_analysis jsonb not null default '{}'::jsonb;
alter table public.fund_metrics_cache
  add column if not exists downside_volatility numeric(16, 8) not null default 0,
  add column if not exists sortino_ratio numeric(16, 8) not null default 0,
  add column if not exists calmar_ratio numeric(16, 8) not null default 0,
  add column if not exists positive_day_rate numeric(16, 8) not null default 0,
  add column if not exists best_daily_return numeric(16, 8) not null default 0,
  add column if not exists worst_daily_return numeric(16, 8) not null default 0,
  add column if not exists value_at_risk_95 numeric(16, 8) not null default 0,
  add column if not exists conditional_value_at_risk_95 numeric(16, 8) not null default 0,
  add column if not exists yearly_returns jsonb not null default '{}'::jsonb;

create table if not exists public.market_indices (
  code text primary key,
  name text not null,
  symbol text not null,
  return_type text not null default 'total_return',
  currency text not null default 'USD',
  provider text not null,
  description text not null,
  latest_value numeric(20, 6),
  latest_date date,
  updated_at timestamptz not null default now()
);

create table if not exists public.market_index_nav (
  code text not null references public.market_indices(code) on delete cascade,
  date date not null,
  nav numeric(20, 10) not null,
  accumulated_nav numeric(20, 10),
  raw_value numeric(20, 6) not null,
  primary key (code, date)
);

create index if not exists market_index_nav_code_date_idx
  on public.market_index_nav (code, date);

create table if not exists public.market_index_metrics_cache (
  code text primary key references public.market_indices(code) on delete cascade,
  total_return numeric(16, 8) not null,
  annualized_return numeric(16, 8) not null,
  max_drawdown numeric(16, 8) not null,
  volatility numeric(16, 8) not null,
  sharpe_ratio numeric(16, 8) not null,
  downside_volatility numeric(16, 8) not null default 0,
  sortino_ratio numeric(16, 8) not null default 0,
  calmar_ratio numeric(16, 8) not null default 0,
  positive_day_rate numeric(16, 8) not null default 0,
  best_daily_return numeric(16, 8) not null default 0,
  worst_daily_return numeric(16, 8) not null default 0,
  value_at_risk_95 numeric(16, 8) not null default 0,
  conditional_value_at_risk_95 numeric(16, 8) not null default 0,
  rolling_returns jsonb not null,
  yearly_returns jsonb not null default '{}'::jsonb,
  holding_analysis jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

create schema if not exists app_private;

revoke all on schema app_private from anon, authenticated;

create or replace function app_private.handle_new_user()
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

drop function if exists public.handle_new_user();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function app_private.handle_new_user();

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

alter table public.funds enable row level security;
alter table public.fund_nav enable row level security;
alter table public.fund_performance enable row level security;
alter table public.fund_metrics_cache enable row level security;
alter table public.market_indices enable row level security;
alter table public.market_index_nav enable row level security;
alter table public.market_index_metrics_cache enable row level security;
alter table public.profiles enable row level security;
alter table public.watchlist enable row level security;
alter table public.compare_lists enable row level security;

grant select on table public.funds to anon, authenticated;
grant select on table public.fund_nav to anon, authenticated;
grant select on table public.fund_performance to anon, authenticated;
grant select on table public.fund_metrics_cache to anon, authenticated;
grant select on table public.market_indices to anon, authenticated;
grant select on table public.market_index_nav to anon, authenticated;
grant select on table public.market_index_metrics_cache to anon, authenticated;

drop policy if exists "funds_select_public" on public.funds;
drop policy if exists "fund_nav_select_public" on public.fund_nav;
drop policy if exists "fund_performance_select_public" on public.fund_performance;
drop policy if exists "fund_metrics_cache_select_public" on public.fund_metrics_cache;
drop policy if exists "market_indices_select_public" on public.market_indices;
drop policy if exists "market_index_nav_select_public" on public.market_index_nav;
drop policy if exists "market_index_metrics_cache_select_public" on public.market_index_metrics_cache;

create policy "funds_select_public" on public.funds
  for select using (true);

create policy "fund_nav_select_public" on public.fund_nav
  for select using (true);

create policy "fund_performance_select_public" on public.fund_performance
  for select using (true);

create policy "fund_metrics_cache_select_public" on public.fund_metrics_cache
  for select using (true);

create policy "market_indices_select_public" on public.market_indices
  for select using (true);

create policy "market_index_nav_select_public" on public.market_index_nav
  for select using (true);

create policy "market_index_metrics_cache_select_public" on public.market_index_metrics_cache
  for select using (true);

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "watchlist_crud_own" on public.watchlist;
drop policy if exists "compare_lists_crud_own" on public.compare_lists;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "watchlist_crud_own" on public.watchlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "compare_lists_crud_own" on public.compare_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
