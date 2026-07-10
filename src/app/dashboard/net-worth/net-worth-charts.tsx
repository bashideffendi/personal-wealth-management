'use client'

/**
 * Lazy boundary for the net-worth page's two recharts charts (projection +
 * history) — keeps recharts out of the route's initial JS. JSX copied verbatim
 * from the page; data/accent passed as props, t()/formatters resolved here.
 */

import {
  ComposedChart, Area, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import { useT, useI18n } from '@/lib/i18n/context'

export function ProjectionChart({ data, accent }: { data: Array<{ label: string; netWorth: number }>; accent: string }) {
  const t = useT()
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--ink-soft)' }} interval="preserveStartEnd" minTickGap={28} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={(v) => formatCompactCurrency(Number(v))} tick={{ fontSize: 10, fill: 'var(--ink-soft)' }} width={62} tickLine={false} axisLine={false} />
        <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', fontSize: 12 }} />
        <ReferenceLine y={0} stroke="var(--border)" />
        {/* F10: area lembut di bawah garis — proyeksi gak lagi garis sendirian
            di grid kosong */}
        <Area type="monotone" dataKey="netWorth" name={t('networth.net_worth')} stroke={accent} strokeWidth={2} fill={accent} fillOpacity={0.08} dot={false} activeDot={{ r: 4 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function HistoryChart({ data }: { data: Array<{ date: string; rawDate: string; assets: number; debts: number; net: number }> }) {
  const { t, locale } = useI18n()
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 8 }}>
        {/* F10: fill SOLID warna brand — gradasi opacity lama bikin bar butek
            kecoklatan di kanvas terang + noise. Utang solid coral biar tegas. */}
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
        <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1} />
        <XAxis dataKey="date" fontSize={11} tick={{ fill: 'var(--ink-muted)' }} axisLine={{ stroke: 'var(--border-soft)' }} tickLine={false} />
        <YAxis fontSize={11} tickFormatter={(v: number) => formatCompactCurrency(v)} tick={{ fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} width={70} />
        <Tooltip content={({ active, payload }) => {
          if (!active || !payload?.length) return null
          const p = payload[0].payload as { rawDate: string; assets: number; debts: number; net: number }
          return (
            <div className="rounded-md border px-3 py-2 text-xs shadow-[var(--card-shadow)]" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}>
              <p className="font-semibold mb-1.5">{new Date(p.rawDate).toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p className="num tabular flex justify-between gap-3"><span style={{ color: 'var(--c-mint-ink)' }}>● {t('networth.assets')}</span><span>{formatCurrency(p.assets)}</span></p>
              <p className="num tabular flex justify-between gap-3"><span style={{ color: 'var(--c-coral-ink)' }}>● {t('networth.debt')}</span><span>{formatCurrency(Math.abs(p.debts))}</span></p>
              <p className="num tabular flex justify-between gap-3 font-semibold mt-1 pt-1 border-t" style={{ borderColor: 'var(--border-soft)' }}><span style={{ color: 'var(--c-violet-ink)' }}>● {t('networth.net_worth')}</span><span>{formatCurrency(p.net)}</span></p>
            </div>
          )
        }} />
        <Bar dataKey="assets" name={t('networth.assets')} fill="var(--c-mint)" stackId="a" radius={[4, 4, 0, 0]} />
        <Bar dataKey="debts" name={t('networth.debt')} fill="var(--c-coral)" stackId="a" radius={[0, 0, 4, 4]} />
        {/* dot per titik dibuang — data mingguan bikin polka-dot rame; garis
            bersih + activeDot pas di-tap aja */}
        <Line type="monotone" dataKey="net" name={t('networth.net_worth')} stroke="var(--c-violet)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
