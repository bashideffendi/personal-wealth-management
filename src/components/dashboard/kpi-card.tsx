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
import { formatCurrency } from '@/lib/utils'
import {
  ArrowDownToLine, ArrowUpFromLine, PiggyBank, ArrowLeftRight,
  TrendingUp, TrendingDown,
} from 'lucide-react'

interface KpiCardProps {
  label: string
  value: number
  note?: string
  /** Perubahan % vs bulan sebelumnya. null/undefined = chip disembunyiin (gak ada baseline / bulan berjalan). */
  deltaPct?: number | null
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

export function KpiCard({ label, value, note, deltaPct, kind }: KpiCardProps) {
  const t = useT()
  const k = kind ?? 'net'

  // Delta chip = perubahan REAL vs bulan lalu (bukan dekorasi statis). Panah =
  // arah nilai (naik/turun); warna = bagus/jelek per jenis KPI (expense naik =
  // jelek/coral; income/saving/net naik = bagus/mint). Disembunyiin kalau 0/null.
  const dp = deltaPct != null && Number.isFinite(deltaPct) ? Math.round(deltaPct) : null
  const showDelta = dp != null && dp !== 0
  const deltaUp = (dp ?? 0) > 0
  const deltaGood = k === 'expense' ? !deltaUp : deltaUp

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
            <span className="sm:hidden">{formatCurrency(value)}</span>
            <span className="hidden sm:inline">{formatCurrency(value)}</span>
          </p>
        </div>

        {/* Delta chip top-right — perubahan vs bulan lalu (real, bukan statis) */}
        {showDelta && (
          <span
            className={`delta-chip ${deltaGood ? 'delta-chip-positive' : 'delta-chip-negative'}`}
            title="Perubahan vs bulan lalu"
          >
            {deltaUp ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
            {deltaUp ? '+' : '−'}{Math.abs(dp as number)}%
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
