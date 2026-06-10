'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { INVESTMENT_SUBCATS } from '@/lib/constants'
import { getInvestmentVisual } from '@/lib/investment-visual'
import type { Investment } from '@/types'
import { Loader2, ArrowUpRight, TrendingUp, TrendingDown, Wallet, Plus, History } from 'lucide-react'
import dynamic from 'next/dynamic'
import { CurrencyRates } from '@/components/investment/currency-rates'
import { InstitutionLogo } from '@/components/accounts/institution-logo'
import { EduTip } from '@/components/edu/edu-tip'
import { CalmModeToggle } from '@/components/investment/calm-mode-toggle'
import { QuietPageHeader } from '@/components/layout/quiet-page-header'
import { assetClassKey, ASSET_CLASS_META, ASSET_CLASS_ORDER, type AssetClassKey } from '@/lib/invest/asset-class'
import { enrichHolding, tickerToQuoteSymbol, quoteKey, type LiveQuote } from '@/lib/invest/enrich'
import { FX_FALLBACK_USDIDR } from '@/lib/constants'
import { useT } from '@/lib/i18n/context'

// Defer recharts out of the investment route's initial JS (loads on chart mount).
const EquityArea = dynamic(() => import('./investment-charts').then((m) => m.EquityArea), { ssr: false, loading: () => <div className="h-full animate-pulse rounded-lg" style={{ background: 'var(--surface-2)' }} aria-hidden="true" /> })
const AllocationDonut = dynamic(() => import('./investment-charts').then((m) => m.AllocationDonut), { ssr: false, loading: () => <div className="h-full animate-pulse rounded-full" style={{ background: 'var(--surface-2)' }} aria-hidden="true" /> })
const DividendBar = dynamic(() => import('./investment-charts').then((m) => m.DividendBar), { ssr: false, loading: () => <div className="h-full animate-pulse rounded-lg" style={{ background: 'var(--surface-2)' }} aria-hidden="true" /> })

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
  const t = useT()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [items, setItems] = useState<Investment[]>([])
  const [rdnAccounts, setRdnAccounts] = useState<RdnAccount[]>([])
  const [dividends, setDividends] = useState<{ amount: number; pay_date: string }[]>([])
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({})
  const [usdIdr, setUsdIdr] = useState<number>(FX_FALLBACK_USDIDR)
  const [tab, setTab] = useState<'all' | AssetClassKey>('all')
  const [snapshots, setSnapshots] = useState<{ snapshot_date: string; market_value: number }[]>([])
  const [chartRange, setChartRange] = useState<ChartRangeKey>('all')
  // Kelas Aset: default hanya kelas berisi posisi; ghost card membuka semuanya.
  const [showAllClasses, setShowAllClasses] = useState(false)

  // useCallback so the function is stable and can be a useEffect dep
  // without re-running every render. Same pattern as [slug]/page.tsx.
  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    const { data: { user } } = await supabase.auth.getUser()
    // Session expired/gone: stop the spinner instead of hanging forever —
    // middleware will bounce the next navigation to /login.
    if (!user) { setLoading(false); return }
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
    // A failed core query must NOT render as a believable "Rp 0" portfolio —
    // surface an error card with retry instead. snapshots stay tolerated.
    if (invRes.error || rdnRes.error || divRes.error) {
      setLoadError(true)
      setLoading(false)
      return
    }
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

  // Live quotes (price + currency + day change) for tickered holdings.
  // Split by venue: crypto goes to Binance via /api/crypto-price (the public
  // quote endpoint is geoblocked from many Indonesian ISPs), everything else
  // to /api/quotes; forex tickers are normalized to FX form (USDIDR=X) so a
  // bare "USD" doesn't resolve to a real US ETF. USDIDR=X rides along for
  // converting USD-priced assets to IDR.
  useEffect(() => {
    if (items.length === 0) return
    const cryptoSyms = Array.from(new Set(
      items.filter((i) => i.category === 'crypto' && quoteKey(i.ticker))
        .map((i) => quoteKey(i.ticker).replace(/-USD$/, 'USDT')),
    ))
    const stockSyms = Array.from(new Set(
      items.filter((i) => i.category !== 'crypto')
        .map((i) => tickerToQuoteSymbol(i))
        .filter(Boolean) as string[],
    ))
    if (cryptoSyms.length === 0 && stockSyms.length === 0) return
    const quoteSyms = Array.from(new Set([...stockSyms, 'USDIDR=X']))
    let cancelled = false
    ;(async () => {
      try {
        const [qRes, cRes] = await Promise.all([
          fetch(`/api/quotes?tickers=${encodeURIComponent(quoteSyms.join(','))}`),
          cryptoSyms.length
            ? fetch(`/api/crypto-price?symbols=${encodeURIComponent(cryptoSyms.join(','))}`)
            : Promise.resolve(null),
        ])
        if (cancelled) return
        const map: Record<string, LiveQuote> = {}
        let fx = FX_FALLBACK_USDIDR
        if (qRes.ok) {
          const d = (await qRes.json()) as { quotes?: { ticker: string; price: number; currency: string; changePct: number | null }[] }
          for (const q of d.quotes ?? []) {
            const key = quoteKey(q.ticker)
            if (key === 'USDIDR=X' && Number(q.price) > 0) fx = Number(q.price)
            map[key] = { price: Number(q.price) || 0, currency: q.currency ?? 'USD', changePct: q.changePct }
          }
        }
        if (cRes && cRes.ok) {
          const d = (await cRes.json()) as { tickers?: { symbol: string; lastPrice: number; priceChangePercent: number }[] }
          for (const tk of d.tickers ?? []) {
            // Map Binance symbol back to the user's stored ticker (BTCUSDT → BTC-USD),
            // pre-converted to IDR so downstream math never double-converts.
            const userTicker = tk.symbol.replace(/USDT$/, '-USD')
            map[userTicker] = { price: (Number(tk.lastPrice) || 0) * fx, currency: 'IDR', changePct: Number(tk.priceChangePercent) }
          }
        }
        if (!cancelled) { setQuotes(map); setUsdIdr(fx) }
      } catch { /* quotes are best-effort; stored prices keep the page honest */ }
    })()
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

  // Live-priced holdings (quote → IDR; fallback to stored current_price).
  // Shared helper keeps this page and [slug] mathematically identical.
  const enriched = useMemo(() => {
    return items.map((i) => {
      const sym = tickerToQuoteSymbol(i)
      return enrichHolding(i, sym ? quotes[sym] : undefined, usdIdr)
    })
  }, [items, quotes, usdIdr])

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

  // Today's P/L estimate, only from quoted holdings. `market` is the price
  // NOW (already moved by cp), so today's change = market − market/(1+cp/100)
  // = market × cp/(100+cp). Null when no holding has a live quote — render
  // '—' instead of a confident-looking "+Rp 0".
  const todayPL = useMemo(() => {
    let any = false
    const v = enriched.reduce((s, e) => {
      const sym = tickerToQuoteSymbol(e.i)
      const cp = sym ? quotes[sym]?.changePct : null
      if (cp == null) return s
      any = true
      return s + e.market * (cp / (100 + cp))
    }, 0)
    return any ? v : null
  }, [enriched, quotes])

  // Holding-table tabs: Semua + each class that actually has positions.
  const holdingTabs = useMemo(() => {
    const present = ASSET_CLASS_ORDER.filter((k) => (byClass[k]?.count ?? 0) > 0)
    return [
      { key: 'all' as const, label: t('investment.tab_all') },
      ...present.map((k) => ({ key: k as 'all' | AssetClassKey, label: ASSET_CLASS_META[k].label })),
    ]
  }, [byClass, t])

  const holdingRows = useMemo(() => {
    return enriched
      .filter((e) => tab === 'all' || assetClassKey(e.i) === tab)
      .map((e) => {
        const ck = assetClassKey(e.i)
        const sym = tickerToQuoteSymbol(e.i)
        return {
          id: e.i.id,
          name: e.i.name,
          sym: (e.i.ticker ?? '').replace(/\.JK$/i, '').toUpperCase(),
          classLabel: ASSET_CLASS_META[ck].label,
          classColor: ASSET_CLASS_META[ck].color,
          qty: e.i.quantity,
          price: e.live,
          market: e.market,
          plPct: e.invested > 0 ? (e.pl / e.invested) * 100 : null,
          changePct: sym ? (quotes[sym]?.changePct ?? null) : null,
        }
      })
      .sort((a, b) => b.market - a.market)
  }, [enriched, tab, quotes])

  // Today's movers — quoted holdings sorted by |Δ%|. `covered` counts BEFORE
  // the slice so the card can be honest about how many positions have a live
  // quote at all (gold/deposito/non-quoted are invisible here by nature).
  const movers = useMemo(() => {
    const all = enriched
      .map((e) => {
        const sym = tickerToQuoteSymbol(e.i)
        const cp = sym ? (quotes[sym]?.changePct ?? null) : null
        if (cp == null) return null
        const ck = assetClassKey(e.i)
        return {
          id: e.i.id,
          name: e.i.name,
          sym: (e.i.ticker ?? '').replace(/\.JK$/i, '').toUpperCase(),
          changePct: cp,
          changeRp: e.market * (cp / (100 + cp)),
          color: ASSET_CLASS_META[ck].color,
        }
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    return { list: all.slice(0, 6), covered: all.length, total: enriched.length }
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
  // 'sv' locale = YYYY-MM-DD in LOCAL time — toISOString() is UTC and made a
  // 00:00–07:00 WIB visit overwrite YESTERDAY's snapshot.
  const chartData = useMemo(() => {
    const today = new Date().toLocaleDateString('sv')
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

  // Snapshot recording moved server-side: /api/cron/portfolio-snapshots writes
  // one consistent, live-priced row per user daily (Asia/Jakarta date). The old
  // on-page-open upsert recorded attendance, not the portfolio.

  // Equity curve only earns its slot once there's real history to draw.
  const hasHistory = snapshots.length >= 8

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--ink)' }} />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="s-card p-10 flex flex-col items-center text-center">
        <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('investment.load_error_title')}</p>
        <p className="text-xs mt-1 max-w-sm" style={{ color: 'var(--ink-muted)' }}>{t('investment.load_error_desc')}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition hover:opacity-90"
          style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }}
        >
          {t('investment.retry')}
        </button>
      </div>
    )
  }

  const up = totals.pl >= 0

  return (
    <div className="space-y-6">
      {/* Quiet header — selaras Transaksi/Anggaran; identitas angka tetap di hero */}
      <QuietPageHeader
        title={t('investment.title')}
        info={t('investment.subtitle')}
        actions={
          <>
            <CalmModeToggle />
            <Link
              href="/dashboard/assets/investment/stock?tab=dividen"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition hover:bg-[var(--surface-2)]"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink-muted)' }}
            >
              <History className="size-3.5" /> {t('investment.dividend_history')}
            </Link>
            <Link
              href="/dashboard/assets/investment/stock"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition hover:opacity-90"
              style={{ background: 'var(--c-primary)', color: 'var(--on-black)' }}
            >
              <Plus className="size-3.5" /> {t('investment.add_holding')}
            </Link>
          </>
        }
      />

      {/* Portfolio hero — light card, value-first */}
      <section className="s-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">
              {t('investment.total_value')}
              {institutionCount > 0 ? ` · ${institutionCount} ${t('investment.institutions')}` : ''}
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <p
                className="num tabular font-bold leading-none whitespace-nowrap"
                style={{ color: 'var(--ink)', fontSize: 'clamp(34px, 5vw, 54px)', letterSpacing: '-0.035em' }}
              >
                {formatCurrency(totals.market)}
              </p>
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold mb-1"
                data-loss={up ? undefined : 'true'}
                style={{
                  background: up ? 'var(--c-mint-soft)' : 'var(--c-coral-soft)',
                  color: up ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {up ? '+' : ''}{totals.plPct.toFixed(2)}%
              </span>
            </div>
            <p className="text-sm mt-2" style={{ color: 'var(--ink-muted)' }}>
              {up ? t('investment.total_gain') : t('investment.total_loss')}{' '}
              <span className="num tabular font-semibold" data-loss={up ? undefined : 'true'} style={{ color: up ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}>
                {up ? '+' : ''}{formatCurrency(totals.pl)}
              </span>{' '}
              {t('investment.since_inception')}
            </p>
          </div>
          {hasHistory && (
            <div className="flex gap-0.5 shrink-0 rounded-lg p-0.5" style={{ background: 'var(--surface-2)' }}>
              {CHART_RANGES.map((r) => {
                const active = chartRange === r.key
                return (
                  <button
                    key={r.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setChartRange(r.key)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition"
                    style={active ? { background: 'var(--surface)', color: 'var(--ink)', boxShadow: '0 1px 2px rgba(16,24,40,0.08)' } : { color: 'var(--ink-soft)' }}
                  >
                    {r.key === 'all' ? t('investment.range_all') : r.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Equity curve — demoted until ≥8 stored snapshots exist (a 2-point
            "curve" reads worse than no curve). Until then the slot earns its
            keep with Modal vs Nilai Sekarang, computable from day one.
            data-loss saat turun: Calm Mode ikut menyamarkan kurva merah. */}
        <div className="mt-4" data-loss={up ? undefined : 'true'} style={{ height: 150 }}>
          {!hasHistory ? (
            <div className="h-full rounded-xl px-5 flex flex-col justify-center gap-3" style={{ background: 'var(--surface-2)' }}>
              {(() => {
                const maxV = Math.max(totals.invested, totals.market, 1)
                return (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-[10px] uppercase tracking-wide truncate" style={{ color: 'var(--ink-soft)' }}>
                        {t('investment.stat_invested')}
                      </span>
                      <div className="flex-1 h-6 rounded-md overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                        <div className="h-full rounded-md" style={{ width: `${(totals.invested / maxV) * 100}%`, background: 'var(--border)' }} />
                      </div>
                      <span className="num tabular text-xs font-semibold w-32 text-right shrink-0" style={{ color: 'var(--ink-muted)' }}>
                        {formatCurrency(totals.invested)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-[10px] uppercase tracking-wide truncate" style={{ color: 'var(--ink-soft)' }}>
                        {t('investment.chart_interim_now')}
                      </span>
                      <div className="flex-1 h-6 rounded-md overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                        <div className="h-full rounded-md" data-loss={up ? undefined : 'true'} style={{ width: `${(totals.market / maxV) * 100}%`, background: up ? 'var(--c-mint)' : 'var(--c-coral)' }} />
                      </div>
                      <span className="num tabular text-xs font-semibold w-32 text-right shrink-0" data-loss={up ? undefined : 'true'} style={{ color: up ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}>
                        {formatCurrency(totals.market)}
                      </span>
                    </div>
                    <p className="text-[11px] text-center" style={{ color: 'var(--ink-soft)' }}>
                      {t('investment.chart_collecting_desc')}
                    </p>
                  </>
                )
              })()}
            </div>
          ) : chartData.length < 2 ? (
            <div className="h-full rounded-xl flex items-center justify-center" style={{ background: 'var(--surface-2)' }}>
              <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>{t('investment.chart_range_empty')}</p>
            </div>
          ) : (
            <EquityArea data={chartData} up={up} />
          )}
        </div>

        {/* Sub-stats — modal & P/L primary, dividen supporting */}
        <div
          className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-px rounded-xl overflow-hidden border"
          style={{ background: 'var(--border-soft)', borderColor: 'var(--border-soft)' }}
        >
          <HeroStat label={t('investment.stat_invested')} value={formatCurrency(totals.invested)} />
          <HeroStat
            label={t('investment.stat_pl')}
            value={`${up ? '+' : ''}${formatCurrency(totals.pl)}`}
            accent={up ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)'}
            loss={!up}
          />
          <HeroStat
            label={t('investment.stat_today')}
            value={todayPL == null ? '—' : `${todayPL >= 0 ? '+' : '−'}${formatCurrency(Math.abs(todayPL))}`}
            accent={todayPL == null ? 'var(--ink-soft)' : todayPL >= 0 ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)'}
            loss={todayPL != null && todayPL < 0}
          />
          <HeroStat label={t('investment.stat_dividend_ytd')} value={formatCurrency(dividenYtd)} />
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
            style={{ background: 'var(--c-mint-soft)' }}
          >
            <Wallet className="size-5" style={{ color: 'var(--c-mint-ink)' }} />
          </div>
          <div>
            <p className="eyebrow">{t('investment.rdn_cash')}</p>
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
            title={t('investment.add_rdn_account')}
            aria-label={t('investment.add_rdn_account')}
            className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-xs font-medium transition hover:bg-[var(--surface-2)]"
            style={{ borderColor: 'var(--border)', color: 'var(--ink-soft)' }}
          >
            <Plus className="size-3.5" />
            {rdnAccounts.length === 0 ? <span>{t('investment.add_rdn_account')}</span> : null}
          </Link>
        </div>
        <Link
          href="/dashboard/accounts"
          className="text-xs font-medium inline-flex items-center gap-0.5 hover:underline shrink-0 ml-auto"
          style={{ color: 'var(--c-mint-ink)' }}
        >
          {t('investment.manage')} <ArrowUpRight className="size-3.5" />
        </Link>
      </div>

      {/* Kelas Aset — drill-down cards per kategori (klik → detail per slug).
          Kartu NETRAL (surface + border-soft) dengan warna terkurung di icon
          box — satu palet kanonik dari ASSET_CLASS_META, sama persis dengan
          donut/chip/movers. Default cuma kelas berisi posisi; ghost card
          membuka sisanya (user 2 kelas gak perlu scroll 10 kartu kosong). */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="eyebrow">{t('investment.asset_classes')}</h2>
          <span className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{t('investment.asset_classes_hint')}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(() => {
            const allCards = INVESTMENT_SUBCATS.flatMap((sc) => {
              // Saham dipecah jadi 2 kartu (IDX & US) -> nge-link ke halaman terpisah.
              const Icon = getInvestmentVisual(sc.slug).icon
              return sc.slug === 'stock'
                ? [
                    { key: 'stock-idx', classKey: 'stock_idx' as AssetClassKey, label: t('investment.stock_idx'), href: '/dashboard/assets/investment/stock-idx', d: byClass.stock_idx, Icon },
                    { key: 'stock-us', classKey: 'stock_us' as AssetClassKey, label: t('investment.stock_us'), href: '/dashboard/assets/investment/stock-us', d: byClass.stock_us, Icon },
                  ]
                : [{
                    key: sc.slug,
                    classKey: sc.slug.replace(/-/g, '_') as AssetClassKey,
                    label: sc.label,
                    href: `/dashboard/assets/investment/${sc.slug}`,
                    d: byCategory[sc.slug === 'mutual-fund' ? 'mutual_fund' : sc.slug === 'time-deposit' ? 'time_deposit' : sc.slug],
                    Icon,
                  }]
            })
            const hasAny = allCards.some((c) => (c.d?.count ?? 0) > 0)
            // Pengguna tanpa posisi tetap lihat kelas starter buat onboarding.
            const STARTERS = ['stock-idx', 'mutual-fund', 'crypto', 'gold', 'sbn', 'time-deposit']
            const visibleCards = showAllClasses
              ? allCards
              : hasAny
                ? allCards.filter((c) => (c.d?.count ?? 0) > 0)
                : allCards.filter((c) => STARTERS.includes(c.key))
            const hiddenCount = allCards.length - visibleCards.length
            return (
              <>
                {visibleCards.map((c) => {
                  const data = c.d ?? { invested: 0, market: 0, count: 0 }
                  const pl = data.market - data.invested
                  const pct = data.invested > 0 ? (pl / data.invested) * 100 : 0
                  const plUp = pl >= 0
                  const hasPosition = data.count > 0
                  const color = ASSET_CLASS_META[c.classKey].color
                  const CardIcon = c.Icon
                  return (
                    <Link
                      key={c.key}
                      href={c.href}
                      className="group rounded-xl border p-4 transition-all hover:shadow-md hover:-translate-y-0.5"
                      style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)' }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className="grid place-items-center shrink-0"
                          style={{ width: 32, height: 32, borderRadius: 9, background: `color-mix(in srgb, ${color} 15%, var(--surface))`, color }}
                        >
                          <CardIcon className="size-4" strokeWidth={2} />
                        </div>
                        <ArrowUpRight
                          className="size-4 opacity-30 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition shrink-0 mt-1"
                          style={{ color: 'var(--ink-soft)' }}
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
                          {hasPosition ? `${data.count} ${t('investment.positions')}` : t('investment.no_position')}
                        </span>
                        {data.invested > 0 && (
                          <span
                            className="num font-semibold tabular px-1.5 py-0.5 rounded"
                            data-loss={plUp ? undefined : 'true'}
                            style={{
                              color: plUp ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)',
                              background: plUp ? 'var(--c-mint-soft)' : 'var(--c-coral-soft)',
                            }}
                          >
                            {plUp ? '+' : ''}{pct.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    </Link>
                  )
                })}
                {(hiddenCount > 0 || showAllClasses) && (
                  <button
                    type="button"
                    onClick={() => setShowAllClasses((v) => !v)}
                    className="rounded-xl border border-dashed p-4 flex flex-col items-center justify-center gap-1.5 text-xs font-medium transition hover:bg-[var(--surface-2)] min-h-[120px]"
                    style={{ borderColor: 'var(--border)', color: 'var(--ink-soft)' }}
                  >
                    <Plus className="size-4" />
                    {showAllClasses
                      ? t('investment.show_less_classes')
                      : `${t('investment.show_all_classes')} (${hiddenCount})`}
                  </button>
                )}
              </>
            )
          })()}
        </div>
      </div>

      {/* Alokasi donut + Kinerja per kelas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="s-card p-5 sm:p-6 lg:col-span-2 flex flex-col">
          <div className="mb-4">
            <p className="eyebrow">{t('investment.allocation')}</p>
            <h2 className="text-xl font-semibold mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--ink)' }}>
              {t('investment.portfolio_composition')}
              <EduTip topic="diversification" side="bottom" />
            </h2>
          </div>

          {donut.length === 0 ? (
            <div className="flex-1 min-h-[240px] flex flex-col items-center justify-center text-center px-4">
              <div
                className="size-12 rounded-2xl flex items-center justify-center mb-3"
                style={{ background: 'var(--info-bg)' }}
              >
                <TrendingUp className="size-6" style={{ color: 'var(--info)' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('investment.no_position')}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>
                {t('investment.allocation_empty_desc')}
              </p>
            </div>
          ) : (
            <>
              <div className="relative" style={{ height: 180 }}>
                <AllocationDonut data={donut} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                    {donut.length} {t('investment.classes')}
                  </p>
                  <p className="num tabular text-base font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
                    {formatCurrency(totals.market)}
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
              <p className="eyebrow">{t('investment.performance')}</p>
              <h2 className="text-xl font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{t('investment.return_per_class')}</h2>
            </div>
            <span className="text-[11px] shrink-0 mt-1" style={{ color: 'var(--ink-soft)' }}>{t('investment.performance_hint')}</span>
          </div>
          {kinerja.length === 0 ? (
            <div className="flex-1 min-h-[180px] flex flex-col items-center justify-center text-center">
              <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>{t('investment.performance_empty')}</p>
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
                          data-loss={positive ? undefined : 'true'}
                          style={{
                            left: positive ? '50%' : `${50 - half}%`,
                            width: `${half}%`,
                            background: positive ? 'var(--c-mint)' : 'var(--c-coral)',
                          }}
                        />
                      </div>
                      <span
                        className="num tabular text-xs font-semibold w-16 text-right shrink-0"
                        data-loss={positive ? undefined : 'true'}
                        style={{ color: positive ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}
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
              <p className="eyebrow">{t('investment.holding')}</p>
              <h2 className="text-xl font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{t('investment.holding_list')}</h2>
            </div>
            <div className="flex flex-wrap gap-1">
              {holdingTabs.map((tabItem) => {
                const active = tab === tabItem.key
                return (
                  <button
                    key={tabItem.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTab(tabItem.key)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-medium transition"
                    style={active
                      ? { background: 'var(--c-primary)', color: 'var(--on-black)' }
                      : { background: 'var(--surface-2)', color: 'var(--ink-muted)' }}
                  >
                    {tabItem.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" style={{ minWidth: 640 }}>
              <thead>
                <tr style={{ background: 'var(--surface-3)' }}>
                  <th className="text-left text-[11px] uppercase tracking-wider font-medium px-3 py-2 whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>{t('investment.col_sym')}</th>
                  <th className="text-left text-[11px] uppercase tracking-wider font-medium px-3 py-2" style={{ color: 'var(--ink-muted)' }}>{t('investment.col_name')}</th>
                  <th className="text-right text-[11px] uppercase tracking-wider font-medium px-3 py-2 whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>{t('investment.col_lot_unit')}</th>
                  <th className="text-right text-[11px] uppercase tracking-wider font-medium px-3 py-2 whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>{t('investment.col_value')}</th>
                  <th className="text-right text-[11px] uppercase tracking-wider font-medium px-3 py-2 whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>{t('investment.col_pl')}</th>
                  <th className="text-right text-[11px] uppercase tracking-wider font-medium px-3 py-2 whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>{t('investment.col_day_change')}</th>
                </tr>
              </thead>
              <tbody>
                {holdingRows.map((r) => {
                  const plUp = (r.plPct ?? 0) >= 0
                  const dUp = (r.changePct ?? 0) >= 0
                  return (
                    <tr key={r.id} className="border-b transition-colors hover:bg-[var(--surface-2)]" style={{ borderColor: 'var(--border-soft)' }}>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="num tabular text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${r.classColor}1A`, color: `color-mix(in srgb, ${r.classColor} 60%, var(--ink))` }}>
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
                      <td className="px-3 py-2.5 text-right num tabular whitespace-nowrap" data-loss={r.plPct != null && !plUp ? 'true' : undefined} style={{ color: r.plPct == null ? 'var(--ink-soft)' : plUp ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}>
                        {r.plPct == null ? '—' : `${plUp ? '+' : ''}${r.plPct.toFixed(1)}%`}
                      </td>
                      <td className="px-3 py-2.5 text-right num tabular whitespace-nowrap" data-loss={r.changePct != null && !dUp ? 'true' : undefined} style={{ color: r.changePct == null ? 'var(--ink-soft)' : dUp ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}>
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
        <div className={`s-card p-5 sm:p-6 ${movers.list.length === 0 ? 'lg:col-span-2' : ''}`}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="eyebrow">{t('investment.dividend_6mo')}</p>
              <p className="num tabular text-2xl font-bold mt-1" style={{ color: 'var(--ink)' }}>{formatCurrency(dividen6Total)}</p>
            </div>
            {dividen6DeltaPct != null && (
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                style={{
                  background: dividen6DeltaPct >= 0 ? 'var(--c-mint-soft)' : 'var(--c-coral-soft)',
                  color: dividen6DeltaPct >= 0 ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)',
                }}
              >
                {dividen6DeltaPct >= 0 ? '+' : ''}{dividen6DeltaPct.toFixed(0)}% {t('investment.vs_prev_6mo')}
              </span>
            )}
          </div>
          {dividen6Total === 0 ? (
            <div className="h-[160px] flex flex-col items-center justify-center text-center">
              <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>{t('investment.dividend_empty')}</p>
              <Link href="/dashboard/assets/investment/stock?tab=dividen" className="text-xs mt-1 hover:underline" style={{ color: 'var(--c-mint-ink)' }}>
                {t('investment.record_dividend')} →
              </Link>
            </div>
          ) : (
            <div style={{ height: 160 }}>
              <DividendBar data={dividen6} />
            </div>
          )}
        </div>

        {/* Pergerakan hari ini */}
        {movers.list.length > 0 && (
          <div className="s-card p-5 sm:p-6">
            <p className="eyebrow">{t('investment.today')}</p>
            <h2 className="text-xl font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{t('investment.movers_today')}</h2>
            {movers.covered < movers.total && (
              <p className="text-[11px] mt-0.5 mb-3" style={{ color: 'var(--ink-soft)' }}>
                {movers.covered}/{movers.total} {t('investment.movers_coverage')}
              </p>
            )}
            {movers.covered >= movers.total && <div className="mb-3" />}
            <div>
              {movers.list.map((m) => {
                const pos = m.changePct >= 0
                return (
                  <div key={m.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0" style={{ borderColor: 'var(--border-soft)' }}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="size-8 rounded-full grid place-items-center text-[10px] font-bold shrink-0" style={{ background: `${m.color}1A`, color: `color-mix(in srgb, ${m.color} 60%, var(--ink))` }}>
                        {m.sym.slice(0, 4) || '—'}
                      </span>
                      <span className="truncate text-sm" style={{ color: 'var(--ink)' }}>{m.name}</span>
                    </div>
                    <div className="text-right shrink-0" data-loss={pos ? undefined : 'true'}>
                      <p className="num tabular text-sm font-semibold" style={{ color: pos ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}>
                        {pos ? '+' : '−'}{formatCurrency(Math.abs(m.changeRp))}
                      </p>
                      <p className="num tabular text-[11px] inline-flex items-center justify-end gap-0.5 w-full" style={{ color: pos ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}>
                        {pos ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />} {Math.abs(m.changePct).toFixed(2)}%
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

function HeroStat({ label, value, accent, loss }: { label: string; value: string; accent?: string; loss?: boolean }) {
  return (
    <div className="p-3.5" style={{ background: 'var(--surface)' }}>
      <p className="eyebrow">{label}</p>
      <p className="num tabular text-lg font-bold mt-1" data-loss={loss ? 'true' : undefined} style={{ color: accent ?? 'var(--ink)' }}>
        {value}
      </p>
    </div>
  )
}
