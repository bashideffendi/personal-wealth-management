'use client'

/**
 * Dashboard recharts charts, extracted out of dashboard/page.tsx so recharts
 * (+ its d3 deps) can be code-split. The page lazy-imports these via
 * next/dynamic (ssr:false), keeping recharts out of the dashboard's initial JS
 * — it loads only once a chart mounts. Visuals are byte-for-byte the same as
 * the previous inline charts.
 */

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { useT } from '@/lib/i18n/context'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const formatTooltipValue = (value: any) => formatCurrency(Number(value) || 0)

export function MonthlyFlowChart({ data }: { data: Array<{ month: string; income: number; expense: number }> }) {
  const t = useT()
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barGap={4} barCategoryGap="20%">
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
        <XAxis
          dataKey="month"
          fontSize={11}
          tick={{ fill: 'var(--ink-muted)' }}
          axisLine={{ stroke: 'var(--border-soft)' }}
          tickLine={false}
        />
        <YAxis
          fontSize={11}
          tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}jt`}
          tick={{ fill: 'var(--ink-muted)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={formatTooltipValue}
          contentStyle={{
            backgroundColor: 'var(--black)',
            border: '1px solid var(--black-line)',
            borderRadius: '8px',
            fontSize: 12,
            color: 'var(--on-black)',
          }}
          labelStyle={{ color: 'var(--on-black-mut)' }}
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
        <Bar dataKey="income" name={t('dashboard.kpi_income')} fill="#10B981" radius={[3, 3, 0, 0]} maxBarSize={24} />
        <Bar dataKey="expense" name={t('dashboard.kpi_expense')} fill="#F43F5E" radius={[3, 3, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function InvestmentPie({ data, palette }: { data: Array<{ value: number; name?: string }>; palette: string[] }) {
  return (
    <ResponsiveContainer width={120} height={120}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={36} outerRadius={56} paddingAngle={2} dataKey="value" stroke="var(--surface)" strokeWidth={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={formatTooltipValue}
          contentStyle={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border-soft)',
            borderRadius: '8px',
            fontSize: 12,
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
