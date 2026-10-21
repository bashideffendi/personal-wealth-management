/**
 * Aturan KANONIK arus bulanan (dashboard, laporan bulanan, kalender transaksi).
 *
 * - Kategori 'Transfer' = pindah antar-akun, tercatat 2 kaki (expense +
 *   income) → di-exclude dari SEMUA tipe; kalau ikut, income & expense
 *   double-count dan saving rate ngaco.
 * - Bulan ditentukan dari string `date` (YYYY-MM-DD, tanggal lokal user saat
 *   dicatat) — BUKAN Date/UTC, supaya transaksi tanggal 1 jam 01:00 WIB tidak
 *   jatuh ke bulan sebelumnya.
 */

export type FlowType = 'income' | 'expense' | 'saving' | 'investment'
export type FlowTx = { date: string; type: string; amount: number; category?: string | null }
export type MonthFlow = Record<FlowType, number> & { net: number; savingRate: number }

export const isRealFlow = (t: Pick<FlowTx, 'category'>) => t.category !== 'Transfer'

export function sumFlow(txs: readonly FlowTx[], type: FlowType): number {
  let s = 0
  for (const t of txs) if (t.type === type && isRealFlow(t)) s += t.amount || 0
  return s
}

/** [start, end) bulan `month` (1–12) sebagai string ISO, aman pergantian tahun. */
export function monthBounds(year: number, month: number): { start: string; end: string } {
  const pad = (n: number) => String(n).padStart(2, '0')
  const ny = month === 12 ? year + 1 : year
  const nm = month === 12 ? 1 : month + 1
  return { start: `${year}-${pad(month)}-01`, end: `${ny}-${pad(nm)}-01` }
}

export function inMonth<T extends Pick<FlowTx, 'date'>>(txs: readonly T[], year: number, month: number): T[] {
  const { start, end } = monthBounds(year, month)
  return txs.filter((t) => t.date >= start && t.date < end)
}

export function monthFlow(txs: readonly FlowTx[]): MonthFlow {
  const income = sumFlow(txs, 'income')
  const expense = sumFlow(txs, 'expense')
  const saving = sumFlow(txs, 'saving')
  const investment = sumFlow(txs, 'investment')
  return {
    income, expense, saving, investment,
    net: income - expense - saving - investment,
    savingRate: income > 0 ? ((saving + investment) / income) * 100 : 0,
  }
}
