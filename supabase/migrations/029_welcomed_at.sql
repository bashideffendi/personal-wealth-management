-- 029_welcomed_at.sql
--
-- One-shot marker so the welcome email (sent from /auth/callback on a user's
-- first login) fires exactly once per user. Nullable + additive → safe and
-- reversible (drop with: alter table public.profiles drop column welcomed_at).
--
-- NOT yet applied. Apply with `supabase db push`, or paste into the Supabase
-- SQL editor, once the dev/prod DB split is sorted. The /auth/callback code is
-- already defensive: until this runs, the welcome step simply no-ops.

alter table public.profiles
  add column if not exists welcomed_at timestamptz;
