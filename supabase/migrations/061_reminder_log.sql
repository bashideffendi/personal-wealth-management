-- 061_reminder_log.sql — IDEMPOTEN. Run in Supabase SQL Editor.
--
-- Guard idempotensi buat cron reminder (trial-ending / renewal). Sebelumnya dedup
-- cuma ngandelin asumsi "cron jalan tepat 1×/hari" (exact-date match) — kalau
-- Vercel retry / manual re-run / overlap, user bisa keterima email DOBEL.
--
-- PK (user_id, threshold, sent_on): satu user + threshold (H-14/3/0) + tanggal
-- cuma boleh 1 baris → insert kedua di hari sama = conflict = skip kirim.
-- Ditulis service-role only (route cron pakai admin). Backward-compatible: route
-- pakai guard best-effort, skip kalau tabel belum ada.

create table if not exists public.reminder_log (
  user_id uuid references auth.users on delete cascade not null,
  kind text not null,           -- 'trial' | 'renewal' (informasional)
  threshold int not null,       -- 14 | 3 | 0
  sent_on date not null,        -- tanggal kirim (UTC), buat dedup harian
  created_at timestamptz not null default now(),
  primary key (user_id, threshold, sent_on)
);

alter table public.reminder_log enable row level security;
revoke insert, update, delete on public.reminder_log from authenticated, anon;
