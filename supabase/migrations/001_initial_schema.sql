-- ============================================
-- Personal Wealth Management - Initial Schema
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Profiles
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null default '',
  currency text not null default 'IDR',
  created_at timestamptz not null default now()
);

-- Accounts
create table public.accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  type text not null check (type in ('cash', 'bank', 'digital_wallet', 'investment')),
  starting_balance bigint not null default 0,
  current_balance bigint not null default 0,
  created_at timestamptz not null default now()
);

-- Transactions
create table public.transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  date date not null default current_date,
  account_id uuid references public.accounts on delete set null,
  type text not null check (type in ('income', 'expense', 'saving', 'investment')),
  category text not null,
  description text not null default '',
  amount bigint not null default 0,
  created_at timestamptz not null default now()
);

-- Budgets
create table public.budgets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  year int not null,
  month int not null check (month between 1 and 12),
  category text not null,
  type text not null check (type in ('income', 'expense', 'saving', 'investment')),
  amount bigint not null default 0,
  unique (user_id, year, month, category, type)
);

-- Assets - Liquid
create table public.assets_liquid (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  type text not null check (type in ('cash', 'bank', 'digital_wallet', 'receivable')),
  balance bigint not null default 0,
  month int not null check (month between 1 and 12),
  year int not null
);

-- Assets - Non-Liquid
create table public.assets_non_liquid (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  category text not null check (category in ('property', 'vehicle', 'personal_item')),
  type text not null default '',
  purchase_value bigint not null default 0,
  current_value bigint not null default 0,
  purchase_date date,
  notes text not null default ''
);

-- Investments
create table public.investments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  category text not null check (category in ('stock', 'mutual_fund', 'crypto', 'gold', 'bond', 'time_deposit', 'p2p', 'business')),
  name text not null,
  platform text not null default '',
  quantity numeric not null default 0,
  avg_cost numeric not null default 0,
  current_price numeric not null default 0,
  total_value bigint not null default 0,
  type text not null check (type in ('variable_income', 'fixed_income', 'business'))
);

-- Debts
create table public.debts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  category text not null check (category in ('consumer', 'cash_loan', 'long_term')),
  type text not null default '',
  principal bigint not null default 0,
  remaining bigint not null default 0,
  interest_rate numeric not null default 0,
  monthly_payment bigint not null default 0,
  due_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Emergency Fund
create table public.emergency_funds (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null unique,
  job_stability text not null default '',
  dependents int not null default 0,
  monthly_expenses bigint not null default 0,
  target_amount bigint not null default 0,
  current_amount bigint not null default 0
);

-- Emergency Fund Locations
create table public.emergency_fund_locations (
  id uuid primary key default uuid_generate_v4(),
  fund_id uuid references public.emergency_funds on delete cascade not null,
  account_name text not null,
  amount bigint not null default 0
);

-- Transfers
create table public.transfers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  from_account uuid references public.accounts on delete set null,
  to_account uuid references public.accounts on delete set null,
  amount bigint not null default 0,
  date date not null default current_date,
  notes text not null default ''
);

-- ============================================
-- INDEXES
-- ============================================

