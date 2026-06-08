/**
 * Demo fixtures — populated in-memory data for the no-backend demo mode.
 * All tables are keyed by table name and all rows share the same DEMO_USER_ID.
 */

export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000000'

export const DEMO_USER = {
  id: DEMO_USER_ID,
  email: 'demo@heritage.id',
  user_metadata: {
    full_name: 'Bashid Demo',
  },
  app_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
}

const today = new Date()
const YEAR = today.getFullYear()

function d(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function uid(prefix: string, i: number) {
  return `${prefix}-${String(i).padStart(4, '0')}`
}

// Accounts
const accounts = [
  { id: uid('acc', 1), user_id: DEMO_USER_ID, name: 'BCA Utama',    type: 'bank',          starting_balance: 50_000_000, current_balance:  62_450_000, created_at: '2026-01-01' },
  { id: uid('acc', 2), user_id: DEMO_USER_ID, name: 'Mandiri Gaji', type: 'bank',          starting_balance: 20_000_000, current_balance:  18_320_000, created_at: '2026-01-01' },
  { id: uid('acc', 3), user_id: DEMO_USER_ID, name: 'GoPay',        type: 'digital_wallet',starting_balance:    500_000, current_balance:     850_000, created_at: '2026-01-01' },
  { id: uid('acc', 4), user_id: DEMO_USER_ID, name: 'Kas Rumah',    type: 'cash',          starting_balance:  1_500_000, current_balance:   1_240_000, created_at: '2026-01-01' },
]

// Transactions — 12 months spread
const transactions: Array<{
  id: string
  user_id: string
  date: string
  account_id: string
  type: 'income' | 'expense' | 'saving' | 'investment'
  category: string
  description: string
  amount: number
  created_at: string
}> = []

let txId = 1
for (let m = 1; m <= 12; m++) {
  // Income (gaji pokok + freelance kadang)
  transactions.push({
    id: uid('tx', txId++), user_id: DEMO_USER_ID, date: d(YEAR, m, 25), account_id: accounts[1].id,
    type: 'income', category: 'Gaji', description: 'Gaji bulanan',
    amount: 18_500_000 + (m % 3 === 0 ? 2_000_000 : 0), created_at: d(YEAR, m, 25),
  })
  if (m % 2 === 0) {
    transactions.push({
      id: uid('tx', txId++), user_id: DEMO_USER_ID, date: d(YEAR, m, 15), account_id: accounts[0].id,
      type: 'income', category: 'Side Hustle / Freelance', description: 'Project freelance',
      amount: 3_000_000 + m * 200_000, created_at: d(YEAR, m, 15),
    })
  }

  // Expenses
  transactions.push({ id: uid('tx', txId++), user_id: DEMO_USER_ID, date: d(YEAR, m, 5),  account_id: accounts[0].id, type: 'expense', category: 'Tempat Tinggal',  description: 'Cicilan KPR',          amount: 5_200_000, created_at: d(YEAR, m, 5) })
  transactions.push({ id: uid('tx', txId++), user_id: DEMO_USER_ID, date: d(YEAR, m, 8),  account_id: accounts[0].id, type: 'expense', category: 'Makanan',         description: 'Belanja bulanan',      amount: 2_100_000 + (m * 30_000), created_at: d(YEAR, m, 8) })
  transactions.push({ id: uid('tx', txId++), user_id: DEMO_USER_ID, date: d(YEAR, m, 12), account_id: accounts[2].id, type: 'expense', category: 'Transportasi',    description: 'BBM & transport',      amount:   900_000, created_at: d(YEAR, m, 12) })
  transactions.push({ id: uid('tx', txId++), user_id: DEMO_USER_ID, date: d(YEAR, m, 18), account_id: accounts[0].id, type: 'expense', category: 'Tagihan',         description: 'Listrik, air, internet', amount: 1_450_000, created_at: d(YEAR, m, 18) })
  transactions.push({ id: uid('tx', txId++), user_id: DEMO_USER_ID, date: d(YEAR, m, 22), account_id: accounts[0].id, type: 'expense', category: 'Hiburan',         description: 'Dining & nonton',      amount:   620_000, created_at: d(YEAR, m, 22) })

  // Saving
  transactions.push({
    id: uid('tx', txId++), user_id: DEMO_USER_ID, date: d(YEAR, m, 26), account_id: accounts[0].id,
    type: 'saving', category: 'Dana Darurat', description: 'Top up dana darurat',
    amount: 1_500_000, created_at: d(YEAR, m, 26),
  })

  // Investment
  transactions.push({
    id: uid('tx', txId++), user_id: DEMO_USER_ID, date: d(YEAR, m, 27), account_id: accounts[0].id,
    type: 'investment', category: 'Saham', description: 'DCA saham IDX',
    amount: 2_000_000, created_at: d(YEAR, m, 27),
  })
}

// Budgets — 12 months x a few categories
const budgets: Array<{
  id: string; user_id: string; year: number; month: number; category: string
  type: 'income' | 'expense' | 'saving' | 'investment'; amount: number
}> = []
let bId = 1
const budgetPlan = [
  { category: 'Gaji',            type: 'income' as const,   amount: 18_500_000 },
  { category: 'Tempat Tinggal',  type: 'expense' as const,  amount:  5_200_000 },
  { category: 'Makanan',         type: 'expense' as const,  amount:  2_500_000 },
  { category: 'Transportasi',    type: 'expense' as const,  amount:  1_000_000 },
  { category: 'Tagihan',         type: 'expense' as const,  amount:  1_500_000 },
  { category: 'Hiburan',         type: 'expense' as const,  amount:    800_000 },
  { category: 'Dana Darurat',    type: 'saving' as const,   amount:  1_500_000 },
  { category: 'Saham',           type: 'investment' as const,amount:  2_000_000 },
]
for (let m = 1; m <= 12; m++) {
  for (const p of budgetPlan) {
    budgets.push({
      id: uid('bdg', bId++), user_id: DEMO_USER_ID, year: YEAR, month: m,
      category: p.category, type: p.type, amount: p.amount,
    })
  }
}

// Assets — liquid snapshot for current month
const assets_liquid = [
  { id: uid('lq', 1), user_id: DEMO_USER_ID, name: 'BCA Utama',    type: 'bank',           balance: 62_450_000, month: today.getMonth() + 1, year: YEAR },
  { id: uid('lq', 2), user_id: DEMO_USER_ID, name: 'Mandiri Gaji', type: 'bank',           balance: 18_320_000, month: today.getMonth() + 1, year: YEAR },
  { id: uid('lq', 3), user_id: DEMO_USER_ID, name: 'GoPay',        type: 'digital_wallet', balance:    850_000, month: today.getMonth() + 1, year: YEAR },
  { id: uid('lq', 4), user_id: DEMO_USER_ID, name: 'Kas Rumah',    type: 'cash',           balance:  1_240_000, month: today.getMonth() + 1, year: YEAR },
  { id: uid('lq', 5), user_id: DEMO_USER_ID, name: 'Piutang Adik', type: 'receivable',     balance:  3_000_000, month: today.getMonth() + 1, year: YEAR },
]

const assets_non_liquid = [
  { id: uid('nlq', 1), user_id: DEMO_USER_ID, name: 'Rumah Bintaro',    category: 'property',      type: 'Rumah Tinggal', purchase_value: 850_000_000, current_value: 1_100_000_000, purchase_date: '2020-07-15', notes: 'KPR sisa 8 tahun', latitude: -6.2874, longitude: 106.7234, address: 'Bintaro Sektor 9, Tangerang Selatan' },
  { id: uid('nlq', 2), user_id: DEMO_USER_ID, name: 'Apartemen Kemang', category: 'property',      type: 'Apartemen',     purchase_value: 650_000_000, current_value:   720_000_000, purchase_date: '2022-03-10', notes: 'Disewakan', latitude: -6.2626, longitude: 106.8106, address: 'Kemang Village, Jakarta Selatan' },
  { id: uid('nlq', 3), user_id: DEMO_USER_ID, name: 'Honda BR-V 2023',  category: 'vehicle',       type: 'Mobil',         purchase_value: 320_000_000, current_value:   280_000_000, purchase_date: '2023-01-20', notes: '' },
  { id: uid('nlq', 4), user_id: DEMO_USER_ID, name: 'Yamaha NMax',      category: 'vehicle',       type: 'Motor',         purchase_value:  32_000_000, current_value:    24_000_000, purchase_date: '2022-11-05', notes: '' },
  { id: uid('nlq', 5), user_id: DEMO_USER_ID, name: 'MacBook Pro M3',   category: 'personal_item', type: 'Elektronik',    purchase_value:  34_000_000, current_value:    26_000_000, purchase_date: '2024-02-14', notes: 'Laptop kerja' },
]

// Investments — live quote tickers + some fixed income
const investments = [
  { id: uid('inv', 1), user_id: DEMO_USER_ID, category: 'stock',        name: 'Bank Central Asia',     platform: 'Stockbit',  quantity: 1200, avg_cost:  9_100, current_price: 10_450, total_value:  12_540_000, type: 'variable_income', ticker: 'BBCA.JK',  currency: 'IDR', last_synced_at: null, notes: '', sector: 'Finansial' },
  { id: uid('inv', 2), user_id: DEMO_USER_ID, category: 'stock',        name: 'Telkom Indonesia',      platform: 'Stockbit',  quantity:  800, avg_cost:  3_450, current_price:  3_120, total_value:   2_496_000, type: 'variable_income', ticker: 'TLKM.JK',  currency: 'IDR', last_synced_at: null, notes: '', sector: 'Telekomunikasi' },
  { id: uid('inv', 3), user_id: DEMO_USER_ID, category: 'stock',        name: 'Apple Inc.',            platform: 'IBKR',      quantity:   15, avg_cost: 2_450_000, current_price: 2_920_000, total_value: 43_800_000, type: 'variable_income', ticker: 'AAPL',     currency: 'USD', last_synced_at: null, notes: 'Equivalen IDR', sector: 'Teknologi' },
  { id: uid('inv', 4), user_id: DEMO_USER_ID, category: 'crypto',       name: 'Bitcoin',               platform: 'Pintu',     quantity: 0.08, avg_cost: 950_000_000, current_price: 1_120_000_000, total_value: 89_600_000, type: 'variable_income', ticker: 'BTC-USD',  currency: 'USD', last_synced_at: null, notes: '' },
  { id: uid('inv', 5), user_id: DEMO_USER_ID, category: 'mutual_fund',  name: 'RD Pasar Uang BNI',     platform: 'Bibit',     quantity:    1, avg_cost: 25_000_000, current_price: 26_100_000, total_value: 26_100_000, type: 'variable_income', ticker: null,       currency: 'IDR', last_synced_at: null, notes: 'Dana cadangan' },
  { id: uid('inv', 6), user_id: DEMO_USER_ID, category: 'gold',         name: 'Antam 10 gr',           platform: 'Pegadaian', quantity:   50, avg_cost: 1_050_000, current_price: 1_280_000, total_value: 64_000_000, type: 'variable_income', ticker: null,       currency: 'IDR', last_synced_at: null, notes: '' },
  { id: uid('inv', 7), user_id: DEMO_USER_ID, category: 'time_deposit', name: 'Deposito BCA 6 bln',    platform: 'BCA',       quantity:    1, avg_cost: 50_000_000, current_price: 50_000_000, total_value: 50_000_000, type: 'fixed_income',    ticker: null,       currency: 'IDR', last_synced_at: null, notes: 'Bunga 6.25%' },
  { id: uid('inv', 8), user_id: DEMO_USER_ID, category: 'bond',         name: 'SBR013',                platform: 'Bibit',     quantity:    1, avg_cost: 30_000_000, current_price: 30_450_000, total_value: 30_450_000, type: 'fixed_income',    ticker: null,       currency: 'IDR', last_synced_at: null, notes: 'Tenor 2 tahun' },
  // Valas (USD holding)
  { id: uid('inv', 9), user_id: DEMO_USER_ID, category: 'forex',        name: 'USD Tabungan',          platform: 'Bank Mandiri',quantity: 5000, avg_cost: 15_400,     current_price: 15_820,     total_value: 79_100_000, type: 'variable_income', ticker: 'USD/IDR',  currency: 'USD', last_synced_at: null, notes: 'Hedge inflasi Rupiah' },
  { id: uid('inv',10), user_id: DEMO_USER_ID, category: 'forex',        name: 'SGD Dompet Digital',    platform: 'Wise',       quantity: 1500, avg_cost: 11_400,     current_price: 11_700,     total_value: 17_550_000, type: 'variable_income', ticker: 'SGD/IDR',  currency: 'SGD', last_synced_at: null, notes: 'Untuk liburan' },
  // SBN Ritel
  { id: uid('inv',11), user_id: DEMO_USER_ID, category: 'sbn',          name: 'ORI024',                platform: 'Bibit',      quantity:    1, avg_cost: 50_000_000, current_price: 51_200_000, total_value: 51_200_000, type: 'fixed_income',    ticker: null,       currency: 'IDR', last_synced_at: null, notes: 'Kupon 6.35% · tenor 3 tahun' },
  { id: uid('inv',12), user_id: DEMO_USER_ID, category: 'sbn',          name: 'ST012',                 platform: 'Stockbit',   quantity:    1, avg_cost: 25_000_000, current_price: 25_400_000, total_value: 25_400_000, type: 'fixed_income',    ticker: null,       currency: 'IDR', last_synced_at: null, notes: 'Sukuk Tabungan · syariah' },
  // Dana Pensiun
  { id: uid('inv',13), user_id: DEMO_USER_ID, category: 'pension',      name: 'DPLK BNI',              platform: 'BNI',         quantity:    1, avg_cost: 80_000_000, current_price: 92_000_000, total_value: 92_000_000, type: 'fixed_income',    ticker: null,       currency: 'IDR', last_synced_at: null, notes: 'Iuran Rp 2jt/bulan' },
  { id: uid('inv',14), user_id: DEMO_USER_ID, category: 'pension',      name: 'BPJS Ketenagakerjaan',  platform: 'BPJS-TK',     quantity:    1, avg_cost: 35_000_000, current_price: 38_500_000, total_value: 38_500_000, type: 'fixed_income',    ticker: null,       currency: 'IDR', last_synced_at: null, notes: 'JHT + JP' },
]

const debts = [
  { id: uid('dbt', 1), user_id: DEMO_USER_ID, name: 'KPR Rumah Bintaro', category: 'long_term', type: 'KPR',        principal: 650_000_000, remaining: 410_000_000, interest_rate: 7.5, monthly_payment: 5_200_000, due_date: d(YEAR, today.getMonth() + 1, 5),  is_active: true, created_at: '2020-07-15' },
  { id: uid('dbt', 2), user_id: DEMO_USER_ID, name: 'KKB Honda BR-V',    category: 'long_term', type: 'KKB',        principal: 280_000_000, remaining:  95_000_000, interest_rate: 6.8, monthly_payment: 4_100_000, due_date: d(YEAR, today.getMonth() + 1, 20), is_active: true, created_at: '2023-01-20' },
  { id: uid('dbt', 3), user_id: DEMO_USER_ID, name: 'Kartu Kredit BCA',  category: 'consumer',  type: 'Kartu Kredit',principal:   8_500_000, remaining:   2_300_000, interest_rate: 2.2, monthly_payment:   500_000, due_date: d(YEAR, today.getMonth() + 1, 15), is_active: true, created_at: '2024-06-01' },
]

const emergency_funds = [
  {
    id: uid('ef', 1), user_id: DEMO_USER_ID,
    job_stability: 'stable', dependents: 2, monthly_expenses: 12_000_000,
    target_amount: 72_000_000, current_amount: 48_000_000,
  },
]

const emergency_fund_locations = [
  { id: uid('efl', 1), fund_id: emergency_funds[0].id, account_name: 'BCA Tahapan Xpresi', amount: 28_000_000 },
  { id: uid('efl', 2), fund_id: emergency_funds[0].id, account_name: 'RD Pasar Uang Bibit', amount: 20_000_000 },
]

// Price snapshots — empty by default, populated when user clicks Refresh
const price_snapshots: Array<{
  ticker: string; price: number; currency: string; change_pct: number | null
  market_state: string | null; fetched_at: string; source: string
}> = []

// Financial Goals
const goals = [
  { id: uid('gl', 1), user_id: DEMO_USER_ID, name: 'DP Rumah Kedua',     category: 'property', target_amount: 200_000_000, current_amount:  55_000_000, deadline: `${YEAR + 2}-12-31`, notes: 'Target DP 20% apartemen', is_active: true, created_at: '2025-01-15' },
  { id: uid('gl', 2), user_id: DEMO_USER_ID, name: 'Liburan Jepang',     category: 'travel',   target_amount:  45_000_000, current_amount:  18_500_000, deadline: `${YEAR + 1}-04-30`, notes: 'Musim semi, sakura', is_active: true, created_at: '2025-06-01' },
  { id: uid('gl', 3), user_id: DEMO_USER_ID, name: 'Upgrade MacBook',    category: 'gadget',   target_amount:  40_000_000, current_amount:  12_000_000, deadline: `${YEAR}-12-31`,     notes: 'MacBook Pro M5', is_active: true, created_at: '2026-01-20' },
  { id: uid('gl', 4), user_id: DEMO_USER_ID, name: 'Dana Pendidikan Anak',category:'education', target_amount: 500_000_000, current_amount:  78_000_000, deadline: `${YEAR + 15}-06-30`,notes: 'Kuliah S1', is_active: true, created_at: '2024-08-10' },
]

// Recurring transactions
const recurring_transactions = [
  { id: uid('rc', 1), user_id: DEMO_USER_ID, name: 'Gaji Bulanan',       type: 'income',     category: 'Gaji',            amount: 18_500_000, account_id: accounts[1].id, frequency: 'monthly', day_of_period: 25, start_date: '2024-01-25', end_date: null, last_run_date: d(YEAR, Math.max(1, today.getMonth()), 25), is_active: true, notes: '' },
  { id: uid('rc', 2), user_id: DEMO_USER_ID, name: 'Cicilan KPR',        type: 'expense',    category: 'Tempat Tinggal',  amount:  5_200_000, account_id: accounts[0].id, frequency: 'monthly', day_of_period: 5,  start_date: '2020-07-05', end_date: null, last_run_date: d(YEAR, Math.max(1, today.getMonth()), 5),  is_active: true, notes: '' },
  { id: uid('rc', 3), user_id: DEMO_USER_ID, name: 'Netflix',            type: 'expense',    category: 'Langganan',       amount:    186_000, account_id: accounts[0].id, frequency: 'monthly', day_of_period: 10, start_date: '2023-03-10', end_date: null, last_run_date: d(YEAR, Math.max(1, today.getMonth()), 10), is_active: true, notes: 'Premium 4K' },
  { id: uid('rc', 4), user_id: DEMO_USER_ID, name: 'Spotify Family',     type: 'expense',    category: 'Langganan',       amount:     86_900, account_id: accounts[0].id, frequency: 'monthly', day_of_period: 15, start_date: '2022-06-15', end_date: null, last_run_date: d(YEAR, Math.max(1, today.getMonth()), 15), is_active: true, notes: '' },
  { id: uid('rc', 5), user_id: DEMO_USER_ID, name: 'DCA Saham',          type: 'investment', category: 'Saham',           amount:  2_000_000, account_id: accounts[0].id, frequency: 'monthly', day_of_period: 27, start_date: '2024-01-27', end_date: null, last_run_date: d(YEAR, Math.max(1, today.getMonth()), 27), is_active: true, notes: 'Auto-invest BBCA/TLKM' },
  { id: uid('rc', 6), user_id: DEMO_USER_ID, name: 'Top Up Dana Darurat',type: 'saving',     category: 'Dana Darurat',    amount:  1_500_000, account_id: accounts[0].id, frequency: 'monthly', day_of_period: 26, start_date: '2024-01-26', end_date: null, last_run_date: d(YEAR, Math.max(1, today.getMonth()), 26), is_active: true, notes: '' },
  { id: uid('rc', 7), user_id: DEMO_USER_ID, name: 'Indihome',           type: 'expense',    category: 'Tagihan',         amount:    420_000, account_id: accounts[0].id, frequency: 'monthly', day_of_period: 18, start_date: '2021-02-18', end_date: null, last_run_date: d(YEAR, Math.max(1, today.getMonth()), 18), is_active: true, notes: '100Mbps' },
]

// Dividends — for stock investments
const dividends = [
  { id: uid('dv', 1), user_id: DEMO_USER_ID, investment_id: 'inv-0001', ticker: 'BBCA.JK', amount:   540_000, shares: 1200, ex_date: `${YEAR}-03-15`, pay_date: `${YEAR}-04-05`, notes: 'Interim dividend' },
  { id: uid('dv', 2), user_id: DEMO_USER_ID, investment_id: 'inv-0001', ticker: 'BBCA.JK', amount: 1_260_000, shares: 1200, ex_date: `${YEAR - 1}-09-10`, pay_date: `${YEAR - 1}-10-15`, notes: 'Final dividend' },
  { id: uid('dv', 3), user_id: DEMO_USER_ID, investment_id: 'inv-0002', ticker: 'TLKM.JK', amount:   376_000, shares:  800, ex_date: `${YEAR}-05-20`, pay_date: `${YEAR}-06-15`, notes: '' },
  { id: uid('dv', 4), user_id: DEMO_USER_ID, investment_id: 'inv-0003', ticker: 'AAPL',    amount:   225_000, shares:   15, ex_date: `${YEAR}-02-10`, pay_date: `${YEAR}-02-15`, notes: 'Q1' },
]

// Net Worth Snapshots — generate 12 months
const net_worth_snapshots: Array<{
  id: string; user_id: string; snapshot_date: string
  total_assets: number; total_debts: number; net_worth: number; created_at: string
}> = []
{
  // Simulate gradual growth from ~1.5M to current ~1.7M
  const baseAssets = 1_500_000_000
  const baseDebts  =   560_000_000
  for (let i = 11; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const growth = Math.pow(1.012, 12 - i) // 1.2% per month growth on assets
    const debtDecay = Math.pow(0.992, 12 - i) // debts reduce ~0.8% per month
    const assets = Math.round(baseAssets * growth)
    const debts  = Math.round(baseDebts  * debtDecay)
    net_worth_snapshots.push({
      id: uid('nws', 12 - i),
      user_id: DEMO_USER_ID,
      snapshot_date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`,
      total_assets: assets,
      total_debts:  debts,
      net_worth:    assets - debts,
      created_at:   `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`,
    })
  }
}

// Credit cards
const credit_cards = [
  { id: uid('cc', 1), user_id: DEMO_USER_ID, name: 'BCA Everyday',    issuer: 'BCA',       last_four: '4821', credit_limit: 15_000_000, current_balance: 2_300_000, billing_day: 25, due_day: 15, interest_rate: 2.25, is_active: true,  created_at: '2023-05-01' },
  { id: uid('cc', 2), user_id: DEMO_USER_ID, name: 'Mandiri Skyz',    issuer: 'Mandiri',   last_four: '1147', credit_limit: 25_000_000, current_balance: 7_800_000, billing_day: 18, due_day: 8,  interest_rate: 2.25, is_active: true,  created_at: '2024-02-10' },
  { id: uid('cc', 3), user_id: DEMO_USER_ID, name: 'CIMB Travel',     issuer: 'CIMB Niaga', last_four: '9002', credit_limit:  8_000_000, current_balance:         0, billing_day: 10, due_day: 28, interest_rate: 2.25, is_active: true,  created_at: '2024-08-20' },
]

const credit_card_payments = [
  { id: uid('ccp', 1), user_id: DEMO_USER_ID, card_id: credit_cards[0].id, amount: 1_500_000, from_account_id: accounts[0].id, date: d(YEAR, Math.max(1, today.getMonth()),     15), notes: 'Bayar tagihan bulan ini' },
  { id: uid('ccp', 2), user_id: DEMO_USER_ID, card_id: credit_cards[1].id, amount: 5_000_000, from_account_id: accounts[0].id, date: d(YEAR, Math.max(1, today.getMonth()),     8),  notes: 'Bayar minimum' },
  { id: uid('ccp', 3), user_id: DEMO_USER_ID, card_id: credit_cards[0].id, amount: 3_100_000, from_account_id: accounts[0].id, date: d(YEAR, Math.max(1, today.getMonth() - 1), 15), notes: 'Bayar full bulan lalu' },
]

// Debt payments — demo history
const debt_payments = [
  { id: uid('dp', 1), user_id: DEMO_USER_ID, debt_id: debts[0].id, amount: 5_200_000, date: d(YEAR, Math.max(1, today.getMonth()),     5), notes: 'Cicilan KPR bulanan' },
  { id: uid('dp', 2), user_id: DEMO_USER_ID, debt_id: debts[1].id, amount: 4_100_000, date: d(YEAR, Math.max(1, today.getMonth()),    20), notes: 'Cicilan KKB bulanan' },
  { id: uid('dp', 3), user_id: DEMO_USER_ID, debt_id: debts[2].id, amount:   500_000, date: d(YEAR, Math.max(1, today.getMonth()),    15), notes: 'Kartu kredit — minimum' },
  { id: uid('dp', 4), user_id: DEMO_USER_ID, debt_id: debts[0].id, amount: 5_200_000, date: d(YEAR, Math.max(1, today.getMonth() - 1), 5), notes: 'Cicilan KPR bulan lalu' },
  { id: uid('dp', 5), user_id: DEMO_USER_ID, debt_id: debts[2].id, amount: 1_200_000, date: d(YEAR, Math.max(1, today.getMonth() - 1), 25), notes: 'Kartu kredit — ekstra' },
]

// Categorization Rules
const categorization_rules = [
  { id: uid('rule', 1), user_id: DEMO_USER_ID, match_text: 'GRAB',       type: 'expense', category: 'Transportasi', priority: 1, is_active: true, created_at: '2025-01-01' },
  { id: uid('rule', 2), user_id: DEMO_USER_ID, match_text: 'GOJEK',      type: 'expense', category: 'Transportasi', priority: 1, is_active: true, created_at: '2025-01-01' },
  { id: uid('rule', 3), user_id: DEMO_USER_ID, match_text: 'INDOMARET',  type: 'expense', category: 'Makanan',      priority: 1, is_active: true, created_at: '2025-01-01' },
  { id: uid('rule', 4), user_id: DEMO_USER_ID, match_text: 'ALFAMART',   type: 'expense', category: 'Makanan',      priority: 1, is_active: true, created_at: '2025-01-01' },
  { id: uid('rule', 5), user_id: DEMO_USER_ID, match_text: 'NETFLIX',    type: 'expense', category: 'Langganan',    priority: 1, is_active: true, created_at: '2025-01-01' },
  { id: uid('rule', 6), user_id: DEMO_USER_ID, match_text: 'PLN',        type: 'expense', category: 'Tagihan',      priority: 1, is_active: true, created_at: '2025-01-01' },
]

// Stock Transaction Log
const stock_transactions = [
  { id: uid('stx', 1), user_id: DEMO_USER_ID, investment_id: 'inv-0001', ticker: 'BBCA.JK', side: 'buy',  shares:  500, price:  8_800, fee: 15_000, total:  4_415_000, broker: 'Stockbit', date: '2024-03-15', notes: '' },
  { id: uid('stx', 2), user_id: DEMO_USER_ID, investment_id: 'inv-0001', ticker: 'BBCA.JK', side: 'buy',  shares:  400, price:  9_250, fee: 15_000, total:  3_715_000, broker: 'Stockbit', date: '2024-09-20', notes: 'DCA' },
  { id: uid('stx', 3), user_id: DEMO_USER_ID, investment_id: 'inv-0001', ticker: 'BBCA.JK', side: 'buy',  shares:  300, price:  9_450, fee: 10_000, total:  2_845_000, broker: 'Stockbit', date: '2025-02-10', notes: '' },
  { id: uid('stx', 4), user_id: DEMO_USER_ID, investment_id: 'inv-0002', ticker: 'TLKM.JK', side: 'buy',  shares:  800, price:  3_450, fee: 12_000, total:  2_772_000, broker: 'Stockbit', date: '2024-06-05', notes: '' },
  { id: uid('stx', 5), user_id: DEMO_USER_ID, investment_id: 'inv-0003', ticker: 'AAPL',    side: 'buy',  shares:   10, price: 2_400_000, fee: 50_000, total: 24_050_000, broker: 'IBKR', date: '2024-11-15', notes: 'USD equivalent' },
  { id: uid('stx', 6), user_id: DEMO_USER_ID, investment_id: 'inv-0003', ticker: 'AAPL',    side: 'buy',  shares:    5, price: 2_550_000, fee: 25_000, total: 12_775_000, broker: 'IBKR', date: '2025-04-10', notes: '' },
]

// IHSG benchmark series (12 months, simulated)
const ihsg_snapshots = (() => {
  const out: Array<{ date: string; close: number }> = []
  let price = 7_200
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    price = price * (1 + (Math.sin(i) * 0.015 + 0.004))
    out.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
      close: Math.round(price),
    })
  }
  return out
})()

// Profiles
const profiles = [
  { id: DEMO_USER_ID, full_name: 'Bashid Demo', currency: 'IDR', onboarding_focus: ['networth', 'budget'], welcomed_at: '2026-01-02', created_at: '2026-01-01' },
]

// Transfers
const transfers: unknown[] = []

// Contracts — demo set covers every status (overdue/expiring/upcoming/archived)
const contracts = (() => {
  const now = today
  const addDays = (n: number) => {
    const d = new Date(now); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10)
  }
  return [
    { id: uid('ctr', 1), user_id: DEMO_USER_ID, name: 'Asuransi Mobil Allianz', category: 'insurance',    provider: 'Allianz',         policy_number: 'MV-2024-88123', start_date: '2025-06-01', end_date: addDays(18),   cost: 8_500_000,  frequency: 'yearly',    auto_renew: false, reminder_days_before: 30, is_archived: false, notes: 'All Risk, deductible Rp 500rb',   created_at: '2025-06-01' },
    { id: uid('ctr', 2), user_id: DEMO_USER_ID, name: 'Asuransi Kesehatan Keluarga', category: 'insurance', provider: 'Prudential',      policy_number: 'PRU-4471',      start_date: '2025-01-15', end_date: addDays(265),  cost: 18_000_000, frequency: 'yearly',    auto_renew: true,  reminder_days_before: 30, is_archived: false, notes: '',                                 created_at: '2025-01-15' },
    { id: uid('ctr', 3), user_id: DEMO_USER_ID, name: 'Netflix Premium',           category: 'subscription', provider: 'Netflix',        policy_number: '',              start_date: '2024-09-01', end_date: addDays(9),    cost: 186_000,    frequency: 'monthly',   auto_renew: true,  reminder_days_before: 14, is_archived: false, notes: 'Shared dengan istri',              created_at: '2024-09-01' },
    { id: uid('ctr', 4), user_id: DEMO_USER_ID, name: 'Spotify Family',            category: 'subscription', provider: 'Spotify',        policy_number: '',              start_date: '2025-02-10', end_date: addDays(45),   cost: 89_000,     frequency: 'monthly',   auto_renew: true,  reminder_days_before: 7,  is_archived: false, notes: '',                                 created_at: '2025-02-10' },
    { id: uid('ctr', 5), user_id: DEMO_USER_ID, name: 'KPR BCA Rumah Utama',       category: 'loan',         provider: 'BCA',             policy_number: 'KPR-BCA-2019-0012', start_date: '2019-03-01', end_date: '2034-03-01',  cost: 7_200_000,  frequency: 'monthly',   auto_renew: false, reminder_days_before: 60, is_archived: false, notes: 'Tenor 15 tahun',                   created_at: '2019-03-01' },
    { id: uid('ctr', 6), user_id: DEMO_USER_ID, name: 'Garansi TV Samsung',        category: 'warranty',     provider: 'Samsung',         policy_number: 'WR-2024-55219', start_date: '2024-12-12', end_date: addDays(-5),   cost: null,        frequency: null,        auto_renew: false, reminder_days_before: 30, is_archived: false, notes: 'Simpan struk',                     created_at: '2024-12-12' },
    { id: uid('ctr', 7), user_id: DEMO_USER_ID, name: 'Sewa Ruko Proyek',          category: 'lease',        provider: 'Pemilik Ruko',    policy_number: '',              start_date: '2025-01-01', end_date: addDays(128),  cost: 75_000_000, frequency: 'yearly',    auto_renew: false, reminder_days_before: 60, is_archived: false, notes: 'Kontrak 1 tahun',                  created_at: '2025-01-01' },
    { id: uid('ctr', 8), user_id: DEMO_USER_ID, name: 'Asuransi Jiwa lama',        category: 'insurance',    provider: 'AXA Mandiri',     policy_number: '',              start_date: '2020-06-01', end_date: '2025-06-01',  cost: 6_000_000,  frequency: 'yearly',    auto_renew: false, reminder_days_before: 30, is_archived: true,  notes: 'Sudah ganti ke Prudential',        created_at: '2020-06-01' },
  ]
})()

export const demoStore: Record<string, unknown[]> = {
  profiles,
  accounts,
  transactions,
  budgets,
  assets_liquid,
  assets_non_liquid,
  investments,
  debts,
  emergency_funds,
  emergency_fund: emergency_funds, // alias (page uses singular)
  emergency_fund_locations,
  transfers,
  price_snapshots,
  debt_payments,
  credit_cards,
  credit_card_payments,
  goals,
  recurring_transactions,
  dividends,
  net_worth_snapshots,
  categorization_rules,
  stock_transactions,
  ihsg_snapshots,
  contracts,
}
