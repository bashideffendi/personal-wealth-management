'use client'

import { formatCurrency } from '@/lib/utils'

interface SavingRateRingProps {
  savingRate: number
  income: number
  savings: number
}

export function SavingRateRing({ savingRate, income, savings }: SavingRateRingProps) {
  const rateCapped = Math.min(100, Math.max(0, savingRate))
  const circumference = 2 * Math.PI * 44
  const offset = circumference - (rateCapped / 100) * circumference
  const color = savingRate >= 20 ? 'var(--c-mint)' : savingRate >= 10 ? 'var(--c-amber)' : 'var(--c-coral)'
  const verdict = savingRate >= 30 ? 'Excellent'
    : savingRate >= 20 ? 'Sehat'
    : savingRate >= 10 ? 'Cukup'
    : savingRate > 0 ? 'Rendah'
    : 'Negatif'

  return (
    <div className="s-card p-5">
      <p className="caps">Saving Rate</p>
      <h3 className="text-base font-semibold mt-0.5">Tabungan / Pemasukan</h3>
      <div className="mt-4 flex items-center gap-4">
        <div className="relative shrink-0">
          <svg width={110} height={110} viewBox="0 0 110 110">
            <circle
              cx={55} cy={55} r={44}
              fill="none"
              stroke="var(--surface-2)"
              strokeWidth={10}
            />
            <circle
              cx={55} cy={55} r={44}
              fill="none"
              stroke={color}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 55 55)"
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="num text-2xl font-bold tabular" style={{ color }}>
              {savingRate.toFixed(0)}%
            </span>
            <span className="text-[10px] font-semibold" style={{ color: 'var(--ink-muted)' }}>
              {verdict}
            </span>
          </div>
        </div>
        <div className="flex-1 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--ink-muted)' }}>Pemasukan</span>
            <span className="num tabular font-semibold" style={{ color: 'var(--ink)' }}>
              {formatCurrency(income)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--ink-muted)' }}>Ditabung</span>
            <span className="num tabular font-semibold" style={{ color: 'var(--c-mint)' }}>
              {formatCurrency(savings)}
            </span>
          </div>
          <div className="pt-2 border-t text-[10px]" style={{ color: 'var(--ink-soft)', borderColor: 'var(--border-soft)' }}>
            Target sehat: <span className="font-semibold">≥ 20%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
