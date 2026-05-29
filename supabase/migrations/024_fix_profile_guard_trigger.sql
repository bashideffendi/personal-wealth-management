-- ============================================================
-- 024 — Repair the profiles billing-column guard + advisor cleanup
--
-- IMPORTANT FIX:
--   Migration 023 created public.guard_profile_billing_columns() as
--   SECURITY DEFINER. Inside a SECURITY DEFINER function `current_user` is the
--   function OWNER (postgres), never the original caller — so the guard's
--   `current_user in ('authenticated','anon')` check was ALWAYS false and the
--   trigger never pinned anything. i.e. Vector 1 (a signed-in user doing
--   `update public.profiles set ai_credits = 999 where id = me` straight from
--   the client) was NOT actually closed by 023.
--
--   Switching the function to SECURITY INVOKER makes `current_user` reflect the
--   real executor:
--     - direct client write  -> current_user = 'authenticated' (or 'anon') -> pinned
--     - metering fns (018/019, SECURITY DEFINER owned by postgres) run their
--       UPDATE as postgres -> current_user = 'postgres' -> NOT pinned (allowed)
--     - service_role writes  -> current_user = 'service_role' -> allowed
--   No EXECUTE privilege is needed for a trigger to fire, so revoking it from
--   the client roles is safe.
--
-- >>> TEST AFTER APPLYING (the one that proves Vector 1 is finally closed):
--   In the browser console as a logged-in user:
--     await supabase.from('profiles').update({ ai_credits: 999999 }).eq('id', <your id>)
--   then re-read profiles.ai_credits — it must be UNCHANGED.
--   Also re-run an AI action and confirm credits still DECREMENT (proves the
--   metering SECURITY DEFINER path is still allowed through the trigger).
-- ============================================================

-- 1. THE FIX — flip the guard to SECURITY INVOKER so current_user is the caller.
alter function public.guard_profile_billing_columns() security invoker;

-- 2. A trigger function is invoked by the system, never called directly, so no
--    role needs EXECUTE on it. (Clears the advisor "can execute" flags for it.)
revoke execute on function public.guard_profile_billing_columns() from public, anon, authenticated;

-- 3. Cosmetic: pin a fixed search_path on the remaining flagged helper functions.
--    Uses ALTER (config only) — the function bodies are untouched and already
--    use fully-qualified names, so this is behavior-neutral. Clears the 5
--    "Function Search Path Mutable" advisor warnings.
alter function public.is_household_member(uuid)         set search_path = public, pg_temp;
alter function public.current_household_id()            set search_path = public, pg_temp;
alter function public.accept_household_invitation(text) set search_path = public, pg_temp;
alter function public.touch_updated_at()                set search_path = public, pg_temp;
alter function public.handle_new_user()                 set search_path = public, pg_temp;
