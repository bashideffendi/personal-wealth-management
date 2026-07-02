-- 057_harden_subscriptions_price_history.sql
-- Run in Supabase SQL Editor. IDEMPOTEN — aman dijalankan berkali-kali.
--
-- Menutup dua temuan audit (defense-in-depth, tidak mengubah perilaku app yang
-- sah — kedua tabel hanya ditulis oleh service-role):
--
-- (A) public.subscriptions = tabel BILLING ENTITLEMENT (dibuat migrasi 014:
--     plan_id, status, expires_at). Migrasi 036 (fitur "tracker langganan
--     digital" yang kemudian di-abandon) sempat menempelkan policy WRITE
--     (subs_insert/subs_update/subs_delete `with check (auth.uid() = user_id)`)
--     ke tabel ini. Efeknya user login bisa self-grant paket berbayar +
--     menaikkan cap kredit AI dari browser console. Migrasi 052 sudah men-drop
--     policy tsb; migrasi ini RE-ASSERT drop + REVOKE privilege supaya proteksi
--     tidak bergantung pada urutan apply manual. Perubahan plan HANYA lewat
--     service-role (webhook billing / server), yang bypass RLS & grant ini.
--
-- (B) public.price_history = cache harga historis BERSAMA lintas-user (migrasi
--     009) dengan policy INSERT/UPDATE `with check (true)` untuk role
--     `authenticated` → user mana pun bisa meracuni (cache poisoning) harga
--     ticker apa pun yang lalu dibaca semua user. Migrasi 055 sudah menutup
--     tabel cache saudaranya (price_snapshots, stock_research_cache) tapi
--     price_history kelewat. Ini menyamakan posture: write hanya service-role,
--     SELECT (read-all) dibiarkan agar chart/analitik tetap bisa membaca.

-- (A) subscriptions → SELECT-only untuk user
drop policy if exists "subs_insert" on public.subscriptions;
drop policy if exists "subs_update" on public.subscriptions;
drop policy if exists "subs_delete" on public.subscriptions;
revoke insert, update, delete on public.subscriptions from authenticated, anon;

-- (B) price_history → cabut write dari authenticated/anon, biarkan SELECT
drop policy if exists "Authenticated can upsert price_history" on public.price_history;
drop policy if exists "Authenticated can update price_history" on public.price_history;
revoke insert, update, delete on public.price_history from authenticated, anon;
