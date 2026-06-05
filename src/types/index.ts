export interface Profile {
  id: string
  full_name: string
  currency: string
  created_at: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  type: 'cash' | 'bank' | 'digital_wallet' | 'rdn' | 'investment'
  starting_balance: number
  current_balance: number
  /** Optional account/e-wallet number — shown masked in UI (migration 045). */
  account_number?: string | null
  created_at: string
}

/**
 * Per-account earmark — "Rp X in this account is reserved for purpose Y."
 * Lets emergency fund / goals reflect real account balances instead of
 * being separate typed-in numbers that drift out of date.
 *
 * Sum of allocations on one account should be ≤ that account's balance,
 * but we don't hard-enforce — bank balances drift, and locking the user
 * out of editing an allocation just because of a rounding mismatch sucks.
 */
export type AllocationPurpose = 'emergency_fund' | 'goal' | 'sinking_fund' | 'other'

export interface AccountAllocation {
  id: string
  user_id: string
  account_id: string
  purpose_kind: AllocationPurpose
  // Exactly one of these is set per purpose_kind
  emergency_fund_id: string | null
  goal_id: string | null
  custom_label: string  // for sinking_fund / other
  amount: number
  notes: string
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  user_id: string
  date: string
  account_id: string
  type: 'income' | 'expense' | 'saving' | 'investment'
  category: string
  description: string
  amount: number
  created_at: string
  goal_id?: string | null
  tags?: string[]
}

export interface CategorizationRule {
  id: string
  user_id: string
  match_text: string
  type: 'income' | 'expense' | 'saving' | 'investment'
  category: string
  priority: number
  is_active: boolean
  created_at: string
}

export interface StockTransaction {
  id: string
  user_id: string
  investment_id: string | null
  ticker: string | null
  side: 'buy' | 'sell'
  shares: number
  price: number
  fee: number
  total: number
  broker: string
  date: string
  notes: string
  created_at: string
}

export interface Budget {
  id: string
  user_id: string
  year: number
  month: number
  category: string
  type: 'income' | 'expense' | 'saving' | 'investment'
  amount: number
}

export interface AssetLiquid {
  id: string
  user_id: string
  name: string
  type: 'cash' | 'bank' | 'digital_wallet' | 'receivable'
  balance: number
  month: number
  year: number
}

export interface AssetNonLiquid {
  id: string
  user_id: string
  name: string
  category: 'property' | 'vehicle' | 'personal_item'
  type: string
  purchase_value: number
  current_value: number
  purchase_date: string
  notes: string
  latitude?: number | null
  longitude?: number | null
  address?: string
}

export interface Investment {
  id: string
  user_id: string
  category: 'stock' | 'mutual_fund' | 'crypto' | 'gold' | 'bond' | 'sbn' | 'time_deposit' | 'forex' | 'p2p' | 'pension' | 'business'
  name: string
  platform: string
  quantity: number
  avg_cost: number
  current_price: number
  total_value: number
  type: 'variable_income' | 'fixed_income' | 'business'
  ticker?: string | null
  currency?: string
  last_synced_at?: string | null
  notes?: string
  sector?: string | null
}

export interface PriceSnapshot {
  ticker: string
  price: number
  currency: string
  change_pct: number | null
  market_state: string | null
  fetched_at: string
  source: string
}

export interface Quote {
  ticker: string
  price: number
  currency: string
  changePct: number | null
  marketState: string | null
  name?: string
}

export interface CreditCard {
  id: string
  user_id: string
  name: string
  issuer: string
  /** Card network: 'visa' | 'mastercard' | 'gpn' | 'jcb' | 'amex' (logo on the card). */
  network?: string | null
  last_four: string
  credit_limit: number
  current_balance: number
  billing_day: number
  due_day: number
  interest_rate: number
  is_active: boolean
  created_at: string
}

export interface CreditCardPayment {
  id: string
  user_id: string
  card_id: string
  amount: number
  from_account_id: string | null
  date: string
  notes: string
  created_at: string
}

export interface Debt {
  id: string
  user_id: string
  name: string
  category: 'consumer' | 'cash_loan' | 'long_term'
  type: string
  principal: number
  remaining: number
  interest_rate: number
  monthly_payment: number
  due_date: string
  is_active: boolean
  created_at: string
}

export interface EmergencyFund {
  id: string
  user_id: string
  job_stability: string
  dependents: number
  monthly_expenses: number
  target_amount: number
  current_amount: number
}

export interface EmergencyFundLocation {
  id: string
  fund_id: string
  account_name: string
  amount: number
}

export interface EmergencyFundTransaction {
  id: string
  fund_id: string
  date: string
  kind: 'setor' | 'tarik'
  amount: number
  location: string
  note: string
  created_at: string
}

export interface Transfer {
  id: string
  user_id: string
  from_account: string
  to_account: string
  amount: number
  date: string
  notes: string
}

export interface Goal {
  id: string
  user_id: string
  name: string
  category: string
  target_amount: number
  current_amount: number
  deadline: string | null
  notes: string
  is_active: boolean
  created_at: string
}

export interface RecurringTransaction {
  id: string
  user_id: string
  name: string
  type: 'income' | 'expense' | 'saving' | 'investment'
  category: string
  amount: number
  account_id: string | null
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  day_of_period: number
  start_date: string
  end_date: string | null
  last_run_date: string | null
  is_active: boolean
  notes: string
  created_at: string
}

export interface Dividend {
  id: string
  user_id: string
  investment_id: string | null
  ticker: string | null
  amount: number
  shares: number
  ex_date: string | null
  pay_date: string
  notes: string
  created_at: string
}

export interface NetWorthSnapshot {
  id: string
  user_id: string
  snapshot_date: string
  total_assets: number
  total_debts: number
  net_worth: number
  created_at: string
}

export type ContractCategory =
  | 'insurance'
  | 'subscription'
  | 'loan'
  | 'warranty'
  | 'lease'
  | 'work'
  | 'property'
  | 'other'

export type ContractFrequency = 'monthly' | 'quarterly' | 'yearly' | 'one_time'

export interface Contract {
  id: string
  user_id: string
  name: string
  category: ContractCategory
  provider: string
  policy_number: string
  start_date: string | null
  end_date: string
  cost: number | null
  coverage: number
  frequency: ContractFrequency | null
  auto_renew: boolean
  reminder_days_before: number
  is_archived: boolean
  notes: string
  created_at: string
}

export interface Subscription {
  id: string
  user_id: string
  name: string
  provider: string
  price: number
  cycle: 'weekly' | 'monthly' | 'yearly'
  billing_day: number
  /** Review status: active = pertahankan, consider = pertimbangkan, cancel = cabut */
  status: 'active' | 'consider' | 'cancel'
  usage_note: string
  account_id: string | null
  is_active: boolean
  created_at: string
}
