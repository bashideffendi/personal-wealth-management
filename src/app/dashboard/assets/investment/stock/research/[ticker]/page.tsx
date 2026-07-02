import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import YahooFinance from 'yahoo-finance2'
import { createClient } from '@/lib/supabase/server'
import {
  getEmittenStat,
  getDividendsForTicker,
  getStock,
  getSectorMedians,
  getQuarterlyFinancialsFor,
  getPricePerformanceFor,
  getResearchMarkdown,
  latestMetricYear,
  getMetricSeries,
} from '@/lib/invest/stocks'
import { valuate } from '@/lib/invest/valuation'
import { getEmiten } from '@/lib/invest/emitten'
import { getOwnership } from '@/lib/invest/ownership'
import { formatPrice, formatTanggalID, verdictStyle } from '@/lib/invest/format'
import { ResearchTabs, type ResearchTabsProps } from '@/components/investment/research-tabs'
import { ResearchLogButton } from '@/components/investment/research-log-button'
import { ResearchStockSearch } from '@/components/investment/research-stock-search'
import { StockLogo } from '@/components/investment/stock-logo'
import { StockPriceChart } from '@/components/investment/stock-price-chart-lazy'
import { InvestmentDisclaimer } from '@/components/investment/investment-disclaimer'

// yahoo-finance2 needs the Node runtime (not Edge) for the live-price fetch.
export const runtime = 'nodejs'

// yahoo-finance2 v3 requires class instantiation (removed default instance).
const yahooFinance = new YahooFinance()

interface RouteProps {
  params: Promise<{ ticker: string }>
}

/**
 * Fetch the live market price (Yahoo Finance) for the Yahoo-form ticker.
 * Single guarded call — falls back to `fallback` on any error/null/zero so the
 * page never breaks when Yahoo is down. This is the SAME source the price chart
 * uses, keeping MoS aligned with what the user sees on the chart.
 */
async function fetchLivePrice(
  yahooTicker: string,
  fallback: number,
): Promise<number> {
  try {
    const q = (await yahooFinance.quote(yahooTicker)) as {
      regularMarketPrice?: number
    }
    const live = q?.regularMarketPrice
    return typeof live === 'number' && live > 0 ? live : fallback
  } catch {
    return fallback
  }
}

