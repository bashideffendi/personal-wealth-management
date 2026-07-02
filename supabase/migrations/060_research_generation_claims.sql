-- 060_research_generation_claims.sql — IDEMPOTEN. Run in Supabase SQL Editor.
--
-- Guard idempotensi buat generate research saham: cegah DOUBLE-CHARGE kredit
-- (30/generate) kalau 2 request ticker yang sama datang hampir barengan
-- (double-click / retry / 2 device). Request pertama "klaim" ticker; yang kedua
-- lihat klaim → tunggu/pakai cache, gak charge lagi.
--
-- Ditulis service-role only (route pakai admin client). Aman diapply kapan aja;
-- route pakai guard best-effort → kalau tabel belum ada, skip (perilaku lama).

create table if not exists public.research_generation_claims (
  ticker text primary key,
  user_id uuid references auth.users on delete set null,
  claimed_at timestamptz not null default now()
);

alter table public.research_generation_claims enable row level security;
revoke insert, update, delete on public.research_generation_claims from authenticated, anon;
