'use client'

/**
 * Goal Probability Meter — small inline widget for each goal card.
 * Runs Monte Carlo (5000 sims) on mount and shows:
 *   - Probability % of hitting target by deadline
 *   - Color-coded bar (red <40, amber 40-70, green ≥70)
 *   - Expandable detail with risk profile assumption + required-monthly-for-90%
 *
 * Uses suggestedRiskProfile() to auto-pick assumptions; user can manually
 * switch via a tiny dropdown in the expanded view.
 */

import { useMemo, useState } from 'react'
import { TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  computeGoalProbability,
  RISK_PROFILES,
  suggestedRiskProfile,
  type RiskProfile,
} from '@/lib/goal-probability'

interface Props {
  current: number
  target: number
  deadline: string | null
  /** Goal category — used to suggest risk profile */
  category: string
  /** Optional explicit monthly contribution; otherwise computed as remaining/months */
  monthlyContribution?: number
}

function monthsUntil(deadline: string): number {
  const d = new Date(deadline)
  const now = new Date()
  return Math.max(
    0,
    (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth()),
  )
}

export function GoalProbabilityMeter({
  current, target, deadline, category, monthlyContribution,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [riskOverride, setRiskOverride] = useState<RiskProfile | null>(null)

  const monthsLeft = deadline ? monthsUntil(deadline) : 0

  // Effective monthly contribution: user-provided OR auto-computed
  const effectiveContribution = useMemo(() => {
    if (monthlyContribution !== undefined) return monthlyContribution
    if (monthsLeft <= 0) return 0
    const remaining = Math.max(0, target - current)
    return Math.ceil(remaining / monthsLeft)
  }, [monthlyContribution, monthsLeft, target, current])

  const profile = riskOverride ?? suggestedRiskProfile(category, monthsLeft)
  const assumptions = RISK_PROFILES[profile]

  // Run Monte Carlo
  const result = useMemo(
    () => computeGoalProbability({
      current,
      target,
      monthsLeft,
      monthlyContribution: effectiveContribution,
      assumptions: { annualReturn: assumptions.annualReturn, annualStdev: assumptions.annualStdev },
    }),
    [current, target, monthsLeft, effectiveContribution, assumptions],
  )

  // Don't render meter if no deadline (probability meaningless)
  if (!deadline || monthsLeft === 0) {
    return null
  }

  const prob = result.probability
  const probColor = prob >= 70 ? '#10B981' : prob >= 40 ? '#F59E0B' : '#F43F5E'
  const probLabel = prob >= 80 ? 'Sangat mungkin'
    : prob >= 60 ? 'Mungkin tercapai'
    : prob >= 40 ? 'Berisiko meleset'
    : 'Sulit tercapai'

  return (
    <div
      className="rounded-md border-t pt-2 mt-2"
      style={{ borderColor: 'var(--border-soft)' }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 group"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <TrendingUp className="size-3 shrink-0" style={{ color: probColor }} />
          <span
            className="text-[10px] uppercase tracking-wide font-semibold shrink-0"
            style={{ color: 'var(--ink-soft)' }}
          >
            Peluang
          </span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${prob}%`, background: probColor }}
            />
          </div>
          <span
            className="num text-[11px] font-bold shrink-0 tabular"
            style={{ color: probColor }}
          >
            {prob.toFixed(0)}%
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="size-3 shrink-0 opacity-50" />
        ) : (
          <ChevronDown className="size-3 shrink-0 opacity-50 group-hover:opacity-100 transition" />
        )}
      </button>

      {expanded && (
        <div
          className="mt-2 pt-2 border-t space-y-2 text-[11px]"
          style={{ borderColor: 'var(--border-soft)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <p style={{ color: 'var(--ink)' }}>
            <span className="font-semibold" style={{ color: probColor }}>{probLabel}</span>
            {' '}— berdasar simulasi 5000 path dengan asumsi return {profile}.
          </p>

          {/* Risk profile selector */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span style={{ color: 'var(--ink-soft)' }}>Profil:</span>
            {(['conservative', 'moderate', 'aggressive'] as RiskProfile[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setRiskOverride(p)}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium transition"
                style={{
                  background: profile === p ? 'var(--ink)' : 'var(--surface-2)',
                  color: profile === p ? 'var(--surface)' : 'var(--ink-muted)',
                }}
              >
                {RISK_PROFILES[p].label}
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p style={{ color: 'var(--ink-soft)' }}>Kontribusi/bln</p>
              <p className="num font-semibold" style={{ color: 'var(--ink)' }}>
                {formatCurrency(effectiveContribution)}
              </p>
            </div>
            {prob < 90 && result.requiredMonthlyFor90 > effectiveContribution && (
              <div>
                <p style={{ color: 'var(--ink-soft)' }}>Untuk 90% peluang</p>
                <p className="num font-semibold" style={{ color: '#10B981' }}>
                  {formatCurrency(result.requiredMonthlyFor90)}/bln
                </p>
              </div>
            )}
            <div>
              <p style={{ color: 'var(--ink-soft)' }}>Median akhir</p>
              <p className="num font-semibold" style={{ color: 'var(--ink)' }}>
                {formatCurrency(Math.round(result.medianFinal))}
              </p>
            </div>
            <div>
              <p style={{ color: 'var(--ink-soft)' }}>Range (P10-P90)</p>
              <p className="num text-[10px]" style={{ color: 'var(--ink-muted)' }}>
                {formatCurrency(Math.round(result.p10Final))}
                {' – '}
                {formatCurrency(Math.round(result.p90Final))}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
