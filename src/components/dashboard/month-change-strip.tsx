'use client'

/**
 * "Apa yang berubah bulan ini" — compares this month's expense by category
 * against the running 3-month average. Surfaces 1-2 concrete diffs.
 *
 * Why not a long insight list? The dashboard already has AI insights below.
 * This strip is the fast, deterministic answer to "did my spending shift?"
 * without burning AI credits — pure aggregation.
 *
 * Hides when there's no meaningful diff or not enough prior data.
 */

import { TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Tx {
  type: 'income' | 'expense' | 'saving' | 'investment'
  category: string
  amount: number
  date: string
}

interface MonthChangeStripProps {
  /** Transaksi di bulan ini (sampai hari ini). */
  currentMonthTx: Tx[]
  /** Transaksi 3 bulan SEBELUMNYA (tidak termasuk bulan ini). */
  priorMonthsTx: Tx[]
  /** Jumlah bulan prior — default 3. */
  priorMonthCount?: number
  /** Minimum absolute Rp diff per kategori untuk dianggap signifikan. */
  minAbsThreshold?: number
}

function aggregateExpenseByCategory(txs: Tx[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const t of txs) {
    if (t.type !== 'expense') continue
    // Skip "Transfer" pseudo-category — internal moves, not real spending
    if (t.category === 'Transfer') continue
    m.set(t.category, (m.get(t.category) ?? 0) + t.amount)
  }
  return m
}

export function MonthChangeStrip({
  currentMonthTx,
  priorMonthsTx,
  priorMonthCount = 3,
  minAbsThreshold = 50_000,
}: MonthChangeStripProps) {
  // Need both: at least one current expense AND prior baseline.
  // (If user is brand new with only 1 month of data, this widget hides.)
  if (currentMonthTx.length === 0 || priorMonthsTx.length === 0) return null
  if (priorMonthCount < 1) return null

  const current = aggregateExpenseByCategory(currentMonthTx)
  const priorTotal = aggregateExpenseByCategory(priorMonthsTx)

  // Monthly average from prior period
  const priorAvg = new Map<string, number>()
  for (const [cat, total] of priorTotal) priorAvg.set(cat, total / priorMonthCount)

  // Compute diff per category. Include cats only in prior (might be "dropped") and only in current (new spend).
  const diffs: Array<{ category: string; cur: number; avg: number; abs: number; pct: number }> = []
  const allCats = new Set<string>([...current.keys(), ...priorAvg.keys()])
  for (const cat of allCats) {
    const cur = current.get(cat) ?? 0
    const avg = priorAvg.get(cat) ?? 0
    const abs = cur - avg
    if (Math.abs(abs) < minAbsThreshold) continue
    const pct = avg > 0 ? (abs / avg) * 100 : (cur > 0 ? 100 : 0)
    diffs.push({ category: cat, cur, avg, abs, pct })
  }
  if (diffs.length === 0) return null

  diffs.sort((a, b) => Math.abs(b.abs) - Math.abs(a.abs))
  const top = diffs[0]
  const second = diffs[1]

  return (
    <section
      className="rounded-2xl border px-4 py-3 sm:px-5 sm:py-3.5"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
      aria-label="Perubahan bulan ini dibanding 3 bulan terakhir"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="text-[10px] uppercase font-semibold tracking-[0.10em]"
          style={{ color: 'var(--ink-soft)' }}
        >
          Apa yang berubah bulan ini
        </span>
        <span
          className="text-[10px]"
          style={{ color: 'var(--ink-soft)' }}
        >
          · vs rata-rata {priorMonthCount} bulan
        </span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <ChangeRow row={top} />
        {second && (
          <>
            <span
              className="hidden sm:inline-block h-4 w-px"
              style={{ background: 'var(--border)' }}
            />
            <ChangeRow row={second} dimmed />
          </>
        )}
      </div>
    </section>
  )
}

function ChangeRow({
  row,
  dimmed = false,
}: {
  row: { category: string; cur: number; avg: number; abs: number; pct: number }
  dimmed?: boolean
}) {
  const up = row.abs > 0
  const Icon = up ? TrendingUp : TrendingDown
  const colorVar = up ? 'var(--c-coral)' : 'var(--c-mint)'
  const bgTint = up ? 'rgba(244,63,94,0.10)' : 'rgba(16,185,129,0.12)'
  const sign = up ? '+' : '−'

  return (
    <div
      className="flex items-center gap-2.5 min-w-0"
      style={{ opacity: dimmed ? 0.85 : 1 }}
    >
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-md"
        style={{ background: bgTint, color: colorVar }}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>
          {row.category}{' '}
          <span className="num font-bold" style={{ color: colorVar }}>
            {sign}
            {formatCurrency(Math.round(Math.abs(row.abs)))}
          </span>
        </p>
        <p className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
          {row.avg > 0
            ? `${sign}${Math.abs(Math.round(row.pct))}% · rata-rata ${formatCurrency(
                Math.round(row.avg),
              )}/bulan`
            : 'Kategori baru bulan ini'}
        </p>
      </div>
    </div>
  )
}
