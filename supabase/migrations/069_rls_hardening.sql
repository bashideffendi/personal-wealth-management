-- BELUM DITERAPKAN (audit 2026-10 deep). Review sebelum apply.
--
-- 069_rls_hardening.sql — IDEMPOTEN. Run in Supabase SQL Editor.
--
-- Hasil audit RLS menyeluruh 001..068. Hanya menutup celah yang NYATA; tabel/fungsi
-- lain sudah benar (lihat laporan audit). Semua perubahan kompatibel dengan kode
-- app saat ini (dicek terhadap src/: family/page.tsx, transactions/page.tsx,
-- accounts/page.tsx, idx-research route & page).
--
--  §1 (P1) household_invitations: policy UPDATE 015 mengizinkan `accepted_by =
--     auth.uid()`. Penerima undangan yang sudah accepted bisa mengubah baris itu:
--     set household_id = <household korban>, status = 'pending', expires_at jauh
--     → akun lain memanggil accept_household_invitation(token) dan masuk ke
--     household korban (baca/tulis data keuangan bersama). Accept sudah lewat RPC
--     SECURITY DEFINER, jadi klausa itu tidak dibutuhkan → owner-only.
--
--  §2 (P1) household_members: policy UPDATE owner (041) tidak membatasi kolom →
--     owner bisa `update set user_id = <korban>` dan memasukkan user lain ke
--     household-nya tanpa undangan. App lalu auto-tag household_id di transaksi/
--     rekening baru korban → data korban terbaca owner. Fix: hak UPDATE kolom
--     dibatasi ke (can_edit, relationship) — persis yang dipakai family/page.tsx.
--     set_my_net_worth_sharing() SECURITY DEFINER, tidak terpengaruh.
--
--  §3 (P1) accounts/transactions/budgets/goals: policy UPDATE household (041/042)
--     tanpa WITH CHECK → USING dipakai ke baris baru, dan USING untuk baris
--     household TIDAK mengecek user_id. Anggota (atau siapa pun yang bikin
--     household sendiri) bisa `update set user_id = <uuid korban>` → baris palsu
--     muncul di data korban (RLS select `auth.uid() = user_id`), tak bisa dihapus
--     korban; budgets bahkan bisa nge-DoS (unique user_id,year,month,...).
--     Fix: trigger BEFORE UPDATE yang mem-PIN user_id (diam-diam, pola sama dgn
--     guard_profile_billing_columns 023/024). Sengaja tidak raise: form edit
--     transaksi mengirim `user_id: user.id`, dan anggota yang mengedit transaksi
--     anggota lain dulu diam-diam "mengambil alih" baris; sekarang pemilik tetap.
--
--  §4 (P2) adjust_account_balance (059): cek izin pakai is_household_member →
--     anggota "Lihat saja" (can_edit=false) bisa mengubah saldo rekening bersama,
--     padahal RLS UPDATE accounts (041) mensyaratkan can_member_write.
--
--  §5 (P2) households: owner bisa INSERT/UPDATE max_seats bebas (mis. 999) →
--     lewati batas kursi paket. Hak kolom dibatasi: INSERT (name, owner_user_id),
--     UPDATE (name). App hanya insert {name, owner_user_id}.
--
--  §6 (P3) stock_research_cache.generated_by terbaca semua user login → panen
--     UUID user (prasyarat serangan §3). App tidak pernah select kolom ini.
-- ============================================================

begin;

