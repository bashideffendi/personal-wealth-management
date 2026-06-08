'use client'

/**
 * Lazy boundary for the category drill-down's monthly bar chart — keeps recharts
 * out of the route's initial JS (loads when the chart mounts). Same pattern as
 * the dashboard charts.
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'

export function CategoryBarChart({ data }: { data: Array<{ month: string; value: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
        <XAxis dataKey="month" fontSize={11} tick={{ fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
        <YAxis fontSize={11} tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}jt`} tick={{ fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(v: unknown) => formatCurrency(Number(v) || 0)}
          contentStyle={{ background: 'var(--black)', color: 'var(--on-black)', border: '1px solid var(--black-line)', borderRadius: 8, fontSize: 12 }}
        />
        <Bar dataKey="value" fill="#0A0A0A" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
