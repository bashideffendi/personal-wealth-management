-- ============================================================
-- 023 — Harden AI-credit access (security)
--
-- Surfaced by Supabase Security Advisor (2026-05-29) + code review.
-- The AI-credit balance lives in profiles.ai_credits and is metered by the
-- SECURITY DEFINER functions in 018/019. Two abuse vectors existed:
--
--   Vector 1 (direct table write): the profiles UPDATE policy is
--     `using (auth.uid() = id)` with NO column restriction, so any signed-in
--     user could `update public.profiles set ai_credits = 999999 where id = me`
--     straight from the browser anon client. This is the worst one.
--
--   Vector 2 (RPC): consume/refund/reset/status are SECURITY DEFINER, take
--     p_user_id as a parameter, were granted to `authenticated` AND retained
--     the default PUBLIC execute grant (callable even by `anon`), and never
--     verified the caller. So a user could drain ANOTHER user's credits
--     (consume with a victim id), read anyone's balance (status), or — even
--     unauthenticated — hit the RPC endpoints.
--
-- This migration closes everything that can be closed WITHOUT introducing a
-- service-role key (none is provisioned). What it does:
--   1. Recreates the 4 credit functions with `set search_path = ''` (clears the
--      "Function Search Path Mutable" advisor warnings) + a caller guard
--      (`auth.uid() = p_user_id`) so they only ever act on the caller's own row.
--   2. Revokes EXECUTE from `anon` + `public` on the credit functions and the
--      other SECURITY DEFINER helpers (kills the "callable without signing in"
--      surface). `authenticated` keeps EXECUTE so the app's server routes —
--      which call as the signed-in user — keep working.
--   3. Adds a BEFORE UPDATE trigger on profiles that pins ai_credits +
--      ai_credits_renewal_at for the client roles (authenticated/anon),
--      closing Vector 1. The SECURITY DEFINER functions run as the table owner
--      (current_user = postgres), so they bypass the trigger and can still
--      meter credits normally. Legit client profile edits (theme, language,
--      pin, avatar, onboarding, etc.) never touch these columns, so they are
--      unaffected.
--
-- KNOWN RESIDUAL (needs a follow-up, see task / migration 024):
--   `refund_ai_credits(self, n)` is still callable by the signed-in user and,
--   because it is SECURITY DEFINER, the trigger does not block it — so a user
--   can refill THEIR OWN balance up to the plan cap repeatedly, bypassing the
--   monthly meter. Fully closing this needs refund (and ideally consume/reset)
--   to run only via the SERVICE ROLE from the server routes, then
--   `revoke execute on refund_ai_credits from authenticated`. That requires
--   provisioning SUPABASE_SERVICE_ROLE_KEY + a small app change, so it is
--   deferred to a coordinated deploy.
--
-- >>> TEST AFTER APPLYING (cannot be tested from migrations):
--   a) Run an AI action (receipt scan / insights / NL parse) → credits should
--      still decrement, and a forced failure should refund.
--   b) Edit a profile setting (theme/language/PIN) → should still save.
--   c) From the browser console as a logged-in user, try
--        supabase.from('profiles').update({ai_credits: 999}).eq('id', <id>)
--      → ai_credits must NOT change (the update "succeeds" but the column is
--      pinned by the trigger).
--   d) Try supabase.rpc('ai_credit_status', { p_user_id: <some other uuid> })
--      → must error (forbidden), not return a row.
-- ============================================================

-- ---------------------------------------------------------------------------
-- 1. Recreate credit functions: pinned search_path + caller guard.
--    Bodies are byte-for-byte the same logic as 018/019, with two additions:
--      - `set search_path = ''` in the function header
--      - a guard block rejecting calls where auth.uid() <> p_user_id
--    All object refs are already fully schema-qualified, so an empty
--    search_path is safe (built-ins resolve via pg_catalog, always implicit).
-- ---------------------------------------------------------------------------

-- 1a. consume — atomic check+deduct. Returns TRUE if charged.
create or replace function public.consume_ai_credits(p_user_id uuid, p_amount int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current int;
begin
  -- Caller may only spend their OWN credits.
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Lock the row to prevent concurrent over-spend
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

-- 1b. reset — top up to plan cap if past renewal.
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
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select ai_credits_renewal_at into v_renewal
  from public.profiles where id = p_user_id;

  if v_renewal is null or v_renewal > now() then
    return;  -- not yet due
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

-- 1c. status — read current balance / cap / renewal.
create or replace function public.ai_credit_status(p_user_id uuid)
returns table(current_credits int, monthly_cap int, renewal_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select
    pr.ai_credits,
    coalesce(pl.ai_credits_monthly, 10),
    pr.ai_credits_renewal_at
  from public.profiles pr
  left join public.subscriptions s on s.user_id = pr.id and s.status = 'active'
  left join public.plans pl on pl.id = s.plan_id
  where pr.id = p_user_id
  order by s.started_at desc
  limit 1;
end;
$$;

-- 1d. refund — add credits, clamped to plan cap.
--     NOTE: caller guard added, but see KNOWN RESIDUAL above — a user can still
--     self-refill to cap. Closing that needs service-role-only execution.
create or replace function public.refund_ai_credits(p_user_id uuid, p_amount int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap int;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
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

-- ---------------------------------------------------------------------------
-- 2. Lock down EXECUTE. Kill the anon/public surface; keep `authenticated`
--    (the app's server routes call as the signed-in user).
-- ---------------------------------------------------------------------------
revoke execute on function public.consume_ai_credits(uuid, int)     from public, anon;
revoke execute on function public.refund_ai_credits(uuid, int)      from public, anon;
revoke execute on function public.reset_ai_credits_if_due(uuid)     from public, anon;
revoke execute on function public.ai_credit_status(uuid)            from public, anon;
grant  execute on function public.consume_ai_credits(uuid, int)     to authenticated;
grant  execute on function public.refund_ai_credits(uuid, int)      to authenticated;
grant  execute on function public.reset_ai_credits_if_due(uuid)     to authenticated;
grant  execute on function public.ai_credit_status(uuid)            to authenticated;

-- Other SECURITY DEFINER helpers flagged as "Public Can Execute" — these should
-- never be reachable by anon. handle_new_user is a signup trigger (no API need
-- at all). is_household_member / current_household_id are RLS helpers used
-- inside policies (definer context), not meant to be called from the client.
revoke execute on function public.handle_new_user()                 from public, anon;
revoke execute on function public.is_household_member(uuid)         from public, anon;
revoke execute on function public.current_household_id()            from public, anon;
-- accept_household_invitation stays callable by authenticated (a user accepts
-- their own invite); just drop the anon/public grant.
revoke execute on function public.accept_household_invitation(text) from public, anon;

-- ---------------------------------------------------------------------------
-- 3. Pin billing columns on profiles against direct client writes (Vector 1).
--    Client roles (authenticated/anon) can still UPDATE their own profile row
--    via RLS, but any attempt to change ai_credits / ai_credits_renewal_at is
--    silently reverted to the existing value. The metering functions in §1 are
--    SECURITY DEFINER (current_user = table owner), so they are NOT affected
--    and continue to set these columns.
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.ai_credits            := old.ai_credits;
    new.ai_credits_renewal_at := old.ai_credits_renewal_at;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_billing_columns on public.profiles;
create trigger guard_profile_billing_columns
  before update on public.profiles
  for each row
  execute function public.guard_profile_billing_columns();
