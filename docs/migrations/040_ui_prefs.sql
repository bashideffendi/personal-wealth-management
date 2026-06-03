-- 040_ui_prefs.sql
-- Preferensi UI per-user (cross-device): section dashboard & report yang
-- disembunyiin user lewat "Atur" / "Atur isi". Bentuk JSONB:
--   { "dashboardHidden": ["aliran", ...], "reportHidden": ["top10", ...] }
-- Default '{}'. localStorage tetap dipakai buat instant render; ini durable
-- mirror biar lintas-perangkat & tahan cache clear.
-- Jalankan di Supabase SQL Editor. "Success. No rows returned" = berhasil.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ui_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;
