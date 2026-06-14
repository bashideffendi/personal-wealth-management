-- 054 — Cap kredit AI: ikutkan status 'trialing' saat lookup plan (billing-4)
--
-- Bug: reset_ai_credits_if_due + refund_ai_credits lookup plan cap dengan
-- `s.status = 'active'` doang → user TRIALING dapat fallback 10 kredit pas reset
-- bulanan / refund, bukan cap plan-nya (250). Sekarang masih ketutup karena trial
-- 21 hari < 30 hari window renewal, TAPI jadi bug nyata kalau trial diperpanjang
-- (lihat catatan query manual di migration 051). Fix: status in ('active','trialing').
--
-- create or replace, idempoten. Body identik 025 kecuali klausa WHERE status.
-- (consume_ai_credits TIDAK pakai cap lookup → tidak diubah.)

create or replace function public.reset_ai_credits_if_due(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_renewal timestamptz;
  v_cap int;
begin
  if auth.role() = 'authenticated' and auth.uid() <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select ai_credits_renewal_at into v_renewal
  from public.profiles where id = p_user_id;

  if v_renewal is null or v_renewal > now() then
    return;
  end if;

  select coalesce(p.ai_credits_monthly, 10) into v_cap
  from public.subscriptions s
  left join public.plans p on p.id = s.plan_id
  where s.user_id = p_user_id and s.status in ('active', 'trialing')
  order by s.started_at desc
  limit 1;

  if v_cap is null then v_cap := 10; end if;

  update public.profiles
    set ai_credits = v_cap,
        ai_credits_renewal_at = now() + interval '30 days'
    where id = p_user_id;
end;
$$;

create or replace function public.refund_ai_credits(p_user_id uuid, p_amount int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap int;
begin
  if auth.role() = 'authenticated' and auth.uid() <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_amount <= 0 then return false; end if;

  select coalesce(pl.ai_credits_monthly, 10) into v_cap
  from public.subscriptions s
  left join public.plans pl on pl.id = s.plan_id
  where s.user_id = p_user_id and s.status in ('active', 'trialing')
  order by s.started_at desc
  limit 1;

  if v_cap is null then v_cap := 10; end if;

  update public.profiles
    set ai_credits = least(ai_credits + p_amount, v_cap)
    where id = p_user_id;

  return true;
end;
$$;
