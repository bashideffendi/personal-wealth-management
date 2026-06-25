'use client'

/**
 * Financial Health — dua bento card terpisah (beda hal):
 *   - part="score"    → Skor (ring besar) + deskripsi tier + breakdown 7-indikator
 *   - part="coverage" → Cash Coverage / runway likuiditas + bar runway
 * Tiap card sengaja didesain ngisi penuh tingginya (flex distribute) — angka
 * hero gede, no dead space. Burn rate dihitung sekali.
 */

import { Sparkles } from 'lucide-react'
import type { FHSResult, FHSIndicator } from '@/lib/financial-health'
import { formatCurrency } from '@/lib/utils'
import { EduTip } from '@/components/edu/edu-tip'
import { useT } from '@/lib/i18n/context'

interface Props {
  result: FHSResult
  liquidBalance: number
  monthlyExpense: number
  part?: 'score' | 'coverage'
}

// bg = tint via color-mix (hex+alpha concat dilarang & invalid utk var()).
function tierChipStyle(color: string, ink: string): React.CSSProperties {
  return { background: `color-mix(in srgb, ${color} 12%, transparent)`, color: ink }
}

export function FinancialHealthCard({ result, liquidBalance, monthlyExpense, part }: Props) {
  const t = useT()
  const { score, tier, tierMeta, breakdown } = result

  const hasExpenseData = monthlyExpense > 0
  const burnMonths = hasExpenseData ? liquidBalance / monthlyExpense : 0
  const burnColor = !hasExpenseData ? 'var(--ink-soft)'
    : burnMonths >= 6 ? 'var(--c-mint)'
    : burnMonths >= 3 ? 'var(--c-amber)'
    : 'var(--c-coral)'
  // Teks pakai -ink (AA); bar/border tetap full-sat via burnColor.
  const burnInk = !hasExpenseData ? 'var(--ink-soft)'
    : burnMonths >= 6 ? 'var(--c-mint-ink)'
    : burnMonths >= 3 ? 'var(--c-amber-ink)'
    : 'var(--c-coral-ink)'
  const burnTint = !hasExpenseData ? 'var(--surface-2)'
    : burnMonths >= 6 ? 'var(--c-mint-soft)'
    : burnMonths >= 3 ? 'var(--c-amber-soft)'
    : 'var(--c-coral-soft)'
  const burnVerdict = !hasExpenseData ? t('health_card.verdict_no_data')
    : burnMonths >= 6 ? t('health_card.verdict_very_safe')
    : burnMonths >= 3 ? t('health_card.verdict_safe_enough')
    : burnMonths >= 1 ? t('health_card.verdict_thin')
    : t('health_card.verdict_high_risk')

  // ─── Card: Skor + deskripsi + breakdown ────────────────────────────
  const scoreCard = (
    <div className="s-card p-6 sm:p-7 h-full">
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 sm:gap-8 h-full">
        {/* Score + tier description — ngisi tinggi kolom */}
        <div className="sm:col-span-5 flex flex-col">
          <div className="flex items-center gap-1.5 shrink-0">
            <p className="eyebrow">{t('health_card.eyebrow_score')}</p>
            <EduTip topic="financial-health" side="bottom" />
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-2">
            <div className="relative shrink-0">
              <svg width={208} height={208} viewBox="0 0 192 192" className="size-48 sm:size-52 -rotate-90">
                <circle cx={96} cy={96} r={84} fill="none" stroke="var(--surface-2)" strokeWidth={11} />
                <circle
                  cx={96} cy={96} r={84} fill="none" stroke={tierMeta.color} strokeWidth={11} strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 84}
                  strokeDashoffset={2 * Math.PI * 84 * (1 - score / 100)}
                  style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="leading-none tabular-nums font-bold" style={{ fontSize: 46, letterSpacing: '-0.03em', color: tierMeta.ink }}>
                  {score}
                </span>
                <span className="text-[11px] mt-1.5 font-medium opacity-50" style={{ color: tierMeta.ink }}>
                  {t('health_card.out_of_100')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider" style={tierChipStyle(tierMeta.color, tierMeta.ink)}>
                {tierMeta.label}
              </span>
              {tier === 'thriving' && <Sparkles className="size-4" style={{ color: tierMeta.ink }} />}
            </div>
            <p className="text-[12.5px] leading-relaxed max-w-[26ch]" style={{ color: 'var(--ink-muted)' }}>
              {tierMeta.description}
            </p>
          </div>
        </div>

        {/* Breakdown 7-indikator — spread biar ngisi tinggi */}
        <div className="sm:col-span-7 sm:border-l sm:pl-7 flex flex-col" style={{ borderColor: 'var(--border-soft)' }}>
          <p className="eyebrow shrink-0">{t('health_card.breakdown')}</p>
          <div className="flex-1 flex flex-col justify-between mt-4">
            {breakdown.map((ind) => <IndicatorBar key={ind.key} indicator={ind} />)}
          </div>
        </div>
      </div>
    </div>
  )

  // ─── Card: Cash Coverage / runway ──────────────────────────────────
  const coverageCard = (
    <div className="s-card p-6 h-full flex flex-col">
      <div className="flex items-center gap-1.5 shrink-0">
        <p className="eyebrow">{t('health_card.cash_coverage')}</p>
        <EduTip topic="financial-health" side="bottom" />
      </div>
      <div className="mt-3 flex-1 rounded-2xl p-5 flex flex-col" style={{ background: burnTint, border: `1px solid color-mix(in srgb, ${burnColor} 20%, transparent)` }}>
        <div className="flex items-baseline gap-2">
          <span className="num tabular leading-none font-bold" style={{ color: burnInk, fontSize: 46, letterSpacing: '-0.03em' }}>
            {!hasExpenseData ? '—' : burnMonths > 99 ? '99+' : burnMonths.toFixed(1)}
          </span>
          <span className="text-base font-semibold" style={{ color: burnInk }}>{t('health_card.months')}</span>
        </div>
        <p className="text-[12px] mt-2 font-bold uppercase tracking-[0.08em]" style={{ color: burnInk }}>
          {burnVerdict}
        </p>

        {/* Runway bar — coverage vs target 6 bulan */}
        {hasExpenseData && (
          <div className="mt-5">
            <div className="flex justify-between text-[10px] mb-1.5" style={{ color: 'var(--ink-soft)' }}>
              <span>0</span>
              <span>Target 6 bln</span>
            </div>
            <span className="quest-bar w-full" style={{ ['--bar-fill' as string]: burnColor, ['--bar-h' as string]: '10px' }}><i style={{ width: `${Math.min(burnMonths / 6, 1) * 100}%` }} /></span>
          </div>
        )}

        <p className="text-[12px] mt-4 leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
          {hasExpenseData ? (
            <>{t('health_card.coverage_prefix')}{' '}
            <span className="num font-semibold" style={{ color: 'var(--ink)' }}>{burnMonths > 99 ? '> 99' : burnMonths.toFixed(1)}</span> {t('health_card.coverage_suffix')}</>
          ) : (
            t('health_card.coverage_no_data')
          )}
        </p>

        <div className="mt-auto pt-4 border-t space-y-2" style={{ borderColor: `color-mix(in srgb, ${burnColor} 12%, transparent)` }}>
          <div className="flex items-center justify-between text-[12px]">
            <span style={{ color: 'var(--ink-muted)' }}>{t('health_card.liquid_cash')}</span>
            <span className="num font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(liquidBalance)}</span>
          </div>
          <div className="flex items-center justify-between text-[12px]">
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

function IndicatorBar({ indicator }: { indicator: FHSIndicator }) {
  const t = useT()
  const isNa = indicator.status === 'na'
  const barColor = (() => {
    if (isNa) return 'var(--ink-soft)'
    if (indicator.score >= 75) return 'var(--c-mint)'
    if (indicator.score >= 50) return 'var(--c-amber)'
    return 'var(--c-coral)'
  })()
  const barInk = (() => {
    if (isNa) return 'var(--ink-soft)'
    if (indicator.score >= 75) return 'var(--c-mint-ink)'
    if (indicator.score >= 50) return 'var(--c-amber-ink)'
    return 'var(--c-coral-ink)'
  })()
  const pct = isNa ? 0 : Math.min(100, Math.max(0, indicator.score))
  const tooltip = indicator.tip ? `${indicator.explainer}\n\n${t('health_card.tip_label')} ${indicator.tip}` : indicator.explainer

  return (
    <div title={tooltip} className="cursor-help">
      <div className="flex items-center justify-between text-[12.5px] mb-1.5">
        <span style={{ color: 'var(--ink)' }}>{indicator.label}</span>
        <span className="num text-[11px] font-semibold shrink-0" style={{ color: isNa ? 'var(--ink-soft)' : barInk }}>
          {isNa ? 'N/A' : indicator.score}
        </span>
      </div>
      <span className="quest-bar w-full" style={{ ['--bar-fill' as string]: barColor, ['--bar-h' as string]: '8px' }}><i style={{ width: `${pct}%` }} /></span>
    </div>
  )
}
