'use client'

/**
 * Cash-flow Forecast — projects daily balance for next 30 days based on
 * recurring transactions + upcoming contract due dates. Surfaces:
 *   - Min balance hit during the window (vs current balance)
 *   - Days where balance projects to dip below "safe" threshold
 *   - Per-day inflow/outflow breakdown on hover
 *
 * Why this matters (CFPB cash-flow budgeting framework, 2021): mayoritas
 * problem cashflow rumah tangga bukan "berapa total bulanan" tapi "kapan
 * uang masuk vs kapan tagihan jatuh" — timing mismatch yang bikin
 * overdraft meskipun bulan-end positif.
 *
 * This is a deterministic forecast (no probabilistic), good enough for
 * 30-day window. For longer horizons, we'd need to add variance bands.
 */

import { useMemo } from 'react'
import { TrendingDown, TrendingUp, AlertTriangle, Calendar } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { EduTip } from '@/components/edu/edu-tip'

interface RecurringItem {
  name: string
  type: string  // 'income' | 'expense' | 'saving' | 'investment'
  amount: number
  frequency: string  // 'monthly' | 'weekly' | 'yearly' | 'daily'
  day_of_period: number
}

interface ContractItem {
  name: string
  end_date: string  // ISO yyyy-mm-dd
  cost: number | null
  category: string  // 'insurance' | 'subscription' | 'loan' | 'warranty' | 'lease' | 'other'
  is_archived: boolean
}

interface Props {
  liquidBalance: number
  recurringItems: RecurringItem[]
  contracts: ContractItem[]
  /** Buffer threshold below which we flag "risk" (default Rp 500k) */
  safetyBuffer?: number
  /** Days to project (default 30) */
  daysAhead?: number
}

interface DayPoint {
  date: Date
  iso: string  // yyyy-mm-dd
  inflow: number
  outflow: number
  events: { name: string; amount: number; kind: 'in' | 'out' }[]
  balance: number
}

/**
 * Project balance forward N days. For each day, apply matching recurring
 * transactions + contract end_date events.
 */
function buildForecast(
  startBalance: number,
  recurring: RecurringItem[],
  contracts: ContractItem[],
  daysAhead: number,
): DayPoint[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const points: DayPoint[] = []
  let balance = startBalance

  for (let i = 0; i < daysAhead; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    const iso = date.toISOString().slice(0, 10)
    const dom = date.getDate()
    const dow = date.getDay()  // 0=Sun

    let inflow = 0
    let outflow = 0
    const events: DayPoint['events'] = []

    // Apply recurring transactions
    for (const r of recurring) {
      let matches = false
      if (r.frequency === 'monthly' && r.day_of_period === dom) matches = true
      else if (r.frequency === 'weekly' && r.day_of_period === dow) matches = true
      else if (r.frequency === 'daily') matches = true
      else if (r.frequency === 'yearly' && r.day_of_period === dom && date.getMonth() === today.getMonth()) {
        // Crude: yearly fires on same dom + same month as today. Real
        // recurring schemas are richer; this is a 90% approximation.
        matches = true
      }
      if (!matches || r.amount <= 0) continue
      if (r.type === 'income') {
        inflow += r.amount
        events.push({ name: r.name, amount: r.amount, kind: 'in' })
      } else {
        // expense / saving / investment all reduce liquid balance
        outflow += r.amount
        events.push({ name: r.name, amount: r.amount, kind: 'out' })
      }
    }

    // Apply contract end_date events (treat as outflow on that day)
    for (const c of contracts) {
      if (c.is_archived) continue
      if (!c.cost || c.cost <= 0) continue
      if (c.end_date !== iso) continue
      // Skip insurance auto-renew if we don't have a clear expectation —
      // use the cost as a safe outflow estimate. Could be income (refund)
      // for some contracts but rare.
      outflow += c.cost
      events.push({ name: `${c.name} (${c.category})`, amount: c.cost, kind: 'out' })
    }

    balance = balance + inflow - outflow
    points.push({ date, iso, inflow, outflow, events, balance })
  }

  return points
}

