'use client'

/**
 * KpiCard — editorial StatsRowA tile per design handoff (2026-05-28).
 *
 * Pattern: tone dot di kiri-atas + label + value besar tabular + sub
 * note dengan accent color. Icon box di kanan-atas dengan soft bg.
 * Hover lift shadow ke shadow-lg, transition 150ms.
 *
 * Color tones (semantic):
 *   income   → mint    (income/surplus/sehat)
 *   expense  → coral   (expense/defisit/warning)
 *   saving   → amber   (streak/perhatian/savings tier)
 *   net      → primary (akumulasi/arus kas bersih) → coral kalau negatif
 */

import { useT } from '@/lib/i18n/context'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import {
  ArrowDownToLine, ArrowUpFromLine, Wallet, TrendingUp, TrendingDown, ArrowLeftRight,
} from 'lucide-react'

interface KpiCardProps {
  label: string
  value: number
  note?: string
  direction?: 'up' | 'down'
  /** Color identity: tints accent + tone dot + icon box */
  kind?: 'income' | 'expense' | 'saving' | 'net'
}

const ICONS: Record<NonNullable<KpiCardProps['kind']>, React.ComponentType<{ className?: string }>> = {
  income: ArrowDownToLine,
  expense: ArrowUpFromLine,
  saving: Wallet,
  net: ArrowLeftRight,
}

export function KpiCard({ label, value, note, direction, kind }: KpiCardProps) {
  const t = useT()

  // Tone token mapping per kind (semantic editorial accents)
  const tone = (() => {
    if (kind === 'income') return 'mint'
    if (kind === 'expense') return 'coral'
    if (kind === 'saving') return 'amber'
    if (kind === 'net') return value >= 0 ? 'primary' : 'coral'
    return 'primary'
  })()

  const IconCmp = kind ? ICONS[kind] : ArrowLeftRight
  // Net negative → flip ke TrendingDown
  const IconResolved = kind === 'net' && value < 0 ? TrendingDown : kind === 'net' ? TrendingUp : IconCmp

  return (
    <article
      className="kl-card transition-shadow"
      style={{
        padding: 18,
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-card)'
      }}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 2,
                background: `var(--c-${tone})`,
              }}
            />
            <p
              style={{
                fontSize: 11,
                color: 'var(--text-mute)',
                fontWeight: 600,
              }}
            >
              {label}
            </p>
          </div>
          <p
            className="kl-num mt-2"
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '-0.02em',
            }}
          >
            <span className="sm:hidden">{formatCompactCurrency(value)}</span>
            <span className="hidden sm:inline">{formatCurrency(value)}</span>
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            {direction && (
              <span
                className="kl-num"
                style={{ fontSize: 11, color: `var(--c-${tone})`, fontWeight: 700 }}
              >
                {direction === 'up' ? '↑' : '↓'}
              </span>
            )}
            <span style={{ fontSize: 11, color: 'var(--text-mute)' }}>
              {note ?? t('dashboard.current_month')}
            </span>
          </div>
        </div>
        <div
          className="grid place-items-center shrink-0"
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: `var(--c-${tone}-soft)`,
            color: `var(--c-${tone})`,
          }}
        >
          <IconResolved className="size-[15px]" />
        </div>
      </div>
    </article>
  )
}
