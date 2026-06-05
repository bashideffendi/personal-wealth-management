-- ============================================================
-- KELUARGA ROADMAP — jalankan SEKALI di Supabase SQL Editor.
-- URUT: 041 dulu (helper can_member_write), baru 042-044.
-- Sumber kebenaran = file masing-masing di supabase/migrations/.
-- ============================================================


-- >>>>>>>> 041_household_member_permissions.sql >>>>>>>>
-- ============================================================
-- 041 — Household granular permissions + net-worth sharing opt-in
--
-- Adds to household_members:
--   can_edit        — false = "Lihat saja" (view-only): can SEE shared data,
--                     cannot insert/update/delete it. Owner always true.
--   relationship    — cosmetic label (pasangan/orang_tua/anak/saudara/lainnya).
--   share_net_worth — opt-in (default FALSE) to include own net worth in the
--                     household combined figure (see migration 044 RPC).
--
-- Security model (mirrors 015 exactly, adds can_edit gate on WRITES):
--   - SELECT on shared rows: unchanged (any member sees).
--   - INSERT/UPDATE/DELETE on HOUSEHOLD rows: only members who can_member_write
--     (= owner OR can_edit). Personal rows (household_id null): own only.
--   - Owner manages member perms; self toggles ONLY own share_net_worth via RPC
--     (direct self-UPDATE is blocked to prevent can_edit self-escalation).
--
-- Run in Supabase SQL Editor. "Success. No rows returned" = ok.
-- ============================================================

alter table public.household_members add column if not exists can_edit boolean not null default true;
alter table public.household_members add column if not exists relationship text
  check (relationship in ('pasangan', 'orang_tua', 'anak', 'saudara', 'lainnya'));
alter table public.household_members add column if not exists share_net_worth boolean not null default false;

-- Tie the member row to ACTUAL ownership: the real household owner is always
-- role=owner + can_edit (prevents owner self-demotion and self-lockout from own data).
create or replace function public.enforce_owner_can_edit()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.households h where h.id = new.household_id and h.owner_user_id = new.user_id) then
    new.role := 'owner';
    new.can_edit := true;
  elsif new.role = 'owner' then
    new.can_edit := true;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_owner_can_edit on public.household_members;
create trigger trg_owner_can_edit
  before insert or update on public.household_members
  for each row execute function public.enforce_owner_can_edit();

-- Harden membership INSERT: you may only insert YOURSELF as the OWNER of a household
-- you created (the create-household flow). Joining someone else's household MUST go
-- through accept_household_invitation() (SECURITY DEFINER, bypasses RLS) which enforces
-- invite validity + capacity + one-household-per-user. Closes the 015 self-join bypass.
drop policy if exists "Anyone can insert self into household" on public.household_members;
drop policy if exists "Owner can insert self on create" on public.household_members;
create policy "Owner can insert self on create"
  on public.household_members for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.households h where h.id = household_id and h.owner_user_id = auth.uid())
  );

-- Single source of truth for "can this user WRITE household rows": member AND (owner OR can_edit).
create or replace function public.can_member_write(hid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.household_members m
    join public.households h on h.id = m.household_id
    where m.household_id = hid
      and m.user_id = auth.uid()
      and (h.owner_user_id = auth.uid() or m.can_edit = true)
  );
$$;

-- Owner manages member perms (can_edit / relationship). NOTE: no self-UPDATE policy —
-- a member must NOT be able to flip their own can_edit. Self-only privacy toggle
-- (share_net_worth) goes through the RPC below.
drop policy if exists "Owner can update member perms" on public.household_members;
create policy "Owner can update member perms"
  on public.household_members for update
  using (exists (select 1 from public.households h where h.id = household_id and h.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.households h where h.id = household_id and h.owner_user_id = auth.uid()));

-- Self toggles OWN net-worth sharing only (cannot touch can_edit / role).
create or replace function public.set_my_net_worth_sharing(share boolean)
returns void
language sql
security definer
as $$
  update public.household_members set share_net_worth = share where user_id = auth.uid();
$$;
grant execute on function public.set_my_net_worth_sharing(boolean) to authenticated;

-- ── Re-gate WRITE policies on shared tables ───────────────────────────────
-- Personal rows (household_id null): own only. Household rows: can_member_write.
-- SELECT policies from 015 stay unchanged (view-only members keep read access).

-- ACCOUNTS
drop policy if exists "Users can insert own or household accounts" on public.accounts;
create policy "Users can insert own or household accounts"
  on public.accounts for insert
  with check (auth.uid() = user_id and (household_id is null or public.can_member_write(household_id)));
drop policy if exists "Users can update own or household accounts" on public.accounts;
create policy "Users can update own or household accounts"
  on public.accounts for update
  using ((household_id is null and auth.uid() = user_id) or (household_id is not null and public.can_member_write(household_id)));
drop policy if exists "Users can delete own or household accounts" on public.accounts;
create policy "Users can delete own or household accounts"
  on public.accounts for delete
  using ((household_id is null and auth.uid() = user_id) or (household_id is not null and public.can_member_write(household_id)));

