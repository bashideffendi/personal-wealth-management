'use client'

import { formatCurrency } from '@/lib/utils'
import type { Transaction, CreditCard, Contract } from '@/types'

interface Budget {
  id: string
  year: number
  month: number
  category: string
  type: 'income' | 'expense' | 'saving' | 'investment'
  amount: number
}

interface InsightsPanelProps {
  monthTransactions: Transaction[]
  yearTransactions: Transaction[]
  monthBudgets: Budget[]
  creditCards: CreditCard[]
  contracts: Contract[]
  savingRate: number
  netCashflow: number
}

export function InsightsPanel({
  monthTransactions, yearTransactions, monthBudgets, creditCards, contracts, savingRate, netCashflow,
}: InsightsPanelProps) {
  const alerts: Array<{ level: 'critical' | 'warn' | 'good'; text: string }> = []
  const today = new Date()

  // Contract expiries (overdue + within reminder window)
  for (const c of contracts) {
    const end = new Date(c.end_date); end.setHours(0, 0, 0, 0)
    const t = new Date(today); t.setHours(0, 0, 0, 0)
    const days = Math.round((end.getTime() - t.getTime()) / 86_400_000)
    if (days < 0) {
      alerts.push({
        level: 'critical',
        text: `Kontrak "${c.name}" lewat jatuh tempo ${Math.abs(days)} hari`,
      })
    } else if (days <= c.reminder_days_before) {
      alerts.push({
        level: days <= 7 ? 'critical' : 'warn',
        text: `Kontrak "${c.name}" jatuh tempo ${days === 0 ? 'hari ini' : `${days} hari lagi`}`,
      })
    }
  }

  // Upcoming CC due dates (< 7 days)
  for (const c of creditCards) {
    if (c.current_balance <= 0) continue
    const y = today.getFullYear()
    const m = today.getMonth()
    let due = new Date(y, m, c.due_day)
    if (due < new Date(y, m, today.getDate())) due = new Date(y, m + 1, c.due_day)
    const days = Math.round((due.getTime() - new Date(y, m, today.getDate()).getTime()) / 86_400_000)
    if (days <= 7) {
      alerts.push({
        level: days <= 3 ? 'critical' : 'warn',
        text: `Kartu ${c.name} jatuh tempo ${days} hari lagi · ${formatCurrency(c.current_balance)}`,
      })
    }
  }

  // Budget overrun
  for (const b of monthBudgets) {
    if (b.type !== 'expense' || b.amount <= 0) continue
    const actual = monthTransactions
      .filter((t) => t.type === 'expense' && t.category === b.category)
      .reduce((s, t) => s + t.amount, 0)
    const pct = (actual / b.amount) * 100
    if (pct >= 100) {
      alerts.push({
        level: 'critical',
        text: `Budget ${b.category} over-limit · terpakai ${pct.toFixed(0)}% (${formatCurrency(actual - b.amount)} lewat)`,
      })
    } else if (pct >= 85) {
      alerts.push({
        level: 'warn',
        text: `Budget ${b.category} hampir habis · ${pct.toFixed(0)}% terpakai`,
      })
    }
  }

  // Saving rate reinforcement
  if (savingRate >= 20) {
    alerts.push({
      level: 'good',
      text: `Saving rate kamu ${savingRate.toFixed(1)}% — kategori sehat (>20%). Pertahankan.`,
    })
  } else if (savingRate > 0 && savingRate < 10) {
    alerts.push({
      level: 'warn',
      text: `Saving rate ${savingRate.toFixed(1)}% masih rendah. Target minimum 10%.`,
    })
  }

  // Monthly trend insight
  const prevMonthExp = (() => {
    const y = today.getFullYear()
    const m = today.getMonth() // current
    const prevStart = new Date(y, m - 1, 1).toISOString().split('T')[0]
    const prevEnd   = new Date(y, m, 1).toISOString().split('T')[0]
    return yearTransactions
      .filter((t) => t.type === 'expense' && t.date >= prevStart && t.date < prevEnd)
      .reduce((s, t) => s + t.amount, 0)
  })()
  const currMonthExp = monthTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  if (prevMonthExp > 0 && currMonthExp > 0) {
    const delta = ((currMonthExp - prevMonthExp) / prevMonthExp) * 100
    if (Math.abs(delta) > 15) {
      alerts.push({
        level: delta > 0 ? 'warn' : 'good',
        text: `Pengeluaran bulan ini ${delta > 0 ? 'naik' : 'turun'} ${Math.abs(delta).toFixed(1)}% vs bulan lalu`,
      })
    }
  }

  // Cashflow forecast (very simple: 3-month avg × 3)
  const avg3mo = (() => {
    const y = today.getFullYear()
    const m = today.getMonth()
    let inc = 0, exp = 0, months = 0
    for (let i = 1; i <= 3; i++) {
      const mm = m - i
      const start = new Date(y, mm, 1).toISOString().split('T')[0]
      const end   = new Date(y, mm + 1, 1).toISOString().split('T')[0]
      const txs = yearTransactions.filter((t) => t.date >= start && t.date < end)
      if (txs.length === 0) continue
      inc += txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      exp += txs.filter((t) => t.type !== 'income').reduce((s, t) => s + t.amount, 0)
      months++
    }
    return months > 0 ? { inc: inc / months, exp: exp / months, net: (inc - exp) / months } : null
  })()

  if (alerts.length === 0 && !avg3mo) return null

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Alerts */}
      <div className="s-card p-5 lg:col-span-2">
        <p className="caps">Insights & Alerts</p>
        <h3 className="text-lg font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
          Perlu Perhatian
        </h3>
        {alerts.length === 0 ? (
          <p className="text-sm mt-3" style={{ color: 'var(--ink-muted)' }}>
            Semua terkendali. Keep it up.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {alerts.slice(0, 6).map((a, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-sm rounded-lg p-2.5 border"
                style={{
                  borderColor:
                    a.level === 'critical' ? 'var(--danger)'
                    : a.level === 'warn' ? 'var(--ink)'
                    : 'var(--lime-500)',
                  background:
                    a.level === 'critical' ? 'var(--danger-bg)'
                    : a.level === 'warn' ? 'var(--surface-2)'
                    : 'var(--lime-50)',
                }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full mt-1.5 shrink-0"
                  style={{
                    background:
                      a.level === 'critical' ? 'var(--danger)'
                      : a.level === 'warn' ? 'var(--ink)'
                      : 'var(--lime-500)',
                  }}
                />
                <span style={{ color: 'var(--ink)' }}>{a.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Cashflow forecast 3 bulan */}
      <div className="s-card p-5">
        <p className="caps">Proyeksi 3 Bulan</p>
        <h3 className="text-lg font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
          Forecast Arus Kas
        </h3>
        {avg3mo ? (
          <div className="mt-4 space-y-2 text-sm">
            <Row2 label="Pemasukan /bln" value={avg3mo.inc} />
            <Row2 label="Pengeluaran /bln" value={avg3mo.exp} />
            <div className="pt-2 border-t" style={{ borderColor: 'var(--border-soft)' }}>
              <Row2
                label="Net /bln"
                value={avg3mo.net}
                accent={avg3mo.net >= 0 ? 'var(--lime-700)' : 'var(--danger)'}
                bold
              />
            </div>
            <div className="pt-2 mt-2 border-t text-[11px]" style={{ color: 'var(--ink-soft)', borderColor: 'var(--border-soft)' }}>
              Estimasi saldo bersih 3 bulan ke depan:
              <span className="num font-semibold ml-1" style={{ color: avg3mo.net >= 0 ? 'var(--lime-700)' : 'var(--danger)' }}>
                {formatCurrency(avg3mo.net * 3)}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm mt-3" style={{ color: 'var(--ink-muted)' }}>
            Belum cukup data. Butuh minimal 1 bulan riwayat.
          </p>
        )}
        {/* silence unused variable — reserved for future cash-flow visualization */}
        <span className="hidden">{netCashflow}</span>
      </div>
    </div>
  )
}

function Row2({ label, value, accent, bold }: { label: string; value: number; accent?: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? 'font-semibold' : ''} style={{ color: 'var(--ink-muted)' }}>{label}</span>
      <span className={`num tabular ${bold ? 'font-semibold' : ''}`} style={{ color: accent ?? 'var(--ink)' }}>
        {formatCurrency(value)}
      </span>
    </div>
  )
}
