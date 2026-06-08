'use client'

/**
 * Financial Health Score — sengaja DIPECAH jadi dua bento card karena beda hal:
 *   - part="score"    → Skor (ring) + Breakdown 7-indikator (2 kolom)
 *   - part="coverage" → Cash Coverage / runway likuiditas (1 kolom)
 * Tanpa `part` (legacy) = gabungan lama. Burn rate dihitung sekali, dipakai
 * coverage card.
 */

import { Sparkles } from 'lucide-react'
import type { FHSResult, FHSIndicator } from '@/lib/financial-health'
import { formatCurrency } from '@/lib/utils'
import { EduTip } from '@/components/edu/edu-tip'
import { useT } from '@/lib/i18n/context'

interface Props {
  result: FHSResult
  /** Liquid balance — for burn rate calc */
  liquidBalance: number
  /** Avg monthly expense — for burn rate calc */
  monthlyExpense: number
  /** Split target: 'score' (ring+breakdown) atau 'coverage' (runway). */
  part?: 'score' | 'coverage'
}

function tierChipStyle(color: string): React.CSSProperties {
  return { background: `${color}1F`, color }
}

export function FinancialHealthCard({ result, liquidBalance, monthlyExpense, part }: Props) {
  const t = useT()
  const { score, tier, tierMeta, breakdown } = result

  // Burn rate. Guard: expense<=0 (bulan berjalan belum ada transaksi) BUKAN
  // "cash habis 0 bulan" — state netral aja, jangan alarm merah.
  const hasExpenseData = monthlyExpense > 0
  const burnMonths = hasExpenseData ? liquidBalance / monthlyExpense : 0
  const burnColor = !hasExpenseData ? 'var(--ink-soft)'
    : burnMonths >= 6 ? 'var(--c-mint)'
    : burnMonths >= 3 ? 'var(--c-amber)'
    : 'var(--c-coral)'
  const burnTint = !hasExpenseData ? 'var(--surface-2)'
    : burnMonths >= 6 ? 'var(--c-mint-soft)'
    : burnMonths >= 3 ? 'var(--c-amber-soft)'
    : 'var(--c-coral-soft)'
  const burnVerdict = !hasExpenseData ? t('health_card.verdict_no_data')
    : burnMonths >= 6 ? t('health_card.verdict_very_safe')
    : burnMonths >= 3 ? t('health_card.verdict_safe_enough')
    : burnMonths >= 1 ? t('health_card.verdict_thin')
    : t('health_card.verdict_high_risk')

  // ─── Card 1: Skor + Breakdown (2 kolom internal) ───────────────────
  const scoreCard = (
    <div className="s-card p-6 sm:p-7 h-full">
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 sm:gap-7 items-stretch h-full">
        {/* Score ring */}
        <div className="sm:col-span-5 flex flex-col items-center text-center">
          <div className="flex items-center gap-1.5 mb-3 self-stretch justify-center">
            <p className="eyebrow">{t('health_card.eyebrow_score')}</p>
            <EduTip topic="financial-health" side="bottom" />
          </div>
          <div className="flex flex-col items-center justify-center flex-1">
            <div className="relative shrink-0">
              <svg width={176} height={176} viewBox="0 0 192 192" className="size-36 sm:size-40 -rotate-90">
                <circle cx={96} cy={96} r={84} fill="none" stroke="var(--surface-2)" strokeWidth={10} />
                <circle
                  cx={96} cy={96} r={84} fill="none" stroke={tierMeta.color} strokeWidth={10} strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 84}
                  strokeDashoffset={2 * Math.PI * 84 * (1 - score / 100)}
                  style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="leading-none tabular-nums font-bold" style={{ fontSize: 56, letterSpacing: '-0.04em', color: tierMeta.color }}>
                  {score}
                </span>
                <span className="text-[11px] mt-1 font-medium opacity-50" style={{ color: tierMeta.color }}>
                  {t('health_card.out_of_100')}
                </span>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider" style={tierChipStyle(tierMeta.color)}>
                {tierMeta.label}
              </span>
              {tier === 'thriving' && <Sparkles className="size-4" style={{ color: tierMeta.color }} />}
            </div>
          </div>
        </div>

        {/* Breakdown 7-indikator */}
        <div className="sm:col-span-7 sm:border-l sm:pl-6 flex flex-col" style={{ borderColor: 'var(--border-soft)' }}>
          <p className="eyebrow mb-4">{t('health_card.breakdown')}</p>
          <div className="space-y-2.5 flex-1">
            {breakdown.map((ind) => <IndicatorBar key={ind.key} indicator={ind} />)}
          </div>
        </div>
      </div>
    </div>
  )

  // ─── Card 2: Cash Coverage / runway (1 kolom) ──────────────────────
  const coverageCard = (
    <div className="s-card p-6 h-full flex flex-col">
      <div className="flex items-center gap-1.5 mb-3">
        <p className="eyebrow">{t('health_card.cash_coverage')}</p>
        <EduTip topic="financial-health" side="bottom" />
      </div>
      <div className="rounded-xl p-4 flex-1 flex flex-col" style={{ background: burnTint, border: `1px solid ${burnColor}33` }}>
        <div className="flex items-baseline gap-1.5">
          <span className="num tabular leading-none font-bold" style={{ color: burnColor, fontSize: 48, letterSpacing: '-0.03em' }}>
            {!hasExpenseData ? '—' : burnMonths > 99 ? '99+' : burnMonths.toFixed(1)}
          </span>
          <span className="text-sm font-medium" style={{ color: burnColor }}>{t('health_card.months')}</span>
        </div>
        <p className="text-[11px] mt-2 font-semibold uppercase tracking-[0.08em]" style={{ color: burnColor }}>
          {burnVerdict}
        </p>
        <p className="text-[11.5px] mt-2 leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
          {hasExpenseData ? (
            <>{t('health_card.coverage_prefix')}{' '}
            <span className="num font-semibold" style={{ color: 'var(--ink)' }}>{burnMonths > 99 ? '> 99' : burnMonths.toFixed(1)}</span> {t('health_card.coverage_suffix')}</>
          ) : (
            t('health_card.coverage_no_data')
          )}
        </p>
        <div className="mt-auto pt-3 border-t space-y-1.5" style={{ borderColor: `${burnColor}20` }}>
          <div className="flex items-center justify-between text-[11px]">
            <span style={{ color: 'var(--ink-muted)' }}>{t('health_card.liquid_cash')}</span>
            <span className="num font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(liquidBalance)}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span style={{ color: 'var(--ink-muted)' }}>{t('health_card.expense_per_month')}</span>
            <span className="num font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(monthlyExpense)}</span>
          </div>
        </div>
      </div>
    </div>
  )

  if (part === 'coverage') return coverageCard
  return scoreCard
}

/** Compact one-line indicator: label + score on top, thin bar below. */
function IndicatorBar({ indicator }: { indicator: FHSIndicator }) {
  const t = useT()
  const isNa = indicator.status === 'na'
  const barColor = (() => {
    if (isNa) return 'var(--ink-soft)'
    if (indicator.score >= 75) return 'var(--c-mint)'
    if (indicator.score >= 50) return 'var(--c-amber)'
    return 'var(--c-coral)'
  })()
  const pct = isNa ? 0 : Math.min(100, Math.max(0, indicator.score))
  const tooltip = indicator.tip ? `${indicator.explainer}\n\n${t('health_card.tip_label')} ${indicator.tip}` : indicator.explainer

  return (
    <div title={tooltip} className="cursor-help">
      <div className="flex items-center justify-between text-[12px] mb-1">
        <span style={{ color: 'var(--ink)' }}>{indicator.label}</span>
        <span className="num text-[11px] font-semibold shrink-0" style={{ color: isNa ? 'var(--ink-soft)' : barColor }}>
          {isNa ? 'N/A' : indicator.score}
        </span>
      </div>
      <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: barColor }} />
      </div>
    </div>
  )
}
