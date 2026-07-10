'use client'

/**
 * Lazy boundary for the assets page charts (allocation pie + non-liquid bar) —
 * keeps recharts out of the route's initial JS. JSX copied verbatim; data +
 * category colors passed as props.
 */

import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

// Fallback default — urutan SAMA dengan CHART_PALETTE dashboard & ALLOC_PALETTE
// (4 warna logo → -ink → amber terakhir) biar warna kategori konsisten se-app.
const PIE_COLORS = [
  'var(--c-mint)', 'var(--c-blue)', 'var(--c-violet)', 'var(--c-coral)',
  'var(--c-mint-ink)', 'var(--c-blue-ink)', 'var(--c-violet-ink)', 'var(--c-coral-ink)',
  'var(--c-amber)',
]

export function AllocationPie({ data, palette }: { data: Array<{ name: string; value: number }>; palette?: string[] }) {
  const colors = palette && palette.length > 0 ? palette : PIE_COLORS
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" stroke="transparent">
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(v: any) => formatCurrency(Number(v) || 0)}
          contentStyle={{ background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border-soft)', borderRadius: 10, fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function NonLiquidBar({ rows }: { rows: Array<{ name: string; value: number; color: string }> }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
        <XAxis dataKey="name" fontSize={11} tick={{ fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
        <YAxis fontSize={11} tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}jt`} tick={{ fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(v: any) => formatCurrency(Number(v) || 0)}
          contentStyle={{ background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border-soft)', borderRadius: 10, fontSize: 12 }}
        />
        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
          {rows.map((r, i) => <Cell key={i} fill={r.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
