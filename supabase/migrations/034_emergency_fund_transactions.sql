-- 034_emergency_fund_transactions.sql
-- Log pembentukan dana darurat: setiap setoran/penarikan dari waktu ke waktu.
-- Jadi sumber data buat chart "Perjalanan Membangun Dana" + riwayat (ikut sheet user).
--
-- IDEMPOTEN (create if not exists + drop/create policy) → aman di-apply / di-rerun.
-- RLS lewat kepemilikan fund (fund_id → emergency_funds.user_id), mirror policy
-- emergency_fund_locations yang udah ada.
create table if not exists public.emergency_fund_transactions (
  id uuid primary key default uuid_generate_v4(),
  fund_id uuid references public.emergency_funds on delete cascade not null,
  date date not null default current_date,
  kind text not null check (kind in ('setor', 'tarik')),
  amount bigint not null default 0,
  location text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_eft_fund_id on public.emergency_fund_transactions (fund_id);
alter table public.emergency_fund_transactions enable row level security;

drop policy if exists "eft_select" on public.emergency_fund_transactions;
create policy "eft_select" on public.emergency_fund_transactions for select
  using (exists (select 1 from public.emergency_funds f where f.id = fund_id and f.user_id = auth.uid()));

drop policy if exists "eft_insert" on public.emergency_fund_transactions;
create policy "eft_insert" on public.emergency_fund_transactions for insert
  with check (exists (select 1 from public.emergency_funds f where f.id = fund_id and f.user_id = auth.uid()));

drop policy if exists "eft_update" on public.emergency_fund_transactions;
create policy "eft_update" on public.emergency_fund_transactions for update
  using (exists (select 1 from public.emergency_funds f where f.id = fund_id and f.user_id = auth.uid()));

drop policy if exists "eft_delete" on public.emergency_fund_transactions;
create policy "eft_delete" on public.emergency_fund_transactions for delete
  using (exists (select 1 from public.emergency_funds f where f.id = fund_id and f.user_id = auth.uid()));