create index idx_accounts_user_id on public.accounts (user_id);
create index idx_transactions_user_id on public.transactions (user_id);
create index idx_transactions_date on public.transactions (user_id, date);
create index idx_transactions_account on public.transactions (account_id);
create index idx_budgets_user_id on public.budgets (user_id);
create index idx_budgets_period on public.budgets (user_id, year, month);
create index idx_assets_liquid_user_id on public.assets_liquid (user_id);
create index idx_assets_non_liquid_user_id on public.assets_non_liquid (user_id);
create index idx_investments_user_id on public.investments (user_id);
create index idx_debts_user_id on public.debts (user_id);
create index idx_emergency_funds_user_id on public.emergency_funds (user_id);
create index idx_emergency_fund_locations_fund_id on public.emergency_fund_locations (fund_id);
create index idx_transfers_user_id on public.transfers (user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.assets_liquid enable row level security;
alter table public.assets_non_liquid enable row level security;
alter table public.investments enable row level security;
alter table public.debts enable row level security;
alter table public.emergency_funds enable row level security;
alter table public.emergency_fund_locations enable row level security;
alter table public.transfers enable row level security;

-- Profiles policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Accounts policies
create policy "Users can view own accounts"
  on public.accounts for select
  using (auth.uid() = user_id);

create policy "Users can insert own accounts"
  on public.accounts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own accounts"
  on public.accounts for update
  using (auth.uid() = user_id);

create policy "Users can delete own accounts"
  on public.accounts for delete
  using (auth.uid() = user_id);

-- Transactions policies
create policy "Users can view own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert own transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own transactions"
  on public.transactions for update
  using (auth.uid() = user_id);

create policy "Users can delete own transactions"
  on public.transactions for delete
  using (auth.uid() = user_id);

-- Budgets policies
create policy "Users can view own budgets"
  on public.budgets for select
  using (auth.uid() = user_id);

create policy "Users can insert own budgets"
  on public.budgets for insert
  with check (auth.uid() = user_id);

create policy "Users can update own budgets"
  on public.budgets for update
  using (auth.uid() = user_id);

create policy "Users can delete own budgets"
  on public.budgets for delete
  using (auth.uid() = user_id);

-- Assets Liquid policies
create policy "Users can view own liquid assets"
  on public.assets_liquid for select
  using (auth.uid() = user_id);

create policy "Users can insert own liquid assets"
  on public.assets_liquid for insert
  with check (auth.uid() = user_id);

create policy "Users can update own liquid assets"
  on public.assets_liquid for update
  using (auth.uid() = user_id);

create policy "Users can delete own liquid assets"
  on public.assets_liquid for delete
  using (auth.uid() = user_id);

-- Assets Non-Liquid policies
create policy "Users can view own non-liquid assets"
  on public.assets_non_liquid for select
  using (auth.uid() = user_id);

create policy "Users can insert own non-liquid assets"
  on public.assets_non_liquid for insert
  with check (auth.uid() = user_id);

create policy "Users can update own non-liquid assets"
  on public.assets_non_liquid for update
  using (auth.uid() = user_id);

create policy "Users can delete own non-liquid assets"
  on public.assets_non_liquid for delete
  using (auth.uid() = user_id);

-- Investments policies
create policy "Users can view own investments"
  on public.investments for select
  using (auth.uid() = user_id);

create policy "Users can insert own investments"
  on public.investments for insert
  with check (auth.uid() = user_id);

create policy "Users can update own investments"
  on public.investments for update
  using (auth.uid() = user_id);

create policy "Users can delete own investments"
  on public.investments for delete
  using (auth.uid() = user_id);

-- Debts policies
create policy "Users can view own debts"
  on public.debts for select
  using (auth.uid() = user_id);

create policy "Users can insert own debts"
  on public.debts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own debts"
  on public.debts for update
  using (auth.uid() = user_id);

create policy "Users can delete own debts"
  on public.debts for delete
  using (auth.uid() = user_id);

-- Emergency Funds policies
create policy "Users can view own emergency fund"
  on public.emergency_funds for select
  using (auth.uid() = user_id);

create policy "Users can insert own emergency fund"
  on public.emergency_funds for insert
  with check (auth.uid() = user_id);

create policy "Users can update own emergency fund"
  on public.emergency_funds for update
  using (auth.uid() = user_id);

create policy "Users can delete own emergency fund"
  on public.emergency_funds for delete
  using (auth.uid() = user_id);

-- Emergency Fund Locations policies
create policy "Users can view own fund locations"
  on public.emergency_fund_locations for select
  using (
    exists (
      select 1 from public.emergency_funds
      where emergency_funds.id = emergency_fund_locations.fund_id
        and emergency_funds.user_id = auth.uid()
    )
  );

create policy "Users can insert own fund locations"
  on public.emergency_fund_locations for insert
  with check (
    exists (
      select 1 from public.emergency_funds
      where emergency_funds.id = emergency_fund_locations.fund_id
        and emergency_funds.user_id = auth.uid()
    )
  );

create policy "Users can update own fund locations"
  on public.emergency_fund_locations for update
  using (
    exists (
      select 1 from public.emergency_funds
      where emergency_funds.id = emergency_fund_locations.fund_id
        and emergency_funds.user_id = auth.uid()
    )
  );

create policy "Users can delete own fund locations"
  on public.emergency_fund_locations for delete
  using (
    exists (
      select 1 from public.emergency_funds
      where emergency_funds.id = emergency_fund_locations.fund_id
        and emergency_funds.user_id = auth.uid()
    )
  );

-- Transfers policies
create policy "Users can view own transfers"
  on public.transfers for select
  using (auth.uid() = user_id);

create policy "Users can insert own transfers"
  on public.transfers for insert
  with check (auth.uid() = user_id);

create policy "Users can update own transfers"
  on public.transfers for update
  using (auth.uid() = user_id);

create policy "Users can delete own transfers"
  on public.transfers for delete
  using (auth.uid() = user_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
