/**
 * Validasi/clamp output tool-use model SEBELUM dikirim ke client.
 *
 * Kenapa: `input_schema` di Anthropic tool BUKAN jaminan — model (apalagi
 * kalau teks/struk/mutasi berisi prompt injection) bisa mengembalikan tipe
 * salah, enum di luar daftar, angka negatif/raksasa, atau string kepanjangan.
 * Client mengisi form/preview dari data ini (dan import mutasi bisa bulk
 * insert), jadi server wajib menormalkan dulu: enum di-whitelist, amount
 * dibulatkan & di-clamp, string dipotong, baris invalid dibuang.
 *
 * Pure function — tanpa I/O, gampang di-test (sanitize.test.ts).
 */

import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  SAVING_CATEGORIES,
  INVESTMENT_CATEGORIES,
} from '@/lib/constants'

/** Batas atas nominal satu transaksi (Rp 100 triliun) — di atas itu pasti salah parse. */
export const MAX_AMOUNT = 100_000_000_000_000

const TX_TYPES = ['income', 'expense', 'saving', 'investment'] as const
type TxType = (typeof TX_TYPES)[number]

const CATS_BY_TYPE: Record<TxType, readonly string[]> = {
  income: INCOME_CATEGORIES,
  expense: EXPENSE_CATEGORIES,
  saving: SAVING_CATEGORIES,
  investment: INVESTMENT_CATEGORIES,
}

const ALL_CATS = new Set<string>([
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES,
  ...SAVING_CATEGORIES,
  ...INVESTMENT_CATEGORIES,
])

const CONFIDENCE = ['high', 'medium', 'low'] as const
const PAYMENT_METHODS = ['cash', 'qris', 'debit_card', 'credit_card', 'ewallet', 'transfer', 'unknown'] as const

export function str(v: unknown, max: number): string {
  if (typeof v !== 'string') return ''
  // Buang karakter kontrol (kecuali spasi biasa) lalu potong.
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max)
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
}

/** Integer rupiah ≥ 0, ≤ MAX_AMOUNT. Non-angka/NaN → null. */
export function amount(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  if (!Number.isFinite(n)) return null
  return Math.min(MAX_AMOUNT, Math.max(0, Math.round(Math.abs(n))))
}

/** YYYY-MM-DD yang valid secara kalender, atau null. */
export function isoDate(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const d = new Date(`${v}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return null
  const y = d.getUTCFullYear()
  if (y < 1990 || y > 2100) return null
  return v
}

/**
 * Kategori harus ada di enum yang dikirim ke model (gabungan semua daftar —
 * sama dengan `input_schema`, jadi perilaku lama tidak berubah). Di luar
 * itu → kategori pertama tipe tsb kalau 'Lainnya' tidak tersedia.
 */
function category(v: unknown, type: TxType): string {
  if (typeof v === 'string' && ALL_CATS.has(v)) return v
  return ALL_CATS.has('Lainnya') ? 'Lainnya' : CATS_BY_TYPE[type][0]
}

export interface ParsedTransactionOut {
  type: TxType
  amount: number
  category: string
  description: string
  payment_hint: string
  confidence: (typeof CONFIDENCE)[number]
}

/** Output /api/parse-transaction. null = output tidak bisa dipakai (tanpa amount). */
export function sanitizeParsedTransaction(raw: unknown): ParsedTransactionOut | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const amt = amount(r.amount)
  if (amt === null) return null
  const type = oneOf(r.type, TX_TYPES, 'expense')
  return {
    type,
    amount: amt,
    category: category(r.category, type),
    description: str(r.description, 200),
    payment_hint: str(r.payment_hint, 50),
    confidence: oneOf(r.confidence, CONFIDENCE, 'low'),
  }
}

export interface ReceiptOut {
  merchant: string
  date: string
  total: number
  type: TxType
  category: string
  description: string
  payment_method: (typeof PAYMENT_METHODS)[number]
  payment_detail: string
  confidence: (typeof CONFIDENCE)[number]
  notes?: string
}

/** Output /api/extract-receipt. Tanggal invalid → hari ini (confidence diturunkan). */
export function sanitizeReceipt(raw: unknown, todayISO: string): ReceiptOut | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const total = amount(r.total)
  if (total === null) return null
  const type = oneOf(r.type, TX_TYPES, 'expense')
  const date = isoDate(r.date)
  let confidence = oneOf(r.confidence, CONFIDENCE, 'low')
  if (!date && confidence === 'high') confidence = 'medium'
  const out: ReceiptOut = {
    merchant: str(r.merchant, 120),
    date: date ?? todayISO,
    total,
    type,
    category: category(r.category, type),
    description: str(r.description, 200),
    payment_method: oneOf(r.payment_method, PAYMENT_METHODS, 'unknown'),
    payment_detail: str(r.payment_detail, 50),
    confidence,
  }
  const notes = str(r.notes, 300)
  if (notes) out.notes = notes
  return out
}

export interface MutasiRowOut {
  date: string
  description: string
  amount: number
  type: 'expense' | 'income'
  category: string
  confidence: (typeof CONFIDENCE)[number]
  is_transfer: boolean
}

export interface MutasiOut {
  transactions: MutasiRowOut[]
  bank_name?: string
  period_start?: string
  period_end?: string
}

/** Batas jumlah baris hasil import per request. */
export const MAX_MUTASI_ROWS = 2000

/**
 * Output /api/import-mutasi. Baris tanpa tanggal valid / amount > 0 DIBUANG
 * (lebih baik kelewat daripada palsu — sejalan dengan prompt).
 */
export function sanitizeMutasi(raw: unknown): MutasiOut {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const rows = Array.isArray(r.transactions) ? r.transactions : []
  const transactions: MutasiRowOut[] = []
  for (const item of rows) {
    if (transactions.length >= MAX_MUTASI_ROWS) break
    if (!item || typeof item !== 'object') continue
    const t = item as Record<string, unknown>
    const date = isoDate(t.date)
    const amt = amount(t.amount)
    if (!date || !amt) continue
    const type = oneOf(t.type, ['expense', 'income'] as const, 'expense')
    transactions.push({
      date,
      description: str(t.description, 200),
      amount: amt,
      type,
      category: category(t.category, type),
      confidence: oneOf(t.confidence, CONFIDENCE, 'low'),
      is_transfer: t.is_transfer === true,
    })
  }
  const out: MutasiOut = { transactions }
  const bank = str(r.bank_name, 60)
  if (bank) out.bank_name = bank
  const ps = isoDate(r.period_start)
  const pe = isoDate(r.period_end)
  if (ps) out.period_start = ps
  if (pe) out.period_end = pe
  return out
}
