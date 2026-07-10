/**
 * Parsing CSV import + serialisasi CSV export transaksi — logika murni,
 * diekstrak dari transactions/page.tsx (protokol pecah god-file, langkah A).
 */

import { applyRules, type RuleLike, type TxType } from './rules'

export type ParsedCsvRow = {
  date: string
  description: string
  amount: number
  type: TxType
  category: string
}

/**
 * Parse nominal fleksibel ID/EN. Versi lama (inline page) strip non-digit lalu
 * Number() — "Rp 125.000" terbaca 125 (titik RIBUAN Indonesia dianggap
 * desimal): salah-baca uang 1000x. Aturan sekarang:
 * - separator (./,) muncul >1 kali → ribuan, buang semua;
 * - muncul sekali dengan TEPAT 3 digit di belakang → ribuan ("125.000",
 *   "125,000");
 * - selain itu → desimal ("125.5", "99,95").
 */
export function parseFlexibleAmount(raw: unknown): number {
  let s = String(raw ?? '').replace(/[^\d.,-]/g, '')
  if (!s) return 0
  const neg = s.includes('-')
  s = s.replace(/-/g, '')
  // Separator TERAKHIR yang menentukan: 3 digit di belakangnya = ribuan
  // (buang semua separator), 1-2 digit = desimal (sisanya ribuan).
  let normalized = s
  if (/[.,]/.test(s)) {
    const idx = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','))
    const after = s.slice(idx + 1)
    normalized = after.length === 3
      ? s.replace(/[.,]/g, '')
      : `${s.slice(0, idx).replace(/[.,]/g, '')}.${after}`
  }
  const num = Number(normalized) || 0
  return neg ? -num : num
}

/**
 * Parse tanggal fleksibel → yyyy-mm-dd. Versi lama new Date() duluan —
 * "05/07/2026" terbaca 7 Mei (format US) + toISOString geser -1 hari di WIB.
 * Sekarang: pola d/m/yyyy dicek DULU (konvensi mutasi bank ID = dd/mm;
 * kalau "bulan" > 12 berarti sumbernya mm/dd → di-swap), sisanya new Date()
 * dengan komponen LOKAL (tanpa geser timezone).
 */
export function parseFlexibleDate(raw: string, fallback: string): string {
  if (!raw) return fallback
  const m = raw.match(/^\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s*$/)
  if (m) {
    let day = Number(m[1])
    let month = Number(m[2])
    if (month > 12 && day <= 12) [day, month] = [month, day]
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${m[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  const dn = new Date(raw)
  if (!isNaN(dn.getTime())) {
    return `${dn.getFullYear()}-${String(dn.getMonth() + 1).padStart(2, '0')}-${String(dn.getDate()).padStart(2, '0')}`
  }
  return fallback
}

/**
 * Map baris hasil papaparse (header fleksibel ID/EN) → baris transaksi.
 * - Nominal: strip non-digit, tanda minus = expense.
 * - Tanggal: yyyy-mm-dd / parseable Date / dd-mm-yyyy — fallback `today`.
 * - Kategori: rules dulu; cue debit whole-word (\b — "Checkout"/"payout"
 *   TIDAK terbaca expense).
 * Baris amount <= 0 dibuang.
 */
export function parseCsvRows(
  data: readonly Record<string, string>[],
  rules: readonly RuleLike[],
  today: string = new Date().toISOString().split('T')[0],
): ParsedCsvRow[] {
  return data
    .map((row) => {
      // Try to detect common column names (flexible)
      const desc = (row.description ?? row.Deskripsi ?? row.Description ?? row.Keterangan ?? row.keterangan ?? '').trim()
      const dateRaw = row.date ?? row.Tanggal ?? row.Date ?? row.tanggal ?? ''
      const amountRaw = row.amount ?? row.Jumlah ?? row.Amount ?? row.Nominal ?? '0'
      const amountSigned = parseFlexibleAmount(amountRaw)
      const amount = Math.abs(amountSigned)
      const date = parseFlexibleDate(dateRaw, today)
      // Auto-categorize from rules
      const matched = applyRules(rules, desc)
      // Expense if: a rule says so, OR the raw amount is negative, OR the
      // description has a whole-word debit cue. Anchored \b so "Checkout",
      // "Takeout", "payout" don't get misread as expenses.
      const isExpense = matched?.type === 'expense' || amountSigned < 0 || /\b(debit|keluar|withdraw|dr)\b/i.test(desc)
      return {
        date,
        description: desc,
        amount,
        type: (matched?.type ?? (isExpense ? 'expense' : 'income')) as TxType,
        category: matched?.category ?? (isExpense ? 'Lainnya' : 'Gaji'),
      }
    })
    .filter((r) => r.amount > 0)
}

/**
 * Quote + escape SETIAP cell (akun/kategori juga free-text) dan netralkan
 * formula injection spreadsheet (cell berawalan =,+,-,@) dengan leading quote.
 */
export function csvCell(v: unknown): string {
  let s = String(v ?? '')
  if (/^[=+\-@]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

/** Susun konten CSV dari baris-baris sel mentah (header termasuk). */
export function toCsv(rows: readonly (readonly unknown[])[]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\n')
}
