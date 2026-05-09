'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import { INVESTMENT_SUBCATS } from '@/lib/constants'
import type { Investment } from '@/types'
import { Loader2, ArrowUpRight, TrendingUp, TrendingDown, Percent, Wallet } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

const CAT_LABELS: Record<string, string> = {
  stock: 'Saham', mutual_fund: 'Reksa Dana', crypto: 'Crypto',
  gold: 'Emas', bond: 'Obligasi', time_deposit: 'Deposito',
  p2p: 'P2P Lending', business: 'Bisnis',
}

// Vivid palette tuned for distinguishability across 8 categories.
// Order matters — 1st category gets emerald (the brand color).
const DONUT_PALETTE = [
  '#10B981', // emerald
  '#0EA5E9', // sky
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EF4444', // coral
  '#EC4899', // pink
  '#14B8A6', // teal
  '#737373', // gray (last resort)
]

// Asset class for diversification analysis (matches Investment.type schema)
const FIXED_INCOME_CATS = new Set(['bond', 'sbn', 'time_deposit'])

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
      .sort((a, b) => b[1].market - a[1].market)
      .map(([k, v]) => ({ name: CAT_LABELS[k] ?? k, key: k, value: v.market }))
  }, [byCategory])

  // Concentration risk: top kategori share of total
  const topCatPct = useMemo(() => {
    const total = donut.reduce((s, d) => s + d.value, 0)
    return total > 0 ? (donut[0]?.value ?? 0) / total * 100 : 0
  }, [donut])
  const diversification: 'rendah' | 'sedang' | 'tinggi' =
    topCatPct === 0 ? 'tinggi'
    : topCatPct > 60 ? 'rendah'
    : topCatPct > 40 ? 'sedang'
    : 'tinggi'

  // Best & worst performers (require positive cost basis to compute %)
  const bestPerformer = useMemo(() => {
    const candidates = enriched.filter((e) => e.invested > 0 && e.market > 0)
    if (candidates.length === 0) return null
    return [...candidates].sort((a, b) => (b.pl / b.invested) - (a.pl / a.invested))[0]
  }, [enriched])
  const worstPerformer = useMemo(() => {
    const candidates = enriched.filter((e) => e.invested > 0 && e.market > 0)
    if (candidates.length === 0) return null
    return [...candidates].sort((a, b) => (a.pl / a.invested) - (b.pl / b.invested))[0]
  }, [enriched])

  // Asset class split for diversification bar
  const { variableShare, fixedShare } = useMemo(() => {
    const fixed = enriched
      .filter((e) => FIXED_INCOME_CATS.has(e.i.category))
      .reduce((s, e) => s + e.market, 0)
    const variable = enriched
      .filter((e) => !FIXED_INCOME_CATS.has(e.i.category))
      .reduce((s, e) => s + e.market, 0)
    const total = fixed + variable
    if (total === 0) return { variableShare: 0, fixedShare: 0 }
    return {
      variableShare: (variable / total) * 100,
      fixedShare: (fixed / total) * 100,
    }
  }, [enriched])

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
        <div className="glass-card p-5 sm:p-6 lg:col-span-2 flex flex-col">
          <div className="flex items-start justify-between gap-2 mb-4">
            <div>
              <p className="caps">Alokasi</p>
              <h3 className="font-display text-xl mt-0.5">Komposisi Portofolio</h3>
            </div>
            {totals.market > 0 && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{
                  background:
                    diversification === 'tinggi' ? 'rgba(16,185,129,0.12)'
                    : diversification === 'sedang' ? 'rgba(245,158,11,0.14)'
                    : 'rgba(239,68,68,0.12)',
                  color:
                    diversification === 'tinggi' ? '#065F46'
                    : diversification === 'sedang' ? '#92400E'
                    : '#991B1B',
                }}
                title={`Top kategori = ${topCatPct.toFixed(0)}% dari portofolio`}
              >
                Diversifikasi {diversification}
              </span>
            )}
          </div>

          {donut.length === 0 ? (
            <div className="h-[220px] flex flex-col items-center justify-center text-center px-4">
              <div
                className="size-12 rounded-2xl flex items-center justify-center text-2xl mb-3"
                style={{ background: 'rgba(14, 165, 233, 0.12)' }}
              >
                📈
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Belum ada posisi</p>
              <p className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>
                Catat saham, reksa dana, crypto, atau emas yang kamu pegang.
              </p>
            </div>
          ) : (
            <>
              {/* Donut with center label */}
              <div className="relative" style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donut}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="transparent"
                    >
                      {donut.map((_, i) => (
                        <Cell key={i} fill={DONUT_PALETTE[i % DONUT_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(v: any) => formatCurrency(Number(v) || 0)}
                      contentStyle={{
                        background: '#fff',
                        border: '1px solid var(--border-soft)',
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                    Total
                  </p>
                  <p className="num tabular text-base font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
                    {formatCompactCurrency(totals.market)}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: up ? '#059669' : '#DC2626' }}>
                    {up ? '+' : ''}{totals.plPct.toFixed(2)}%
                  </p>
                </div>
              </div>

              {/* Category share legend */}
              <div className="mt-3 space-y-1.5">
                {donut.slice(0, 5).map((row, i) => {
                  const pct = totals.market > 0 ? (row.value / totals.market) * 100 : 0
                  return (
                    <div key={row.name} className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 truncate" style={{ color: 'var(--ink-muted)' }}>
                        <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: DONUT_PALETTE[i % DONUT_PALETTE.length] }} />
                        <span className="truncate">{row.name}</span>
                      </span>
                      <span className="tabular shrink-0 ml-2" style={{ color: 'var(--ink)' }}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Top holding callouts: best & worst performer */}
              {(bestPerformer || worstPerformer) && (
                <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-2" style={{ borderColor: 'var(--border-soft)' }}>
                  {bestPerformer && (
                    <div
                      className="rounded-lg p-2.5 border"
                      style={{ background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.20)' }}
                      title={`${bestPerformer.i.name}: ${formatCurrency(bestPerformer.market)}`}
                    >
                      <p className="text-[9px] uppercase tracking-wide" style={{ color: '#059669' }}>
                        ▲ Top performer
                      </p>
                      <p className="text-[11px] font-semibold truncate mt-0.5" style={{ color: 'var(--ink)' }}>
                        {bestPerformer.i.name || CAT_LABELS[bestPerformer.i.category]}
                      </p>
                      <p className="num tabular text-xs font-semibold mt-0.5" style={{ color: '#059669' }}>
                        +{bestPerformer.invested > 0 ? ((bestPerformer.pl / bestPerformer.invested) * 100).toFixed(1) : '0'}%
                      </p>
                    </div>
                  )}
                  {worstPerformer && worstPerformer.invested > 0 && worstPerformer.pl < 0 && (
                    <div
                      className="rounded-lg p-2.5 border"
                      style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.20)' }}
                      title={`${worstPerformer.i.name}: ${formatCurrency(worstPerformer.market)}`}
                    >
                      <p className="text-[9px] uppercase tracking-wide" style={{ color: '#DC2626' }}>
                        ▼ Underperform
                      </p>
                      <p className="text-[11px] font-semibold truncate mt-0.5" style={{ color: 'var(--ink)' }}>
                        {worstPerformer.i.name || CAT_LABELS[worstPerformer.i.category]}
                      </p>
                      <p className="num tabular text-xs font-semibold mt-0.5" style={{ color: '#DC2626' }}>
                        {((worstPerformer.pl / worstPerformer.invested) * 100).toFixed(1)}%
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Asset class split: variable income vs fixed income */}
              {(variableShare > 0 || fixedShare > 0) && (
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] mb-1" style={{ color: 'var(--ink-soft)' }}>
                    <span>Variable income {variableShare.toFixed(0)}%</span>
                    <span>Fixed income {fixedShare.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden flex" style={{ background: 'var(--surface-2)' }}>
                    <div style={{ width: `${variableShare}%`, background: '#0EA5E9' }} />
                    <div style={{ width: `${fixedShare}%`, background: '#F59E0B' }} />
                  </div>
                </div>
              )}
            </>
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
