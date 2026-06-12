-- ============================================================
-- 050 — Cartoon Quest fase 2 (milestone a): XP ledger + achievements
--
-- xp_events = buku besar APPEND-ONLY (gaya akuntan): total XP = SUM
-- ledger, bisa diaudit, tanpa kolom agregat yang bisa drift. Tanpa
-- policy UPDATE/DELETE — sekali tercatat, tercatat.
-- achievements = status unlock per user; definisi badge di kode app.
--
-- RLS own-only semua. Run in Supabase SQL Editor. Idempotent.
-- ============================================================

create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  source text not null,
  amount integer not null check (amount > 0 and amount <= 1000),
  ref_id text,
  created_at timestamptz not null default now()
);
create index if not exists idx_xp_events_user_time
  on public.xp_events (user_id, created_at desc);

alter table public.xp_events enable row level security;
drop policy if exists "xp select own" on public.xp_events;
create policy "xp select own" on public.xp_events
  for select using (auth.uid() = user_id);
drop policy if exists "xp insert own" on public.xp_events;
create policy "xp insert own" on public.xp_events
  for insert with check (auth.uid() = user_id);
-- append-only: sengaja TANPA policy update/delete

create table if not exists public.achievements (
  user_id uuid not null references auth.users on delete cascade,
  key text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.achievements enable row level security;
drop policy if exists "ach select own" on public.achievements;
create policy "ach select own" on public.achievements
  for select using (auth.uid() = user_id);
drop policy if exists "ach insert own" on public.achievements;
create policy "ach insert own" on public.achievements
  for insert with check (auth.uid() = user_id);

-- Total XP milik sendiri — invoker + RLS jaga barisnya.
create or replace function public.get_my_xp()
returns bigint
language sql
security invoker
set search_path = public, pg_temp
stable
as $$
  select coalesce(sum(amount), 0)::bigint
  from public.xp_events
  where user_id = auth.uid()
$$;
revoke execute on function public.get_my_xp() from public, anon;
grant execute on function public.get_my_xp() to authenticated;
