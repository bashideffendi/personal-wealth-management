'use client'

/**
 * Per-metric historical line chart untuk Charts tab (TrendsPanel).
 * Diport dari finance/invest metric-line-chart, di-restyle ke Klunting LIGHT
 * theme — axis var(--ink-soft), no vertical grid, tooltip kartu putih.
 */

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type Point = { year: string | number; value: number }

export type ChartFormat = 'idr' | 'pct' | 'ratio' | 'number'

function fmt(value: number, format: ChartFormat): string {
  if (value === null || value === undefined || isNaN(value)) return '—'
  if (format === 'pct') {
    return new Intl.NumberFormat('id-ID', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }
  if (format === 'ratio') return `${value.toFixed(2)}x`
  if (format === 'idr') {
    const abs = Math.abs(value)
    const sign = value < 0 ? '−' : ''
    if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)} T`
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)} M`
    if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)} Jt`
    if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(2)} rb`
    return value.toLocaleString('id-ID', { maximumFractionDigits: 0 })
  }
  return value.toLocaleString('id-ID', { maximumFractionDigits: 2 })
}

export function MetricLineChart({
  data,
  color = 'var(--c-mint)',
  format = 'number',
  height = 140,
}: {
  data: Point[]
  color?: string
  format?: ChartFormat
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
        <XAxis
          dataKey="year"
          tick={{ fontSize: 11, fill: 'var(--ink-soft)' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--ink-soft)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => fmt(v, format)}
          width={64}
        />
        <Tooltip
          cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content={({ active, payload, label }: any) => {
            if (!active || !payload?.length) return null
            const v = payload[0].value as number
            return (
              <div
                className="rounded-lg px-2.5 py-1.5 shadow"
                style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)' }}
              >
                <p className="num tabular text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                  {typeof v === 'number' ? fmt(v, format) : '—'}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                  {String(label ?? '')}
                </p>
              </div>
            )
          }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={{ r: 3, fill: color }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
