'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatCompactCurrency, formatCurrency } from '@/lib/utils'
import type { Investment } from '@/types'
import { Loader2, ArrowUpRight, TrendingUp, Wallet, Plus, History, ChevronDown } from 'lucide-react'
import { CurrencyRates } from '@/components/investment/currency-rates'
import { InstitutionLogo } from '@/components/accounts/institution-logo'
import { EduTip } from '@/components/edu/edu-tip'
import { CalmModeToggle } from '@/components/investment/calm-mode-toggle'
import { QuietPageHeader } from '@/components/layout/quiet-page-header'
import { PortfolioHero } from '@/components/investment/portfolio-hero'
import { AssetClassCards } from '@/components/investment/asset-class-cards'
import { HoldingTable } from '@/components/investment/holding-table'
import { UpcomingDividends } from '@/components/investment/upcoming-dividends'
import { WatchlistTargetChip } from '@/components/investment/watchlist-target-chip'
import { assetClassKey, ASSET_CLASS_META, type AssetClassKey } from '@/lib/invest/asset-class'
import { enrichHolding, tickerToQuoteSymbol, quoteKey, type LiveQuote } from '@/lib/invest/enrich'
import { FX_FALLBACK_USDIDR, INVESTMENT_SUBCATS } from '@/lib/constants'
import { useT } from '@/lib/i18n/context'

// Defer recharts out of the route's initial JS (loads on chart mount).
const AllocationDonut = dynamic(() => import('@/components/investment/investment-charts').then((m) => m.AllocationDonut), { ssr: false, loading: () => <div className="h-full animate-pulse rounded-full" style={{ background: 'var(--surface-2)' }} aria-hidden="true" /> })
const DividendBar = dynamic(() => import('@/components/investment/investment-charts').then((m) => m.DividendBar), { ssr: false, loading: () => <div className="h-full animate-pulse rounded-lg" style={{ background: 'var(--surface-2)' }} aria-hidden="true" /> })

const MONTHS_SHORT_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

interface RdnAccount {
  id: string
  name: string
  current_balance: number
}

interface UserDividend {
  amount: number
  pay_date: string
  ticker: string | null
  investment_id: string | null
}

interface OverviewData {
  items: Investment[]
  rdnAccounts: RdnAccount[]
  dividends: UserDividend[]
  snapshots: { snapshot_date: string; market_value: number }[]
}

// Stable empty fallbacks — fresh [] per render would invalidate every memo.
const NO_ITEMS: Investment[] = []
const NO_RDN: RdnAccount[] = []
const NO_DIVIDENDS: UserDividend[] = []
const NO_SNAPSHOTS: { snapshot_date: string; market_value: number }[] = []
const NO_QUOTES: Record<string, LiveQuote> = {}

