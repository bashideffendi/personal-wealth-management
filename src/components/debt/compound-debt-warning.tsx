'use client'

/**
 * Compound Debt Warning — visualizes what happens to a debt if user only
 * makes minimum payments. The pedagogical point: high-APR debt (KK 27%/yr,
 * paylater 30-40%/yr) compounds against you fast.
 *
 * Math: assuming min payment = max(2% of balance, Rp 50k) and bunga
 * dibebankan ke sisa saldo. Approximates what banks actually charge —
 * close enough to be educational without being a financial calculator.
 *
 * This isn't a precise simulator (real cards have grace periods, interest
 * calc methods vary, fees). It's a "wake-up call" widget.
 */

import { useMemo } from 'react'
import { TrendingUp, AlertCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { EduTip } from '@/components/edu/edu-tip'
import { useT } from '@/lib/i18n/context'

interface Props {
  /** Debt balance to project */
  balance: number
  /** Annual interest rate (e.g. 27 for 27%/year) */
  annualRate: number
  /** Optional debt name for context */
  label?: string
}

interface ProjectionRow {
  year: number
  balance: number
  totalPaid: number
  totalInterest: number
}

/** Simulate min-payment-only scenario over N years */
function simulate(initialBalance: number, annualRate: number, years: number): ProjectionRow[] {
  const monthlyRate = annualRate / 100 / 12
  let balance = initialBalance
  let totalPaid = 0
  let totalInterest = 0
  const rows: ProjectionRow[] = []
  for (let m = 1; m <= years * 12; m++) {
    if (balance <= 0) break
    // Interest charged this month
    const interest = balance * monthlyRate
    totalInterest += interest
    balance += interest
    // Min payment: 2% of new balance OR Rp 50k, whichever larger
    const minPayment = Math.max(balance * 0.02, 50_000)
    const actualPayment = Math.min(minPayment, balance)
    balance -= actualPayment
    totalPaid += actualPayment
    if (m % 12 === 0) {
      rows.push({
        year: m / 12,
        balance: Math.max(0, balance),
        totalPaid,
        totalInterest,
      })
    }
  }
  return rows
}

export function CompoundDebtWarning({ balance, annualRate, label }: Props) {
  const t = useT()
  const projection = useMemo(() => simulate(balance, annualRate, 10), [balance, annualRate])

  // Skip visualizing if balance is tiny or rate is unreasonably low
  if (balance < 100_000 || annualRate < 5) return null

  const after1y = projection[0]
  const after5y = projection[4]
  const isHighRate = annualRate >= 18
  const monthlyInterest = (balance * annualRate / 100) / 12

  return (
    <div
      className="rounded-2xl border p-5 sm:p-6"
      style={{
        boxShadow: 'var(--card-shadow)', background: isHighRate
          ? 'linear-gradient(135deg, rgba(244,63,94,0.04), var(--surface) 50%)'
          : 'var(--surface)',
        borderColor: isHighRate ? 'rgba(244,63,94,0.20)' : 'var(--border)',
      }}
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="size-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: isHighRate ? 'rgba(244,63,94,0.10)' : 'rgba(245,158,11,0.12)' }}
        >
          {isHighRate ? (
            <AlertCircle className="size-4" style={{ color: 'var(--c-coral-ink)' }} />
          ) : (
            <TrendingUp className="size-4" style={{ color: 'var(--c-amber)' }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="eyebrow flex items-center gap-1.5">
            {t('compound_warning.eyebrow')}
            <EduTip topic="compound-interest" side="bottom" />
          </p>
          <h3 className="text-base sm:text-lg font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
            {t('compound_warning.heading')}
          </h3>
        </div>
      </div>

      {/* Headline scenario — what 1 month of interest looks like */}
      <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--ink)' }}>
        {label ? <span className="font-semibold">{label}</span> : t('compound_warning.this_debt')} {t('compound_warning.with_interest')}{' '}
        <span className="font-bold" style={{ color: isHighRate ? 'var(--c-coral)' : 'var(--c-amber)' }}>
          {annualRate.toFixed(1)}{t('compound_warning.rate_suffix')}
        </span>
        {' '}{t('compound_warning.generates')}{' '}
        <span className="num font-semibold" style={{ color: 'var(--ink)' }}>
          {formatCurrency(monthlyInterest)}
        </span>
        {' '}{t('compound_warning.interest_per_month')}
      </p>

      {/* Projection table */}
      <div
        className="rounded-lg p-3 grid grid-cols-3 gap-2"
        style={{ background: 'var(--surface-2)' }}
      >
        <ProjectionStat
          label={t('compound_warning.stat_now')}
          balance={balance}
          highlight={false}
        />
        {after1y && (
          <ProjectionStat
            label={t('compound_warning.stat_1y')}
            balance={after1y.balance}
            highlight={after1y.balance > balance}
          />
        )}
        {after5y && (
          <ProjectionStat
            label={t('compound_warning.stat_5y')}
            balance={after5y.balance}
            interest={after5y.totalInterest}
            highlight={after5y.balance > 0}
          />
        )}
      </div>

      {after5y && after5y.totalInterest > 0 && (
        <p className="text-[11px] leading-relaxed mt-3 pt-3 border-t" style={{ color: 'var(--ink-soft)', borderColor: 'var(--border-soft)' }}>
          {t('compound_warning.total_interest_5y')}{' '}
          <span className="num font-semibold" style={{ color: isHighRate ? 'var(--c-coral)' : 'var(--ink)' }}>
            {formatCurrency(after5y.totalInterest)}
          </span>
          {t('compound_warning.pay_above_min_tip')}
        </p>
      )}
    </div>
  )
}

function ProjectionStat({
  label, balance, interest, highlight,
}: {
  label: string
  balance: number
  interest?: number
  highlight: boolean
}) {
  const t = useT()
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--ink-soft)' }}>
        {label}
      </p>
      <p
        className="num tabular text-sm font-bold mt-1"
        style={{ color: highlight ? 'var(--c-coral)' : 'var(--ink)' }}
      >
        {formatCurrency(balance)}
      </p>
      {interest !== undefined && interest > 0 && (
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
          +{formatCurrency(interest)} {t('compound_warning.interest_label')}
        </p>
      )}
    </div>
  )
}
