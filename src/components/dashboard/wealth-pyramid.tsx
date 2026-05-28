'use client'

/**
 * Wealth Pyramid (Hierarchy of Financial Needs) — adaptasi dari Maslow's
 * hierarchy untuk konteks personal finance. 5 tier:
 *
 *   1. Foundation     — cashflow stabil + kebutuhan dasar terpenuhi
 *   2. Safety         — emergency fund 3×, asuransi minimal (BPJS)
 *   3. Accumulation   — investasi jangka pendek-menengah aktif
 *   4. Growth         — investasi jangka panjang, dana pensiun
 *   5. Legacy         — estate planning, waqf, bequest
 *
 * Tier "unlocks" berurutan — user idealnya kuatkan dasar dulu sebelum
 * naik. Status check per tier dari data PWM yang udah ada.
 *
 * Reference: Mission Asset Fund Hierarchy of Financial Needs (HFN);
 * adaptasi Maslow (1943) untuk financial planning oleh CFP community.
 */

import { useMemo } from 'react'
import { Lock, CheckCircle2, Circle, ChevronRight } from 'lucide-react'
import { EduTip } from '@/components/edu/edu-tip'

interface PyramidInput {
  /** Monthly net cashflow (income - expense). Positive = healthy */
  monthlyNet: number
  /** Liquid balance / monthly expense ratio */
  liquidMonths: number
  /** Has at least 1 insurance contract */
  hasInsurance: boolean
  /** Total investment value */
  investmentValue: number
  /** Annual income for ratio comparison */
  annualIncome: number
  /** Has any active goal */
  hasGoals: boolean
  /** Has retirement-tagged goal or DPLK */
  hasRetirementPlan: boolean
}

interface Tier {
  key: string
  level: number
  title: string
  emoji: string
  color: string
  description: string
  /** true = met, false = not yet, null = N/A (no data) */
  status: boolean | null
  /** What user needs to achieve this tier */
  requirement: string
}

function evaluateTiers(input: PyramidInput): Tier[] {
  const investmentRatio = input.annualIncome > 0
    ? input.investmentValue / input.annualIncome
    : 0

  return [
    {
      key: 'foundation',
      level: 1,
      title: 'Foundation',
      emoji: '🏠',
      color: '#0EA5E9',
      description: 'Cashflow stabil, kebutuhan dasar tertutup, mulai catat keuangan.',
      requirement: 'Pengeluaran ≤ pendapatan bulanan',
      status: input.monthlyNet >= 0,
    },
    {
      key: 'safety',
      level: 2,
      title: 'Safety',
      emoji: '🛡️',
      color: '#10B981',
      description: 'Dana darurat 3×, asuransi minimal (BPJS Kesehatan + 1 lain).',
      requirement: 'Dana darurat ≥ 3× pengeluaran + asuransi aktif',
      status: input.liquidMonths >= 3 && input.hasInsurance,
    },
    {
      key: 'accumulation',
      level: 3,
      title: 'Accumulation',
      emoji: '💰',
      color: '#F59E0B',
      description: 'Punya goal jangka pendek-menengah + investasi rutin.',
      requirement: 'Minimal 1 goal aktif + ada investasi',
      status: input.hasGoals && input.investmentValue > 0,
    },
    {
      key: 'growth',
      level: 4,
      title: 'Growth',
      emoji: '📈',
      color: '#8B5CF6',
      description: 'Investasi jangka panjang ≥ 3× annual income, dana pensiun aktif.',
      requirement: 'Investasi ≥ 3× annual income + dana pensiun',
      status: investmentRatio >= 3 && input.hasRetirementPlan,
    },
    {
      key: 'legacy',
      level: 5,
      title: 'Legacy',
      emoji: '🌳',
      color: '#EC4899',
      description: 'Estate planning, warisan, waqf, financial independence achieved.',
      requirement: 'Investasi ≥ 10× annual income (FI threshold)',
      status: investmentRatio >= 10,
    },
  ]
}

interface Props {
  input: PyramidInput
}

export function WealthPyramid({ input }: Props) {
  const tiers = useMemo(() => evaluateTiers(input), [input])
  const reachedCount = tiers.filter((t) => t.status === true).length

  // Find next tier to focus on (lowest unmet)
  const nextTier = tiers.find((t) => !t.status)

  return (
    <div
      className="rounded-2xl border p-5 sm:p-6"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="eyebrow flex items-center gap-1.5">
            Hierarchy of Financial Needs
            <EduTip topic="wealth-pyramid" side="bottom" />
          </p>
          <h3 className="text-lg font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
            Piramida Kekayaan
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
            {reachedCount} dari 5 tier tercapai. Kuatkan dasar dulu sebelum naik.
          </p>
        </div>
      </div>

      {/* Pyramid — bottom (foundation) wide → top (legacy) narrow */}
      <div className="space-y-1.5">
        {[...tiers].reverse().map((tier, idx) => {
          // Width: top narrowest (50%) → bottom widest (100%)
          const widths = ['50%', '65%', '80%', '90%', '100%']
          const width = widths[idx]
          const reached = tier.status === true
          const locked = !reached && tiers.slice(0, tier.level - 1).some((t) => !t.status)
          return (
            <div key={tier.key} className="flex justify-center">
              <div
                className="rounded-lg border p-3 transition-all hover:shadow-sm"
                style={{
                  width,
                  background: reached
                    ? `${tier.color}10`
                    : locked
                      ? 'var(--surface-2)'
                      : 'var(--surface)',
                  borderColor: reached ? `${tier.color}40` : 'var(--border-soft)',
                  opacity: locked ? 0.55 : 1,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">{tier.emoji}</span>
                    <div className="min-w-0">
                      <p
                        className="text-[11px] font-bold uppercase tracking-wide truncate"
                        style={{ color: reached ? tier.color : 'var(--ink-soft)' }}
                      >
                        {tier.level}. {tier.title}
                      </p>
                    </div>
                  </div>
                  {reached ? (
                    <CheckCircle2 className="size-4 shrink-0" style={{ color: tier.color }} />
                  ) : locked ? (
                    <Lock className="size-3.5 shrink-0 opacity-40" />
                  ) : (
                    <Circle className="size-3.5 shrink-0 opacity-40" />
                  )}
                </div>
                <p className="text-[10px] mt-1 leading-snug truncate" style={{ color: 'var(--ink-muted)' }}>
                  {tier.requirement}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Next focus */}
      {nextTier && (
        <div
          className="mt-4 pt-3 border-t flex items-start gap-3"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <ChevronRight className="size-4 mt-0.5 shrink-0" style={{ color: nextTier.color }} />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
              Fokus berikutnya
            </p>
            <p className="text-sm font-semibold mt-0.5" style={{ color: nextTier.color }}>
              {nextTier.emoji} {nextTier.title}
            </p>
            <p className="text-[12px] mt-1 leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
              {nextTier.description}
            </p>
          </div>
        </div>
      )}

      {!nextTier && (
        <div
          className="mt-4 pt-3 border-t text-center"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <p className="text-2xl">🎉</p>
          <p className="text-sm font-semibold mt-1" style={{ color: 'var(--ink)' }}>
            Semua tier tercapai!
          </p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--ink-muted)' }}>
            Saatnya fokus ke estate planning + giving back.
          </p>
        </div>
      )}
    </div>
  )
}
