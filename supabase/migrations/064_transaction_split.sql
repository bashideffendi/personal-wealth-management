-- 064_transaction_split.sql
-- Split transaction: satu belanja (mis. supermarket) dipecah ke beberapa
-- KATEGORI. Konsepnya TANPA tabel baru — tiap potongan disimpan sebagai baris
-- transaksi biasa (kategori + nominal sendiri) yang berbagi split_group_id
-- sama. Karena tiap potongan sudah jadi transaksi penuh, semua agregasi /
-- anggaran / statistik existing OTOMATIS benar tanpa diubah.
-- Idempoten & additive. Jalankan di Supabase SQL Editor.
-- "Success. No rows returned" = berhasil.

alter table public.transactions
  add column if not exists split_group_id uuid;

-- Index parsial: mayoritas baris bukan split — index cukup baris yang punya grup
-- (buat lookup "potongan lain dari belanja yang sama").
create index if not exists idx_tx_split_group
  on public.transactions(split_group_id)
  where split_group_id is not null;
