-- ============================================================
-- PWM — Combined migration (001 → 010)
-- Idempotent: aman di-Run berkali-kali di Supabase SQL Editor
-- Generated for: personalwealthmanagement.vercel.app
-- ============================================================

-- ============================================================
-- 001 — Initial schema
-- ============================================================

create extension if not exists "uuid-ossp";

-- Profiles
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null default '',
  currency text not null default 'IDR',
  created_at timestamptz not null default now()
);

-- Accounts
create table if not exists public.accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  type text not null check (type in ('cash', 'bank', 'digital_wallet', 'investment')),
  starting_balance bigint not null default 0,
  current_balance bigint not null default 0,
  created_at timestamptz not null default now()
);

-- Transactions
create table if not exists public.transactions (
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
create table if not exists public.budgets (
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
create table if not exists public.assets_liquid (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  type text not null check (type in ('cash', 'bank', 'digital_wallet', 'receivable')),
  balance bigint not null default 0,
  month int not null check (month between 1 and 12),
  year int not null
);

-- Assets - Non-Liquid
create table if not exists public.assets_non_liquid (
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
create table if not exists public.investments (
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
create table if not exists public.debts (
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
create table if not exists public.emergency_funds (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null unique,
  job_stability text not null default '',
  dependents int not null default 0,
  monthly_expenses bigint not null default 0,
  target_amount bigint not null default 0,
  current_amount bigint not null default 0
);

-- Emergency Fund Locations
create table if not exists public.emergency_fund_locations (
  id uuid primary key default uuid_generate_v4(),
  fund_id uuid references public.emergency_funds on delete cascade not null,
  account_name text not null,
  amount bigint not null default 0
);

-- Transfers
create table if not exists public.transfers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  from_account uuid references public.accounts on delete set null,
  to_account uuid references public.accounts on delete set null,
  amount bigint not null default 0,
  date date not null default current_date,
  notes text not null default ''
);

-- Indexes
create index if not exists idx_accounts_user_id on public.accounts (user_id);
create index if not exists idx_transactions_user_id on public.transactions (user_id);
create index if not exists idx_transactions_date on public.transactions (user_id, date);
create index if not exists idx_transactions_account on public.transactions (account_id);
create index if not exists idx_budgets_user_id on public.budgets (user_id);
create index if not exists idx_budgets_period on public.budgets (user_id, year, month);
create index if not exists idx_assets_liquid_user_id on public.assets_liquid (user_id);
create index if not exists idx_assets_non_liquid_user_id on public.assets_non_liquid (user_id);
create index if not exists idx_investments_user_id on public.investments (user_id);
create index if not exists idx_debts_user_id on public.debts (user_id);
create index if not exists idx_emergency_funds_user_id on public.emergency_funds (user_id);
create index if not exists idx_emergency_fund_locations_fund_id on public.emergency_fund_locations (fund_id);
create index if not exists idx_transfers_user_id on public.transfers (user_id);

-- RLS enable
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
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Accounts policies
drop policy if exists "Users can view own accounts" on public.accounts;
create policy "Users can view own accounts" on public.accounts for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own accounts" on public.accounts;
create policy "Users can insert own accounts" on public.accounts for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own accounts" on public.accounts;
create policy "Users can update own accounts" on public.accounts for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own accounts" on public.accounts;
create policy "Users can delete own accounts" on public.accounts for delete using (auth.uid() = user_id);

-- Transactions policies
drop policy if exists "Users can view own transactions" on public.transactions;
create policy "Users can view own transactions" on public.transactions for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own transactions" on public.transactions;
create policy "Users can insert own transactions" on public.transactions for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own transactions" on public.transactions;
create policy "Users can update own transactions" on public.transactions for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own transactions" on public.transactions;
create policy "Users can delete own transactions" on public.transactions for delete using (auth.uid() = user_id);

-- Budgets policies
drop policy if exists "Users can view own budgets" on public.budgets;
create policy "Users can view own budgets" on public.budgets for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own budgets" on public.budgets;
create policy "Users can insert own budgets" on public.budgets for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own budgets" on public.budgets;
create policy "Users can update own budgets" on public.budgets for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own budgets" on public.budgets;
create policy "Users can delete own budgets" on public.budgets for delete using (auth.uid() = user_id);

-- Assets Liquid policies
drop policy if exists "Users can view own liquid assets" on public.assets_liquid;
create policy "Users can view own liquid assets" on public.assets_liquid for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own liquid assets" on public.assets_liquid;
create policy "Users can insert own liquid assets" on public.assets_liquid for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own liquid assets" on public.assets_liquid;
create policy "Users can update own liquid assets" on public.assets_liquid for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own liquid assets" on public.assets_liquid;
create policy "Users can delete own liquid assets" on public.assets_liquid for delete using (auth.uid() = user_id);

-- Assets Non-Liquid policies
drop policy if exists "Users can view own non-liquid assets" on public.assets_non_liquid;
create policy "Users can view own non-liquid assets" on public.assets_non_liquid for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own non-liquid assets" on public.assets_non_liquid;
create policy "Users can insert own non-liquid assets" on public.assets_non_liquid for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own non-liquid assets" on public.assets_non_liquid;
create policy "Users can update own non-liquid assets" on public.assets_non_liquid for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own non-liquid assets" on public.assets_non_liquid;
create policy "Users can delete own non-liquid assets" on public.assets_non_liquid for delete using (auth.uid() = user_id);

-- Investments policies
drop policy if exists "Users can view own investments" on public.investments;
create policy "Users can view own investments" on public.investments for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own investments" on public.investments;
create policy "Users can insert own investments" on public.investments for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own investments" on public.investments;
create policy "Users can update own investments" on public.investments for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own investments" on public.investments;
create policy "Users can delete own investments" on public.investments for delete using (auth.uid() = user_id);

-- Debts policies
drop policy if exists "Users can view own debts" on public.debts;
create policy "Users can view own debts" on public.debts for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own debts" on public.debts;
create policy "Users can insert own debts" on public.debts for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own debts" on public.debts;
create policy "Users can update own debts" on public.debts for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own debts" on public.debts;
create policy "Users can delete own debts" on public.debts for delete using (auth.uid() = user_id);

-- Emergency Funds policies
drop policy if exists "Users can view own emergency fund" on public.emergency_funds;
create policy "Users can view own emergency fund" on public.emergency_funds for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own emergency fund" on public.emergency_funds;
create policy "Users can insert own emergency fund" on public.emergency_funds for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own emergency fund" on public.emergency_funds;
create policy "Users can update own emergency fund" on public.emergency_funds for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own emergency fund" on public.emergency_funds;
create policy "Users can delete own emergency fund" on public.emergency_funds for delete using (auth.uid() = user_id);

-- Emergency Fund Locations policies
drop policy if exists "Users can view own fund locations" on public.emergency_fund_locations;
create policy "Users can view own fund locations" on public.emergency_fund_locations for select using (
  exists (select 1 from public.emergency_funds where emergency_funds.id = emergency_fund_locations.fund_id and emergency_funds.user_id = auth.uid())
);
drop policy if exists "Users can insert own fund locations" on public.emergency_fund_locations;
create policy "Users can insert own fund locations" on public.emergency_fund_locations for insert with check (
  exists (select 1 from public.emergency_funds where emergency_funds.id = emergency_fund_locations.fund_id and emergency_funds.user_id = auth.uid())
);
drop policy if exists "Users can update own fund locations" on public.emergency_fund_locations;
create policy "Users can update own fund locations" on public.emergency_fund_locations for update using (
  exists (select 1 from public.emergency_funds where emergency_funds.id = emergency_fund_locations.fund_id and emergency_funds.user_id = auth.uid())
);
drop policy if exists "Users can delete own fund locations" on public.emergency_fund_locations;
create policy "Users can delete own fund locations" on public.emergency_fund_locations for delete using (
  exists (select 1 from public.emergency_funds where emergency_funds.id = emergency_fund_locations.fund_id and emergency_funds.user_id = auth.uid())
);

-- Transfers policies
drop policy if exists "Users can view own transfers" on public.transfers;
create policy "Users can view own transfers" on public.transfers for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own transfers" on public.transfers;
create policy "Users can insert own transfers" on public.transfers for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own transfers" on public.transfers;
create policy "Users can update own transfers" on public.transfers for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own transfers" on public.transfers;
create policy "Users can delete own transfers" on public.transfers for delete using (auth.uid() = user_id);

-- Trigger: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 002 — Investments live quote support
-- ============================================================

alter table public.investments
  add column if not exists ticker text,
  add column if not exists currency text not null default 'IDR',
  add column if not exists last_synced_at timestamptz,
  add column if not exists notes text not null default '';

create index if not exists idx_investments_ticker
  on public.investments (ticker)
  where ticker is not null;

create table if not exists public.price_snapshots (
  ticker text primary key,
  price numeric not null,
  currency text not null default 'USD',
  change_pct numeric,
  market_state text,
  fetched_at timestamptz not null default now(),
  source text not null default 'yahoo-finance'
);

create index if not exists idx_price_snapshots_fetched_at
  on public.price_snapshots (fetched_at desc);

alter table public.price_snapshots enable row level security;

drop policy if exists "Authenticated can read price_snapshots" on public.price_snapshots;
create policy "Authenticated can read price_snapshots"
  on public.price_snapshots for select to authenticated using (true);

drop policy if exists "Service role can upsert price_snapshots" on public.price_snapshots;
create policy "Service role can upsert price_snapshots"
  on public.price_snapshots for all to service_role using (true) with check (true);

-- ============================================================
-- 003 — Debt payments
-- ============================================================

create table if not exists public.debt_payments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  debt_id uuid references public.debts on delete cascade not null,
  amount bigint not null default 0,
  date date not null default current_date,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_debt_payments_user_id on public.debt_payments (user_id);
create index if not exists idx_debt_payments_debt_id on public.debt_payments (debt_id);

alter table public.debt_payments enable row level security;

drop policy if exists "Users can view own debt_payments" on public.debt_payments;
create policy "Users can view own debt_payments"
  on public.debt_payments for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own debt_payments" on public.debt_payments;
create policy "Users can insert own debt_payments"
  on public.debt_payments for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own debt_payments" on public.debt_payments;
create policy "Users can update own debt_payments"
  on public.debt_payments for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own debt_payments" on public.debt_payments;
create policy "Users can delete own debt_payments"
  on public.debt_payments for delete using (auth.uid() = user_id);

-- ============================================================
-- 004 — Credit cards + credit card payments
-- ============================================================

create table if not exists public.credit_cards (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  issuer text not null default '',
  last_four text not null default '',
  credit_limit bigint not null default 0,
  current_balance bigint not null default 0,
  billing_day int not null default 1 check (billing_day between 1 and 31),
  due_day int not null default 15 check (due_day between 1 and 31),
  interest_rate numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_credit_cards_user_id on public.credit_cards (user_id);

alter table public.credit_cards enable row level security;

drop policy if exists "Users can view own credit_cards" on public.credit_cards;
create policy "Users can view own credit_cards"
  on public.credit_cards for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own credit_cards" on public.credit_cards;
create policy "Users can insert own credit_cards"
  on public.credit_cards for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own credit_cards" on public.credit_cards;
create policy "Users can update own credit_cards"
  on public.credit_cards for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own credit_cards" on public.credit_cards;
create policy "Users can delete own credit_cards"
  on public.credit_cards for delete using (auth.uid() = user_id);

create table if not exists public.credit_card_payments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  card_id uuid references public.credit_cards on delete cascade not null,
  amount bigint not null default 0,
  from_account_id uuid references public.accounts on delete set null,
  date date not null default current_date,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_cc_payments_user_id on public.credit_card_payments (user_id);
create index if not exists idx_cc_payments_card_id on public.credit_card_payments (card_id);

alter table public.credit_card_payments enable row level security;

drop policy if exists "Users can view own cc_payments" on public.credit_card_payments;
create policy "Users can view own cc_payments"
  on public.credit_card_payments for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own cc_payments" on public.credit_card_payments;
create policy "Users can insert own cc_payments"
  on public.credit_card_payments for insert with check (auth.uid() = user_id);
drop policy if exists "Users can delete own cc_payments" on public.credit_card_payments;
create policy "Users can delete own cc_payments"
  on public.credit_card_payments for delete using (auth.uid() = user_id);

-- ============================================================
-- 005 — Goals, Recurring, Dividends, NetWorth Snapshots
-- ============================================================

create table if not exists public.goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  category text not null default 'other',
  target_amount bigint not null default 0,
  current_amount bigint not null default 0,
  deadline date,
  notes text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_goals_user_id on public.goals (user_id);
alter table public.goals enable row level security;
drop policy if exists "Users can manage own goals" on public.goals;
create policy "Users can manage own goals" on public.goals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.recurring_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  type text not null check (type in ('income', 'expense', 'saving', 'investment')),
  category text not null,
  amount bigint not null default 0,
  account_id uuid references public.accounts on delete set null,
  frequency text not null default 'monthly' check (frequency in ('daily','weekly','monthly','yearly')),
  day_of_period int not null default 1,
  start_date date not null default current_date,
  end_date date,
  last_run_date date,
  is_active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_recurring_user_id on public.recurring_transactions (user_id);
alter table public.recurring_transactions enable row level security;
drop policy if exists "Users can manage own recurring" on public.recurring_transactions;
create policy "Users can manage own recurring" on public.recurring_transactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.dividends (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  investment_id uuid references public.investments on delete cascade,
  ticker text,
  amount bigint not null default 0,
  shares numeric not null default 0,
  ex_date date,
  pay_date date not null default current_date,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_dividends_user_id on public.dividends (user_id);
alter table public.dividends enable row level security;
drop policy if exists "Users can manage own dividends" on public.dividends;
create policy "Users can manage own dividends" on public.dividends for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.net_worth_snapshots (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  snapshot_date date not null default current_date,
  total_assets bigint not null default 0,
  total_debts bigint not null default 0,
  net_worth bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, snapshot_date)
);
create index if not exists idx_nws_user_id on public.net_worth_snapshots (user_id);
alter table public.net_worth_snapshots enable row level security;
drop policy if exists "Users can manage own nws" on public.net_worth_snapshots;
create policy "Users can manage own nws" on public.net_worth_snapshots for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 006 — Non-liquid asset location
-- ============================================================

alter table public.assets_non_liquid
  add column if not exists latitude  numeric,
  add column if not exists longitude numeric,
  add column if not exists address   text not null default '';

-- ============================================================
-- 007 — Categorization rules + Stock TX log + goal_id on transactions
-- ============================================================

create table if not exists public.categorization_rules (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  match_text text not null,
  type text not null check (type in ('income', 'expense', 'saving', 'investment')),
  category text not null,
  priority int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_cat_rules_user_id on public.categorization_rules (user_id);
alter table public.categorization_rules enable row level security;
drop policy if exists "Users can manage own rules" on public.categorization_rules;
create policy "Users can manage own rules" on public.categorization_rules for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.stock_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  investment_id uuid references public.investments on delete set null,
  ticker text,
  side text not null check (side in ('buy', 'sell')),
  shares numeric not null default 0,
  price numeric not null default 0,
  fee bigint not null default 0,
  total bigint not null default 0,
  broker text not null default '',
  date date not null default current_date,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_stock_tx_user_id on public.stock_transactions (user_id);
alter table public.stock_transactions enable row level security;
drop policy if exists "Users can manage own stock_tx" on public.stock_transactions;
create policy "Users can manage own stock_tx" on public.stock_transactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.transactions
  add column if not exists goal_id uuid references public.goals on delete set null;

-- ============================================================
-- 008 — Expand investments.category check
-- ============================================================

alter table public.investments drop constraint if exists investments_category_check;
alter table public.investments add constraint investments_category_check
  check (category in (
    'stock', 'mutual_fund', 'crypto', 'gold', 'bond', 'sbn',
    'time_deposit', 'forex', 'p2p', 'pension', 'business'
  ));

-- ============================================================
-- 009 — Price history (weekly closes for RRG)
-- ============================================================

create table if not exists public.price_history (
  ticker text not null,
  date date not null,
  close numeric not null,
  interval text not null default '1wk',
  source text not null default 'yahoo-finance',
  fetched_at timestamptz not null default now(),
  primary key (ticker, interval, date)
);

create index if not exists idx_price_history_ticker_date
  on public.price_history (ticker, date desc);

alter table public.price_history enable row level security;

drop policy if exists "Authenticated can read price_history" on public.price_history;
create policy "Authenticated can read price_history"
  on public.price_history for select to authenticated using (true);

drop policy if exists "Service role can upsert price_history" on public.price_history;
create policy "Service role can upsert price_history"
  on public.price_history for all to service_role using (true) with check (true);

drop policy if exists "Authenticated can upsert price_history" on public.price_history;
create policy "Authenticated can upsert price_history"
  on public.price_history for insert to authenticated with check (true);

drop policy if exists "Authenticated can update price_history" on public.price_history;
create policy "Authenticated can update price_history"
  on public.price_history for update to authenticated using (true) with check (true);

-- ============================================================
-- 010 — Contracts (insurance, subscription, loan, warranty, lease)
-- ============================================================

create table if not exists public.contracts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  category text not null check (category in (
    'insurance', 'subscription', 'loan', 'warranty', 'lease', 'other'
  )),
  provider text not null default '',
  policy_number text not null default '',
  start_date date,
  end_date date not null,
  cost bigint,
  frequency text check (frequency in ('monthly', 'quarterly', 'yearly', 'one_time')),
  auto_renew boolean not null default false,
  reminder_days_before int not null default 30
    check (reminder_days_before between 1 and 365),
  is_archived boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists contracts_user_id_end_date_idx
  on public.contracts (user_id, end_date)
  where is_archived = false;

alter table public.contracts enable row level security;

drop policy if exists "Users view own contracts" on public.contracts;
create policy "Users view own contracts"
  on public.contracts for select using (auth.uid() = user_id);
drop policy if exists "Users insert own contracts" on public.contracts;
create policy "Users insert own contracts"
  on public.contracts for insert with check (auth.uid() = user_id);
drop policy if exists "Users update own contracts" on public.contracts;
create policy "Users update own contracts"
  on public.contracts for update using (auth.uid() = user_id);
drop policy if exists "Users delete own contracts" on public.contracts;
create policy "Users delete own contracts"
  on public.contracts for delete using (auth.uid() = user_id);

-- ============================================================
-- DONE
-- ============================================================
