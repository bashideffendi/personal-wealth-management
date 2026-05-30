-- Portfolio value snapshots — one row per user per day, upserted whenever the
-- user opens the Investasi page. Powers the equity curve on the hero.
--
-- Safe to run multiple times (idempotent guards). RLS so each user only sees
-- and writes their own snapshots.

create table if not exists public.portfolio_snapshots (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  snapshot_date date not null,
  market_value  numeric not null default 0,
  invested      numeric not null default 0,
  created_at    timestamptz not null default now(),
  unique (user_id, snapshot_date)
);

alter table public.portfolio_snapshots enable row level security;

drop policy if exists "portfolio_snapshots_select_own" on public.portfolio_snapshots;
create policy "portfolio_snapshots_select_own"
  on public.portfolio_snapshots for select
  using (auth.uid() = user_id);

drop policy if exists "portfolio_snapshots_insert_own" on public.portfolio_snapshots;
create policy "portfolio_snapshots_insert_own"
  on public.portfolio_snapshots for insert
  with check (auth.uid() = user_id);

drop policy if exists "portfolio_snapshots_update_own" on public.portfolio_snapshots;
create policy "portfolio_snapshots_update_own"
  on public.portfolio_snapshots for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists portfolio_snapshots_user_date_idx
  on public.portfolio_snapshots (user_id, snapshot_date);
