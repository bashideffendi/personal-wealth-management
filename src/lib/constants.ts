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

export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'Transaksi', href: '/transactions', icon: 'Receipt' },
  { label: 'Anggaran', href: '/budget', icon: 'Wallet' },
  { label: 'Aset', href: '/assets', icon: 'Building2' },
  { label: 'Utang', href: '/debts', icon: 'CreditCard' },
  { label: 'Dana Darurat', href: '/emergency-fund', icon: 'Shield' },
  { label: 'Kekayaan Bersih', href: '/net-worth', icon: 'TrendingUp' },
] as const
