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

const PIE_COLORS = ['#10B981', '#0EA5E9', '#F59E0B', '#F43F5E', '#8B5CF6', '#34D399', '#7DD3FC', '#737373']

export function AllocationPie({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" stroke="transparent">
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % 8]} />
          ))}
        </Pie>
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(v: any) => formatCurrency(Number(v) || 0)}
          contentStyle={{ background: '#fff', border: '1px solid var(--border-soft)', borderRadius: 10, fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function NonLiquidBar({ data, categoryColors }: { data: Record<string, number>; categoryColors: Record<string, string> }) {
  const rows = Object.entries(data).map(([k, v]) => ({
    name: ({ property: 'Properti', vehicle: 'Kendaraan', personal_item: 'Barang Pribadi' } as Record<string, string>)[k] ?? k,
    value: v,
    color: categoryColors[k] ?? '#10B981',
  }))
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows}>
        <defs>
          <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity={1} />
            <stop offset="100%" stopColor="#047857" stopOpacity={0.85} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
        <XAxis dataKey="name" fontSize={11} tick={{ fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
        <YAxis fontSize={11} tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}jt`} tick={{ fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(v: any) => formatCurrency(Number(v) || 0)}
          contentStyle={{ background: '#fff', border: '1px solid var(--border-soft)', borderRadius: 10, fontSize: 12 }}
        />
        <Bar dataKey="value" fill="url(#bar-grad)" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
