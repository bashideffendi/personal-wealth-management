-- 065_atomic_debt_rpc.sql — IDEMPOTEN. Run in Supabase SQL Editor.
--
-- RPC increment sisa utang ATOMIK — menutup race "lost update" yang sama
-- dengan yang ditutup 059 untuk accounts/credit_cards, tapi belum diterapkan
-- ke debts.remaining (bayar utang & hapus pembayaran masih read-modify-write
-- dari state client yang bisa basi: dua tab / double-click = sisa utang salah).
--
-- Aman diapply kapan saja. Kode app pakai fallback: kalau fungsi ini belum ada,
-- jatuh ke perilaku lama (tidak ada urutan-deploy yang bisa bikin live rusak).

-- Utang: owner-only (RLS debts)
create or replace function public.adjust_debt_remaining(
  p_debt uuid, p_delta numeric, p_clamp_zero boolean default true
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare new_bal numeric;
begin
  update public.debts
     set remaining = case when p_clamp_zero
                          then greatest(0, remaining + p_delta)
                          else remaining + p_delta end
   where id = p_debt and user_id = auth.uid()
   returning remaining into new_bal;
  if new_bal is null then
    raise exception 'debt not found or not owned' using errcode = '42501';
  end if;
  return new_bal;
end;
$$;
revoke all on function public.adjust_debt_remaining(uuid, numeric, boolean) from public, anon;
grant execute on function public.adjust_debt_remaining(uuid, numeric, boolean) to authenticated;
