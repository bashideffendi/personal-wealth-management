-- 062_recurring_auto_post.sql — IDEMPOTEN. Run in Supabase SQL Editor.
--
-- Auto-post recurring → transaksi via cron harian (/api/cron/post-recurring).
--  - auto_post        : opt-in per item (default OFF → perilaku existing gak berubah).
--  - last_posted_date : watermark idempotensi. Cron hitung occurrence dari
--    (last_posted_date + 1 hari) ?? start_date s/d hari ini, insert transaksi,
--    lalu majuin watermark ke occurrence terakhir — monoton maju, jadi retry /
--    re-run di hari yang sama gak nyatat dobel.
--
-- Tanpa backfill: NULL = belum pernah auto-post. Kalau user nyalain auto_post
-- di item lama, occurrence dihitung dari start_date (cap 31 occurrence per item
-- per run di route jadi rem catch-up).

alter table public.recurring_transactions
  add column if not exists last_posted_date date;

alter table public.recurring_transactions
  add column if not exists auto_post boolean not null default false;
