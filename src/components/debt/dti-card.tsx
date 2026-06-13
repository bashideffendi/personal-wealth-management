'use client'

/**
 * DTI / DSR Card — visual indicator of debt burden vs income.
 *
 * Standard rule (CFPB / banks): front-end ≤28%, back-end (total debt) ≤36%.
 * OJK guideline Indonesia: total DSR ≤ 30-35% of take-home is the
 * commonly-cited safe zone.
 *
 * Color zones:
 *   <20%  → Excellent
 *   20-30% → Healthy
 *   30-36% → Caution
 *   36-50% → Warning
 *   >50%   → At Risk
 */

import { TrendingDown, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { EduTip } from '@/components/edu/edu-tip'
import { useT } from '@/lib/i18n/context'

interface Props {
  monthlyIncome: number
  monthlyDebtPayment: number
}

interface Zone {
  label: string
  color: string
  bg: string
  description: string
}

function getZone(ratio: number, hasNoDebt: boolean): Zone {
  if (hasNoDebt) {
    return {
      label: 'Bebas Utang',
      color: 'var(--c-mint)',
      bg: 'rgba(16,185,129,0.10)',
      description: 'Tidak ada utang aktif. Manfaatkan untuk akselerasi investasi.',
    }
  }
  if (ratio < 0.20) return {
    label: 'Excellent',
    color: 'var(--c-mint)',
    bg: 'rgba(16,185,129,0.10)',
    description: 'Cicilan sangat aman, ada banyak ruang untuk goals lain.',
  }
  if (ratio < 0.30) return {
    label: 'Healthy',
    color: 'var(--c-mint)',
    bg: 'rgba(16,185,129,0.10)',
    description: 'Cicilan masih sehat — di bawah ambang OJK 30%.',
  }
  if (ratio < 0.36) return {
    label: 'Caution',
    color: 'var(--c-amber)',
    bg: 'rgba(245,158,11,0.12)',
    description: 'Mendekati batas standar (36%). Hindari ambil cicilan baru.',
  }
  if (ratio < 0.50) return {
    label: 'Warning',
    color: '#EA580C',
    bg: 'rgba(234,88,12,0.10)',
    description: 'Di atas ambang sehat. Pertimbangkan refinance/konsolidasi.',
  }
  return {
    label: 'At Risk',
    color: 'var(--c-coral)',
    bg: 'rgba(244,63,94,0.10)',
    description: 'Cicilan >50% income. Risiko tinggi — prioritas pelunasan utang.',
  }
}

export function DTICard({ monthlyIncome, monthlyDebtPayment }: Props) {
  const t = useT()
  const hasNoDebt = monthlyDebtPayment === 0
  const ratio = monthlyIncome > 0 ? monthlyDebtPayment / monthlyIncome : 0
  const zone = getZone(ratio, hasNoDebt)

  // Position the marker on a 0-50% scale so all zones are visible.
  // Cap visual at 60% to keep marker on bar even for >50% ratio.
  const visualPct = Math.min(60, ratio * 100)
  const markerPos = (visualPct / 60) * 100

  return (
    <div
      className="rounded-2xl border p-5 sm:p-6"
      style={{
        boxShadow: 'var(--card-shadow)', background: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="eyebrow flex items-center gap-1.5">
            DTI / DSR
            <EduTip topic="dti-ratio" side="bottom" />
          </p>
          <h3 className="text-xl font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
            {t('dti.title')}
          </h3>
        </div>
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide shrink-0"
          style={{ background: zone.bg, color: zone.color }}
        >
          {ratio >= 0.36 && !hasNoDebt && <AlertTriangle className="size-3" />}
          {ratio < 0.20 && !hasNoDebt && <TrendingDown className="size-3" />}
          {zone.label}
        </span>
      </div>

      {/* Big ratio number */}
      <div className="flex items-baseline gap-2 mb-1">
        <p
          className="num tabular text-4xl sm:text-5xl font-bold leading-none"
          style={{ color: zone.color }}
        >
          {hasNoDebt ? '0' : (ratio * 100).toFixed(1)}
          <span className="text-2xl ml-1">%</span>
        </p>
        {!hasNoDebt && monthlyIncome > 0 && (
          <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
            {t('dti.ofIncome')}
          </p>
        )}
      </div>

      {/* Visual zone bar */}
      <div className="mt-4 mb-2">
        <div
          className="relative h-3 rounded-full overflow-hidden"
          style={{
            background: 'linear-gradient(90deg, var(--c-mint) 0%, var(--c-mint) 33%, var(--c-amber) 50%, var(--c-amber) 60%, var(--c-coral) 80%, var(--c-coral) 100%)',
          }}
        >
          {/* Marker */}
          {!hasNoDebt && monthlyIncome > 0 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 size-4 rounded-full border-2 border-white shadow-[var(--card-shadow)] transition-all duration-700"
              style={{
                left: `calc(${markerPos}% - 8px)`,
                background: zone.color,
              }}
            />
          )}
        </div>
        {/* Zone labels */}
        <div className="flex justify-between mt-1.5 text-[10px]" style={{ color: 'var(--ink-soft)' }}>
          <span>0%</span>
          <span style={{ marginLeft: '50%', transform: 'translateX(-50%)' }}>30%</span>
          <span>60%+</span>
        </div>
      </div>

      <p className="text-xs leading-relaxed mt-3" style={{ color: 'var(--ink-muted)' }}>
        {zone.description}
      </p>

      {/* Detail breakdown */}
      {!hasNoDebt && monthlyIncome > 0 && (
        <div
          className="mt-4 pt-3 border-t grid grid-cols-2 gap-3 text-[11px]"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <div>
            <p style={{ color: 'var(--ink-soft)' }}>{t('dti.monthlyPayment')}</p>
            <p className="num font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
              {formatCurrency(monthlyDebtPayment)}
            </p>
          </div>
          <div>
            <p style={{ color: 'var(--ink-soft)' }}>{t('dti.monthlyIncome')}</p>
            <p className="num font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
              {formatCurrency(monthlyIncome)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
