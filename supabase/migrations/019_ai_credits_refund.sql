-- ============================================
-- 019 — AI Credit Refund
--
-- Companion to 018_ai_credits_metering.sql. The original metering charged
-- credits BEFORE calling the upstream Anthropic API. If Anthropic returned
-- 502/timeout/refusal, the user lost credits without getting a result.
--
-- This migration adds an atomic refund function so API routes can roll
-- back the charge in their catch blocks. We clamp to the user's plan cap
-- so a refund can never push the balance above the legitimate ceiling
-- (defensive — in practice we only refund what was just consumed).
-- ============================================

create or replace function public.refund_ai_credits(p_user_id uuid, p_amount int)
returns boolean
language plpgsql
security definer
as $$
declare
  v_cap int;
begin
  if p_amount <= 0 then return false; end if;

  -- Find the user's plan cap (same lookup as reset_ai_credits_if_due)
  select coalesce(pl.ai_credits_monthly, 10) into v_cap
  from public.subscriptions s
  left join public.plans pl on pl.id = s.plan_id
  where s.user_id = p_user_id and s.status = 'active'
  order by s.started_at desc
  limit 1;

  if v_cap is null then v_cap := 10; end if;

  -- Lock + add, clamped to cap
  update public.profiles
    set ai_credits = least(ai_credits + p_amount, v_cap)
    where id = p_user_id;

  return true;
end;
$$;

grant execute on function public.refund_ai_credits to authenticated;
