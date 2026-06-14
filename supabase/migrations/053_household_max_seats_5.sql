-- 053 — Household max_seats 4 → 5 (samakan dgn janji marketing "Max = 5 anggota")
--
-- Bug: pricing page menjanjikan paket Max = household sampai 5 anggota, tapi
-- migration 015 set households.max_seats DEFAULT 4 (owner + 3) → pembeli Max
-- cuma bisa nambah 4 total. Broken promise + tiket support hari pertama.
--
-- Fix: default jadi 5 + naikkan household existing yg masih 4 ke 5.
-- (Kalau nanti plan-gating wired, seat bisa di-set per-plan saat upgrade.)
-- Idempoten & aman diulang.

alter table public.households alter column max_seats set default 5;

update public.households set max_seats = 5 where max_seats = 4;
