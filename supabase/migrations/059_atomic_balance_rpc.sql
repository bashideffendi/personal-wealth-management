-- 059_atomic_balance_rpc.sql — IDEMPOTEN. Run in Supabase SQL Editor.
--
-- RPC increment saldo ATOMIK — menutup race "lost update" dari pola lama
-- read-modify-write nilai absolut (current_balance = <state-client-basi> + amount)
-- di quick-add / transactions / credit-cards. Ownership di-enforce DI DALAM
-- fungsi (SECURITY DEFINER bypass RLS) persis aturan RLS tabelnya.
--
-- Aman diapply kapan saja. Kode app pakai fallback: kalau fungsi ini belum ada,
-- jatuh ke perilaku lama (jadi tidak ada urutan-deploy yang bisa bikin live rusak).

-- Kartu kredit: owner-only (RLS migrasi 004)
create or replace function public.adjust_credit_card_balance(
  p_card uuid, p_delta numeric, p_clamp_zero boolean default false
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare new_bal numeric;
begin
  update public.credit_cards
     set current_balance = case when p_clamp_zero
                                then greatest(0, current_balance + p_delta)
                                else current_balance + p_delta end
   where id = p_card and user_id = auth.uid()
   returning current_balance into new_bal;
  if new_bal is null then
    raise exception 'credit_card not found or not owned' using errcode = '42501';
  end if;
  return new_bal;
end;
$$;
revoke all on function public.adjust_credit_card_balance(uuid, numeric, boolean) from public, anon;
grant execute on function public.adjust_credit_card_balance(uuid, numeric, boolean) to authenticated;

-- Rekening: owner ATAU anggota household (RLS migrasi 015)
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
          or (household_id is not null and public.is_household_member(household_id)))
   returning current_balance into new_bal;
  if new_bal is null then
    raise exception 'account not found or not permitted' using errcode = '42501';
  end if;
  return new_bal;
end;
$$;
revoke all on function public.adjust_account_balance(uuid, numeric, boolean) from public, anon;
grant execute on function public.adjust_account_balance(uuid, numeric, boolean) to authenticated;
