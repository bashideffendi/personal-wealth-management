-- ============================================================
-- 026 — Close the refund self-refill vector (FINAL STEP)
--
-- This is the step that actually closes the last vector: a signed-in user
-- calling refund_ai_credits(self, n) from the browser to top their own balance
-- back to the plan cap, repeatedly, bypassing the monthly meter.
--
-- It revokes EXECUTE on the three credit MUTATION functions from `authenticated`
-- (and anon/public, already done in 023). After this they are callable ONLY by
-- `service_role` — i.e. only the server, via src/lib/supabase/admin.ts.
--
-- >>> ORDER MATTERS — apply this LAST, and ONLY after BOTH are true:
--   1. SUPABASE_SERVICE_ROLE_KEY is set in the app's env (local + Vercel), and
--   2. the build that routes credit mutations through the service-role client
--      (admin.ts + the updated lib/ai-credits.ts) is DEPLOYED and verified.
--
-- If you apply this BEFORE that deploy, the app (still calling these RPCs as
-- the authenticated user) will get "permission denied for function ..." and
-- every AI feature that charges credits will fail. Verify on a Preview
-- deployment first.
--
-- ai_credit_status is NOT revoked — it is read-only and the client badge calls
-- it directly (with its own-row guard from 023).
--
-- Rollback if needed:
--   grant execute on function public.consume_ai_credits(uuid, int) to authenticated;
--   grant execute on function public.refund_ai_credits(uuid, int)  to authenticated;
--   grant execute on function public.reset_ai_credits_if_due(uuid)  to authenticated;
-- ============================================================

revoke execute on function public.consume_ai_credits(uuid, int) from authenticated;
revoke execute on function public.refund_ai_credits(uuid, int)  from authenticated;
revoke execute on function public.reset_ai_credits_if_due(uuid)  from authenticated;
