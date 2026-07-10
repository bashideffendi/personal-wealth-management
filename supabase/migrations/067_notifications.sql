-- 067_notifications.sql — IDEMPOTEN. Run in Supabase SQL Editor.
--
-- Inbox notifikasi in-app (bell di top nav) + target watchlist alerts.
-- Satu baris = satu notifikasi per user. Penulis = SERVER (service-role,
-- bypass RLS — cron /api/cron/watchlist-alerts via notifyUser); user cuma
-- boleh BACA miliknya + nandain dibaca (update read_at). Sengaja TANPA
-- policy insert/delete buat authenticated.
--
-- Dedup alert: unique partial index (user_id, tag) WHERE read_at IS NULL —
-- selama notif ber-tag sama masih unread, insert berikutnya kena 23505 dan
-- server skip diam-diam (gak ada spam "Target tercapai" tiap hari).
--
-- Aman diapply kapan saja. Kode app pakai fallback: kalau tabel ini belum
-- ada, bell render kosong + notifyUser lanjut ke push saja (tidak ada
-- urutan-deploy yang bisa bikin live rusak).

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  body text,
  url text,
  tag text,
  created_at timestamptz default now(),
  read_at timestamptz
);

alter table public.notifications enable row level security;

drop policy if exists "notif select own" on public.notifications;
create policy "notif select own" on public.notifications
  for select using (auth.uid() = user_id);

-- Update own — dipakai buat set read_at (tandai dibaca / tandai semua).
drop policy if exists "notif update own" on public.notifications;
create policy "notif update own" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Listing bell: 20 terbaru per user → index komposit created_at desc.
create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

-- Dedup: satu notif UNREAD per (user, tag). Row ber-tag null bebas duplikat
-- (unique index Postgres memperlakukan null sebagai distinct).
create unique index if not exists uq_notifications_unread_tag
  on public.notifications (user_id, tag) where read_at is null;
