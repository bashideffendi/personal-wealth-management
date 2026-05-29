-- ============================================================
-- 027 — Secure invitation lookup RPC (part 1 of 2)
--
-- Problem (from 015): the policy "Anyone can read invitation by token" lets
-- ANY authenticated user SELECT every pending, non-expired household_invitations
-- row — including the secret `token`. So a logged-in stranger can enumerate
-- tokens and join a household that has an open seat (via
-- accept_household_invitation), gaining access to that family's shared finances.
--
-- Fix: replace the broad SELECT with a SECURITY DEFINER lookup that returns
-- ONLY the single row matching an exact token, and only safe display fields
-- (never the token, never a list). You can preview an invite only if you
-- already hold its exact token (i.e. you were given the link) — no enumeration.
--
-- This migration is ADDITIVE and safe to apply any time: it just creates the
-- function. The broad policy is dropped separately in migration 028, AFTER the
-- updated join page (which calls this RPC) is deployed — so there is no window
-- where the join page can't read invitations.
--
-- Bonus: running as definer, this also returns an accurate member_count and the
-- inviter's name, which the old client query couldn't read (RLS blocked the
-- invitee from seeing household_members and the inviter's profile).
-- ============================================================

create or replace function public.get_household_invitation(invite_token text)
returns table (
  status           text,
  expires_at       timestamptz,
  household_id     uuid,
  household_name   text,
  max_seats        integer,
  invited_by_name  text,
  member_count     integer
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    i.status,
    i.expires_at,
    i.household_id,
    h.name,
    h.max_seats,
    p.full_name,
    (select count(*)::int
       from public.household_members m
      where m.household_id = i.household_id)
  from public.household_invitations i
  left join public.households h on h.id = i.household_id
  left join public.profiles   p on p.id = i.invited_by
  where i.token = invite_token
  limit 1;
$$;

-- Only signed-in users need this (the join page is under /dashboard, auth-gated).
revoke execute on function public.get_household_invitation(text) from public, anon;
grant  execute on function public.get_household_invitation(text) to authenticated;
