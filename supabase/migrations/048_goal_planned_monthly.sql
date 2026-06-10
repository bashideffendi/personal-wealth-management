-- 048: setoran rencana per goal — input jujur buat probabilitas Monte Carlo.
-- Sebelumnya simulasi diberi makan "iuran wajib" (sisa ÷ bulan tersisa) yang
-- by construction selalu nyampe target → probabilitas ~100% terus. Kolom ini
-- nyimpen rencana setoran user; NULL = fallback ke iuran wajib (berlabel).
-- Pola defensif sama dengan 032 (savings_strategy): app jalan tanpa kolom ini.

alter table public.goals
  add column if not exists planned_monthly numeric;
