'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { INVESTMENT_SUBCATS } from '@/lib/constants'
import type { Investment } from '@/types'
import { Loader2, ArrowUpRight, TrendingUp, TrendingDown, Percent, Wallet } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

const CAT_LABELS: Record<string, string> = {
  stock: 'Saham', mutual_fund: 'Reksa Dana', crypto: 'Crypto',
  gold: 'Emas', bond: 'Obligasi', time_deposit: 'Deposito',
  p2p: 'P2P Lending', business: 'Bisnis',
}

export default function InvestmentOverviewPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Investment[]>([])

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('investments').select('*').eq('user_id', user.id)
    setItems((data ?? []) as Investment[])
    setLoading(false)
  }

  const enriched = useMemo(() => {
    return items.map((i) => {
      const invested = (i.quantity || 0) * (i.avg_cost || 0)
      const market = (i.quantity || 0) * (i.current_price || i.avg_cost || 0)
      const pl = market - invested
      return { i, invested, market, pl }
    })
  }, [items])

  const totals = useMemo(() => {
    const invested = enriched.reduce((s, x) => s + x.invested, 0)
    const market = enriched.reduce((s, x) => s + x.market, 0)
    const pl = market - invested
    const plPct = invested > 0 ? (pl / invested) * 100 : 0
    return { invested, market, pl, plPct }
  }, [enriched])

  const byCategory = useMemo(() => {
    const map: Record<string, { invested: number; market: number; count: number }> = {}
    for (const e of enriched) {
      const k = e.i.category
      if (!map[k]) map[k] = { invested: 0, market: 0, count: 0 }
      map[k].invested += e.invested
      map[k].market += e.market
      map[k].count += 1
    }
    return map
  }, [enriched])

  const donut = useMemo(() => {
    return Object.entries(byCategory)
      .filter(([, v]) => v.market > 0)
      .map(([k, v]) => ({ name: CAT_LABELS[k] ?? k, key: k, value: v.market }))
  }, [byCategory])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--indigo-600)' }} />
      </div>
    )
  }

  const up = totals.pl >= 0

  return (
    <div className="space-y-6">
      <div className="dark-card p-6 sm:p-8">
        <p className="caps">Portofolio Investasi</p>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <p className="num tabular text-4xl sm:text-5xl lg:text-6xl font-semibold" style={{ color: 'var(--ink)' }}>
            {formatCurrency(totals.market)}
          </p>
          <span
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold"
            style={{
              background: 'var(--black)',
              color: up ? 'var(--lime-400)' : '#F87171',
            }}
          >
            {up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {up ? '+' : ''}{totals.plPct.toFixed(2)}%
          </span>
        </div>
        <p className="text-sm mt-2" style={{ color: 'var(--on-black-mut)' }}>
          Modal <span className="num">{formatCurrency(totals.invested)}</span>
          {' · '}
          P/L <span className="num">{formatCurrency(totals.pl)}</span>
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniStat label="Modal" value={formatCurrency(totals.invested)} icon={<Wallet className="h-4 w-4" />} glow="glow-indigo" />
        <MiniStat label="Nilai Pasar" value={formatCurrency(totals.market)} icon={<Wallet className="h-4 w-4" />} glow="glow-violet" />
        <MiniStat
          label="P/L"
          value={formatCurrency(totals.pl)}
          icon={up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          glow={up ? 'glow-emerald' : 'glow-rose'}
          accent={up ? '#059669' : '#E11D48'}
        />
        <MiniStat
          label="Return"
          value={`${up ? '+' : ''}${totals.plPct.toFixed(2)}%`}
          icon={<Percent className="h-4 w-4" />}
          glow={up ? 'glow-emerald' : 'glow-rose'}
          accent={up ? '#059669' : '#E11D48'}
        />
      </div>

      {/* Allocation + category grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="glass-card p-6 lg:col-span-2">
          <p className="caps">Alokasi</p>
          <h3 className="font-display text-xl mt-0.5">Komposisi Portofolio</h3>
          {donut.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm" style={{ color: 'var(--ink-soft)' }}>
              Belum ada posisi.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={donut} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" stroke="transparent">
                  {donut.map((_, i) => (
                    <Cell key={i} fill={['#0A0A0A','#A3E635','#F97316','#10B981','#3B82F6','#737373','#8B5CF6','#EF4444'][i % 8]} />
                  ))}
                </Pie>
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => formatCurrency(Number(v) || 0)}
                  contentStyle={{ background: '#fff', border: '1px solid var(--border-soft)', borderRadius: 10, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="lg:col-span-3">
          <p className="caps mb-3">Kategori</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {INVESTMENT_SUBCATS.map((sc) => {
              const cat = sc.slug === 'mutual-fund' ? 'mutual_fund' : sc.slug === 'time-deposit' ? 'time_deposit' : sc.slug
              const data = byCategory[cat] ?? { invested: 0, market: 0, count: 0 }
              const pl = data.market - data.invested
              const pct = data.invested > 0 ? (pl / data.invested) * 100 : 0
              const plUp = pl >= 0
              return (
                <Link
                  key={sc.slug}
                  href={`/dashboard/assets/investment/${sc.slug}`}
                  className="group relative rounded-lg p-4 bg-white border border-[var(--border-soft)] hover:border-[var(--ink)] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold" style={{ color: 'var(--ink)' }}>{sc.label}</p>
                    <ArrowUpRight className="h-4 w-4 opacity-30 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
                  </div>
                  <p className="num text-xl mt-2 tabular font-semibold" style={{ color: 'var(--ink)' }}>
                    {formatCurrency(data.market)}
                  </p>
                  <div className="mt-1 flex items-center justify-between text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                    <span>{data.count} posisi</span>
                    {data.invested > 0 && (
                      <span className="num font-medium" style={{ color: plUp ? 'var(--lime-700)' : 'var(--danger)' }}>
                        {plUp ? '+' : ''}{pct.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniStat({
  label, value, icon, glow, accent,
}: {
  label: string
  value: string
  icon: React.ReactNode
  glow?: string
  accent?: string
}) {
  return (
    <div className={`glass-card p-4 ${glow ?? ''}`}>
      <div className="flex items-center justify-between">
        <p className="caps">{label}</p>
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: 'var(--indigo-50)', color: accent ?? 'var(--indigo-600)' }}
        >
          {icon}
        </div>
      </div>
      <p className="font-display text-xl mt-2 tabular font-bold" style={{ color: accent ?? 'var(--ink)' }}>
        {value}
      </p>
    </div>
  )
}
