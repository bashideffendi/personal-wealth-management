-- 033_asset_details.sql
-- Satu kolom JSONB `details` nampung SEMUA field ekstra per-aset (shape-nya
-- ditentukan app, bukan skema DB) → nambah/ubah field gak perlu migration baru:
--   • Kendaraan : plate, engine, color, year + penyusutan
--                 (metode, masaManfaat, residu, deprOverride)
--   • Pribadi   : penyusutan (metode, masaManfaat, residu, deprOverride)
--   • Properti  : luasTanah, luasBangunan, spesifikasi
--
-- ADDITIVE + IDEMPOTEN (add column if not exists) → aman di-apply / di-rerun
-- kapan aja. Kode nulis `details` best-effort (update terpisah, error diabaikan
-- kalau kolom belum ada) → GAK ADA window error walau belum di-apply; data baru
-- ke-persist begitu kolom ini ada. RLS own-row di assets_non_liquid otomatis
-- nutup kolom ini juga — gak butuh policy tambahan. Gak ada index: `details`
-- cuma dibaca utuh per-row + diproses client-side, gak pernah di-query/filter.
alter table public.assets_non_liquid
  add column if not exists details jsonb;
