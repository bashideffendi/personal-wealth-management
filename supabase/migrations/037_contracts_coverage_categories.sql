-- 037_contracts_coverage_categories.sql
-- Kontrak & Polis: tambah kolom `coverage` (uang pertanggungan / nilai
-- coverage asuransi) + perluas kategori dengan 'work' (kontrak kerja) &
-- 'property' (properti/sewa). Idempoten + aman thd data existing.
alter table public.contracts add column if not exists coverage bigint not null default 0;

alter table public.contracts drop constraint if exists contracts_category_check;
alter table public.contracts add constraint contracts_category_check
  check (category in ('insurance', 'subscription', 'loan', 'warranty', 'lease', 'work', 'property', 'other'));
