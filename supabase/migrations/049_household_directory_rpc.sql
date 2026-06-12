-- ============================================================
-- 049 — Direktori nama anggota household (fix halaman Keluarga)
--
-- ROOT CAUSE halaman Keluarga gagal memuat di prod: client embed
-- `profiles!inner(full_name)` di household_members & household_activities
-- = PGRST200 (tidak ada FK household_members.user_id → profiles; user_id
-- nunjuk ke auth.users). Dibuktikan probe REST prod 2026-06-13.
--
-- Solusi: client berhenti pakai embed; nama anggota diambil lewat RPC
-- SECURITY DEFINER kolom-terbatas ini (cuma user_id + full_name, cuma
-- buat sesama anggota household). RLS profiles tetap own-only — tidak
-- ada kolom profil lain yang kebuka.
--
-- Halaman tetap jalan TANPA migration ini (nama fallback "Anggota");
-- jalankan ini biar nama asli muncul. Run in Supabase SQL Editor.
-- ============================================================

create or replace function public.get_household_directory(hh_id uuid)
returns table (user_id uuid, full_name text)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select m.user_id, p.full_name
  from public.household_members m
  left join public.profiles p on p.id = m.user_id
  where m.household_id = hh_id
    and exists (
      select 1 from public.household_members me
      where me.household_id = hh_id and me.user_id = auth.uid()
    )
$$;

revoke execute on function public.get_household_directory(uuid) from public, anon;
grant execute on function public.get_household_directory(uuid) to authenticated;

-- Sekalian rapikan 044 (temuan audit): pin search_path + cabut dari anon.
alter function public.get_household_net_worth(uuid) set search_path = public, pg_temp;
revoke execute on function public.get_household_net_worth(uuid) from public, anon;
grant execute on function public.get_household_net_worth(uuid) to authenticated;
