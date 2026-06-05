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
