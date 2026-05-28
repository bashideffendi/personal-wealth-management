'use client'

/**
 * Health Score Panel — editorial HealthRowA per design handoff.
 * 3-col: Score gauge + Breakdown (5 pilar) + Cash Coverage (runway).
 *
 * Score colors via tone tokens:
 *   ≥85 (A/Excellent) → mint
 *   ≥70 (B/Good)      → mint
 *   ≥55 (C/Fair)      → amber
 *   ≥40 (D/Needs Work)→ amber
 *   <40 (E/Critical)  → coral
 */

import { formatCurrency } from '@/lib/utils'
import type { Transaction } from '@/types'

interface HealthScorePanelProps {
  monthTransactions: Transaction[]
  yearTransactions: Transaction[]
  savingRate: number
  liquidTotal: number
  debtTotal: number
  efCurrent: number
  efTarget: number
}

export function HealthScorePanel({
  monthTransactions, yearTransactions, savingRate, liquidTotal, debtTotal, efCurrent, efTarget,
}: HealthScorePanelProps) {
  void efTarget

  const monthExpense = monthTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const savingRateScore = Math.min(20, Math.max(0, (savingRate / 30) * 20))
  const debtRatio = liquidTotal > 0 ? debtTotal / liquidTotal : 5
  const debtScore = debtRatio <= 0 ? 20 : debtRatio <= 1 ? 20 : debtRatio <= 2 ? 15 : debtRatio <= 4 ? 10 : 5
  const efMonths = monthExpense > 0 ? efCurrent / monthExpense : 0
  const efScore = efMonths >= 6 ? 20 : efMonths >= 3 ? 15 : efMonths >= 1 ? 10 : 5
  const growthScore = (() => {
    const inc = yearTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const exp = yearTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    if (inc === 0) return 5
    const ratio = (inc - exp) / inc
    return ratio >= 0.3 ? 20 : ratio >= 0.15 ? 15 : ratio >= 0 ? 10 : 0
  })()
  const budgetScore = savingRate > 0 ? 15 : 5

  const total = Math.round(savingRateScore + debtScore + efScore + growthScore + budgetScore)
  const grade = total >= 85 ? 'A' : total >= 70 ? 'B' : total >= 55 ? 'C' : total >= 40 ? 'D' : 'E'
  const verdict = total >= 85 ? 'Excellent'
    : total >= 70 ? 'Sehat'
    : total >= 55 ? 'Cukup'
    : total >= 40 ? 'Perlu perhatian'
    : 'Darurat'
  const verdictDesc = total >= 85 ? 'Kondisi finansialmu luar biasa — pertahankan ritme ini.'
    : total >= 70 ? 'Finansialmu sehat. Masih ada ruang optimasi.'
    : total >= 55 ? 'Ada beberapa area yang perlu diperbaiki.'
    : total >= 40 ? 'Banyak aspek butuh perhatian segera.'
    : 'Kondisi darurat — prioritaskan stabilisasi.'

  // Tone per total score
  const scoreTone = total >= 70 ? 'mint' : total >= 40 ? 'amber' : 'coral'

  // Gauge arc (semicircle 220° sweep)
  const SIZE = 200
  const STROKE = 14
  const R = (SIZE - STROKE) / 2
  const C = 2 * Math.PI * R
  // Use 70% of full circle for gauge sweep (more dial-like)
  const sweepPct = 0.7
  const arcLen = C * sweepPct
  const totalCapped = Math.min(100, Math.max(0, total))
  const progress = (totalCapped / 100) * arcLen
  const remaining = arcLen - progress

  const burnMonths = monthExpense > 0 ? liquidTotal / monthExpense : 0
  const burnTone = burnMonths >= 6 ? 'mint' : burnMonths >= 3 ? 'amber' : 'coral'
  const burnLabel = burnMonths >= 6 ? 'Sangat aman'
    : burnMonths >= 3 ? 'Aman'
    : burnMonths >= 1 ? 'Tipis'
    : 'Mendesak'

  const components: { label: string; v: number; max: number }[] = [
    { label: 'Saving Rate', v: savingRateScore, max: 20 },
    { label: 'Debt Ratio',  v: debtScore,       max: 20 },
    { label: 'Dana Darurat', v: efScore,        max: 20 },
    { label: 'Growth',      v: growthScore,     max: 20 },
    { label: 'Anggaran',    v: budgetScore,     max: 20 },
  ]

  return (
    <section className="grid gap-4 lg:grid-cols-[0.9fr_1.4fr_0.85fr]">
      {/* ─── Score gauge ─── */}
      <article
        className="s-card flex flex-col items-center justify-center"
        style={{ padding: 24 }}
      >
        <p className="eyebrow self-start">Skor Kesehatan</p>
        <div className="relative my-2" style={{ width: SIZE, height: SIZE * 0.8 }}>
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            style={{ transform: 'rotate(140deg)' }}
          >
            <circle
              cx={SIZE / 2} cy={SIZE / 2} r={R}
              fill="none"
              stroke="var(--surface-2)"
              strokeWidth={STROKE}
              strokeDasharray={`${arcLen} ${C}`}
              strokeLinecap="round"
            />
            <circle
              cx={SIZE / 2} cy={SIZE / 2} r={R}
              fill="none"
              stroke={`var(--c-${scoreTone})`}
              strokeWidth={STROKE}
              strokeDasharray={`${progress} ${C}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 1s ease-out' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="display num tabular"
              style={{ fontSize: 56, color: 'var(--ink)' }}
            >
              {total}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--text-mute)',
                marginTop: 2,
              }}
            >
              dari 100
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className="grid place-items-center rounded-lg text-base font-bold"
            style={{
              width: 32,
              height: 32,
              background: `var(--c-${scoreTone}-soft)`,
              color: `var(--c-${scoreTone})`,
            }}
          >
            {grade}
          </span>
          <span
            className="chip"
            style={{
              background: `var(--c-${scoreTone}-soft)`,
              color: `var(--c-${scoreTone})`,
            }}
          >
            {verdict}
          </span>
        </div>
        <p
          className="text-xs leading-relaxed mt-3 text-center"
          style={{ color: 'var(--text-2)' }}
        >
          {verdictDesc}
        </p>
      </article>

      {/* ─── Breakdown bars ─── */}
      <article className="s-card s-card-pad-lg">
        <p className="eyebrow">Breakdown · 5 Pilar</p>
        <div className="flex flex-col gap-3 mt-4">
          {components.map((s) => {
            const v = Math.round(s.v)
            const tone = s.v >= s.max * 0.7 ? 'mint' : s.v >= s.max * 0.4 ? 'amber' : 'coral'
            return (
              <div
                key={s.label}
                className="grid items-center gap-3"
                style={{ gridTemplateColumns: '180px 1fr 40px' }}
              >
                <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{s.label}</span>
                <div
                  className="kl-bar"
                  style={{ color: `var(--c-${tone})` }}
                >
                  <i style={{ width: `${(s.v / s.max) * 100}%` }} />
                </div>
                <span
                  className="num tabular text-right"
                  style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}
                >
                  {v}
                </span>
              </div>
            )
          })}
        </div>
      </article>

      {/* ─── Cash Coverage ─── */}
      <article
        className="s-card flex flex-col justify-between"
        style={{
          padding: 24,
          background: `var(--c-${burnTone}-soft)`,
        }}
      >
        <div>
          <p
            className="eyebrow"
            style={{ color: `var(--c-${burnTone})` }}
          >
            Cash Coverage
          </p>
          <div className="flex items-baseline gap-2 mt-3">
            <span
              className="display num tabular"
              style={{ fontSize: 56, color: 'var(--ink)', lineHeight: 1 }}
            >
              {burnMonths.toFixed(1)}
            </span>
            <span
              style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 600 }}
            >
              bulan
            </span>
          </div>
          <span
            className="chip mt-2.5"
            style={{
              background: `var(--c-${burnTone})`,
              color: 'var(--c-ink)',
            }}
          >
            {burnLabel}
          </span>
          <p
            className="text-xs mt-3 leading-relaxed"
            style={{ color: 'var(--text-2)' }}
          >
            Tanpa pemasukan baru, kas likuid menutup {burnMonths.toFixed(1)} bulan pengeluaran.
          </p>
        </div>
        <div
          className="mt-4 pt-4 flex justify-between"
          style={{ borderTop: '1px solid var(--line)' }}
        >
          <div>
            <p
              style={{
                fontSize: 10.5,
                color: 'var(--text-mute)',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Kas Likuid
            </p>
            <p className="num tabular mt-1" style={{ fontSize: 14, fontWeight: 700 }}>
              {formatCurrency(liquidTotal)}
            </p>
          </div>
          <div className="text-right">
            <p
              style={{
                fontSize: 10.5,
                color: 'var(--text-mute)',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Per Bulan
            </p>
            <p className="num tabular mt-1" style={{ fontSize: 14, fontWeight: 700 }}>
              {formatCurrency(monthExpense)}
            </p>
          </div>
        </div>
      </article>
    </section>
  )
}
