-- 068_harden_function_security.sql — IDEMPOTEN. Applied via MCP 2026-07-11.
--
-- Hardening dari Supabase security advisor (dijalankan setelah 065/066/067),
-- lint 0011 function_search_path_mutable: 4 fungsi lama tanpa search_path
-- terkunci. Fungsi baru (059/065/066) sudah `set search_path = public`; keempat
-- ini menyusul — mencegah privilege-escalation via search_path pada fungsi
-- SECURITY DEFINER. Terverifikasi bersih di advisor pasca-apply.

alter function public.can_member_write(uuid)            set search_path = public;
alter function public.set_my_net_worth_sharing(boolean) set search_path = public;
alter function public.handle_new_user()                 set search_path = public;
alter function public.enforce_owner_can_edit()          set search_path = public;

-- CATATAN — lint 0028 (anon bisa execute) untuk can_member_write &
-- set_my_net_worth_sharing SENGAJA TIDAK diperbaiki:
--  * can_member_write(uuid) dipanggil DI DALAM RLS policy goals/accounts/
--    transactions/budgets (insert/update/delete). Revoke EXECUTE dari PUBLIC
--    akan membuat evaluasi policy gagal → SEMUA tulis ke tabel inti terblokir.
--    Fungsi ini WAJIB broadly-executable; warning-nya false-positive utk infra RLS.
--  * Keduanya mengandalkan auth.uid(); dipanggil anon = auth.uid() null = no-op,
--    jadi permukaan risiko nyata nol. Membiarkannya lebih aman daripada menyentuh
--    grant fungsi yang menopang RLS tabel keuangan.