export default function InvestmentOverviewPage() {
  const t = useT()
  const supabase = createClient()

  // Menu "Tambah Holding" — pilih kelas aset dulu (investasi bukan cuma saham),
  // lalu langsung dibuka form tambahnya via ?add=1 di halaman kelas.
  const [addOpen, setAddOpen] = useState(false)
  const addRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!addOpen) return
    const onDown = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setAddOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAddOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [addOpen])

  // Server data via react-query: back-nav from a class page now renders
  // instantly from cache (staleTime 60s) instead of re-running getUser +
  // four queries behind a full-page spinner.
  const overview = useQuery<OverviewData>({
    queryKey: ['investment-overview'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      // Session expired/gone: render empty —  middleware bounces the next
      // navigation to /login.
      if (!user) return { items: [], rdnAccounts: [], dividends: [], snapshots: [] }
      const [invRes, rdnRes, divRes, snapRes] = await Promise.all([
        supabase.from('investments').select('*').eq('user_id', user.id),
        supabase
          .from('accounts')
          .select('id, name, current_balance')
          .eq('user_id', user.id)
          .eq('type', 'rdn'),
        supabase
          .from('dividends')
          .select('amount, pay_date, ticker, investment_id')
          .eq('user_id', user.id),
        // portfolio_snapshots may not exist yet (migration 030) — tolerated.
        supabase
          .from('portfolio_snapshots')
          .select('snapshot_date, market_value')
          .eq('user_id', user.id)
          .order('snapshot_date', { ascending: true }),
      ])
      // A failed core query must NOT render as a believable "Rp 0" portfolio.
      if (invRes.error || rdnRes.error || divRes.error) {
        throw new Error(invRes.error?.message ?? rdnRes.error?.message ?? divRes.error?.message)
      }
      return {
        items: (invRes.data ?? []) as Investment[],
        rdnAccounts: (rdnRes.data ?? []) as RdnAccount[],
        dividends: (divRes.data ?? []) as UserDividend[],
        snapshots: (snapRes.data ?? []) as { snapshot_date: string; market_value: number }[],
      }
    },
  })
  const items = overview.data?.items ?? NO_ITEMS
  const rdnAccounts = overview.data?.rdnAccounts ?? NO_RDN
  const dividends = overview.data?.dividends ?? NO_DIVIDENDS
  const snapshots = overview.data?.snapshots ?? NO_SNAPSHOTS

  // Live quotes (price + currency + day change) for tickered holdings.
  // Split by venue: crypto via /api/crypto-price (Binance; the public quote
  // endpoint is geoblocked from many ID ISPs), everything else via
  // /api/quotes; forex normalized to FX form (USDIDR=X) so a bare "USD"
  // doesn't resolve to a real US ETF. USDIDR=X rides along for conversion.
  const quoteSymbols = useMemo(() => {
    const cryptoSyms = Array.from(new Set(
      items.filter((i) => i.category === 'crypto' && quoteKey(i.ticker))
        .map((i) => quoteKey(i.ticker).replace(/-USD$/, 'USDT')),
    )).sort()
    const stockSyms = Array.from(new Set(
      items.filter((i) => i.category !== 'crypto')
        .map((i) => tickerToQuoteSymbol(i))
        .filter(Boolean) as string[],
    )).sort()
    return { cryptoSyms, stockSyms }
  }, [items])

  const quotesQuery = useQuery({
    queryKey: ['invest-quotes', quoteSymbols.stockSyms.join(','), quoteSymbols.cryptoSyms.join(',')],
    enabled: quoteSymbols.stockSyms.length > 0 || quoteSymbols.cryptoSyms.length > 0,
    staleTime: 5 * 60 * 1000, // mirrors the server-side price cache TTL
    queryFn: async () => {
      const quoteSyms = Array.from(new Set([...quoteSymbols.stockSyms, 'USDIDR=X']))
      const [qRes, cRes] = await Promise.all([
        fetch(`/api/quotes?tickers=${encodeURIComponent(quoteSyms.join(','))}`),
        quoteSymbols.cryptoSyms.length
          ? fetch(`/api/crypto-price?symbols=${encodeURIComponent(quoteSymbols.cryptoSyms.join(','))}`)
          : Promise.resolve(null),
      ])
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
          // Binance symbol → user's stored ticker (BTCUSDT → BTC-USD),
          // pre-converted to IDR so downstream math never double-converts.
          const userTicker = tk.symbol.replace(/USDT$/, '-USD')
          map[userTicker] = { price: (Number(tk.lastPrice) || 0) * fx, currency: 'IDR', changePct: Number(tk.priceChangePercent) }
        }
      }
      return { map, fx }
    },
  })
  const quotes = quotesQuery.data?.map ?? NO_QUOTES
  const usdIdr = quotesQuery.data?.fx ?? FX_FALLBACK_USDIDR

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
  // NOW (already moved by cp), so today's change = market × cp/(100+cp).
  // Null when no holding has a live quote — render '—', not a fake "+Rp 0".
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

  // Yield on cost ≈ trailing-12-month dividends ÷ cost basis of the holdings
  // that actually PAY them (matched by investment_id or bare ticker) — NOT
  // totals.invested, which would dilute the yield with crypto/gold/etc.
  const yieldOnCost = useMemo(() => {
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - 1)
    let trailing = 0
    const payerIds = new Set<string>()
    const payerTickers = new Set<string>()
    for (const dv of dividends) {
      if (dv.investment_id) payerIds.add(dv.investment_id)
      if (dv.ticker) payerTickers.add(dv.ticker.replace(/.JK$/i, '').trim().toUpperCase())
      if (dv.pay_date && new Date(dv.pay_date) >= cutoff) trailing += dv.amount || 0
    }
    if (trailing <= 0) return null
    const basis = enriched.reduce((sum, e) => {
      const bare = (e.i.ticker ?? '').replace(/.JK$/i, '').trim().toUpperCase()
      const isPayer = payerIds.has(e.i.id) || (bare !== '' && payerTickers.has(bare))
      return isPayer ? sum + e.invested : sum
    }, 0)
    return basis > 0 ? (trailing / basis) * 100 : null
  }, [dividends, enriched])

  if (overview.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--ink)' }} />
      </div>
    )
  }

  if (overview.isError) {
    return (
      <div className="s-card p-10 flex flex-col items-center text-center">
        <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('investment.load_error_title')}</p>
        <p className="text-xs mt-1 max-w-sm" style={{ color: 'var(--ink-muted)' }}>{t('investment.load_error_desc')}</p>
        <button
          type="button"
          onClick={() => void overview.refetch()}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition hover:opacity-90"
          style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }}
        >
          {t('investment.retry')}
        </button>
      </div>
    )
  }

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
              aria-label={t('investment.dividend_history')}
              title={t('investment.dividend_history')}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium border transition hover:bg-[var(--surface-2)]"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink-muted)' }}
            >
              <History className="size-3.5" />
              {/* Mobile <sm: icon-only biar muat 1 baris bareng "Tambah holding" */}
              <span className="hidden sm:inline">{t('investment.dividend_history')}</span>
            </Link>
            <div className="relative" ref={addRef}>
              <button
                type="button"
                onClick={() => setAddOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={addOpen}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition hover:opacity-90"
                style={{ background: 'var(--c-primary)', color: 'var(--on-black)' }}
              >
                <Plus className="size-3.5" /> {t('investment.add_holding')} <ChevronDown className="size-3" style={{ transform: addOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
              </button>
              {addOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border py-1.5 z-50 max-h-[60vh] overflow-y-auto"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--card-shadow)' }}
                >
                  {INVESTMENT_SUBCATS.map((sc) => (
                    <Link
                      key={sc.slug}
                      role="menuitem"
                      href={`/dashboard/assets/investment/${sc.slug}?add=1`}
                      onClick={() => setAddOpen(false)}
                      className="block px-3.5 py-2 text-xs font-medium transition hover:bg-[var(--surface-2)]"
                      style={{ color: 'var(--ink)' }}
                    >
                      {sc.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        }
      />

      <PortfolioHero
        totals={totals}
        todayPL={todayPL}
        dividenYtd={dividenYtd}
        institutionCount={institutionCount}
        snapshots={snapshots}
      />

      {/* Kas di RDN / RDI — kartu PUTIH, chip krem + logo bank, tombol "+" selalu ada.
          F9 mobile: label pindah ke .m-sec di kanvas (+ link Kelola), eyebrow & link dalam kartu disembunyikan. */}
      <div>
        <div className="m-sec md:hidden">
          <span>{t('investment.rdn_cash')}</span>
          <Link href="/dashboard/accounts">{t('investment.manage')} ›</Link>
        </div>
        <div className="s-card p-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-3 shrink-0">
          <div
            className="size-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--c-mint-soft)' }}
          >
            <Wallet className="size-5" style={{ color: 'var(--c-mint-ink)' }} />
          </div>
          <div>
            <p className="eyebrow max-md:hidden">{t('investment.rdn_cash')}</p>
            <p className="num tabular font-bold leading-tight" style={{ fontSize: 19, color: 'var(--ink)' }} title={formatCurrency(rdnTotal)}>
              {formatCompactCurrency(rdnTotal)}
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
          className="text-xs font-medium max-md:hidden md:inline-flex items-center gap-0.5 hover:underline shrink-0 ml-auto"
          style={{ color: 'var(--c-mint-ink)' }}
        >
          {t('investment.manage')} <ArrowUpRight className="size-3.5" />
        </Link>
        </div>
      </div>

      {/* F9 mobile: header "Kelas Aset" (sudah di kanvas dalam komponen) di-restyle
          jadi rupa .m-sec — 13px/600 ink, non-uppercase. `!` wajib: .eyebrow
          unlayered di globals ngalahin utilities tanpa important. Desktop tetap. */}
      <div className="max-md:[&_.eyebrow]:text-[13px]! max-md:[&_.eyebrow]:font-semibold! max-md:[&_.eyebrow]:normal-case! max-md:[&_.eyebrow]:tracking-normal! max-md:[&_.eyebrow]:text-[color:var(--ink)]! max-md:[&>div>div:first-child]:mb-1.5">
        <AssetClassCards byClass={byClass} byCategory={byCategory} />
      </div>

      {/* Currency rates — konteks FX, diturunkan dari slot #2: duit user dulu,
          kurs belakangan. F9 mobile: judul pindah ke .m-sec kanvas; eyebrow
          dalam kartu disembunyikan (subtitle jam update + refresh tetap). */}
      <div>
        <div className="m-sec md:hidden"><span>{t('investment.fx_title')}</span></div>
        <div className="max-md:[&_.eyebrow]:hidden">
          <CurrencyRates />
        </div>
      </div>

      {/* Alokasi donut + Kinerja per kelas.
          F9 mobile: judul tiap kartu pindah ke .m-sec di kanvas (marginTop 0
          inline — margin .m-sec gak collapse di dalam grid cell); header
          dalam kartu jadi desktop-only. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2 flex flex-col">
          <div className="m-sec md:hidden" style={{ marginTop: 0 }}><span>{t('investment.portfolio_composition')}</span></div>
          <div className="s-card p-5 sm:p-6 flex-1 flex flex-col">
          <div className="mb-4 max-md:hidden">
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
              {/* F11: donut TETAP (informatif) tapi proporsional di HP —
                  tinggi diciutkan + angka tengah compact (full digit kelebaran
                  buat lubang donut di layar sempit; full tetap via title). */}
              <div className="relative h-[150px] md:h-[180px]">
                <AllocationDonut data={donut} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                    {donut.length} {t('investment.classes')}
                  </p>
                  <p className="num tabular text-base font-semibold leading-tight" title={formatCurrency(totals.market)} style={{ color: 'var(--ink)' }}>
                    <span className="md:hidden">{formatCompactCurrency(totals.market)}</span>
                    <span className="hidden md:inline">{formatCurrency(totals.market)}</span>
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
        </div>

        <div className="lg:col-span-3 flex flex-col">
          <div className="m-sec md:hidden" style={{ marginTop: 0 }}>
            <span>{t('investment.return_per_class')}</span>
            <span className="text-[11px] font-normal" style={{ color: 'var(--ink-soft)' }}>{t('investment.performance_hint')}</span>
          </div>
          <div className="s-card p-5 sm:p-6 flex-1 flex flex-col">
          <div className="flex items-start justify-between gap-2 mb-4 max-md:hidden">
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
      </div>

      <WatchlistTargetChip />

      {/* F9 mobile: judul "Daftar Holding" pindah ke .m-sec kanvas; eyebrow+h2
          dalam kartu disembunyikan (wedge summary + tab pill tetap). Gate
          enriched.length menjiplak guard internal HoldingTable biar .m-sec
          gak yatim pas komponen return null. */}
      {enriched.length > 0 && (
        <div>
          <div className="m-sec md:hidden"><span>{t('investment.holding_list')}</span></div>
          <div className="max-md:[&_.eyebrow]:hidden max-md:[&_h2]:hidden">
            <HoldingTable enriched={enriched} quotes={quotes} />
          </div>
        </div>
      )}

      {/* Bottom row: Dividen 6 bulan + Dividen Terdekat (forward-looking —
          mengganti "Pergerakan Hari Ini" yang merender data day-change yang
          sama untuk ketiga kalinya di satu halaman). */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start">
        {/* Dividen 6 bulan — real dari tabel dividends.
            F9 mobile: judul ke .m-sec kanvas, eyebrow dalam kartu md-only. */}
        <div>
          <div className="m-sec md:hidden" style={{ marginTop: 0 }}><span>{t('investment.dividend_6mo')}</span></div>
          <div className="s-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="eyebrow max-md:hidden">{t('investment.dividend_6mo')}</p>
              <p className="num tabular font-bold mt-1" style={{ fontSize: 19, color: 'var(--ink)' }} title={formatCurrency(dividen6Total)}>{formatCompactCurrency(dividen6Total)}</p>
              {yieldOnCost != null && (
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                  {t('investment.yoc_label')} ~{yieldOnCost.toFixed(1).replace('.', ',')}% {t('investment.yoc_suffix')}
                </p>
              )}
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
            /* Empty state gak perlu nyewa tinggi chart 160px — padding wajar aja */
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>{t('investment.dividend_empty')}</p>
              <Link href="/dashboard/assets/investment/stock?tab=dividen" className="text-xs mt-1 hover:underline" style={{ color: 'var(--c-mint-ink)' }}>
                {t('investment.record_dividend')} →
              </Link>
            </div>
          ) : (
            <div className="h-[160px] xl:h-[220px]">
              <DividendBar data={dividen6} />
            </div>
          )}
          </div>
        </div>

        {/* UpcomingDividends bisa return null (query internal) — .m-sec kanvas
            gak bisa dipasang dari sini tanpa risiko header yatim; header
            dalam kartunya dibiarkan (butuh edit upcoming-dividends.tsx). */}
        <UpcomingDividends enriched={enriched} />
      </div>

    </div>
  )
}
