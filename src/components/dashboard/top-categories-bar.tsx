'use client'

import { formatCurrency } from '@/lib/utils'
import type { Transaction } from '@/types'

export function TopCategoriesBar({ monthTransactions }: { monthTransactions: Transaction[] }) {
  const byCat: Record<string, number> = {}
  for (const t of monthTransactions.filter((t) => t.type === 'expense')) {
    byCat[t.category] = (byCat[t.category] || 0) + t.amount
  }
  const sorted = Object.entries(byCat).sort(([, a], [, b]) => b - a).slice(0, 5)
  const max = sorted[0]?.[1] ?? 1

  return (
    <div className="s-card p-5">
      <p className="eyebrow">Paling Boros</p>
      <h3 className="text-base font-semibold mt-0.5">Top 5 Kategori</h3>
      {sorted.length === 0 ? (
        <div className="flex h-[160px] items-center justify-center text-sm" style={{ color: 'var(--ink-soft)' }}>
          Belum ada pengeluaran.
        </div>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {sorted.map(([cat, amt], i) => {
            const pct = (amt / max) * 100
            return (
              <li key={cat}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-2 font-medium">
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold shrink-0"
                      style={{
                        background: i === 0 ? 'var(--c-coral)' : 'var(--surface-2)',
                        color: i === 0 ? '#FFFFFF' : 'var(--ink-muted)',
                      }}
                    >
                      {i + 1}
                    </span>
                    <span className="truncate">{cat}</span>
                  </span>
                  <span className="num tabular text-[11px] shrink-0 ml-2" style={{ color: 'var(--ink)' }}>
                    {formatCurrency(amt)}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: i === 0 ? 'var(--c-coral)' : 'var(--c-amber)' }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
