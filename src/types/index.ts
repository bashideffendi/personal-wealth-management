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
  type: 'cash' | 'bank' | 'digital_wallet' | 'investment'
  starting_balance: number
  current_balance: number
  created_at: string
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
}

export interface Investment {
  id: string
  user_id: string
  category: 'stock' | 'mutual_fund' | 'crypto' | 'gold' | 'bond' | 'time_deposit' | 'p2p' | 'business'
  name: string
  platform: string
  quantity: number
  avg_cost: number
  current_price: number
  total_value: number
  type: 'variable_income' | 'fixed_income' | 'business'
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

export interface Transfer {
  id: string
  user_id: string
  from_account: string
  to_account: string
  amount: number
  date: string
  notes: string
}
