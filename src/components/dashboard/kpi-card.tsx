'use client'

/**
 * KpiCard — Wise-style stat tile per fintech redesign 2026-05-28.
 *
 * Pattern: tone-colored icon kiri-atas + label compact + mono value
 * big + delta chip color-coded. Hover lift. Drop tone dot indicator,
 * drop emoji.
 *
 * Color semantics:
 *   income    → emerald (positive accent)
 *   expense   → coral (negative accent)
 *   saving    → amber (warning/savings tier)
 *   net       → emerald (positive) atau coral (negative)
 */

import { useT } from '@/lib/i18n/context'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import {
  ArrowDownToLine, ArrowUpFromLine, PiggyBank, ArrowLeftRight,
  TrendingUp, TrendingDown,
} from 'lucide-react'

interface KpiCardProps {
  label: string
  value: number
  note?: string
  direction?: 'up' | 'down'
  /** Color identity: tints accent + icon box */
  kind?: 'income' | 'expense' | 'saving' | 'net'
}

const ICON_MAP: Record<NonNullable<KpiCardProps['kind']>, React.ComponentType<{ className?: string }>> = {
  income: ArrowDownToLine,
  expense: ArrowUpFromLine,
  saving: PiggyBank,
  net: ArrowLeftRight,
}

const TONE_MAP: Record<NonNullable<KpiCardProps['kind']>, {
  icon: string
  iconBg: string
}> = {
  income: { icon: 'var(--c-mint)', iconBg: 'var(--c-mint-soft)' },
  expense: { icon: 'var(--c-coral)', iconBg: 'var(--c-coral-soft)' },
  saving: { icon: 'var(--c-amber)', iconBg: 'var(--c-amber-soft)' },
  net: { icon: 'var(--c-mint)', iconBg: 'var(--c-mint-soft)' },
}

export function KpiCard({ label, value, note, direction, kind }: KpiCardProps) {
  const t = useT()
  const k = kind ?? 'net'

  // Net flip to coral when value < 0
  const tone = k === 'net' && value < 0
    ? { icon: 'var(--c-coral)', iconBg: 'var(--c-coral-soft)' }
    : TONE_MAP[k]
  const IconCmp = k === 'net' && value < 0 ? TrendingDown
    : k === 'net' && value >= 0 ? TrendingUp
    : ICON_MAP[k]

  return (
    <article className="stat-tile">
      <div className="flex items-start gap-3">
        {/* Icon box */}
        <div
          className="grid place-items-center shrink-0"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: tone.iconBg,
            color: tone.icon,
          }}
        >
          <IconCmp className="size-4" />
        </div>

        {/* Label + value */}
        <div className="min-w-0 flex-1">
          <p
            className="text-[11px] font-medium leading-tight"
            style={{ color: 'var(--ink-muted)' }}
          >
            {label}
          </p>
          <p
            className="num tabular font-bold mt-1 leading-tight truncate"
            style={{
              fontSize: 22,
              color: 'var(--ink)',
              letterSpacing: '-0.025em',
            }}
          >
            <span className="sm:hidden">{formatCompactCurrency(value)}</span>
            <span className="hidden sm:inline">{formatCurrency(value)}</span>
          </p>
        </div>

        {/* Delta chip top-right */}
        {direction && (
          <span
            className={`delta-chip ${
              direction === 'up' ? 'delta-chip-positive' : 'delta-chip-negative'
            }`}
          >
            {direction === 'up' ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
            {direction === 'up' ? 'naik' : 'turun'}
          </span>
        )}
      </div>

      {/* Note bottom */}
      <p
        className="text-[11px] mt-2.5"
        style={{ color: 'var(--ink-soft)' }}
      >
        {note ?? t('dashboard.current_month')}
      </p>
    </article>
  )
}
