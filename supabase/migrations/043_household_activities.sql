-- ============================================================
-- 043 — Household activity feed (aktivitas anggota)
--
-- Lightweight append-only feed of household-level events (member joined,
-- invitation sent/revoked, member removed, shared goal created). Logged
-- app-level by the member who performed the action (RLS enforces they can
-- only log as themselves, in their own household). No UPDATE/DELETE policies
-- = immutable (RLS denies by default).
--
-- v1 scope: membership + shared-goal events only (NOT per-transaction —
-- too noisy). Retention: low-volume; revisit a prune job if it grows.
--
-- Run in Supabase SQL Editor.
-- ============================================================

create table if not exists public.household_activities (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid references public.households on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  action text not null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists idx_household_activities_feed
  on public.household_activities (household_id, created_at desc);

alter table public.household_activities enable row level security;

drop policy if exists "Members view household activities" on public.household_activities;
create policy "Members view household activities"
  on public.household_activities for select
  using (public.is_household_member(household_id));

drop policy if exists "Members log own activities" on public.household_activities;
create policy "Members log own activities"
  on public.household_activities for insert
  with check (auth.uid() = user_id and public.is_household_member(household_id));
