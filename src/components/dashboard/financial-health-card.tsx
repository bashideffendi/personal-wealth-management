'use client'

/**
 * Financial Health Score card — applies PWM Redesign v2 design language:
 *   - Soft minimalism: s-card wrapper, soft shadow, generous whitespace
 *   - Typography hierarchy: caps eyebrow + Instrument Serif italic hero
 *     number + JetBrains Mono for indicator scores
 *   - Chip patterns from design handoff (emerald/amber/coral tints)
 *   - Three logical zones: Score (left), Breakdown (middle), Cash Coverage
 *     (right) — equal-height columns
 *
 * Reference: design handoff 03-component-patterns.md (KPIStat, Chip,
 * Card patterns) + dashboard-refine.jsx visual style.
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
  const arcAngle = (score / 100) * 360

  // Burn rate
  const burnMonths = monthlyExpense > 0 ? liquidBalance / monthlyExpense : 0
  const burnColor = burnMonths >= 6 ? 'var(--emerald-600)'
    : burnMonths >= 3 ? 'var(--amber-600)'
    : burnMonths >= 1 ? 'var(--coral-600)'
    : 'var(--coral-700)'
  const burnTint = burnMonths >= 6 ? 'var(--emerald-50)'
    : burnMonths >= 3 ? 'var(--amber-50)'
    : 'var(--coral-50)'
  const burnVerdict = burnMonths >= 6 ? 'Sangat aman'
    : burnMonths >= 3 ? 'Cukup aman'
    : burnMonths >= 1 ? 'Tipis'
    : 'Risiko tinggi'

  return (
    <div className="s-card p-6 sm:p-7">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
        {/* ─── Col 1: Hero score (BIG italic number) ─────────────── */}
        <div className="lg:col-span-4 flex flex-col">
          <div className="flex items-center gap-1.5 mb-4">
            <p className="caps">Skor Kesehatan Finansial</p>
            <EduTip topic="financial-health" side="bottom" />
          </div>

          <div className="flex items-center gap-5 flex-1">
            {/* Score ring with conic-gradient arc */}
            <div className="relative shrink-0">
              <div
                className="size-32 sm:size-36 rounded-full flex items-center justify-center"
                style={{
                  background: `conic-gradient(${tierMeta.color} ${arcAngle}deg, var(--surface-2) 0deg)`,
                }}
              >
                <div
                  className="size-[80%] rounded-full flex flex-col items-center justify-center"
                  style={{ background: 'var(--surface)' }}
                >
                  {/* Hero number — .num (JetBrains Mono) per actual mockup.
                      Italic serif reserved for text moments (empty states,
                      taglines), not numbers. */}
                  <span
                    className="num tabular leading-none font-bold"
                    style={{
                      color: tierMeta.color,
                      fontSize: 60,
                      letterSpacing: '-0.04em',
                    }}
                  >
                    {score}
                  </span>
                  <span
                    className="text-[10px] uppercase tracking-wider mt-1 font-semibold"
                    style={{ color: 'var(--ink-soft)' }}
                  >
                    /100
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                {/* Chip pattern from 03-component-patterns.md § Chip */}
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.06em]"
                  style={tierChipStyle(tierMeta.color)}
                >
                  {tierMeta.label}
                </span>
                {tier === 'thriving' && (
                  <Sparkles className="size-3.5" style={{ color: tierMeta.color }} />
                )}
              </div>
              <p
                className="text-[13px] leading-[1.5]"
                style={{ color: 'var(--ink-muted)' }}
              >
                {tierMeta.description}
              </p>
            </div>
          </div>
        </div>

        {/* ─── Col 2: 7-indicator breakdown (flat list, consistent rhythm) ── */}
        <div
          className="lg:col-span-5 lg:border-l lg:border-r lg:px-6 flex flex-col"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <p className="caps mb-4">Breakdown</p>
          <div className="space-y-2.5 flex-1">
            {breakdown.map((ind) => (
              <IndicatorBar key={ind.key} indicator={ind} />
            ))}
          </div>
        </div>

        {/* ─── Col 3: Cash Coverage (BIG hero, fills column) ───────── */}
        <div className="lg:col-span-3 flex flex-col">
          <p className="caps mb-4">Cash Coverage</p>
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
    if (indicator.score >= 75) return 'var(--emerald-500)'
    if (indicator.score >= 50) return 'var(--amber-500)'
    return 'var(--coral-500)'
  })()
  const pct = isNa ? 0 : Math.min(100, Math.max(0, indicator.score))

  const tooltip = indicator.tip
    ? `${indicator.explainer}\n\n💡 ${indicator.tip}`
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
