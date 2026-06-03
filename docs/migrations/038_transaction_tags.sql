-- 038_transaction_tags.sql
-- Tags lintas-kategori di transaksi (Lebaran, Liburan Bali, Renovasi, Nikahan, dst).
-- Satu transaksi punya 1 kategori, tapi bisa banyak tag (orthogonal).
-- Jalankan di Supabase SQL Editor. "Success. No rows returned" = berhasil.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

-- Index GIN biar filter "transaksi yang punya tag X" cepat.
CREATE INDEX IF NOT EXISTS transactions_tags_idx
  ON transactions USING gin (tags);
