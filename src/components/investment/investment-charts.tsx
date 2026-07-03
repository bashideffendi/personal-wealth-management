'use client'

/**
 * Lazy boundary for the investment overview charts (equity area + allocation
 * donut + dividend bar) — keeps recharts out of the route's initial JS.
 *
 * All three are React.memo'd: their props are referentially stable memos from
 * the page, so interactions elsewhere (holding-table tab, class expander)
 * never re-render a recharts tree.
 */

import { memo } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, AreaChart, Area,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { useT } from '@/lib/i18n/context'

export const EquityArea = memo(function EquityArea({ data, up }: { data: Array<{ value: number }>; up: boolean }) {
  const t = useT()
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={up ? 'var(--c-mint)' : 'var(--c-coral)'} stopOpacity={0.22} />
            <stop offset="100%" stopColor={up ? 'var(--c-mint)' : 'var(--c-coral)'} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(v: any) => [formatCurrency(Number(v) || 0), t('investment.value')]}
          contentStyle={{ background: 'var(--black)', color: 'var(--on-black)', border: '1px solid var(--black-line)', borderRadius: 10, fontSize: 12 }}
        />
        <Area type="monotone" dataKey="value" stroke={up ? 'var(--c-mint)' : 'var(--c-coral)'} strokeWidth={2} fill="url(#equityFill)" />
      </AreaChart>
    </ResponsiveContainer>
  )
})

export const AllocationDonut = memo(function AllocationDonut({ data }: { data: Array<{ value: number; color: string }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        {/* F11: radius persentase — ikut tinggi container (150px mobile /
            180px desktop) tanpa kepotong, proporsi lubang tetap ~69% */}
        <Pie data={data} cx="50%" cy="50%" innerRadius="62%" outerRadius="90%" paddingAngle={3} dataKey="value" stroke="transparent">
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(v: any) => formatCurrency(Number(v) || 0)}
          contentStyle={{ background: 'var(--black)', color: 'var(--on-black)', border: '1px solid var(--black-line)', borderRadius: 10, fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
})

export const DividendBar = memo(function DividendBar({ data }: { data: Array<{ label: string; total: number }> }) {
  const t = useT()
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--ink-soft)' }} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(v: any) => [formatCurrency(Number(v) || 0), t('investment.dividend')]}
          cursor={{ fill: 'var(--surface-2)' }}
          contentStyle={{ background: 'var(--black)', color: 'var(--on-black)', border: '1px solid var(--black-line)', borderRadius: 10, fontSize: 12 }}
        />
        <Bar dataKey="total" radius={[6, 6, 0, 0]}>
          {(() => {
            const max = Math.max(...data.map((x) => x.total), 1)
            return data.map((m, i) => (
              <Cell key={i} fill={m.total >= max && m.total > 0 ? 'var(--c-mint)' : 'color-mix(in srgb, var(--c-mint) 28%, transparent)'} />
            ))
          })()}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
})
