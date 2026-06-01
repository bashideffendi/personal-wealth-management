-- 033_asset_details.sql
-- Field ekstra per-aset (mis. kendaraan: plat, no mesin/rangka, warna, tahun)
-- disimpan di JSONB biar fleksibel + gak nambah kolom tiap jenis aset.
--
-- ADDITIVE + IDEMPOTEN → aman di-apply kapan aja. Kode tulis `details` secara
-- best-effort (di-update terpisah, error diabaikan kalau kolom belum ada), jadi
-- GAK ADA window error walau migration belum di-apply — detail kendaraan baru
-- ke-persist setelah kolom ini ada. RLS assets_non_liquid (own-row) udah nutup.
alter table public.assets_non_liquid
  add column if not exists details jsonb;
