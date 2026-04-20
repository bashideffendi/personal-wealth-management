export const INCOME_CATEGORIES = [
  'Gaji',
  'Gaji Pasangan',
  'Side Hustle / Freelance',
  'Pendapatan Bisnis',
  'Pendapatan Investasi / Dividen / Capital Gain',
  'Pendapatan Sewa',
  'Komisi',
  'Bonus',
  'Pensiun',
  'Beasiswa / Hibah',
  'Warisan',
  'Lotere / Judi',
  'Hadiah',
  'Refund / Reimbursement',
  'Lainnya',
] as const

export const EXPENSE_CATEGORIES = [
  'Makanan',
  'Transportasi',
  'Tempat Tinggal',
  'Kesehatan',
  'Pendidikan',
  'Pakaian & Aksesoris',
  'Asuransi',
  'Pekerjaan',
  'Hiburan',
  'Hadiah',
  'Perjalanan',
  'Langganan',
  'Tagihan',
] as const

export const SAVING_CATEGORIES = [
  'Tabungan Umum',
  'Dana Darurat',
  'Tabungan Pensiun',
  'Sinking Fund',
] as const

export const INVESTMENT_CATEGORIES = [
  'Saham',
  'Reksa Dana',
  'Cryptocurrency',
  'Emas',
  'Obligasi',
  'Deposito',
  'P2P Lending',
  'Investasi Bisnis',
  'Valas',
  'SBN Ritel',
  'Dana Pensiun',
] as const

export const ACCOUNT_TYPES = {
  cash: 'Kas',
  bank: 'Bank',
  digital_wallet: 'Dompet Digital',
  investment: 'Investasi',
} as const

export const DEBT_TYPES = {
  consumer: 'Konsumtif',
  cash_loan: 'Pinjaman Tunai',
  long_term: 'Jangka Panjang',
} as const

export const DEBT_SUBTYPES = {
  consumer: [
    'Kartu Kredit',
    'Paylater',
    'Cicilan Barang',
  ],
  cash_loan: [
    'Pinjaman Online',
    'Pinjaman Bank',
    'Pinjaman Koperasi',
  ],
  long_term: [
    'KPR',
    'KKB',
    'Pinjaman Pendidikan',
    'Pinjaman Bisnis',
  ],
} as const

export const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const

// Investment subcategories — used both for routing and for the page-level tiles
export const INVESTMENT_SUBCATS = [
  { slug: 'stock',        label: 'Saham',          emoji: '📈' },
  { slug: 'mutual-fund',  label: 'Reksa Dana',     emoji: '🧺' },
  { slug: 'crypto',       label: 'Crypto',         emoji: '🪙' },
  { slug: 'gold',         label: 'Emas',           emoji: '🥇' },
  { slug: 'bond',         label: 'Obligasi',       emoji: '📃' },
  { slug: 'sbn',          label: 'SBN Ritel',      emoji: '🇮🇩' },
  { slug: 'time-deposit', label: 'Deposito',       emoji: '🏦' },
  { slug: 'forex',        label: 'Valas',          emoji: '💱' },
  { slug: 'p2p',          label: 'P2P Lending',    emoji: '🤝' },
  { slug: 'pension',      label: 'Dana Pensiun',   emoji: '👴' },
  { slug: 'business',     label: 'Bisnis',         emoji: '💼' },
] as const

export const INVESTMENT_SLUG_TO_CATEGORY: Record<string, string> = {
  stock: 'stock',
  'mutual-fund': 'mutual_fund',
  crypto: 'crypto',
  gold: 'gold',
  bond: 'bond',
  sbn: 'sbn',
  'time-deposit': 'time_deposit',
  forex: 'forex',
  p2p: 'p2p',
  pension: 'pension',
  business: 'business',
}

// Nested nav — single source of truth for the sidebar and route guards.
export type NavSection =
  | 'overview'
  | 'activity'
  | 'wealth'
  | 'debt'
  | 'invest_advanced'
  | 'tools'

export type NavItem = {
  label: string
  href: string
  icon: string
  emoji?: string
  /** i18n message key under nav.* — if omitted, `label` is shown verbatim. */
  titleKey?: string
  /** Section grouping for sidebar headers */
  section?: NavSection
  children?: NavItem[]
}

