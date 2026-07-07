-- ============================================================
-- 063 — Web Push subscriptions (PWA)
--
-- Satu baris = satu browser/device subscription (endpoint unik global —
-- endpoint FCM/Mozilla/WebKit memang unik per subscription). User bisa
-- punya banyak baris (HP + laptop). Kolom p256dh + auth = kunci enkripsi
-- payload milik subscription itu (dipakai lib web-push di server).
--
-- RLS own-only: user cuma bisa lihat/daftar/hapus subscription miliknya.
-- Tanpa policy UPDATE — ganti endpoint = delete + insert (atau upsert via
-- route server). Pengiriman push pakai service-role (bypass RLS).
-- Run in Supabase SQL Editor. Idempotent.
-- ============================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);
create index if not exists idx_push_subscriptions_user
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push select own" on public.push_subscriptions;
create policy "push select own" on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "push insert own" on public.push_subscriptions;
create policy "push insert own" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "push delete own" on public.push_subscriptions;
create policy "push delete own" on public.push_subscriptions
  for delete using (auth.uid() = user_id);
