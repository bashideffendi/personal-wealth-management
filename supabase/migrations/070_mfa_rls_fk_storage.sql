-- 070_mfa_rls_fk_storage.sql
-- BELUM DITERAPKAN (audit 2026-10 deep). Review sebelum apply; apply SETELAH 069.
--
-- 1. 2FA lewat RLS. Enforcement AAL2 selama ini hanya di app (dashboard/layout,
--    print, step-up route). Sesi AAL1 (hanya password) milik user yang sudah
--    enroll authenticator tetap bisa SELECT/UPDATE semua tabel langsung via
--    PostgREST + anon key. Policy RESTRICTIVE di bawah mewajibkan aal2 untuk
--    user yang punya faktor terverifikasi (pola resmi Supabase "Enforce MFA").
--    Sengaja TIDAK dipasang di: profiles, security_events, subscriptions,
--    ai_credit_ledger, push_subscriptions, xp_events, achievements, plans —
--    alur login/tantangan MFA bisa menyentuhnya sebelum sesi naik ke aal2.
-- 2. FK ke auth.users tanpa ON DELETE (022, 015) membuat auth.admin.deleteUser
--    gagal. Route delete-account sudah me-null-kan dulu; ini akar perbaikannya.
-- 3. Bucket struk tanpa batas ukuran/tipe (011).
--
-- TEST setelah apply:
--   a. User TANPA 2FA: dashboard normal.
--   b. User DENGAN 2FA, sesi aal1 (sebelum isi kode): `select * from transactions`
--      via REST → 0 baris; setelah verifikasi kode → data muncul.
--   c. Hapus akun user yang pernah generate riset / menerima undangan → sukses.
--   d. Upload struk .html / > 10MB → ditolak storage.

begin;

-- ── 1. MFA ────────────────────────────────────────────────────────────────
-- SECURITY DEFINER agar tidak butuh grant SELECT ke auth.mfa_factors untuk
-- role authenticated; dipanggil sebagai (select public.mfa_satisfied()) supaya
-- dievaluasi sekali per statement.
create or replace function public.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
         where f.user_id = auth.uid() and f.status = 'verified'
      )
$$;
revoke all on function public.mfa_satisfied() from public, anon;
grant execute on function public.mfa_satisfied() to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts', 'transactions', 'budgets', 'goals', 'budget_categories',
    'assets_liquid', 'assets_non_liquid', 'investments', 'debts', 'debt_payments',
    'emergency_funds', 'emergency_fund_locations', 'emergency_fund_transactions',
    'transfers', 'credit_cards', 'credit_card_payments', 'recurring_transactions',
    'dividends', 'net_worth_snapshots', 'portfolio_snapshots', 'categorization_rules',
    'stock_transactions', 'contracts', 'account_allocations', 'watchlist',
    'notifications', 'households', 'household_members', 'household_activities',
    'household_invitations'
  ]
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('drop policy if exists "require aal2 when mfa enrolled" on public.%I', t);
    execute format(
      'create policy "require aal2 when mfa enrolled" on public.%I as restrictive '
      'for all to authenticated using ((select public.mfa_satisfied())) '
      'with check ((select public.mfa_satisfied()))', t);
  end loop;
end $$;

-- ── 2. FK ON DELETE SET NULL ──────────────────────────────────────────────
alter table public.stock_research_cache
  drop constraint if exists stock_research_cache_generated_by_fkey,
  add constraint stock_research_cache_generated_by_fkey
    foreign key (generated_by) references auth.users (id) on delete set null;

alter table public.household_invitations
  drop constraint if exists household_invitations_accepted_by_fkey,
  add constraint household_invitations_accepted_by_fkey
    foreign key (accepted_by) references auth.users (id) on delete set null;

-- ── 3. Bucket struk ───────────────────────────────────────────────────────
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'application/pdf']
 where id = 'receipts';

commit;
