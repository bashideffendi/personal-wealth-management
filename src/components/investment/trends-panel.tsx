'use client'

/**
 * Charts tab — grid tren metrik per kategori (Growth / Profitability /
 * Valuation / Health). Diport dari finance/invest TrendsPanel, di-restyle ke
 * Klunting LIGHT theme. Murni plotting historical series, gak ada derived math.
 */

import { useState } from 'react'
import { MetricLineChart, type ChartFormat } from './metric-line-chart'

type Category = 'growth' | 'profitability' | 'valuation' | 'health'

const CATEGORIES: {
  key: Category
  label: string
  metrics: {
    title: string
    key: string
    format: ChartFormat
  }[]
}[] = [
  {
    key: 'growth',
    label: 'Growth',
    metrics: [
      { title: 'Revenue', key: 'Revenue', format: 'idr' },
      { title: 'Net Profit', key: 'Net Profit', format: 'idr' },
      { title: 'Gross Profit', key: 'Gross Profit', format: 'idr' },
      { title: 'EBIT', key: 'EBIT', format: 'idr' },
      { title: 'Free Cash Flow', key: 'Free Cash Flow', format: 'idr' },
      { title: 'CFO', key: 'CFO', format: 'idr' },
      { title: 'Ekuitas', key: 'Ekuitas', format: 'idr' },
      { title: 'Dividend Paid', key: 'Dividend', format: 'idr' },
    ],
  },
  {
    key: 'profitability',
    label: 'Profitability',
    metrics: [
      { title: 'ROE', key: 'ROE', format: 'pct' },
      { title: 'ROA', key: 'ROA', format: 'pct' },
      { title: 'ROIC', key: 'ROIC', format: 'pct' },
      { title: 'Net Margin', key: 'Net Profit Margin', format: 'pct' },
      { title: 'Gross Margin', key: 'Gross Profit Margin', format: 'pct' },
      { title: 'Operating Margin', key: 'Operating Profit Margin', format: 'pct' },
      { title: 'FCF Margin', key: 'FCF Margin', format: 'pct' },
    ],
  },
  {
    key: 'valuation',
    label: 'Valuation',
    metrics: [
      { title: 'PE Ratio', key: 'PE Ratio', format: 'ratio' },
      { title: 'PBV', key: 'PBV', format: 'ratio' },
      { title: 'Market Cap', key: 'Market Cap', format: 'idr' },
    ],
  },
  {
    key: 'health',
    label: 'Health',
    metrics: [
      { title: 'Debt to Equity', key: 'Debt to Equity', format: 'ratio' },
      { title: 'Current Ratio', key: 'Current Ratio', format: 'ratio' },
      { title: 'Quick Ratio', key: 'Quick Ratio', format: 'ratio' },
      { title: 'Total Debt', key: 'Total Debt', format: 'idr' },
    ],
  },
]

function seriesToPoints(series: Record<string, number> | undefined) {
  if (!series) return []
  return Object.entries(series)
    .map(([year, value]) => ({ year: Number(year), value }))
    .filter((p) => Number.isFinite(p.year) && Number.isFinite(p.value))
    .sort((a, b) => a.year - b.year)
}

export function TrendsPanel({
  metrics,
}: {
  metrics: Record<string, Record<string, number>>
}) {
  const [category, setCategory] = useState<Category>('growth')

  const active = CATEGORIES.find((c) => c.key === category)!

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => {
          const isActive = category === c.key
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className="px-3 py-1.5 rounded-md text-xs font-semibold transition"
              style={
                isActive
                  ? { background: 'var(--c-primary)', color: '#fff' }
                  : { background: 'var(--surface-2)', color: 'var(--ink-soft)' }
              }
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--ink)'
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--ink-soft)'
              }}
            >
              {c.label}
            </button>
          )
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {active.metrics.map((m) => {
          const data = seriesToPoints(metrics[m.key])
          return (
            <div key={m.key} className="s-card p-4">
              <p className="eyebrow mb-2">{m.title}</p>
              {data.length >= 2 ? (
                <MetricLineChart data={data} format={m.format} height={140} />
              ) : (
                <p className="py-8 text-center text-xs" style={{ color: 'var(--ink-soft)' }}>
                  Belum ada data
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
