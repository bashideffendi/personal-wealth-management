-- Migration 021 — watchlist table for stock monitoring (premium feature).
-- Adopted from kelolainvestasi/invest, gated to Full Service tier eventually.
--
-- Schema: composite PK (user_id, ticker) — one row per stock per user.
-- Note opsional buat reminder pribadi ("nunggu di harga 5500", dll).

create table if not exists public.watchlist (
  user_id uuid not null references auth.users on delete cascade,
  ticker text not null,
  note text,
  target_price numeric,
  created_at timestamptz not null default now(),
  primary key (user_id, ticker)
);

alter table public.watchlist enable row level security;

create policy "watchlist_select_own" on public.watchlist
  for select using (auth.uid() = user_id);

create policy "watchlist_insert_own" on public.watchlist
  for insert with check (auth.uid() = user_id);

create policy "watchlist_update_own" on public.watchlist
  for update using (auth.uid() = user_id);

create policy "watchlist_delete_own" on public.watchlist
  for delete using (auth.uid() = user_id);

create index if not exists watchlist_user_idx on public.watchlist(user_id);