export default async function StockResearchPage({ params }: RouteProps) {
  const { ticker: rawTicker } = await params
  const ticker = rawTicker.toUpperCase()

  // Auth gate
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/dashboard/assets/investment/stock/research/${ticker}`)

  const stock = getStock(ticker)
  const emiten = getEmiten(ticker)
  const stats = getEmittenStat(ticker)
  const pricePerf = getPricePerformanceFor(ticker)
  const dividends = getDividendsForTicker(ticker)
  const bundledResearch = getResearchMarkdown(ticker)
  const quarterly = getQuarterlyFinancialsFor(ticker)
  const ownership = getOwnership(ticker)

  // Fallback: cek cache Supabase kalau gak ada bundled markdown.
  // Cache di-populate oleh /api/idx-research/[ticker]/generate (AI-generated).
  let cachedResearch: { frontmatter: Record<string, string | number>; body: string } | null = null
  if (!bundledResearch) {
    const { data } = await supabase
      .from('stock_research_cache')
      .select('content, frontmatter, generated_at, model')
      .eq('ticker', ticker)
      .maybeSingle()
    if (data) {
      const row = data as {
        content: string
        frontmatter: Record<string, string | number>
        generated_at: string
        model: string
      }
      cachedResearch = {
        frontmatter: { ...row.frontmatter, generated: row.generated_at.slice(0, 10) },
        body: row.content.replace(/^---\n[\s\S]*?\n---\n/, ''), // strip frontmatter from body
      }
    }
  }
  const research = bundledResearch ?? cachedResearch

  if (!stock && !emiten) {
    notFound()
  }

  const name = stock?.name || emiten?.name || ticker
  const sector = stock?.sector || emiten?.sector || null
  const price = stock?.currentPrice ?? emiten?.previousClose ?? 0

  // Yahoo-form ticker for the live price chart. All bundled data here
  // (stocks.json / valuations / emitten) is IDX-only — there's no US signal on
  // these objects — so we always append .JK. (US holdings store their own
  // currency on the `investments` table, but this research page only serves IDX.)
  const yahooTicker = ticker.endsWith('.JK') ? ticker : `${ticker}.JK`

  // Live market price (Yahoo) — same source as the price chart. Used as the
  // market price for Margin of Safety so MoS reflects today, not the stale
  // bundled snapshot. Fair values stay intrinsic (computed from annual FY data).
  const livePrice = await fetchLivePrice(yahooTicker, price)

  const fm = research?.frontmatter ?? {}

  // Build last-5-years metric series from stocks.json
  const latestYear = stock ? (latestMetricYear(stock.metrics['Net Profit'])?.year ?? null) : null
  const metrics5Y = stock
    ? {
        revenue: getMetricSeries(stock, 'Revenue'),
        netProfit: getMetricSeries(stock, 'Net Profit'),
        eps: getMetricSeries(stock, 'EPS'),
        bvps: getMetricSeries(stock, 'BVPS'),
        dps: getMetricSeries(stock, 'DPS'),
        roe: getMetricSeries(stock, 'ROE'),
        npm: getMetricSeries(stock, 'Net Profit Margin'),
        revenueYoY: getMetricSeries(stock, 'Revenue YoY Growth'),
        netProfitYoY: getMetricSeries(stock, 'Net Profit YoY Growth'),
        perRatio: getMetricSeries(stock, 'PE Ratio'),
        pbv: getMetricSeries(stock, 'PBV'),
        der: getMetricSeries(stock, 'Debt to Equity'),
        marketCap: getMetricSeries(stock, 'Market Cap'),
      }
    : {
        revenue: [], netProfit: [], eps: [], bvps: [], dps: [], roe: [], npm: [],
        revenueYoY: [], netProfitYoY: [], perRatio: [], pbv: [], der: [], marketCap: [],
      }

  // Valuasi konsensus 13-metode — live compute dari raw financials.
  // Sector medians dibaca dari precompute (sector-medians.json) — gak perlu
  // muat + iterasi seluruh universe (~30 MB) cuma buat anchor 1 valuasi.
  // Fair value tetap intrinsik (dari data FY); cuma harga pasar buat MoS yang
  // di-override ke harga live Yahoo (bukan snapshot basi).
  const valuationV2 = stock
    ? valuate({ ...stock, currentPrice: livePrice }, getSectorMedians())
    : null

  // Hero strip + verdict badge — satu sumber kebenaran dengan tab Valuasi
  // (valuationV2, 13 metode live). Verdict & MoS dari weighted consensus.
  const verdict = valuationV2?.verdict ?? null
  const verdictColor = verdictStyle(verdict)
  const heroMoS = valuationV2?.weightedMoS ?? null
  const isUp = (heroMoS ?? 0) > 0
  const totalMethods = 13
  // Fair value: samakan dengan kartu ringkasan tab (weighted, fallback median/avg).
  const heroFairValue =
    valuationV2?.weightedFairValue ??
    valuationV2?.medianFairValue ??
    valuationV2?.avgFairValue ??
    null

  const tabsProps: ResearchTabsProps = {
    ticker,
    name,
    sector,
    price: livePrice,
    valuationV2,
    latestYear,
    metrics5Y,
    stockMetrics: stock?.metrics ?? {},
    quarterly,
    stats: stats
      ? {
          freeFloatPct: stats.freeFloatPct,
          marketCap: stats.marketCap,
          enterpriseValue: stats.enterpriseValue,
          currentShareOutstanding: stats.currentShareOutstanding,
          freeFloatStr: stats.freeFloatStr,
        }
      : null,
    pricePerf: pricePerf ?? null,
    dividends,
    research: research
      ? { frontmatter: research.frontmatter, body: research.body }
      : null,
    ownership,
  }

  return (
    <div className="space-y-5">
      {/* Breadcrumb — mobile: back-link tunggal ke screener Research (route
          sama dgn level "Saham", deep-link ?tab=research); desktop (sm+):
          trail 3 level seperti semula. Pola dual-render sm:hidden/hidden sm:flex. */}
      <nav className="sm:hidden" style={{ color: 'var(--ink-muted)' }}>
        <Link
          href="/dashboard/assets/investment/stock?tab=research"
          className="inline-flex items-center gap-1.5 text-xs font-medium rounded-md px-2 py-1 -ml-2 transition-colors hover:bg-[var(--surface-2)]"
        >
          <ArrowLeft className="size-3.5" /> Research
        </Link>
      </nav>
      <nav className="hidden sm:flex items-center gap-1.5 text-sm flex-wrap" style={{ color: 'var(--ink-muted)' }}>
        <Link href="/dashboard/assets/investment" className="hover:underline">Investasi</Link>
        <span style={{ color: 'var(--ink-soft)' }}>›</span>
        <Link href="/dashboard/assets/investment/stock" className="hover:underline">Saham</Link>
        <span style={{ color: 'var(--ink-soft)' }}>›</span>
        <span style={{ color: 'var(--ink)' }}>Research · {ticker}</span>
      </nav>

      {/* Kartu ringkasan: identitas + harga (atas) · metrik valuasi (bawah) */}
      <header className="s-card overflow-hidden">
        {/* Atas — identitas + info emiten (kiri) · aksi (kanan) */}
        <div className="p-5 sm:p-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <StockLogo ticker={ticker} size={58} />
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono font-bold tracking-tight" style={{ fontSize: 24, lineHeight: 1, color: 'var(--ink)' }}>{ticker}</span>
                {verdict && (
                  <span
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: verdictColor.bg, color: verdictColor.fg }}
                  >
                    {verdict}
                  </span>
                )}
              </div>
              <p className="font-semibold mt-1.5" style={{ fontSize: 17, color: 'var(--ink)' }}>{name}</p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2.5 text-[13px]">
                {sector && (
                  <span><span style={{ color: 'var(--ink-soft)' }}>Sektor </span><span style={{ color: 'var(--ink)', fontWeight: 600 }}>{sector}</span></span>
                )}
                {stock?.board && (
                  <span><span style={{ color: 'var(--ink-soft)' }}>Papan </span><span style={{ color: 'var(--ink)', fontWeight: 600 }}>{stock.board}</span></span>
                )}
                {stock?.listingDate && (
                  <span><span style={{ color: 'var(--ink-soft)' }}>Listing </span><span className="num" style={{ color: 'var(--ink)', fontWeight: 600 }}>{formatTanggalID(stock.listingDate)}</span></span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Lompat ke research saham lain dengan cepat */}
            <div className="w-44 sm:w-52">
              <ResearchStockSearch />
            </div>
            <ResearchLogButton ticker={ticker} name={name} />
          </div>
        </div>

        {/* Tengah — grafik harga live (nyatu di kartu yang sama) */}
        <div className="border-t" style={{ borderColor: 'var(--border-soft)' }}>
          <StockPriceChart ticker={yahooTicker} fallbackPrice={livePrice} fallbackCurrency="IDR" />
        </div>

        {/* Bawah — strip metrik valuasi */}
        <div className="border-t grid grid-cols-2 lg:grid-cols-4" style={{ borderColor: 'var(--border-soft)' }}>
          <div
            className="p-4 flex flex-col justify-center border-b lg:border-b-0 lg:border-r"
            style={{ background: 'rgba(16,185,129,0.07)', borderColor: 'var(--border-soft)' }}
          >
          <p className="eyebrow" style={{ color: 'var(--c-mint-ink)' }}>Ringkasan AI · Equity Research</p>
          <p className="text-2xl font-bold mt-1 leading-none" style={{ color: 'var(--c-mint-ink)' }}>
            {fm.recommendation ? String(fm.recommendation).toUpperCase() : '—'}
          </p>
          {fm.conviction && (
            <p className="text-xs mt-2" style={{ color: 'var(--ink-muted)' }}>Conviction <strong style={{ color: 'var(--ink)' }}>{fm.conviction}</strong></p>
          )}
          {fm.generated && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>Diperbarui {fm.generated}</p>
          )}
        </div>
        <div className="p-4 flex flex-col justify-center border-b lg:border-b-0 lg:border-r" style={{ borderColor: 'var(--border-soft)' }}>
          <p className="eyebrow">Fair Value</p>
          <p className="num tabular text-xl font-bold mt-1" style={{ color: 'var(--ink)' }}>
            Rp {formatPrice(heroFairValue)}
          </p>
          {fm.fair_value_low && fm.fair_value_high && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--ink-muted)' }}>Research Rp {formatPrice(Number(fm.fair_value_low) || null)} – Rp {formatPrice(Number(fm.fair_value_high) || null)}</p>
          )}
        </div>
        <div className="p-4 flex flex-col justify-center lg:border-r" style={{ borderColor: 'var(--border-soft)' }}>
          <p className="eyebrow">Konsensus</p>
          <p className="num tabular text-xl font-bold mt-1" style={{ color: 'var(--ink)' }}>
            {valuationV2?.undervaluedCount ?? '—'}/{totalMethods}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>metode: undervalued</p>
        </div>
        <div className="p-4 flex flex-col justify-center">
          <p className="eyebrow">Avg MoS</p>
          <p className="num tabular text-xl font-bold mt-1" style={{ color: isUp ? 'var(--c-mint)' : 'var(--c-coral)' }}>
            {heroMoS != null ? `${isUp ? '+' : ''}${(heroMoS * 100).toFixed(1)}%` : '—'}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>{valuationV2?.methodsValid ?? '—'}/{totalMethods} valid</p>
        </div>
        </div>
      </header>

      <InvestmentDisclaimer className="mt-1" />

      <ResearchTabs {...tabsProps} />
    </div>
  )
}
