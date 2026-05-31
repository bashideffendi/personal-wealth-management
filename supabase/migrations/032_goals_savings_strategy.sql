-- 032_goals_savings_strategy.sql
-- Strategi dana per-goal = asumsi return buat simulasi probabilitas (Monte Carlo).
-- null / 'auto' → app pakai rekomendasi (by kategori + horizon). User bisa pilih
-- 'tabungan' (≈ tanpa imbal hasil, paling jujur kalau dana cuma ditabung) sampai
-- 'aggressive'.
--
-- ADDITIVE + IDEMPOTEN → aman di-apply kapan aja. Kode baca defensif (kolom gak
-- ada → 'auto') + fallback localStorage, jadi GAK ADA window error walau
-- migration belum di-apply. RLS goals (own-row) udah nutup kolom ini otomatis.
alter table public.goals
  add column if not exists savings_strategy text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'goals_savings_strategy_check'
  ) then
    alter table public.goals
      add constraint goals_savings_strategy_check
      check (
        savings_strategy is null
        or savings_strategy in ('auto', 'tabungan', 'conservative', 'moderate', 'aggressive')
      );
  end if;
end $$;
