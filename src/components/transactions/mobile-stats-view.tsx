'use client'

/**
 * MobileStatsView — panel "Statistik" halaman Transaksi (F13c, mobile-only).
 * Muncul saat toggle Catatan|Statistik di posisi Statistik; isi 3 kartu:
 *   1. Sankey aliran uang bulan kalender aktif (reuse MoneyFlowSankey compact).
 *   2. Kategori pengeluaran — donut + list share per kategori (toggle % | Rp).
 *   3. Ringkas: Pemasukan vs Pengeluaran bulan itu.
 *
 * Terima transaksi yang SUDAH difilter ke bulan aktif; agregasi internal
 * pakai useMemo. Rollup subkategori ke induk via rootCategory (SUB_SEP) —
 * konsisten sama Beranda/Anggaran. Kategori 'Transfer' di-skip (bukan flow).
 */

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import { useT } from '@/lib/i18n/context'
import { rootCategory } from '@/lib/budget-categories'
import { categoryHue } from '@/lib/category-hue'
import type { Transaction } from '@/types'
import type { FlowKind } from '@/components/dashboard/money-flow-sankey'

// Recharts cuma ke-load pas panel Statistik dibuka (pola dashboard/page.tsx).
const MoneyFlowSankey = dynamic(
  () => import('@/components/dashboard/money-flow-sankey').then((m) => m.MoneyFlowSankey),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse rounded-lg" style={{ height: 300, background: 'var(--surface-2)' }} aria-hidden="true" />
    ),
  },
)

interface CatRow {
  name: string
  amount: number
  share: number // 0..1 dari total expense
  bar: string   // warna hue terang (dot/bar/donut — bukan teks)
}

const OTHERS_BAR = 'color-mix(in srgb, var(--ink) 22%, transparent)'

