-- ============================================================
-- 045 — Optional account number on `accounts`
--
-- Stores an OPTIONAL account / e-wallet number per account. Shown MASKED
-- (•••• last4) in the UI, and fully hidden when privacy mode is on.
--
-- `accounts` is already RLS-protected (owner + household member), so no new
-- policy is needed. Column is nullable with no default → existing rows stay
-- valid and the app degrades gracefully if this migration hasn't run yet.
--
-- Run in Supabase SQL Editor.
-- ============================================================

alter table public.accounts add column if not exists account_number text;

comment on column public.accounts.account_number is
  'Optional account/e-wallet number. Displayed masked (•••• last4) in UI; owner-private via existing accounts RLS.';
