'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import { INVESTMENT_SUBCATS } from '@/lib/constants'
import { getInvestmentVisual } from '@/lib/investment-visual'
import type { Investment } from '@/types'
import { Loader2, ArrowUpRight, TrendingUp, TrendingDown, Percent, Wallet } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { CurrencyRates } from '@/components/investment/currency-rates'
import { InstitutionLogo } from '@/components/accounts/institution-logo'
import { usePrivacy } from '@/components/privacy/privacy-provider'
import { EduTip } from '@/components/edu/edu-tip'

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

interface RdnAccount {
  id: string
  name: string
  current_balance: number
}

export default function InvestmentOverviewPage() {
  const supabase = createClient()
  const { hidden: privacyHidden } = usePrivacy()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Investment[]>([])
  const [rdnAccounts, setRdnAccounts] = useState<RdnAccount[]>([])

  // useCallback so the function is stable and can be a useEffect dep
  // without re-running every render. Same pattern as [slug]/page.tsx.
  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [invRes, rdnRes] = await Promise.all([
      supabase.from('investments').select('*').eq('user_id', user.id),
      supabase
        .from('accounts')
        .select('id, name, current_balance')
        .eq('user_id', user.id)
        .eq('type', 'rdn'),
    ])
    setItems((invRes.data ?? []) as Investment[])
    setRdnAccounts((rdnRes.data ?? []) as RdnAccount[])
    setLoading(false)
  }, [supabase])

  // The set-state-in-effect rule is overly strict for legitimate data-
  // fetching effects (load → setState). The fetch is gated by auth + an
  // unmount guard inside `load` would just add ceremony.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  const rdnTotal = rdnAccounts.reduce((s, a) => s + (a.current_balance ?? 0), 0)

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
        <p className="caps" style={{ color: 'var(--emerald-300)' }}>Portofolio Investasi</p>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <p
            className="num tabular leading-none font-bold"
            style={{
              color: 'var(--on-black)',
              fontSize: 'clamp(40px, 6vw, 56px)',
              letterSpacing: '-0.035em',
            }}
          >
            {formatCurrency(totals.market)}
          </p>
          <span
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide mb-2"
            style={{
              background: up ? 'rgba(16,185,129,0.18)' : 'rgba(244,63,94,0.18)',
              color: up ? 'var(--emerald-300)' : 'var(--coral-400)',
            }}
          >
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {up ? '+' : ''}{totals.plPct.toFixed(2)}%
          </span>
        </div>
        <p className="text-sm mt-3" style={{ color: 'var(--on-black-mut)' }}>
          Modal <span className="num font-semibold" style={{ color: 'var(--on-black)' }}>{formatCurrency(totals.invested)}</span>
          {' · '}
          P/L <span className="num font-semibold" style={{ color: up ? 'var(--emerald-300)' : 'var(--coral-400)' }}>{formatCurrency(totals.pl)}</span>
        </p>
      </div>

      {/* Currency rates strip — moved here from the bottom (was after categories).
          Sits between the dark hero and the RDN card so users see FX context
          first, before drilling into the breakdown. */}
      <CurrencyRates />

      {/* RDN/RDI cash card — total broker cash sitting idle, with per-broker breakdown */}
      {rdnAccounts.length > 0 && (
        <div
          className="rounded-xl border p-4 sm:p-5"
          style={{
            background: 'linear-gradient(135deg, rgba(20,184,166,0.06), rgba(14,165,233,0.04))',
            borderColor: 'rgba(20,184,166,0.25)',
          }}
        >
          <div className="flex items-end justify-between flex-wrap gap-3 mb-3">
            <div>
              <p className="caps">Dana di RDN / RDI</p>
              <p className="num tabular text-2xl font-semibold mt-1" style={{ color: 'var(--ink)' }}>
                {formatCurrency(rdnTotal)}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                Cash di rekening broker — siap dipakai beli/sell
              </p>
            </div>
            <Link
              href="/dashboard/accounts"
              className="text-[11px] font-medium inline-flex items-center gap-0.5 hover:underline"
              style={{ color: 'var(--emerald-700, #047857)' }}
            >
              Kelola akun <ArrowUpRight className="size-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {rdnAccounts.map((a) => (
              <div
                key={a.id}
                className="rounded-lg border p-2.5 flex items-center gap-2"
                style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)' }}
              >
                <InstitutionLogo accountName={a.name} size={32} shape="circle" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium truncate" style={{ color: 'var(--ink)' }}>
                    {a.name}
                  </p>
                  <p className="num tabular text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                    {formatCurrency(a.current_balance)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* Allocation + category grid — items-start so the left card stays at
          its natural height instead of stretching to match the (often taller)
          right column, which leaves blank space below. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 items-start">
        <div className="glass-card p-5 sm:p-6 lg:col-span-2 flex flex-col">
          <div className="flex items-start justify-between gap-2 mb-4">
            <div>
              <p className="caps">Alokasi</p>
              <h3 className="text-xl font-semibold mt-0.5 flex items-center gap-1.5">
                Komposisi Portofolio
                <EduTip topic="diversification" side="bottom" />
              </h3>
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
                <div className="mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-2" style={{ borderColor: 'var(--border-soft)' }}>
                  {bestPerformer && (
                    <div
                      className="rounded-lg p-2.5 border"
                      style={{ background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.20)' }}
                      title={privacyHidden ? bestPerformer.i.name : `${bestPerformer.i.name}: ${formatCurrency(bestPerformer.market)}`}
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
                      title={privacyHidden ? worstPerformer.i.name : `${worstPerformer.i.name}: ${formatCurrency(worstPerformer.market)}`}
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
              const visual = getInvestmentVisual(sc.slug)
              const Icon = visual.icon
              const hasPosition = data.count > 0
              return (
                <Link
                  key={sc.slug}
                  href={`/dashboard/assets/investment/${sc.slug}`}
                  className="group relative rounded-xl p-4 transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden"
                  style={{
                    background: hasPosition ? '#FFFFFF' : visual.bgTint,
                    border: `1px solid ${hasPosition ? visual.borderTint : 'var(--border-soft)'}`,
                  }}
                >
                  {/* Decorative gradient orb in corner */}
                  <div
                    className="absolute -top-6 -right-6 size-20 rounded-full pointer-events-none transition-opacity group-hover:opacity-100"
                    style={{
                      background: visual.gradient,
                      opacity: hasPosition ? 0.10 : 0.06,
                      filter: 'blur(8px)',
                    }}
                    aria-hidden="true"
                  />

                  <div className="relative flex items-start justify-between gap-2">
                    <div
                      className="size-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                      style={{ background: visual.gradient, color: '#FFFFFF' }}
                    >
                      <Icon className="size-5" strokeWidth={2} />
                    </div>
                    <ArrowUpRight
                      className="size-4 opacity-30 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition shrink-0 mt-1.5"
                      style={{ color: visual.fg }}
                    />
                  </div>

                  <p
                    className="font-semibold text-sm mt-3 tracking-tight"
                    style={{ color: 'var(--ink)' }}
                  >
                    {sc.label}
                  </p>

                  <p
                    className="num text-lg mt-1 tabular font-semibold"
                    style={{ color: 'var(--ink)' }}
                  >
                    {formatCurrency(data.market)}
                  </p>

                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span style={{ color: 'var(--ink-soft)' }}>
                      {hasPosition ? `${data.count} posisi` : 'Belum ada posisi'}
                    </span>
                    {data.invested > 0 && (
                      <span
                        className="num font-semibold tabular px-1.5 py-0.5 rounded"
                        style={{
                          color: plUp ? '#059669' : '#DC2626',
                          background: plUp ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.10)',
                        }}
                      >
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
      <p className="num text-xl mt-2 tabular font-bold" style={{ color: accent ?? 'var(--ink)' }}>
        {value}
      </p>
    </div>
  )
}
