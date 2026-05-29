-- ============================================================
-- 025 — Allow service_role to run the AI-credit mutation RPCs
--
-- Part 1 of closing the last vector (refund self-refill). The app is moving
-- the credit mutations (consume/refund/reset) to a SERVICE-ROLE client
-- (src/lib/supabase/admin.ts) so users can no longer invoke them directly.
--
-- Problem: the 023 guard was `if auth.uid() is null or auth.uid() <> p_user_id`.
-- A service_role call has auth.uid() = null, so that guard would REJECT the
-- server's own calls. This migration relaxes the guard to:
--     if auth.role() = 'authenticated' and auth.uid() <> p_user_id then reject
-- which still blocks a signed-in user from touching another user's balance,
-- but allows service_role (auth.role() <> 'authenticated') through.
--
-- SAFE TO APPLY ANY TIME: authenticated own-id calls still pass, so the app
-- keeps working whether it calls via the user client (fallback) or service_role.
-- It does NOT yet close self-refill — that needs migration 026 (the revoke),
-- which must be applied only AFTER the service-role code is deployed.
--
-- ai_credit_status is intentionally NOT changed here: it is read-only and the
-- client badge calls it directly, so it keeps the strict own-row guard from 023.
-- ============================================================

create or replace function public.consume_ai_credits(p_user_id uuid, p_amount int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current int;
begin
  if auth.role() = 'authenticated' and auth.uid() <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select ai_credits into v_current
  from public.profiles
  where id = p_user_id
  for update;

  if v_current is null then return false; end if;
  if v_current < p_amount then return false; end if;

  update public.profiles
    set ai_credits = ai_credits - p_amount
    where id = p_user_id;

  return true;
end;
$$;

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
  where s.user_id = p_user_id and s.status = 'active'
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
  where s.user_id = p_user_id and s.status = 'active'
  order by s.started_at desc
  limit 1;

  if v_cap is null then v_cap := 10; end if;

  update public.profiles
    set ai_credits = least(ai_credits + p_amount, v_cap)
    where id = p_user_id;

  return true;
end;
$$;
