'use client'

import { formatCurrency } from '@/lib/utils'
import { rootCategory } from '@/lib/budget-categories'
import { useT } from '@/lib/i18n/context'
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
  /** Render only one sub-card so alerts & forecast can be separate bento cards. */
  part?: 'alerts' | 'forecast'
}

export function InsightsPanel({
  monthTransactions, yearTransactions, monthBudgets, creditCards, contracts, savingRate, part,
}: InsightsPanelProps) {
  const t = useT()
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

  // Budget overrun — roll-up ke kategori INDUK (sama kayak dashboard
  // budgetProgress): budget sub 'Induk › Sub' + transaksi induk/sub disamain di
  // root biar persen-nya match halaman Anggaran & gak salah hitung. Skip Transfer.
  {
    const actualByRoot = new Map<string, number>()
    for (const t of monthTransactions) {
      if (t.type !== 'expense' || t.category === 'Transfer') continue
      const root = rootCategory(t.category)
      actualByRoot.set(root, (actualByRoot.get(root) ?? 0) + t.amount)
    }
    const budgetByRoot = new Map<string, number>()
    for (const b of monthBudgets) {
      if (b.type !== 'expense' || b.amount <= 0) continue
      const root = rootCategory(b.category)
      budgetByRoot.set(root, (budgetByRoot.get(root) ?? 0) + b.amount)
    }
    for (const [category, budget] of budgetByRoot) {
      const actual = actualByRoot.get(category) ?? 0
      const pct = (actual / budget) * 100
      if (pct >= 100) {
        alerts.push({
          level: 'critical',
          text: `Budget ${category} over-limit · terpakai ${pct.toFixed(0)}% (${formatCurrency(actual - budget)} lewat)`,
        })
      } else if (pct >= 85) {
        alerts.push({
          level: 'warn',
          text: `Budget ${category} hampir habis · ${pct.toFixed(0)}% terpakai`,
        })
      }
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
      .filter((t) => t.type === 'expense' && t.category !== 'Transfer' && t.date >= prevStart && t.date < prevEnd)
      .reduce((s, t) => s + t.amount, 0)
  })()
  const currMonthExp = monthTransactions.filter((t) => t.type === 'expense' && t.category !== 'Transfer').reduce((s, t) => s + t.amount, 0)
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

  const alertsCard = (
    <div className="s-card s-card-pad-lg h-full flex flex-col">
        <p className="eyebrow">{t('insights_panel.alerts_eyebrow')}</p>
        <h3 className="font-bold mt-1" style={{ fontSize: 16, color: 'var(--ink)', letterSpacing: '-0.015em' }}>
          {t('insights_panel.alerts_title')}
        </h3>
        {alerts.length === 0 ? (
          <p className="text-sm mt-3" style={{ color: 'var(--ink-muted)' }}>
            {t('insights_panel.alerts_empty')}
          </p>
        ) : (
          <ul className="mt-3 space-y-2 flex-1 min-h-0 overflow-y-auto">
            {alerts.slice(0, 6).map((a, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-sm rounded-lg p-2.5"
                style={{
                  background:
                    a.level === 'critical' ? 'var(--c-coral-soft)'
                    : a.level === 'warn' ? 'var(--c-amber-soft)'
                    : 'var(--c-mint-soft)',
                  border:
                    a.level === 'critical' ? '1px solid color-mix(in srgb, var(--c-coral) 25%, transparent)'
                    : a.level === 'warn' ? '1px solid color-mix(in srgb, var(--c-amber) 25%, transparent)'
                    : '1px solid color-mix(in srgb, var(--c-mint) 25%, transparent)',
                }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full mt-1.5 shrink-0"
                  style={{
                    background:
                      a.level === 'critical' ? 'var(--c-coral)'
                      : a.level === 'warn' ? 'var(--c-amber)'
                      : 'var(--c-mint)',
                  }}
                />
                <span style={{ color: 'var(--ink)' }}>{a.text}</span>
              </li>
            ))}
          </ul>
        )}
    </div>
  )

  const forecastCard = (
    <div className="s-card s-card-pad-lg h-full">
        <p className="eyebrow">{t('insights_panel.forecast_eyebrow')}</p>
        <h3 className="font-bold mt-1" style={{ fontSize: 16, color: 'var(--ink)', letterSpacing: '-0.015em' }}>
          {t('insights_panel.forecast_title')}
        </h3>
        {avg3mo ? (
          <div className="mt-4 space-y-2 text-sm">
            <Row2 label={t('insights_panel.row_income')} value={avg3mo.inc} />
            <Row2 label={t('insights_panel.row_expense')} value={avg3mo.exp} />
            <div className="pt-2 border-t" style={{ borderColor: 'var(--border-soft)' }}>
              <Row2
                label={t('insights_panel.row_net')}
                value={avg3mo.net}
                accent={avg3mo.net >= 0 ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)'}
                bold
              />
            </div>
            <div className="pt-2 mt-2 border-t text-[11px]" style={{ color: 'var(--ink-soft)', borderColor: 'var(--border-soft)' }}>
              {t('insights_panel.forecast_estimate_label')}
              <span className="num font-semibold ml-1" style={{ color: avg3mo.net >= 0 ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}>
                {formatCurrency(avg3mo.net * 3)}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm mt-3" style={{ color: 'var(--ink-muted)' }}>
            {t('insights_panel.forecast_empty')}
          </p>
        )}
    </div>
  )

  if (part === 'alerts') return alertsCard
  if (part === 'forecast') return forecastCard
  if (alerts.length === 0 && !avg3mo) return null
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">{alertsCard}</div>
      {forecastCard}
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
