'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import { INVESTMENT_SUBCATS } from '@/lib/constants'
import { getInvestmentVisual } from '@/lib/investment-visual'
import type { Investment } from '@/types'
import { Loader2, ArrowUpRight, TrendingUp, TrendingDown, Wallet, Plus, History } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, AreaChart, Area } from 'recharts'
import { CurrencyRates } from '@/components/investment/currency-rates'
import { InstitutionLogo } from '@/components/accounts/institution-logo'
import { EduTip } from '@/components/edu/edu-tip'
import { CalmModeToggle } from '@/components/investment/calm-mode-toggle'
import { assetClassKey, ASSET_CLASS_META, ASSET_CLASS_ORDER, type AssetClassKey } from '@/lib/invest/asset-class'

const MONTHS_SHORT_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

const CHART_RANGES = [
  { key: '1B', label: '1B', days: 30 },
  { key: '3B', label: '3B', days: 90 },
  { key: '1T', label: '1T', days: 365 },
  { key: 'all', label: 'Sejak', days: Infinity },
] as const
type ChartRangeKey = (typeof CHART_RANGES)[number]['key']

interface RdnAccount {
  id: string
  name: string
  current_balance: number
}

export default function InvestmentOverviewPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Investment[]>([])
  const [rdnAccounts, setRdnAccounts] = useState<RdnAccount[]>([])
  const [dividends, setDividends] = useState<{ amount: number; pay_date: string }[]>([])
  const [quotes, setQuotes] = useState<Record<string, { changePct: number | null }>>({})
  const [tab, setTab] = useState<'all' | AssetClassKey>('all')
  const [snapshots, setSnapshots] = useState<{ snapshot_date: string; market_value: number }[]>([])
  const [chartRange, setChartRange] = useState<ChartRangeKey>('all')

  // useCallback so the function is stable and can be a useEffect dep
  // without re-running every render. Same pattern as [slug]/page.tsx.
  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [invRes, rdnRes, divRes, snapRes] = await Promise.all([
      supabase.from('investments').select('*').eq('user_id', user.id),
      supabase
        .from('accounts')
        .select('id, name, current_balance')
        .eq('user_id', user.id)
        .eq('type', 'rdn'),
      supabase
        .from('dividends')
        .select('amount, pay_date')
        .eq('user_id', user.id),
      // portfolio_snapshots may not exist yet (migration 030) — error is
      // swallowed by `?? []`, page still works, chart shows placeholder.
      supabase
        .from('portfolio_snapshots')
        .select('snapshot_date, market_value')
        .eq('user_id', user.id)
        .order('snapshot_date', { ascending: true }),
    ])
    setItems((invRes.data ?? []) as Investment[])
    setRdnAccounts((rdnRes.data ?? []) as RdnAccount[])
    setDividends((divRes.data ?? []) as { amount: number; pay_date: string }[])
    setSnapshots((snapRes.data ?? []) as { snapshot_date: string; market_value: number }[])
    setLoading(false)
  }, [supabase])

  // The set-state-in-effect rule is overly strict for legitimate data-
  // fetching effects (load → setState). The fetch is gated by auth + an
  // unmount guard inside `load` would just add ceremony.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  // Live day-change quotes for tickered holdings (stocks/ETF/crypto). The
  // stored ticker IS the Yahoo symbol (BBCA.JK / AAPL / BTC-USD).
  useEffect(() => {
    const tickers = Array.from(new Set(items.map((i) => i.ticker?.trim()).filter(Boolean))) as string[]
    if (tickers.length === 0) return
    let cancelled = false
    fetch(`/api/quotes?tickers=${encodeURIComponent(tickers.join(','))}`)
      .then((r) => (r.ok ? r.json() : { quotes: [] }))
      .then((d: { quotes?: { ticker: string; changePct: number | null }[] }) => {
        if (cancelled) return
        const map: Record<string, { changePct: number | null }> = {}
        for (const q of d.quotes ?? []) map[q.ticker.toUpperCase()] = { changePct: q.changePct }
        setQuotes(map)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [items])

  const rdnTotal = rdnAccounts.reduce((s, a) => s + (a.current_balance ?? 0), 0)

  const dividenYtd = useMemo(() => {
    const yr = new Date().getFullYear()
    return dividends
      .filter((d) => d.pay_date && new Date(d.pay_date).getFullYear() === yr)
      .reduce((s, d) => s + (d.amount || 0), 0)
  }, [dividends])

  const institutionCount = useMemo(
    () => new Set(items.map((i) => i.platform?.trim()).filter(Boolean)).size,
    [items],
  )

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

  // Finer grouping for allocation + kinerja: `stock` split into IHSG vs US.
  const byClass = useMemo(() => {
    const map: Partial<Record<AssetClassKey, { invested: number; market: number; count: number }>> = {}
    for (const e of enriched) {
      const k = assetClassKey(e.i)
      if (!map[k]) map[k] = { invested: 0, market: 0, count: 0 }
      map[k]!.invested += e.invested
      map[k]!.market += e.market
      map[k]!.count += 1
    }
    return map
  }, [enriched])

  const donut = useMemo(() => {
    return (Object.entries(byClass) as [AssetClassKey, { invested: number; market: number; count: number }][])
      .filter(([, v]) => v.market > 0)
      .sort((a, b) => b[1].market - a[1].market)
      .map(([k, v]) => ({ name: ASSET_CLASS_META[k].label, key: k, color: ASSET_CLASS_META[k].color, value: v.market }))
  }, [byClass])

  // Return-% per asset class (only classes with cost basis), best → worst.
  const kinerja = useMemo(() => {
    return (Object.entries(byClass) as [AssetClassKey, { invested: number; market: number; count: number }][])
      .filter(([, v]) => v.invested > 0)
      .map(([k, v]) => ({
        key: k,
        label: ASSET_CLASS_META[k].label,
        color: ASSET_CLASS_META[k].color,
        returnPct: ((v.market - v.invested) / v.invested) * 100,
      }))
      .sort((a, b) => b.returnPct - a.returnPct)
  }, [byClass])

  // Today's P/L estimate = Σ market × changePct (only quoted holdings).
  const todayPL = useMemo(() => {
    return enriched.reduce((s, e) => {
      const t = e.i.ticker?.toUpperCase()
      const cp = t ? quotes[t]?.changePct : null
      return cp == null ? s : s + e.market * (cp / 100)
    }, 0)
  }, [enriched, quotes])

  // Holding-table tabs: Semua + each class that actually has positions.
  const holdingTabs = useMemo(() => {
    const present = ASSET_CLASS_ORDER.filter((k) => (byClass[k]?.count ?? 0) > 0)
    return [
      { key: 'all' as const, label: 'Semua' },
      ...present.map((k) => ({ key: k as 'all' | AssetClassKey, label: ASSET_CLASS_META[k].label })),
    ]
  }, [byClass])

  const holdingRows = useMemo(() => {
    return enriched
      .filter((e) => tab === 'all' || assetClassKey(e.i) === tab)
      .map((e) => {
        const ck = assetClassKey(e.i)
        const t = e.i.ticker?.toUpperCase()
        return {
          id: e.i.id,
          name: e.i.name,
          sym: (e.i.ticker ?? '').replace(/\.JK$/i, '').toUpperCase(),
          classLabel: ASSET_CLASS_META[ck].label,
          classColor: ASSET_CLASS_META[ck].color,
          qty: e.i.quantity,
          price: e.i.current_price || e.i.avg_cost,
          market: e.market,
          plPct: e.invested > 0 ? (e.pl / e.invested) * 100 : null,
          changePct: t ? (quotes[t]?.changePct ?? null) : null,
        }
      })
      .sort((a, b) => b.market - a.market)
  }, [enriched, tab, quotes])

  // Today's movers — quoted holdings sorted by |Δ%|.
  const movers = useMemo(() => {
    return enriched
      .map((e) => {
        const t = e.i.ticker?.toUpperCase()
        const cp = t ? (quotes[t]?.changePct ?? null) : null
        if (cp == null) return null
        const ck = assetClassKey(e.i)
        return {
          id: e.i.id,
          name: e.i.name,
          sym: (e.i.ticker ?? '').replace(/\.JK$/i, '').toUpperCase(),
          changePct: cp,
          changeRp: e.market * (cp / 100),
          color: ASSET_CLASS_META[ck].color,
        }
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
      .slice(0, 6)
  }, [enriched, quotes])

  // Dividen per bulan, 6 bulan terakhir (real dari tabel dividends).
  const dividen6 = useMemo(() => {
    const now = new Date()
    const months = Array.from({ length: 6 }, (_, k) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - k), 1)
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTHS_SHORT_ID[d.getMonth()], total: 0 }
    })
    const idx = new Map(months.map((m, i) => [m.key, i]))
    for (const dv of dividends) {
      if (!dv.pay_date) continue
      const pd = new Date(dv.pay_date)
      const i = idx.get(`${pd.getFullYear()}-${pd.getMonth()}`)
      if (i != null) months[i].total += dv.amount || 0
    }
    return months
  }, [dividends])

  const dividen6Total = useMemo(() => dividen6.reduce((s, m) => s + m.total, 0), [dividen6])

  const dividen6DeltaPct = useMemo(() => {
    const now = new Date()
    let prev = 0
    for (const dv of dividends) {
      if (!dv.pay_date) continue
      const pd = new Date(dv.pay_date)
      const ago = (now.getFullYear() - pd.getFullYear()) * 12 + (now.getMonth() - pd.getMonth())
      if (ago >= 6 && ago < 12) prev += dv.amount || 0
    }
    return prev > 0 ? ((dividen6Total - prev) / prev) * 100 : null
  }, [dividends, dividen6Total])

  // Equity curve: stored daily snapshots + always-included live "today" point.
  const chartData = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const map = new Map<string, number>()
    for (const s of snapshots) map.set(s.snapshot_date, Number(s.market_value) || 0)
    map.set(today, totals.market)
    const range = CHART_RANGES.find((r) => r.key === chartRange) ?? CHART_RANGES[3]
    let pts = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    if (range.days !== Infinity) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - range.days)
      const cutStr = cutoff.toISOString().slice(0, 10)
      pts = pts.filter(([d]) => d >= cutStr)
    }
    return pts.map(([date, value]) => ({
      label: new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      value,
    }))
  }, [snapshots, totals.market, chartRange])

  // Record today's portfolio value (one row/day). No-op if table 030 isn't
  // applied yet — the error is ignored.
  useEffect(() => {
    if (loading || items.length === 0) return
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const today = new Date().toISOString().slice(0, 10)
      await supabase.from('portfolio_snapshots').upsert(
        { user_id: user.id, snapshot_date: today, market_value: totals.market, invested: totals.invested },
        { onConflict: 'user_id,snapshot_date' },
      )
    })()
    return () => { cancelled = true }
  }, [loading, items, totals, supabase])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--c-mint)' }} />
      </div>
    )
  }

  const up = totals.pl >= 0

  return (
    <div className="space-y-6">
      {/* Page header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">
            Portofolio{institutionCount > 0 ? ` · ${institutionCount} institusi` : ''}
          </p>
          <h1 className="text-3xl font-bold tracking-tight mt-1" style={{ color: 'var(--ink)' }}>
            Investasi
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>
            Ringkasan nilai portofolio, alokasi, dan holding kamu.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CalmModeToggle />
          <Link
            href="/dashboard/assets/investment/stock?tab=dividen"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition hover:bg-[var(--surface-2)]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink-muted)' }}
          >
            <History className="size-3.5" /> Riwayat dividen
          </Link>
          <Link
            href="/dashboard/assets/investment/stock"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition hover:opacity-90"
            style={{ background: 'var(--c-primary)', color: '#fff' }}
          >
            <Plus className="size-3.5" /> Tambah holding
          </Link>
        </div>
      </header>

      {/* Portfolio hero — light card, value-first */}
      <section className="s-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Total Nilai Portofolio</p>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <p
                className="num tabular font-bold leading-none whitespace-nowrap"
                style={{ color: 'var(--ink)', fontSize: 'clamp(34px, 5vw, 54px)', letterSpacing: '-0.035em' }}
              >
                {formatCurrency(totals.market)}
              </p>
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold mb-1"
                style={{
                  background: up ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)',
                  color: up ? 'var(--c-mint)' : 'var(--c-coral)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {up ? '+' : ''}{totals.plPct.toFixed(2)}%
              </span>
            </div>
            <p className="text-sm mt-2" style={{ color: 'var(--ink-muted)' }}>
              Total {up ? 'untung' : 'rugi'}{' '}
              <span className="num tabular font-semibold" style={{ color: up ? 'var(--c-mint)' : 'var(--c-coral)' }}>
                {up ? '+' : ''}{formatCurrency(totals.pl)}
              </span>{' '}
              sejak awal investasi
            </p>
          </div>
          <div className="flex gap-0.5 shrink-0 rounded-lg p-0.5" style={{ background: 'var(--surface-2)' }}>
            {CHART_RANGES.map((r) => {
              const active = chartRange === r.key
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setChartRange(r.key)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition"
                  style={active ? { background: 'var(--surface)', color: 'var(--ink)', boxShadow: '0 1px 2px rgba(16,24,40,0.08)' } : { color: 'var(--ink-soft)' }}
                >
                  {r.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Equity curve — real, from daily snapshots */}
        <div className="mt-4" style={{ height: 150 }}>
          {chartData.length < 2 ? (
            <div className="h-full rounded-xl flex flex-col items-center justify-center text-center px-6" style={{ background: 'var(--surface-2)' }}>
              <p className="text-xs font-medium" style={{ color: 'var(--ink-muted)' }}>Grafik riwayat lagi dikumpulin</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                Nilai portofolio direkam tiap kamu buka halaman ini — balik lagi besok buat lihat kurvanya tumbuh.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={up ? '#10B981' : '#F43F5E'} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={up ? '#10B981' : '#F43F5E'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [formatCurrency(Number(v) || 0), 'Nilai']}
                  contentStyle={{ background: '#fff', border: '1px solid var(--border-soft)', borderRadius: 10, fontSize: 12 }}
                />
                <Area type="monotone" dataKey="value" stroke={up ? '#10B981' : '#F43F5E'} strokeWidth={2} fill="url(#equityFill)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Sub-stats — modal & P/L primary, dividen supporting */}
        <div
          className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-px rounded-xl overflow-hidden border"
          style={{ background: 'var(--border-soft)', borderColor: 'var(--border-soft)' }}
        >
          <HeroStat label="Modal Ditanam" value={formatCurrency(totals.invested)} />
          <HeroStat
            label="Untung / Rugi"
            value={`${up ? '+' : ''}${formatCurrency(totals.pl)}`}
            accent={up ? 'var(--c-mint)' : 'var(--c-coral)'}
          />
          <HeroStat
            label="Hari Ini"
            value={`${todayPL >= 0 ? '+' : '−'}${formatCurrency(Math.abs(todayPL))}`}
            accent={todayPL >= 0 ? 'var(--c-mint)' : 'var(--c-coral)'}
          />
          <HeroStat label="Dividen YTD" value={formatCurrency(dividenYtd)} />
        </div>
      </section>

      {/* Currency rates strip — moved here from the bottom (was after categories).
          Sits between the dark hero and the RDN card so users see FX context
          first, before drilling into the breakdown. */}
      <CurrencyRates />

      {/* Kas di RDN / RDI — kartu PUTIH, chip krem + logo bank, tombol "+" selalu ada */}
      <div className="s-card p-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-3 shrink-0">
          <div
            className="size-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(20,184,166,0.12)' }}
          >
            <Wallet className="size-5" style={{ color: '#0D9488' }} />
          </div>
          <div>
            <p className="eyebrow">Kas di RDN / RDI</p>
            <p className="num tabular text-2xl font-bold leading-tight" style={{ color: 'var(--ink)' }}>
              {formatCurrency(rdnTotal)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {rdnAccounts.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
              title={a.name}
            >
              <InstitutionLogo accountName={a.name} size={18} shape="circle" />
              <span className="font-medium truncate max-w-[140px]" style={{ color: 'var(--ink-muted)' }}>
                {a.name}
              </span>
              <span className="num tabular font-semibold" style={{ color: 'var(--ink)' }}>
                {formatCurrency(a.current_balance)}
              </span>
            </span>
          ))}
          {/* tombol tambah RDN — selalu tampil di sebelah chip */}
          <Link
            href="/dashboard/accounts"
            title="Tambah rekening RDN"
            className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-xs font-medium transition hover:bg-[var(--surface-2)]"
            style={{ borderColor: 'var(--border)', color: 'var(--ink-soft)' }}
          >
            <Plus className="size-3.5" />
            {rdnAccounts.length === 0 ? <span>Tambah rekening RDN</span> : null}
          </Link>
        </div>
        <Link
          href="/dashboard/accounts"
          className="text-xs font-medium inline-flex items-center gap-0.5 hover:underline shrink-0 ml-auto"
          style={{ color: '#0D9488' }}
        >
          Kelola <ArrowUpRight className="size-3.5" />
        </Link>
      </div>

      {/* Kelas Aset — drill-down cards per kategori (klik → detail per slug) */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="eyebrow">Kelas Aset</p>
          <span className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>Klik buat rincian tiap kelas</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {INVESTMENT_SUBCATS.flatMap((sc) => {
            // Saham dipecah jadi 2 kartu (IDX & US) -> nge-link ke halaman terpisah.
            const cards = sc.slug === 'stock'
              ? [
                  { key: 'stock-idx', label: 'Saham IDX', href: '/dashboard/assets/investment/stock-idx', d: byClass.stock_idx },
                  { key: 'stock-us', label: 'Saham US', href: '/dashboard/assets/investment/stock-us', d: byClass.stock_us },
                ]
              : [{
                  key: sc.slug,
                  label: sc.label,
                  href: `/dashboard/assets/investment/${sc.slug}`,
                  d: byCategory[sc.slug === 'mutual-fund' ? 'mutual_fund' : sc.slug === 'time-deposit' ? 'time_deposit' : sc.slug],
                }]
            const visual = getInvestmentVisual(sc.slug)
            const Icon = visual.icon
            return cards.map((c) => {
              const data = c.d ?? { invested: 0, market: 0, count: 0 }
              const pl = data.market - data.invested
              const pct = data.invested > 0 ? (pl / data.invested) * 100 : 0
              const plUp = pl >= 0
              const hasPosition = data.count > 0
              return (
                <Link
                  key={c.key}
                  href={c.href}
                className="group relative rounded-xl p-4 transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden"
                style={{
                  background: visual.bgTint,
                  border: `1px solid ${visual.borderTint}`,
                }}
              >
                <div
                  className="absolute -top-6 -right-6 size-20 rounded-full pointer-events-none transition-opacity group-hover:opacity-100"
                  style={{ background: visual.gradient, opacity: 0.10, filter: 'blur(8px)' }}
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
                <p className="font-semibold text-sm mt-3 tracking-tight" style={{ color: 'var(--ink)' }}>
                  {c.label}
                </p>
                <p className="num text-lg mt-1 tabular font-semibold" style={{ color: 'var(--ink)' }}>
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
                        color: plUp ? '#10B981' : '#F43F5E',
                        background: plUp ? 'rgba(16,185,129,0.10)' : 'rgba(244,63,94,0.10)',
                      }}
                    >
                      {plUp ? '+' : ''}{pct.toFixed(2)}%
                    </span>
                  )}
                </div>
              </Link>
              )
            })
          })}
        </div>
      </div>

      {/* Alokasi donut + Kinerja per kelas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="s-card p-5 sm:p-6 lg:col-span-2 flex flex-col">
          <div className="mb-4">
            <p className="eyebrow">Alokasi</p>
            <h3 className="text-xl font-semibold mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--ink)' }}>
              Komposisi Portofolio
              <EduTip topic="diversification" side="bottom" />
            </h3>
          </div>

          {donut.length === 0 ? (
            <div className="flex-1 min-h-[240px] flex flex-col items-center justify-center text-center px-4">
              <div
                className="size-12 rounded-2xl flex items-center justify-center mb-3"
                style={{ background: 'rgba(14, 165, 233, 0.12)' }}
              >
                <TrendingUp className="size-6" style={{ color: '#0EA5E9' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Belum ada posisi</p>
              <p className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>
                Catat saham, reksa dana, crypto, atau emas yang kamu pegang.
              </p>
            </div>
          ) : (
            <>
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
                      {donut.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
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
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                    {donut.length} Kelas
                  </p>
                  <p className="num tabular text-base font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
                    {formatCompactCurrency(totals.market)}
                  </p>
                </div>
              </div>

              {/* Legend: nama · nilai · % (ngikut referensi) */}
              <div className="mt-4 space-y-2">
                {donut.map((row) => {
                  const pct = totals.market > 0 ? (row.value / totals.market) * 100 : 0
                  return (
                    <div key={row.name} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-2 truncate" style={{ color: 'var(--ink-muted)' }}>
                        <span className="inline-block h-2.5 w-2.5 rounded-[3px] shrink-0" style={{ background: row.color }} />
                        <span className="truncate">{row.name}</span>
                      </span>
                      <span className="flex items-center gap-3 shrink-0">
                        <span className="num tabular" style={{ color: 'var(--ink)' }}>{formatCurrency(row.value)}</span>
                        <span className="num tabular w-9 text-right font-semibold" style={{ color: 'var(--ink-muted)' }}>{pct.toFixed(0)}%</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className="s-card p-5 sm:p-6 lg:col-span-3 flex flex-col">
          <div className="flex items-start justify-between gap-2 mb-4">
            <div>
              <p className="eyebrow">Kinerja</p>
              <h3 className="text-xl font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>Return per Kelas Aset</h3>
            </div>
            <span className="text-[11px] shrink-0 mt-1" style={{ color: 'var(--ink-soft)' }}>sejak awal · per kelas</span>
          </div>
          {kinerja.length === 0 ? (
            <div className="flex-1 min-h-[180px] flex flex-col items-center justify-center text-center">
              <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>Belum ada posisi dengan modal tercatat.</p>
            </div>
          ) : (
            <div className="space-y-3.5 flex-1 flex flex-col justify-center">
              {(() => {
                const max = Math.max(...kinerja.map((k) => Math.abs(k.returnPct)), 1)
                return kinerja.map((row) => {
                  const positive = row.returnPct >= 0
                  const half = Math.max((Math.abs(row.returnPct) / max) * 50, 1.5)
                  return (
                    <div key={row.key} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-xs flex items-center gap-2 truncate" style={{ color: 'var(--ink-muted)' }}>
                        <span className="size-2.5 rounded-[3px] shrink-0" style={{ background: row.color }} />
                        <span className="truncate">{row.label}</span>
                      </span>
                      {/* diverging bar: nol di tengah, plus ke kanan, minus ke kiri */}
                      <div className="relative flex-1 h-3 rounded-full" style={{ background: 'var(--surface-2)' }}>
                        <div className="absolute top-0 bottom-0" style={{ left: '50%', width: 1, background: 'var(--border)' }} />
                        <div
                          className="absolute top-0 bottom-0 rounded-full"
                          style={{
                            left: positive ? '50%' : `${50 - half}%`,
                            width: `${half}%`,
                            background: positive ? 'var(--c-mint)' : 'var(--c-coral)',
                          }}
                        />
                      </div>
                      <span
                        className="num tabular text-xs font-semibold w-16 text-right shrink-0"
                        style={{ color: positive ? 'var(--c-mint)' : 'var(--c-coral)' }}
                      >
                        {positive ? '+' : ''}{row.returnPct.toFixed(1)}%
                      </span>
                    </div>
                  )
                })
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Daftar Holding — semua posisi, filter per kelas */}
      {enriched.length > 0 && (
        <div className="s-card overflow-hidden">
          <div className="p-5 sm:p-6 pb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Holding</p>
              <h3 className="text-xl font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>Daftar Holding</h3>
            </div>
            <div className="flex flex-wrap gap-1">
              {holdingTabs.map((t) => {
                const active = tab === t.key
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-medium transition"
                    style={active
                      ? { background: 'var(--c-primary)', color: '#fff' }
                      : { background: 'var(--surface-2)', color: 'var(--ink-muted)' }}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" style={{ minWidth: 640 }}>
              <thead>
                <tr style={{ background: 'var(--surface-3)' }}>
                  <th className="text-left text-[11px] uppercase tracking-wider font-medium px-3 py-2 whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>Sym</th>
                  <th className="text-left text-[11px] uppercase tracking-wider font-medium px-3 py-2" style={{ color: 'var(--ink-muted)' }}>Nama</th>
                  <th className="text-right text-[11px] uppercase tracking-wider font-medium px-3 py-2 whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>Lot/Unit</th>
                  <th className="text-right text-[11px] uppercase tracking-wider font-medium px-3 py-2 whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>Nilai</th>
                  <th className="text-right text-[11px] uppercase tracking-wider font-medium px-3 py-2 whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>U/R</th>
                  <th className="text-right text-[11px] uppercase tracking-wider font-medium px-3 py-2 whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>Δ Hari</th>
                </tr>
              </thead>
              <tbody>
                {holdingRows.map((r) => {
                  const plUp = (r.plPct ?? 0) >= 0
                  const dUp = (r.changePct ?? 0) >= 0
                  return (
                    <tr key={r.id} className="border-b transition-colors hover:bg-[var(--surface-2)]" style={{ borderColor: 'var(--border-soft)' }}>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="num tabular text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${r.classColor}1A`, color: r.classColor }}>
                          {r.sym || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 max-w-[260px]">
                        <p className="truncate font-medium" style={{ color: 'var(--ink)' }}>{r.name}</p>
                        <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{r.classLabel}</p>
                      </td>
                      <td className="px-3 py-2.5 text-right num tabular whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>
                        {r.qty.toLocaleString('id-ID')}
                      </td>
                      <td className="px-3 py-2.5 text-right num tabular font-semibold whitespace-nowrap" style={{ color: 'var(--ink)' }}>
                        {formatCurrency(r.market)}
                      </td>
                      <td className="px-3 py-2.5 text-right num tabular whitespace-nowrap" style={{ color: r.plPct == null ? 'var(--ink-soft)' : plUp ? 'var(--c-mint)' : 'var(--c-coral)' }}>
                        {r.plPct == null ? '—' : `${plUp ? '+' : ''}${r.plPct.toFixed(1)}%`}
                      </td>
                      <td className="px-3 py-2.5 text-right num tabular whitespace-nowrap" style={{ color: r.changePct == null ? 'var(--ink-soft)' : dUp ? 'var(--c-mint)' : 'var(--c-coral)' }}>
                        {r.changePct == null ? '—' : `${dUp ? '+' : ''}${r.changePct.toFixed(2)}%`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bottom row: Dividen 6 bulan + Pergerakan hari ini */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start">
        {/* Dividen 6 bulan — real dari tabel dividends */}
        <div className={`s-card p-5 sm:p-6 ${movers.length === 0 ? 'lg:col-span-2' : ''}`}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="eyebrow">Dividen 6 Bulan</p>
              <p className="num tabular text-2xl font-bold mt-1" style={{ color: 'var(--ink)' }}>{formatCurrency(dividen6Total)}</p>
            </div>
            {dividen6DeltaPct != null && (
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                style={{
                  background: dividen6DeltaPct >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)',
                  color: dividen6DeltaPct >= 0 ? 'var(--c-mint)' : 'var(--c-coral)',
                }}
              >
                {dividen6DeltaPct >= 0 ? '+' : ''}{dividen6DeltaPct.toFixed(0)}% vs 6 bln lalu
              </span>
            )}
          </div>
          {dividen6Total === 0 ? (
            <div className="h-[160px] flex flex-col items-center justify-center text-center">
              <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>Belum ada dividen tercatat 6 bulan terakhir.</p>
              <Link href="/dashboard/assets/investment/stock?tab=dividen" className="text-xs mt-1 hover:underline" style={{ color: '#0D9488' }}>
                Catat dividen →
              </Link>
            </div>
          ) : (
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dividen6} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--ink-soft)' }} />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any) => [formatCurrency(Number(v) || 0), 'Dividen']}
                    cursor={{ fill: 'var(--surface-2)' }}
                    contentStyle={{ background: '#fff', border: '1px solid var(--border-soft)', borderRadius: 10, fontSize: 12 }}
                  />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                    {(() => {
                      const max = Math.max(...dividen6.map((x) => x.total), 1)
                      return dividen6.map((m, i) => (
                        <Cell key={i} fill={m.total >= max && m.total > 0 ? '#10B981' : 'rgba(16,185,129,0.28)'} />
                      ))
                    })()}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Pergerakan hari ini */}
        {movers.length > 0 && (
          <div className="s-card p-5 sm:p-6">
            <p className="eyebrow">Hari Ini</p>
            <h3 className="text-xl font-semibold mt-0.5 mb-3" style={{ color: 'var(--ink)' }}>Pergerakan Hari Ini</h3>
            <div>
              {movers.map((m) => {
                const pos = m.changePct >= 0
                return (
                  <div key={m.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0" style={{ borderColor: 'var(--border-soft)' }}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="size-8 rounded-full grid place-items-center text-[10px] font-bold shrink-0" style={{ background: `${m.color}1A`, color: m.color }}>
                        {m.sym.slice(0, 4) || '—'}
                      </span>
                      <span className="truncate text-sm" style={{ color: 'var(--ink)' }}>{m.name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="num tabular text-sm font-semibold" style={{ color: pos ? 'var(--c-mint)' : 'var(--c-coral)' }}>
                        {pos ? '+' : '−'}{formatCurrency(Math.abs(m.changeRp))}
                      </p>
                      <p className="num tabular text-[11px]" style={{ color: pos ? 'var(--c-mint)' : 'var(--c-coral)' }}>
                        {pos ? '▲' : '▼'} {Math.abs(m.changePct).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}

function HeroStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="p-3.5" style={{ background: 'var(--surface)' }}>
      <p className="eyebrow">{label}</p>
      <p className="num tabular text-lg font-bold mt-1" style={{ color: accent ?? 'var(--ink)' }}>
        {value}
      </p>
    </div>
  )
}