-- ---------------------------------------------------------------------------
-- §1 household_invitations — UPDATE hanya owner household.
-- ---------------------------------------------------------------------------
drop policy if exists "Owner can update invitations (revoke)" on public.household_invitations;
create policy "Owner can update invitations (revoke)"
  on public.household_invitations for update
  to authenticated
  using (
    exists (select 1 from public.households h
             where h.id = household_id and h.owner_user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.households h
             where h.id = household_id and h.owner_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- §2 household_members — client hanya boleh UPDATE kolom izin.
-- ---------------------------------------------------------------------------
revoke update on public.household_members from authenticated, anon;
grant  update (can_edit, relationship) on public.household_members to authenticated;

-- ---------------------------------------------------------------------------
-- §3 Pin pemilik baris (user_id) di tabel yang punya jalur tulis household.
-- ---------------------------------------------------------------------------
create or replace function public.pin_row_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Client (authenticated/anon) tidak boleh memindah kepemilikan baris.
  -- service_role / fungsi SECURITY DEFINER (current_user = owner) tidak di-pin.
  if current_user in ('authenticated', 'anon') then
    new.user_id := old.user_id;
  end if;
  return new;
end;
$$;
revoke execute on function public.pin_row_owner() from public, anon, authenticated;

drop trigger if exists pin_row_owner on public.accounts;
create trigger pin_row_owner before update on public.accounts
  for each row execute function public.pin_row_owner();

drop trigger if exists pin_row_owner on public.transactions;
create trigger pin_row_owner before update on public.transactions
  for each row execute function public.pin_row_owner();

drop trigger if exists pin_row_owner on public.budgets;
create trigger pin_row_owner before update on public.budgets
  for each row execute function public.pin_row_owner();

drop trigger if exists pin_row_owner on public.goals;
create trigger pin_row_owner before update on public.goals
  for each row execute function public.pin_row_owner();

-- ---------------------------------------------------------------------------
-- §4 adjust_account_balance — samakan izin dengan RLS UPDATE accounts (041).
--     Signature, search_path, dan grant tidak berubah (create or replace
--     mempertahankan grant; revoke/grant diulang defensif).
-- ---------------------------------------------------------------------------
create or replace function public.adjust_account_balance(
  p_account uuid, p_delta numeric, p_clamp_zero boolean default false
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare new_bal numeric;
begin
  update public.accounts
     set current_balance = case when p_clamp_zero
                                then greatest(0, current_balance + p_delta)
                                else current_balance + p_delta end
   where id = p_account
     and (user_id = auth.uid()
          or (household_id is not null and public.can_member_write(household_id)))
   returning current_balance into new_bal;
  if new_bal is null then
    raise exception 'account not found or not permitted' using errcode = '42501';
  end if;
  return new_bal;
end;
$$;
revoke all on function public.adjust_account_balance(uuid, numeric, boolean) from public, anon;
grant execute on function public.adjust_account_balance(uuid, numeric, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- §5 households — max_seats bukan kolom milik client.
-- ---------------------------------------------------------------------------
revoke insert, update on public.households from authenticated, anon;
grant  insert (name, owner_user_id) on public.households to authenticated;
grant  update (name)                on public.households to authenticated;

-- ---------------------------------------------------------------------------
-- §6 stock_research_cache — sembunyikan generated_by dari client.
-- ---------------------------------------------------------------------------
revoke select on public.stock_research_cache from authenticated, anon;
grant  select (ticker, content, frontmatter, generated_at, model, input_tokens, output_tokens)
  on public.stock_research_cache to authenticated;

commit;

-- >>> TEST SETELAH APPLY (sebagai user login, dari console browser):
--  a) Keluarga: owner ubah izin anggota (can_edit/relationship) → tetap jalan;
--     owner `update({user_id: <uuid lain>})` di household_members → permission denied.
--  b) Penerima undangan: `from('household_invitations').update({status:'pending'})
--     .eq('id', <undangan yg dia accept>)` → 0 baris berubah.
--  c) Edit transaksi sendiri & transaksi household anggota lain → tersimpan,
--     user_id baris TIDAK berubah. `update({user_id: <uuid lain>})` → user_id tetap.
--  d) Anggota can_edit=false: rpc('adjust_account_balance', …) rekening bersama → 42501.
--  e) Buat household baru → sukses; `update({max_seats: 99})` → permission denied.
--  f) Halaman riset saham tetap tampil; select('generated_by') → permission denied.
