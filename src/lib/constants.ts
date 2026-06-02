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
  rdn: 'RDN / RDI',  // Rekening Dana Nasabah / Investasi (broker cash account)
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
// Phase 1.2: simplified to primary (most-used) + secondary (utility tools).
// Profile/Pricing moved to header avatar dropdown.
export type NavSection =
  | 'primary'
  | 'secondary'

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

// Section labels — primary has no header (just clean items),
// secondary has small "Lainnya" label as a divider
export const NAV_SECTIONS: { key: NavSection; titleKey: string }[] = [
  { key: 'primary',   titleKey: '' },                       // no header label
  { key: 'secondary', titleKey: 'nav.section.secondary' },  // "Lainnya"
]

export const NAV_ITEMS: NavItem[] = [
  // ─── PRIMARY (7 items) — daily-use, top of sidebar ───
  { label: 'Beranda',     titleKey: 'nav.dashboard',     href: '/dashboard',                   icon: 'LayoutDashboard', section: 'primary' },
  { label: 'Transaksi',   titleKey: 'nav.transactions',  href: '/dashboard/transactions',      icon: 'Receipt',         section: 'primary' },
  { label: 'Anggaran',    titleKey: 'nav.budgeting',     href: '/dashboard/budgeting',         icon: 'Wallet',          section: 'primary' },
  { label: 'Investasi',   titleKey: 'nav.investment',    href: '/dashboard/assets/investment', icon: 'TrendingUp',      section: 'primary' },
  {
    label: 'Kekayaan', titleKey: 'nav.wealth', href: '/dashboard/net-worth', icon: 'Building2', section: 'primary',
    children: [
      { label: 'Net Worth',       titleKey: 'nav.net_worth',         href: '/dashboard/net-worth',        icon: '' },
      { label: 'Aset Likuid',     titleKey: 'nav.assets_liquid',     href: '/dashboard/assets/liquid',    icon: '' },
      { label: 'Aset Non-Likuid', titleKey: 'nav.assets_non_liquid', href: '/dashboard/assets/non-liquid', icon: '' },
      { label: 'Utang',           titleKey: 'nav.debts',             href: '/dashboard/debts',            icon: '' },
      { label: 'Kartu Kredit',    titleKey: 'nav.credit_cards',      href: '/dashboard/credit-cards',     icon: '' },
      { label: 'Dana Darurat',    titleKey: 'nav.emergency_fund',    href: '/dashboard/emergency-fund',   icon: '' },
    ],
  },
  { label: 'Tujuan',      titleKey: 'nav.goals',         href: '/dashboard/goals',             icon: 'Target',          section: 'primary' },
  { label: 'Keluarga',    titleKey: 'nav.family',        href: '/dashboard/family',            icon: 'Home',            section: 'primary' },

  // ─── SECONDARY (utility tools, smaller styling) ───
  { label: 'Akun',            titleKey: 'nav.accounts',       href: '/dashboard/accounts',       icon: 'CircleDollarSign', section: 'secondary' },
  { label: 'Recurring',       titleKey: 'nav.recurring',      href: '/dashboard/recurring',      icon: 'Repeat',           section: 'secondary' },
  { label: 'Laporan Bulanan', titleKey: 'nav.monthly_report', href: '/dashboard/monthly-report', icon: 'FileText',         section: 'secondary' },
  { label: 'Langganan & Kontrak', titleKey: 'nav.contracts',  href: '/dashboard/contracts',      icon: 'FileClock',        section: 'secondary' },
  { label: 'Subscription',    titleKey: 'nav.subscriptions',  href: '/dashboard/subscriptions',  icon: 'Clock',            section: 'secondary' },
  { label: 'Kalkulator',      titleKey: 'nav.calculators',    href: '/dashboard/calculators',    icon: 'Calculator',       section: 'secondary' },
  { label: 'Aturan Kategori', titleKey: 'nav.rules',          href: '/dashboard/rules',          icon: 'Sparkles',         section: 'secondary' },

  // (Profile, Paket, Keluar are accessed via avatar dropdown in header)
  // (Stock Log + Dividen are tabs inside /dashboard/assets/investment/stock)
  // (Debt sub-pages — Strategi, Pembayaran — accessible via Utang page tabs)
]
