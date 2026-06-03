-- 039_onboarding_focus.sql
-- Fokus finansial yang dipilih user di wizard onboarding pertama kali.
--   NULL  = belum pernah lewat wizard  → dipakai buat gating /onboarding
--   '{}'  = sudah lewat wizard, tapi skip milih fokus
--   {...} = fokus terpilih (budget, emergency, debt, invest, goal, networth)
-- Jalankan di Supabase SQL Editor. "Success. No rows returned" = berhasil.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_focus text[];
