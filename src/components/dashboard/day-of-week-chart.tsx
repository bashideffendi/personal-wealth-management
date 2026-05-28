'use client'

import { formatCurrency } from '@/lib/utils'
import { usePrivacy } from '@/components/privacy/privacy-provider'
import type { Transaction } from '@/types'

export function DayOfWeekChart({ monthTransactions }: { monthTransactions: Transaction[] }) {
  const { hidden: privacyHidden } = usePrivacy()
  const labels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
  const sums = [0, 0, 0, 0, 0, 0, 0]
  const counts = [0, 0, 0, 0, 0, 0, 0]
  for (const t of monthTransactions.filter((t) => t.type === 'expense')) {
    const d = new Date(t.date).getDay()
    sums[d] += t.amount
    counts[d]++
  }
  const averages = sums.map((s, i) => (counts[i] > 0 ? s / counts[i] : 0))
  const max = Math.max(...sums, 1)
  const maxIdx = sums.indexOf(Math.max(...sums))

  return (
    <div className="kl-card p-5">
      <p className="caps">Pola Harian</p>
      <h3 className="text-base font-semibold mt-0.5">Pengeluaran per Hari</h3>
      <div className="mt-4 flex items-end justify-between gap-2 h-[140px]">
        {labels.map((lbl, i) => {
          const h = (sums[i] / max) * 100
          const isPeak = i === maxIdx && sums[i] > 0
          return (
            <div key={lbl} className="flex-1 flex flex-col items-center gap-1.5 h-full">
              <div className="flex-1 w-full flex items-end">
                <div
                  className="w-full rounded-t transition-all"
                  style={{
                    height: `${Math.max(h, 2)}%`,
                    background: isPeak ? 'var(--ink)' : 'var(--c-primary)',
                    minHeight: sums[i] > 0 ? 4 : 0,
                  }}
                  title={privacyHidden ? lbl : `${lbl}: ${formatCurrency(sums[i])} total, ${formatCurrency(averages[i])} rata-rata`}
                />
              </div>
              <span className="text-[10px] font-semibold" style={{ color: isPeak ? 'var(--ink)' : 'var(--ink-muted)' }}>
                {lbl}
              </span>
            </div>
          )
        })}
      </div>
      {sums.some((s) => s > 0) && (
        <p className="text-[11px] mt-3 pt-3 border-t" style={{ color: 'var(--ink-soft)', borderColor: 'var(--border-soft)' }}>
          Paling boros: <span className="font-semibold" style={{ color: 'var(--ink)' }}>{labels[maxIdx]}</span> ·{' '}
          <span className="num">{formatCurrency(sums[maxIdx])}</span>
        </p>
      )}
    </div>
  )
}
