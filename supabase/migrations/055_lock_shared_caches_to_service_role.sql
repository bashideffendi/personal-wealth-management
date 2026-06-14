-- Migration 055 — Lock shared caches to service-role writes (security-4/5)
--
-- price_snapshots + stock_research_cache = cache BERSAMA lintas-user. Migrasi 022
-- dulu ngasih `authenticated` policy upsert/update "own" ke stock_research_cache,
-- sehingga user mana pun bisa NIMPA research ticker apa pun dengan konten arbitrer
-- yang lalu dibaca user lain (cache-poisoning). price_snapshots gak punya policy
-- write authenticated (002), tapi kita cabut grant tabel write secara defensif.
-- SELECT tetap dibiarkan (semua user boleh BACA cache). service_role bypass RLS,
-- jadi write dari admin client (cron + /api/quotes + /api/idx-research/.../generate)
-- tetap jalan.
--
-- ⚠️ URUTAN APPLY: deploy KODE dulu (write sudah lewat createAdminClient ?? user)
-- + verifikasi, BARU jalankan migrasi ini — biar write gak putus di antara deploy
-- dan migrasi. Reversed order tetap non-fatal (research upsert error udah di-swallow;
-- price_snapshots user-write sudah efektif ketolak RLS hari ini).
--
-- Idempoten; aman di-Run berkali-kali di Supabase SQL Editor.

begin;

-- stock_research_cache: buang policy write client, sisakan read-all (022)
drop policy if exists "research_cache_upsert_own" on public.stock_research_cache;
drop policy if exists "research_cache_update_own" on public.stock_research_cache;

-- Cabut grant tabel write dari role client (defensif; service_role tak terpengaruh)
revoke insert, update, delete on public.price_snapshots from authenticated, anon;
revoke insert, update, delete on public.stock_research_cache from authenticated, anon;

-- CATATAN: SELECT TIDAK dicabut — policy "Authenticated can read price_snapshots"
-- (002) & "research_cache_read_all" (022) tetap aktif. Jangan revoke select.

commit;
