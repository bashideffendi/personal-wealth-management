/**
 * Hue kategori — palet 4 warna logo Klunting sebagai sistem semantik (F10).
 *
 * teal  = uang masuk / positif        coral = keluar / negatif
 * biru  = likuid / info / tagihan     ungu  = investasi / tujuan / langganan
 *
 * Kategori TETAP (mapping eksplisit) dapat hue sesuai makna; kategori bebas
 * buatan user dapat hue deterministik dari nama (stabil lintas render &
 * lintas halaman — Beranda, Anggaran, Transaksi pakai warna yang sama).
 * Token CSS var supaya ikut light/dark & skin.
 */

export interface CategoryHue {
  /** background chip ikon (tint pastel) */
  soft: string
  /** teks/ikon di atas tint — varian -ink (AA) */
  ink: string
  /** bar/dot/stroke — hue terang (non-teks) */
  bar: string
}

const HUES: readonly CategoryHue[] = [
  { soft: 'var(--c-coral-soft)', ink: 'var(--c-coral-ink)', bar: 'var(--c-coral)' },
  { soft: 'var(--c-blue-soft)', ink: 'var(--c-blue-ink)', bar: 'var(--c-blue)' },
  { soft: 'var(--c-violet-soft)', ink: 'var(--c-violet-ink)', bar: 'var(--c-violet)' },
  { soft: 'var(--c-mint-soft)', ink: 'var(--c-mint-ink)', bar: 'var(--c-mint)' },
] as const

const CORAL = 0
const BLUE = 1
const VIOLET = 2
const MINT = 3

/** Kategori baku (id/en) → indeks hue bermakna. Lowercase. */
const FIXED: Record<string, number> = {
  makanan: CORAL,
  food: CORAL,
  'pakaian & aksesoris': CORAL,
  hiburan: CORAL,
  entertainment: CORAL,
  'hang out': CORAL,
  belanja: CORAL,
  shopping: CORAL,

  tagihan: BLUE,
  bills: BLUE,
  listrik: BLUE,
  internet: BLUE,
  transportasi: BLUE,
  transportation: BLUE,
  bensin: BLUE,
  kesehatan: BLUE,
  health: BLUE,
  pendidikan: BLUE,
  education: BLUE,

  langganan: VIOLET,
  subscription: VIOLET,
  investasi: VIOLET,
  investment: VIOLET,
  cryptocurrency: VIOLET,
  crypto: VIOLET,
  'reksa dana': VIOLET,
  saham: VIOLET,
  family: VIOLET,

  gaji: MINT,
  salary: MINT,
  pemasukan: MINT,
  income: MINT,
  bonus: MINT,
  tabungan: MINT,
  saving: MINT,
  'dana darurat': MINT,
  freelance: MINT,
  'side hustle': MINT,
}

export function categoryHue(category: string): CategoryHue {
  const key = category.trim().toLowerCase()
  const fixed = FIXED[key]
  if (fixed !== undefined) return HUES[fixed]
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 997
  return HUES[h % HUES.length]
}
