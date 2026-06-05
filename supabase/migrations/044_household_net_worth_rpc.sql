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
