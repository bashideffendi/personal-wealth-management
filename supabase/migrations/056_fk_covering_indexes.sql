-- Migration 056 — Covering indexes untuk kolom foreign-key (database-5)
--
-- Postgres TIDAK auto-bikin index di kolom FK (cuma PK + UNIQUE). Tanpa index,
-- DELETE di tabel induk (accounts/credit_cards/investments) harus seq-scan tabel
-- anak buat cek ON DELETE, dan join/filter by FK jadi lambat. Ini nambahin btree
-- index di kolom FK yang sering kena cascade/join tapi belum ter-index.
--
-- Murni ADITIF + idempoten (`if not exists`) — gak ngubah data/skema kolom,
-- aman di-Run berkali-kali. Index kebangun online utk tabel kecil; gak ada lock
-- berarti pada skala data pre-launch.

begin;

-- transfers: dua FK ke accounts (ON DELETE SET NULL)
create index if not exists idx_transfers_from_account on public.transfers (from_account);
create index if not exists idx_transfers_to_account   on public.transfers (to_account);

-- credit_card_payments: FK ke credit_cards (cascade) + accounts (set null)
create index if not exists idx_cc_payments_card_id      on public.credit_card_payments (card_id);
create index if not exists idx_cc_payments_from_account on public.credit_card_payments (from_account_id);

-- dividends: FK ke investments (ON DELETE CASCADE)
create index if not exists idx_dividends_investment_id on public.dividends (investment_id);

commit;
