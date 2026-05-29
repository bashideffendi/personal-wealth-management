'use client'

/**
 * "Hari ini" — strip widget yang ringkas state finansial hari ini.
 *
 * Format: 3 stat (spend today, top kategori, transaksi count) + optional
 * 1 actionable warning (budget kategori paling kepake).
 *
 * Hides kalau hari ini gak ada transaksi sama sekali — biar dashboard gak
 * keisi widget kosong di pagi-pagi sebelum user buka dompet.
 */

import Link from 'next/link'
import { ArrowRight, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Tx {
  type: 'income' | 'expense' | 'saving' | 'investment'
  category: string
  amount: number
  date: string  // ISO date
}

interface Budget {
  category: string
  type: 'income' | 'expense' | 'saving' | 'investment'
  amount: number
}

interface TodayStripProps {
  /** Transaksi bulan ini (untuk derive "hari ini" + budget usage). */
  monthTransactions: Tx[]
  /** Anggaran kategori bulan ini. Optional — kalau kosong, warning di-skip. */
  monthBudgets?: Budget[]
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

export function TodayStrip({ monthTransactions, monthBudgets = [] }: TodayStripProps) {
  // ─── Today's transactions ──────────────────────────────────────
  const today = monthTransactions.filter((t) => isToday(t.date))
  if (today.length === 0) return null

  const spendToday = today
    .filter((t) => t.type === 'expense' && t.category !== 'Transfer')
    .reduce((s, t) => s + t.amount, 0)

  // Top category today (excluding transfers)
  const todayByCategory = new Map<string, number>()
  for (const t of today) {
    if (t.type !== 'expense') continue
    if (t.category === 'Transfer') continue
    todayByCategory.set(t.category, (todayByCategory.get(t.category) ?? 0) + t.amount)
  }
  const topToday = [...todayByCategory.entries()].sort((a, b) => b[1] - a[1])[0]

  // ─── Budget warning ────────────────────────────────────────────
  // Find the most "burned" expense category — highest % of budget used.
  // Only surfaces when >= 70% used (close to limit).
  let warning: { category: string; pct: number; used: number; budget: number } | null = null
  if (monthBudgets.length > 0) {
    const expenseBudgets = monthBudgets.filter((b) => b.type === 'expense' && b.amount > 0)
    const monthByCategory = new Map<string, number>()
    for (const t of monthTransactions) {
      if (t.type !== 'expense' || t.category === 'Transfer') continue
      monthByCategory.set(t.category, (monthByCategory.get(t.category) ?? 0) + t.amount)
    }
    let topPct = 0
    for (const b of expenseBudgets) {
      const used = monthByCategory.get(b.category) ?? 0
      const pct = (used / b.amount) * 100
      if (pct > topPct && pct >= 70) {
        topPct = pct
        warning = { category: b.category, pct, used, budget: b.amount }
      }
    }
  }

  return (
    <section
      className="rounded-2xl border overflow-hidden"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
      aria-label="Ringkasan hari ini"
    >
      <div className="px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <span
            className="text-[10px] uppercase font-semibold tracking-[0.10em]"
            style={{ color: 'var(--ink-soft)' }}
          >
            Hari ini
          </span>
          <Link
            href="/dashboard/transactions"
            className="text-[11px] font-medium hover:underline inline-flex items-center gap-0.5"
            style={{ color: 'var(--c-mint)' }}
          >
            Lihat semua
            <ArrowRight className="size-3" />
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Stat
            label="Total spending"
            value={spendToday > 0 ? formatCurrency(spendToday) : 'Rp 0'}
            tint="var(--c-coral)"
          />
          <Stat
            label="Top kategori"
            value={topToday ? topToday[0] : '—'}
            sub={topToday ? formatCurrency(topToday[1]) : undefined}
            tint="var(--ink)"
          />
          <Stat
            label="Transaksi"
            value={`${today.length}`}
            sub={today.length === 1 ? 'tercatat' : 'tercatat'}
            tint="var(--ink)"
          />
        </div>
      </div>

      {warning && (
        <Link
          href="/dashboard/budgeting"
          className="flex items-center gap-2.5 px-4 py-2.5 sm:px-5 border-t transition hover:bg-[var(--surface-2)]"
          style={{
            borderColor: 'var(--border-soft)',
            background: 'color-mix(in srgb, var(--amber-500) 8%, transparent)',
          }}
        >
          <AlertTriangle
            className="size-4 shrink-0"
            style={{ color: 'var(--amber-700)' }}
          />
          <p className="flex-1 text-xs sm:text-sm" style={{ color: 'var(--ink)' }}>
            <strong className="font-semibold">{warning.category}</strong>{' '}
            <span style={{ color: 'var(--ink-muted)' }}>udah pakai</span>{' '}
            <span className="num font-semibold" style={{ color: 'var(--amber-700)' }}>
              {Math.round(warning.pct)}%
            </span>{' '}
            <span style={{ color: 'var(--ink-muted)' }}>
              dari anggaran ({formatCurrency(warning.used)} dari{' '}
              {formatCurrency(warning.budget)})
            </span>
          </p>
          <ArrowRight className="size-3.5 shrink-0" style={{ color: 'var(--ink-muted)' }} />
        </Link>
      )}
    </section>
  )
}

function Stat({
  label,
  value,
  sub,
  tint,
}: {
  label: string
  value: string
  sub?: string
  tint: string
}) {
  return (
    <div className="min-w-0">
      <p
        className="text-[10px] uppercase tracking-[0.08em] font-medium truncate"
        style={{ color: 'var(--ink-soft)' }}
      >
        {label}
      </p>
      <p
        className="num font-bold text-base sm:text-lg mt-0.5 truncate"
        style={{ color: tint, letterSpacing: '-0.015em' }}
      >
        {value}
      </p>
      {sub && (
        <p
          className="text-[11px] mt-0.5 truncate"
          style={{ color: 'var(--ink-muted)' }}
        >
          {sub}
        </p>
      )}
    </div>
  )
}