-- TRANSACTIONS
drop policy if exists "Users can insert own or household transactions" on public.transactions;
create policy "Users can insert own or household transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id and (household_id is null or public.can_member_write(household_id)));
drop policy if exists "Users can update own or household transactions" on public.transactions;
create policy "Users can update own or household transactions"
  on public.transactions for update
  using ((household_id is null and auth.uid() = user_id) or (household_id is not null and public.can_member_write(household_id)));
drop policy if exists "Users can delete own or household transactions" on public.transactions;
create policy "Users can delete own or household transactions"
  on public.transactions for delete
  using ((household_id is null and auth.uid() = user_id) or (household_id is not null and public.can_member_write(household_id)));

-- BUDGETS
drop policy if exists "Users can insert own or household budgets" on public.budgets;
create policy "Users can insert own or household budgets"
  on public.budgets for insert
  with check (auth.uid() = user_id and (household_id is null or public.can_member_write(household_id)));
drop policy if exists "Users can update own or household budgets" on public.budgets;
create policy "Users can update own or household budgets"
  on public.budgets for update
  using ((household_id is null and auth.uid() = user_id) or (household_id is not null and public.can_member_write(household_id)));
drop policy if exists "Users can delete own or household budgets" on public.budgets;
create policy "Users can delete own or household budgets"
  on public.budgets for delete
  using ((household_id is null and auth.uid() = user_id) or (household_id is not null and public.can_member_write(household_id)));


-- >>>>>>>> 042_household_goals.sql >>>>>>>>
-- ============================================================
-- 042 — Tujuan Bersama (shared household goals)
--
-- Reuse the existing goals table: a goal becomes shared when household_id is set.
-- household_id null = personal (unchanged). Mirrors the accounts/transactions
-- sharing pattern from 015 + the can_member_write() write-gate from 041.
--
-- Depends on 041 (can_member_write). Run in Supabase SQL Editor.
-- ============================================================

alter table public.goals add column if not exists household_id uuid references public.households on delete set null;
create index if not exists idx_goals_household on public.goals (household_id) where household_id is not null;

-- Replace the own-only FOR ALL policy with household-aware per-operation policies.
drop policy if exists "Users can manage own goals" on public.goals;

drop policy if exists "Users can view own or household goals" on public.goals;
create policy "Users can view own or household goals"
  on public.goals for select
  using (auth.uid() = user_id or (household_id is not null and public.is_household_member(household_id)));

drop policy if exists "Users can insert own or household goals" on public.goals;
create policy "Users can insert own or household goals"
  on public.goals for insert
  with check (auth.uid() = user_id and (household_id is null or public.can_member_write(household_id)));

drop policy if exists "Users can update own or household goals" on public.goals;
create policy "Users can update own or household goals"
  on public.goals for update
  using ((household_id is null and auth.uid() = user_id) or (household_id is not null and public.can_member_write(household_id)));

drop policy if exists "Users can delete own or household goals" on public.goals;
create policy "Users can delete own or household goals"
  on public.goals for delete
  using ((household_id is null and auth.uid() = user_id) or (household_id is not null and public.can_member_write(household_id)));


-- >>>>>>>> 043_household_activities.sql >>>>>>>>
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


-- >>>>>>>> 044_household_net_worth_rpc.sql >>>>>>>>
-- ============================================================
-- 044 — Net Worth Gabungan (combined household net worth) RPC
--
-- net_worth_snapshots stay per-user + own-only RLS (detail aset/utang TIDAK
-- pernah bocor antar-anggota). Aggregation happens ONLY inside this trusted
-- SECURITY DEFINER function, which returns the TOTAL — never per-member rows.
--
-- Privacy: sums only members who opted in (share_net_worth = true, default
-- FALSE from 041). Opting in = consenting to share your net worth with your
-- household. Uses each member's LATEST snapshot.
--
-- Run in Supabase SQL Editor.
-- ============================================================

create or replace function public.get_household_net_worth(hh_id uuid)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  res jsonb;
  total_members int;
begin
  -- Defensive: reject null id (no global/null household allowed).
  if hh_id is null then
    return jsonb_build_object('success', false, 'error', 'Household tidak valid.');
  end if;

  -- Caller must be a member of this household.
  if not exists (
    select 1 from public.household_members where household_id = hh_id and user_id = auth.uid()
  ) then
    return jsonb_build_object('success', false, 'error', 'Bukan anggota keluarga ini.');
  end if;

  select count(*) into total_members from public.household_members where household_id = hh_id;

  with sharers as (
    select user_id
    from public.household_members
    where household_id = hh_id and share_net_worth = true
  ),
  latest as (
    select distinct on (n.user_id)
      n.user_id, n.net_worth, n.total_assets, n.total_debts, n.snapshot_date
    from public.net_worth_snapshots n
    join sharers s on s.user_id = n.user_id
    order by n.user_id, n.snapshot_date desc
  )
  select jsonb_build_object(
    'success', true,
    'combined_net_worth', coalesce(sum(net_worth), 0),
    'combined_assets', coalesce(sum(total_assets), 0),
    'combined_debts', coalesce(sum(total_debts), 0),
    'members_sharing', count(*),
    'members_total', total_members,
    'as_of', max(snapshot_date)
  ) into res
  from latest;

  return res;
end;
$$;

grant execute on function public.get_household_net_worth(uuid) to authenticated;