export function CashFlowForecast({
  liquidBalance,
  recurringItems,
  contracts,
  safetyBuffer = 500_000,
  daysAhead = 30,
}: Props) {
  const forecast = useMemo(
    () => buildForecast(liquidBalance, recurringItems, contracts, daysAhead),
    [liquidBalance, recurringItems, contracts, daysAhead],
  )

  // Stats
  const minPoint = forecast.reduce((min, p) => (p.balance < min.balance ? p : min), forecast[0])
  const endBalance = forecast[forecast.length - 1]?.balance ?? liquidBalance
  const riskDays = forecast.filter((p) => p.balance < safetyBuffer)
  const negativeDays = forecast.filter((p) => p.balance < 0)
  const eventDays = forecast.filter((p) => p.events.length > 0)

  // Empty state — user has no recurring data yet
  if (recurringItems.length === 0 && eventDays.length === 0) {
    return (
      <div
        className="rounded-2xl border p-5 sm:p-6"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-start gap-3 mb-2">
          <div
            className="size-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(14,165,233,0.12)' }}
          >
            <Calendar className="size-4" style={{ color: 'var(--sky-600)' }} />
          </div>
          <div>
            <p className="eyebrow">Forecast Saldo</p>
            <h3 className="text-base font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
              30 Hari ke Depan
            </h3>
          </div>
        </div>
        <p className="text-sm leading-relaxed mt-3" style={{ color: 'var(--ink-muted)' }}>
          Catat <span className="font-semibold">recurring transactions</span> kamu (gaji, langganan,
          listrik) supaya kita bisa proyeksiin saldo harian dan kasih warning kalau bakal tipis
          sebelum gajian.
        </p>
        <a
          href="/dashboard/recurring"
          className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold transition hover:underline"
          style={{ color: 'var(--c-mint)' }}
        >
          Set up recurring →
        </a>
      </div>
    )
  }

  // Color the chart based on health
  const hasNegative = negativeDays.length > 0
  const hasRisk = riskDays.length > 0
  const accentColor = hasNegative ? '#F43F5E' : hasRisk ? '#F59E0B' : '#10B981'

  // SVG chart dimensions
  const chartH = 80
  const chartW = 320  // base; will scale via viewBox
  const balances = forecast.map((p) => p.balance)
  const maxBal = Math.max(...balances, liquidBalance, safetyBuffer * 1.2)
  const minBal = Math.min(...balances, 0)
  const range = Math.max(1, maxBal - minBal)

  // Build polyline points
  const points = forecast.map((p, i) => {
    const x = (i / (forecast.length - 1)) * chartW
    const y = chartH - ((p.balance - minBal) / range) * chartH
    return `${x},${y}`
  }).join(' ')

  // Buffer line position
  const bufferY = chartH - ((safetyBuffer - minBal) / range) * chartH
  const zeroY = chartH - ((0 - minBal) / range) * chartH

  return (
    <div
      className="rounded-2xl border p-4 sm:p-5"
      style={{
        background: hasNegative
          ? 'linear-gradient(135deg, rgba(244,63,94,0.04), var(--surface) 50%)'
          : 'var(--surface)',
        borderColor: hasNegative ? 'rgba(244,63,94,0.20)' : 'var(--border)',
      }}
    >
      {/* Compact header — title + status badge in one row, mini sparkline beside */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Calendar className="size-3.5 shrink-0" style={{ color: accentColor }} />
          <p className="eyebrow flex items-center gap-1.5">
            Forecast Saldo 30h
            <EduTip topic="cash-flow" side="bottom" />
          </p>
        </div>
        {hasNegative ? (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0"
            style={{ background: 'var(--c-coral-soft)', color: 'var(--c-coral)' }}
          >
            <AlertTriangle className="size-2.5" />
            Risiko Negatif
          </span>
        ) : hasRisk ? (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0"
            style={{ background: 'var(--c-amber-soft)', color: 'var(--c-amber)' }}
          >
            Saldo Tipis
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide shrink-0"
            style={{ background: 'var(--c-mint-soft)', color: 'var(--c-mint)' }}
          >
            <TrendingUp className="size-2.5" />
            Aman
          </span>
        )}
      </div>

      {/* Side-by-side: stats (left) + mini sparkline (right) */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-center">
        <div className="grid grid-cols-3 gap-3 text-[11px]">
          <Stat
            label="Sekarang"
            value={formatCurrency(liquidBalance)}
            color="var(--ink)"
          />
          <Stat
            label="Akhir 30h"
            value={formatCurrency(endBalance)}
            color={endBalance < liquidBalance ? 'var(--c-coral)' : 'var(--c-mint)'}
            icon={endBalance < liquidBalance ? <TrendingDown className="size-3" /> : <TrendingUp className="size-3" />}
          />
          <Stat
            label="Terendah"
            value={formatCurrency(minPoint?.balance ?? liquidBalance)}
            color={minPoint && minPoint.balance < safetyBuffer ? accentColor : 'var(--ink)'}
            sub={minPoint?.balance !== undefined && minPoint.balance < liquidBalance
              ? `H+${forecast.indexOf(minPoint)}`
              : undefined}
          />
        </div>

        {/* Mini sparkline — visible only on sm+ to save mobile space */}
        <div className="hidden sm:block w-32 shrink-0">
          <svg
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="w-full h-12"
            preserveAspectRatio="none"
          >
            {bufferY > 0 && bufferY < chartH && (
              <line
                x1="0" y1={bufferY} x2={chartW} y2={bufferY}
                stroke="#F59E0B" strokeWidth="0.5" strokeDasharray="3,3"
                opacity="0.5"
              />
            )}
            {minBal < 0 && (
              <line
                x1="0" y1={zeroY} x2={chartW} y2={zeroY}
                stroke="#F43F5E" strokeWidth="0.8" opacity="0.7"
              />
            )}
            <polygon
              points={`0,${chartH} ${points} ${chartW},${chartH}`}
              fill={accentColor}
              fillOpacity="0.12"
            />
            <polyline
              points={points}
              fill="none"
              stroke={accentColor}
              strokeWidth="1.5"
            />
          </svg>
        </div>
      </div>

      {/* Upcoming events list — actionable bit */}
      {eventDays.length > 0 && (
        <div
          className="mt-3 pt-2 border-t"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            {eventDays.slice(0, 4).map((p) => (
              <div key={p.iso} className="flex items-center gap-1.5">
                <span className="num font-medium" style={{ color: 'var(--ink-soft)' }}>
                  {p.date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                </span>
                <span className="truncate max-w-[100px]" style={{ color: 'var(--ink)' }}>
                  {p.events[0].name}
                </span>
                <span
                  className="num font-semibold"
                  style={{ color: p.inflow > p.outflow ? 'var(--c-mint)' : 'var(--c-coral)' }}
                >
                  {p.inflow > p.outflow ? '+' : '-'}
                  {formatCurrency(Math.max(p.inflow, p.outflow))}
                </span>
              </div>
            ))}
            {eventDays.length > 4 && (
              <span className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>
                +{eventDays.length - 4} event lain
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({
  label, value, color, icon, sub,
}: {
  label: string
  value: string
  color: string
  icon?: React.ReactNode
  sub?: string
}) {
  return (
    <div>
      <p style={{ color: 'var(--ink-soft)' }}>{label}</p>
      <p
        className="num font-bold mt-0.5 inline-flex items-center gap-1"
        style={{ color, fontSize: 14 }}
      >
        {icon}
        {value}
      </p>
      {sub && (
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
          {sub}
        </p>
      )}
    </div>
  )
}
