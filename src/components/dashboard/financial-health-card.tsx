'use client'

/**
 * Financial Health Score card — fintech v2 design language:
 *   - Soft minimalism: s-card wrapper, soft shadow, generous whitespace
 *   - Typography hierarchy: eyebrow + bold sans display hero number
 *     + JetBrains Mono for indicator scores
 *   - Chip patterns: tone-aware (emerald/amber/coral) soft tints
 *   - Three logical zones: Score (left), Breakdown (middle), Cash Coverage
 *     (right) — equal-height columns
 */

import { Sparkles } from 'lucide-react'
import type { FHSResult, FHSIndicator } from '@/lib/financial-health'
import { formatCurrency } from '@/lib/utils'
import { EduTip } from '@/components/edu/edu-tip'

interface Props {
  result: FHSResult
  /** Liquid balance — for burn rate calc */
  liquidBalance: number
  /** Avg monthly expense — for burn rate calc */
  monthlyExpense: number
}

// Chip color recipes per tier — mirrors the reference handoff palette
function tierChipStyle(color: string): React.CSSProperties {
  return {
    background: `${color}1F`,  // ~12% opacity tint
    color,
  }
}

export function FinancialHealthCard({ result, liquidBalance, monthlyExpense }: Props) {
  const { score, tier, tierMeta, breakdown } = result
  // arcAngle no longer needed — SVG ring uses strokeDasharray instead.

  // Burn rate
  const burnMonths = monthlyExpense > 0 ? liquidBalance / monthlyExpense : 0
  const burnColor = burnMonths >= 6 ? 'var(--c-mint)'
    : burnMonths >= 3 ? 'var(--c-amber)'
    : burnMonths >= 1 ? 'var(--c-coral)'
    : 'var(--c-coral)'
  const burnTint = burnMonths >= 6 ? 'var(--c-mint-soft)'
    : burnMonths >= 3 ? 'var(--c-amber-soft)'
    : 'var(--c-coral-soft)'
  const burnVerdict = burnMonths >= 6 ? 'Sangat aman'
    : burnMonths >= 3 ? 'Cukup aman'
    : burnMonths >= 1 ? 'Tipis'
    : 'Risiko tinggi'

  return (
    <div className="s-card p-6 sm:p-7">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
        {/* ─── Col 1: BIG score centered + tier label below ─────────── */}
        <div className="lg:col-span-4 flex flex-col items-center text-center">
          <div className="flex items-center gap-1.5 mb-4 self-stretch justify-center">
            <p className="eyebrow">Skor Kesehatan Finansial</p>
            <EduTip topic="financial-health" side="bottom" />
          </div>

          <div className="flex flex-col items-center justify-center flex-1">
            {/* SVG ring with thin stroke — Apple Health activity ring style.
                Thin elegant ring + heavy sans-bold number = proportional
                weights, no clash. */}
            <div className="relative shrink-0">
              <svg
                width={192} height={192} viewBox="0 0 192 192"
                className="size-44 sm:size-48 -rotate-90"
              >
                {/* Track (inactive portion) */}
                <circle
                  cx={96} cy={96} r={84}
                  fill="none"
                  stroke="var(--surface-2)"
                  strokeWidth={10}
                />
                {/* Active arc */}
                <circle
                  cx={96} cy={96} r={84}
                  fill="none"
                  stroke={tierMeta.color}
                  strokeWidth={10}
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 84}
                  strokeDashoffset={2 * Math.PI * 84 * (1 - score / 100)}
                  style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                />
              </svg>
              {/* Centered number overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className="leading-none tabular-nums font-bold"
                  style={{
                    fontSize: 64,
                    letterSpacing: '-0.04em',
                    color: tierMeta.color,
                  }}
                >
                  {score}
                </span>
                <span
                  className="text-[11px] mt-1.5 font-medium opacity-50"
                  style={{ color: tierMeta.color }}
                >
                  dari 100
                </span>
              </div>
            </div>

            {/* Tier label DIBAWAH angka per user feedback. Indonesian
                label (Rentan/Bertahan/Sehat/Prima). Description moved
                into the EduTip popover (click ⓘ above). */}
            <div className="mt-4 flex items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                style={tierChipStyle(tierMeta.color)}
              >
                {tierMeta.label}
              </span>
              {tier === 'thriving' && (
                <Sparkles className="size-4" style={{ color: tierMeta.color }} />
              )}
            </div>
          </div>
        </div>

        {/* ─── Col 2: 7-indicator breakdown (flat list, consistent rhythm) ── */}
        <div
          className="lg:col-span-5 lg:border-l lg:border-r lg:px-6 flex flex-col"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <p className="eyebrow mb-4">Breakdown</p>
          <div className="space-y-2.5 flex-1">
            {breakdown.map((ind) => (
              <IndicatorBar key={ind.key} indicator={ind} />
            ))}
          </div>
        </div>

        {/* ─── Col 3: Cash Coverage (BIG hero, fills column) ───────── */}
        <div className="lg:col-span-3 flex flex-col">
          <p className="eyebrow mb-4">Cash Coverage</p>
          <div
            className="rounded-xl p-4 flex-1 flex flex-col"
            style={{
              background: burnTint,
              border: `1px solid ${burnColor}33`,
            }}
          >
            <div className="flex items-baseline gap-1.5">
              <span
                className="num tabular leading-none font-bold"
                style={{
                  color: burnColor,
                  fontSize: 48,
                  letterSpacing: '-0.03em',
                }}
              >
                {burnMonths > 99 ? '99+' : burnMonths.toFixed(1)}
              </span>
              <span
                className="text-sm font-medium"
                style={{ color: burnColor }}
              >
                bulan
              </span>
            </div>

            <p
              className="text-[11px] mt-2 font-semibold uppercase tracking-[0.08em]"
              style={{ color: burnColor }}
            >
              {burnVerdict}
            </p>

            <p
              className="text-[11.5px] mt-2 leading-relaxed"
              style={{ color: 'var(--ink-muted)' }}
            >
              Tanpa pemasukan baru, liquid cash bisa cover{' '}
              <span className="num font-semibold" style={{ color: 'var(--ink)' }}>
                {burnMonths > 99 ? '> 99' : burnMonths.toFixed(1)}
              </span> bulan pengeluaran.
            </p>

            {/* Push detail rows to bottom of panel */}
            <div
              className="mt-auto pt-3 border-t space-y-1.5"
              style={{ borderColor: `${burnColor}20` }}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span style={{ color: 'var(--ink-muted)' }}>Liquid cash</span>
                <span className="num font-semibold" style={{ color: 'var(--ink)' }}>
                  {formatCurrency(liquidBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span style={{ color: 'var(--ink-muted)' }}>Pengeluaran/bln</span>
                <span className="num font-semibold" style={{ color: 'var(--ink)' }}>
                  {formatCurrency(monthlyExpense)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Compact one-line indicator: label + score on top, thin bar below.
 * Hover for full explainer + tip via native browser tooltip.
 */
function IndicatorBar({ indicator }: { indicator: FHSIndicator }) {
  const isNa = indicator.status === 'na'
  const barColor = (() => {
    if (isNa) return 'var(--ink-soft)'
    if (indicator.score >= 75) return 'var(--c-mint)'
    if (indicator.score >= 50) return 'var(--c-amber)'
    return 'var(--c-coral)'
  })()
  const pct = isNa ? 0 : Math.min(100, Math.max(0, indicator.score))

  const tooltip = indicator.tip
    ? `${indicator.explainer}\n\nTip: ${indicator.tip}`
    : indicator.explainer

  return (
    <div title={tooltip} className="cursor-help">
      <div className="flex items-center justify-between text-[12px] mb-1">
        <span style={{ color: 'var(--ink)' }}>
          {indicator.label}
        </span>
        <span
          className="num text-[11px] font-semibold shrink-0"
          style={{ color: isNa ? 'var(--ink-soft)' : barColor }}
        >
          {isNa ? 'N/A' : indicator.score}
        </span>
      </div>
      <div
        className="h-1 w-full rounded-full overflow-hidden"
        style={{ background: 'var(--surface-2)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  )
}