// Section labels (displayed as sidebar group headers)
export const NAV_SECTIONS: { key: NavSection; titleKey: string }[] = [
  { key: 'overview',        titleKey: 'nav.section.overview' },
  { key: 'activity',        titleKey: 'nav.section.activity' },
  { key: 'wealth',          titleKey: 'nav.section.wealth' },
  { key: 'debt',            titleKey: 'nav.section.debt' },
  { key: 'invest_advanced', titleKey: 'nav.section.invest_advanced' },
  { key: 'tools',           titleKey: 'nav.section.tools' },
]

export const NAV_ITEMS: NavItem[] = [
  // OVERVIEW — where I am + where I'm heading
  { label: 'Dashboard',   titleKey: 'nav.dashboard',      href: '/dashboard',              icon: 'LayoutDashboard', section: 'overview' },
  { label: 'Tujuan',      titleKey: 'nav.goals',          href: '/dashboard/goals',        icon: 'Target',          section: 'overview' },

  // ACTIVITY (daily recording)
  { label: 'Transaksi',   titleKey: 'nav.transactions',   href: '/dashboard/transactions', icon: 'Receipt',     section: 'activity' },
  { label: 'Recurring',   titleKey: 'nav.recurring',      href: '/dashboard/recurring',    icon: 'Repeat',      section: 'activity' },
  { label: 'Anggaran',    titleKey: 'nav.budgeting',      href: '/dashboard/budgeting',    icon: 'Wallet',      section: 'activity' },

  // WEALTH (assets & net worth)
  {
    label: 'Aset', titleKey: 'nav.assets', href: '/dashboard/assets', icon: 'Building2', section: 'wealth',
    children: [
      { label: 'Ringkasan',       titleKey: 'nav.assets_overview',     href: '/dashboard/assets',             icon: '' },
      { label: 'Aset Likuid',     titleKey: 'nav.assets_liquid',       href: '/dashboard/assets/liquid',      icon: '' },
      { label: 'Aset Non-Likuid', titleKey: 'nav.assets_non_liquid',   href: '/dashboard/assets/non-liquid',  icon: '' },
      { label: 'Investasi',       titleKey: 'nav.investment',          href: '/dashboard/assets/investment',  icon: '' },
    ],
  },
  { label: 'Dana Darurat',    titleKey: 'nav.emergency_fund',  href: '/dashboard/emergency-fund', icon: 'Shield',     section: 'wealth' },
  { label: 'Kekayaan Bersih', titleKey: 'nav.net_worth',       href: '/dashboard/net-worth',      icon: 'TrendingUp', section: 'wealth' },

  // DEBT — Kartu Kredit now lives here as a child of Utang
  {
    label: 'Utang', titleKey: 'nav.debts', href: '/dashboard/debts', icon: 'CreditCard', section: 'debt',
    children: [
      { label: 'Ringkasan',          titleKey: 'nav.debts_overview', href: '/dashboard/debts',          icon: '' },
      { label: 'Strategi Pelunasan', titleKey: 'nav.debts_strategy', href: '/dashboard/debts/strategy', icon: '' },
      { label: 'Pembayaran',         titleKey: 'nav.debts_payments', href: '/dashboard/debts/payments', icon: '' },
      { label: 'Kartu Kredit',       titleKey: 'nav.credit_cards',   href: '/dashboard/credit-cards',   icon: '' },
    ],
  },

  // ADVANCED INVESTING — RRG first (newest), then stock log + dividends
  { label: 'RRG',             titleKey: 'nav.rrg',             href: '/dashboard/rrg',            icon: 'Compass',     section: 'invest_advanced' },
  { label: 'Stock Log',       titleKey: 'nav.stock_log',       href: '/dashboard/stock-log',      icon: 'ListOrdered', section: 'invest_advanced' },
  { label: 'Dividen',         titleKey: 'nav.dividends',       href: '/dashboard/dividends',      icon: 'Coins',       section: 'invest_advanced' },

  // TOOLS — utilities, reports, calculators, category rules
  { label: 'Kalkulator',      titleKey: 'nav.calculators',     href: '/dashboard/calculators',    icon: 'Calculator',  section: 'tools' },
  { label: 'Wrapped',         titleKey: 'nav.wrapped',         href: '/dashboard/wrapped',        icon: 'Gift',        section: 'tools' },
  { label: 'Subscription',    titleKey: 'nav.subscriptions',   href: '/dashboard/subscriptions',  icon: 'Clock',       section: 'tools' },
  { label: 'Aturan Kategori', titleKey: 'nav.rules',           href: '/dashboard/rules',          icon: 'Sparkles',    section: 'tools' },
]
