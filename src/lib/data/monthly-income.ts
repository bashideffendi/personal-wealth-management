import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * SATU sumber aturan "pemasukan rata-rata per bulan" — dipakai Goals, Net Worth,
 * Utang, dan Dashboard biar angkanya TIDAK beda antar layar.
 *
 * Aturan kanonik (asal: halaman Net Worth & Utang, yang paling teliti):
 *   - type = 'income' dan EXCLUDE kategori 'Transfer' (leg transfer antar
 *     rekening bukan pemasukan — tanpa ini income tergelembung).
 *   - Rata-rata pakai jumlah bulan DISTINCT yang benar-benar ada transaksi
 *     (cap `capMonths`, lantai 1) — BUKAN pembagi tetap /3, biar user yang baru
 *     mulai mencatat 1 bulan tidak terlihat miskin 3x lipat.
 */

export type IncomeRow = { amount: number; date: string }

/** Math murni — testable tanpa DB. Kembalikan 0 kalau tidak ada baris. */
export function averageMonthlyIncome(rows: IncomeRow[], capMonths = 3): number {
  if (!rows.length) return 0
  const total = rows.reduce((s, r) => s + (r.amount || 0), 0)
  const distinctMonths = new Set(
    rows.map((r) => (r.date || '').slice(0, 7)).filter(Boolean),
  ).size
  return total / Math.min(capMonths, Math.max(1, distinctMonths))
}

/**
 * Query kanonik: income non-Transfer `months` bulan terakhir (default 3 ≈ 90
 * hari — sama dengan cutoff Net Worth/Utang) lalu rata-ratakan.
 */
export async function fetchMonthlyIncome(
  supabase: SupabaseClient,
  userId: string,
  { months = 3 }: { months?: number } = {},
): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - months * 30)
  const { data } = await supabase
    .from('transactions')
    .select('amount, date')
    .eq('user_id', userId)
    .eq('type', 'income')
    .neq('category', 'Transfer')
    .gte('date', cutoff.toISOString().slice(0, 10))
  return averageMonthlyIncome((data ?? []) as IncomeRow[], months)
}
