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

-- Owner can never be view-only (prevents self-lockout from own household data).
create or replace function public.enforce_owner_can_edit()
returns trigger language plpgsql as $$
begin
  if new.role = 'owner' then new.can_edit := true; end if;
  return new;
end;
$$;
drop trigger if exists trg_owner_can_edit on public.household_members;
create trigger trg_owner_can_edit
  before insert or update on public.household_members
  for each row execute function public.enforce_owner_can_edit();

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