export function MobileStatsView({
  transactions,
  monthLabel,
}: {
  /** Transaksi bulan kalender aktif (sudah difilter di caller). */
  transactions: Transaction[]
  monthLabel: string
}) {
  const t = useT()
  const [catMode, setCatMode] = useState<'pct' | 'rp'>('pct')

  const stats = useMemo(() => {
    // Agregasi per kategori INDUK per tipe — 'Transfer' bukan aliran nyata.
    function bucket(kind: 'income' | 'expense' | 'saving' | 'investment') {
      const byCat: Record<string, number> = {}
      for (const tx of transactions) {
        if (tx.type !== kind || tx.category === 'Transfer') continue
        const root = rootCategory((tx.category || 'Lainnya').trim() || 'Lainnya')
        byCat[root] = (byCat[root] || 0) + tx.amount
      }
      return Object.entries(byCat)
        .map(([name, amount]) => ({ name, amount, kind: kind as FlowKind }))
        .sort((a, b) => b.amount - a.amount)
    }

    const income = bucket('income')
    const expense = bucket('expense')
    const saving = bucket('saving')
    const investment = bucket('investment')

    const totalIncome = income.reduce((s, c) => s + c.amount, 0)
    const totalExpense = expense.reduce((s, c) => s + c.amount, 0)

    // Donut + list: top-6 expense, sisanya digabung jadi baris abu "lainnya".
    const top = expense.slice(0, 6)
    const rest = expense.slice(6)
    const restSum = rest.reduce((s, c) => s + c.amount, 0)
    const catRows: CatRow[] = top.map((c) => ({
      name: c.name,
      amount: c.amount,
      share: totalExpense > 0 ? c.amount / totalExpense : 0,
      bar: categoryHue(c.name).bar,
    }))
    if (restSum > 0) {
      catRows.push({
        name: `+${rest.length} ${t('dashboard.others')}`,
        amount: restSum,
        share: totalExpense > 0 ? restSum / totalExpense : 0,
        bar: OTHERS_BAR,
      })
    }

    return {
      income,
      outflow: [...expense, ...saving, ...investment],
      totalIncome,
      totalExpense,
      catRows,
    }
  }, [transactions, t])

  // Geometri donut — stroke circle + dasharray per slice, mulai jam 12.
  const R = 40
  const SW = 13
  const C = 2 * Math.PI * R
  // Offset kumulatif per slice tanpa mutasi closure saat render (React
  // Compiler immutability) — start = jumlah share slice-slice sebelumnya.
  const slices = stats.catRows.map((row, i) => ({
    ...row,
    start: stats.catRows.slice(0, i).reduce((s, r) => s + r.share, 0),
  }))

  return (
    <div className="space-y-4">
      {/* ── Kartu 1: Sankey aliran uang ──────────────────────────── */}
      <div className="s-card s-card-pad">
        <p className="eyebrow">{monthLabel}</p>
        <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>{t('dashboard.money_flow')}</h3>
        <div className="mt-2">
          <MoneyFlowSankey
            income={stats.income}
            outflow={stats.outflow}
            compact
            height={300}
            emptyMessage={t('dashboard.sankey_empty')}
          />
        </div>
      </div>

      {/* ── Kartu 2: Kategori pengeluaran (donut + list) ─────────── */}
      <div className="s-card s-card-pad">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">{t('transactions.summary_expense')}</p>
            <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>{t('transactions.col_category')}</h3>
          </div>
          {/* Toggle % | Rp — ganti tampilan nilai per baris */}
          <div className="flex items-center rounded-full p-0.5 shrink-0" style={{ background: 'var(--surface-2)' }}>
            {(['pct', 'rp'] as const).map((mo) => (
              <button
                key={mo}
                type="button"
                onClick={() => setCatMode(mo)}
                aria-pressed={catMode === mo}
                className="num rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors"
                style={catMode === mo
                  ? { background: 'var(--ink)', color: 'var(--surface)' }
                  : { color: 'var(--ink-soft)' }}
              >
                {mo === 'pct' ? '%' : 'Rp'}
              </button>
            ))}
          </div>
        </div>

        {stats.catRows.length === 0 ? (
          <p className="text-[13px] text-center py-8" style={{ color: 'var(--ink-soft)' }}>
            {t('dashboard.sankey_empty')}
          </p>
        ) : (
          <>
            {/* Donut sederhana — stroke dasharray per kategori, total di tengah */}
            <div className="flex justify-center mt-3">
              <div className="relative" style={{ width: 130, height: 130 }}>
                <svg viewBox="0 0 100 100" width="130" height="130" role="img" aria-label={t('transactions.col_category')}>
                  <circle cx="50" cy="50" r={R} fill="none" stroke="var(--surface-2)" strokeWidth={SW} />
                  {slices.map((s) => (
                    <circle
                      key={s.name}
                      cx="50"
                      cy="50"
                      r={R}
                      fill="none"
                      stroke={s.bar}
                      strokeWidth={SW}
                      strokeDasharray={`${Math.max(s.share * C - 1, 0)} ${C}`}
                      strokeDashoffset={-s.start * C}
                      transform="rotate(-90 50 50)"
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="text-[9px]" style={{ color: 'var(--ink-soft)' }}>{t('transactions.total')}</p>
                    <p className="num tabular text-[13px] font-semibold" title={formatCurrency(stats.totalExpense)} style={{ color: 'var(--ink)' }}>
                      {formatCompactCurrency(stats.totalExpense)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* List per kategori: dot + nama + bar share + nilai (%/Rp) */}
            <div className="mt-3 space-y-2.5">
              {stats.catRows.map((row) => (
                <div key={row.name} className="flex items-center gap-2.5">
                  <span className="size-2 rounded-full shrink-0" style={{ background: row.bar }} />
                  <span className="text-[12.5px] font-medium truncate" style={{ color: 'var(--ink)', width: 108 }}>
                    {row.name}
                  </span>
                  <span className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: 'var(--surface-2)' }}>
                    <span className="block h-full rounded-full" style={{ width: `${Math.min(row.share * 100, 100)}%`, background: row.bar }} />
                  </span>
                  <span
                    className="num tabular text-[12px] font-semibold text-right shrink-0"
                    style={{ color: 'var(--ink)', minWidth: 56 }}
                    title={formatCurrency(row.amount)}
                  >
                    {catMode === 'pct'
                      ? `${(row.share * 100).toFixed(row.share * 100 >= 10 ? 0 : 1)}%`
                      : formatCompactCurrency(row.amount)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Kartu 3: Ringkas masuk vs keluar ─────────────────────── */}
      <div className="s-card s-card-pad">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{t('transactions.summary_income')}</p>
            <p
              className="num tabular text-[17px] font-semibold mt-0.5"
              title={formatCurrency(stats.totalIncome)}
              style={{ color: 'var(--c-mint-ink)', letterSpacing: '-0.02em' }}
            >
              {formatCompactCurrency(stats.totalIncome)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{t('transactions.summary_expense')}</p>
            <p
              className="num tabular text-[17px] font-semibold mt-0.5"
              title={formatCurrency(stats.totalExpense)}
              style={{ color: 'var(--c-coral-ink)', letterSpacing: '-0.02em' }}
            >
              {formatCompactCurrency(stats.totalExpense)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
