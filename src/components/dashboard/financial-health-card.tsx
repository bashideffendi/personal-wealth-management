'use client'

/**
 * Financial Health Score card — headline diagnostic for the dashboard.
 *
 * 3-column layout (lg+ screens):
 *   1. Score ring + tier + verdict (left)
 *   2. Indicator bars per pillar (middle, always visible — no expand)
 *   3. Burn rate / runway panel (right)
 *
 * Design tenets:
 *   - User shouldn't have to click to see why their score is what it is —
 *     all 7 indicators visible inline as compact bars
 *   - Burn rate sits next to the score because "how long can I survive"
 *     is the most actionable cash-coverage question
 *   - Tier color (red/amber/green/emerald) does the visual work
 *   - On mobile, columns stack vertically with score on top
 */

import { useMemo } from 'react'
import { Activity, Sparkles } from 'lucide-react'
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

const GROUP_ICONS: Record<FHSIndicator['group'], string> = {
  Spend: '💸',
  Save: '🛡️',
  Borrow: '💳',
  Plan: '🎯',
}

export function FinancialHealthCard({ result, liquidBalance, monthlyExpense }: Props) {
  const { score, tier, tierMeta, breakdown } = result

  // Group indicators by category for the bars panel
  const grouped = useMemo(() => {
    const out: Record<string, FHSIndicator[]> = { Spend: [], Save: [], Borrow: [], Plan: [] }
    for (const ind of breakdown) out[ind.group].push(ind)
    return out
  }, [breakdown])

  // Score ring math — 0-100 → 0-360 deg conic gradient
  const arcAngle = (score / 100) * 360

  // Burn rate = how many months the liquid balance can cover monthly expenses
  const burnMonths = monthlyExpense > 0 ? liquidBalance / monthlyExpense : 0
  const burnColor = burnMonths >= 6 ? '#10B981'
    : burnMonths >= 3 ? '#F59E0B'
    : burnMonths >= 1 ? '#EA580C'
    : '#DC2626'
  const burnVerdict = burnMonths >= 6 ? 'Sangat aman'
    : burnMonths >= 3 ? 'Cukup aman'
    : burnMonths >= 1 ? 'Tipis — perlu dikuatkan'
    : 'Risiko tinggi — bangun buffer dulu'

  return (
    <div
      className="rounded-2xl border p-5 sm:p-6"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        boxShadow: '0 4px 12px -4px rgba(0,0,0,0.06)',
      }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ─── Col 1: Score + Tier + Verdict ──────────────────────── */}
        <div className="lg:col-span-3 flex lg:flex-col items-center lg:items-start gap-4 lg:gap-3">
          {/* Score ring */}
          <div className="relative shrink-0">
            <div
              className="size-28 lg:size-32 rounded-full flex items-center justify-center"
              style={{
                background: `conic-gradient(${tierMeta.color} ${arcAngle}deg, var(--surface-2) 0deg)`,
              }}
            >
              <div
                className="size-[80%] rounded-full flex flex-col items-center justify-center"
                style={{ background: 'var(--surface)' }}
              >
                <p
                  className="num tabular text-4xl lg:text-5xl font-bold leading-none"
                  style={{ color: tierMeta.color }}
                >
                  {score}
                </p>
                <p className="text-[9px] uppercase tracking-wider mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                  /100
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="caps">Skor Kesehatan Finansial</p>
              <EduTip topic="financial-health" side="bottom" />
            </div>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide"
                style={{
                  background: `${tierMeta.color}1A`,
                  color: tierMeta.color,
                }}
              >
                <Activity className="size-3" />
                {tierMeta.label}
              </span>
              {tier === 'thriving' && (
                <Sparkles className="size-4" style={{ color: tierMeta.color }} />
              )}
            </div>
            <p className="text-xs lg:text-sm mt-2 leading-relaxed" style={{ color: 'var(--ink)' }}>
              {tierMeta.description}
            </p>
          </div>
        </div>

        {/* ─── Col 2: Indicator bars per pillar ───────────────────── */}
        <div className="lg:col-span-6 lg:border-l lg:border-r lg:px-6" style={{ borderColor: 'var(--border-soft)' }}>
          <p className="caps mb-3">Breakdown</p>
          <div className="space-y-3">
            {(['Spend', 'Save', 'Borrow', 'Plan'] as const).map((group) => {
              const items = grouped[group]
              if (items.length === 0) return null
              return (
                <div key={group}>
                  <p
                    className="text-[10px] uppercase tracking-wider font-bold mb-1.5 flex items-center gap-1.5"
                    style={{ color: 'var(--ink-soft)' }}
                  >
                    <span>{GROUP_ICONS[group]}</span>
                    {group}
                  </p>
                  <div className="space-y-1.5">
                    {items.map((ind) => (
                      <IndicatorBar key={ind.key} indicator={ind} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ─── Col 3: Burn rate / Runway ──────────────────────────── */}
        <div className="lg:col-span-3">
          <p className="caps">Runway / Burn Rate</p>
          <h4 className="text-base font-semibold mt-1" style={{ color: 'var(--ink)' }}>
            Cash Coverage
          </h4>
          <div
            className="mt-3 rounded-xl p-4"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border-soft)',
            }}
          >
            <p className="num tabular font-bold leading-none" style={{ fontSize: 40, color: burnColor }}>
              {burnMonths > 99 ? '99+' : burnMonths.toFixed(1)}
              <span className="text-sm font-normal ml-1.5" style={{ color: 'var(--ink-muted)' }}>
                bulan
              </span>
            </p>
            <p className="text-[11px] mt-2 leading-relaxed" style={{ color: burnColor }}>
              {burnVerdict}
            </p>
            <p className="text-[11px] mt-2 leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
              Tanpa pemasukan baru, liquid cash bisa cover pengeluaran selama{' '}
              <span className="font-semibold num" style={{ color: 'var(--ink)' }}>
                {burnMonths > 99 ? '> 99' : burnMonths.toFixed(1)} bulan
              </span>.
            </p>
            <div
              className="mt-3 pt-3 border-t space-y-1"
              style={{ borderColor: 'var(--border-soft)' }}
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

/** Compact single-line indicator with horizontal bar */
function IndicatorBar({ indicator }: { indicator: FHSIndicator }) {
  const isNa = indicator.status === 'na'
  const barColor = (() => {
    if (isNa) return 'var(--ink-soft)'
    if (indicator.score >= 75) return '#10B981'
    if (indicator.score >= 50) return '#F59E0B'
    return '#DC2626'
  })()
  const pct = isNa ? 0 : Math.min(100, Math.max(0, indicator.score))

  return (
    <div title={indicator.explainer + (indicator.tip ? ` — ${indicator.tip}` : '')}>
      <div className="flex items-center justify-between text-[11px] mb-0.5">
        <span className="font-medium" style={{ color: 'var(--ink)' }}>
          {indicator.label}
        </span>
        <span
          className="num tabular font-semibold shrink-0"
          style={{ color: isNa ? 'var(--ink-soft)' : barColor }}
        >
          {isNa ? 'N/A' : `${indicator.score}/100`}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      {indicator.tip && !isNa && indicator.score < 60 && (
        <p
          className="text-[10px] leading-snug mt-1 italic"
          style={{ color: 'var(--ink-soft)' }}
        >
          💡 {indicator.tip}
        </p>
      )}
    </div>
  )
}
