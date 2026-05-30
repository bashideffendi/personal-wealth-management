import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  getValuation,
  getValuationDetail,
  getEmittenStat,
  getDividendsForTicker,
  getStock,
  getQuarterlyFinancialsFor,
  getPricePerformanceFor,
  getResearchMarkdown,
  latestMetricYear,
  getMetricSeries,
} from '@/lib/invest/stocks'
import { getEmiten } from '@/lib/invest/emitten'
import { formatPrice, verdictStyle } from '@/lib/invest/format'
import { ResearchTabs, type ResearchTabsProps } from '@/components/investment/research-tabs'
import { ResearchLogButton } from '@/components/investment/research-log-button'
import { StockLogo } from '@/components/investment/stock-logo'

interface RouteProps {
  params: Promise<{ ticker: string }>
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
  const valuation = getValuation(ticker)
  const valuationDetail = getValuationDetail(ticker)
  const stats = getEmittenStat(ticker)
  const pricePerf = getPricePerformanceFor(ticker)
  const dividends = getDividendsForTicker(ticker)
  const bundledResearch = getResearchMarkdown(ticker)
  const quarterly = getQuarterlyFinancialsFor(ticker)

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

  if (!stock && !valuation && !emiten) {
    notFound()
  }

  const name = stock?.name || valuation?.name || emiten?.name || ticker
  const sector = stock?.sector || valuation?.sector || emiten?.sector || null
  const price = stock?.currentPrice ?? valuation?.price ?? emiten?.previousClose ?? 0
  const verdict = valuation?.verdict ?? null
  const verdictColor = verdictStyle(verdict)
  const avgMoS = valuation?.avgMoS ?? null
  const isUp = (avgMoS ?? 0) > 0
  const totalMethods = 8
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

  // Last 12 quarters from quarterly-financials (annotated period like "2025-Q2")
  function takeLastQuarters(
    series: Record<string, number> | undefined,
    n = 12,
  ): Array<{ period: string; value: number }> {
    if (!series) return []
    return Object.entries(series)
      .map(([period, value]) => ({ period, value }))
      .filter((q) => Number.isFinite(q.value))
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-n)
  }

  const tabsProps: ResearchTabsProps = {
    ticker,
    name,
    sector,
    price,
    latestYear,
    metrics5Y,
    stockMetrics: stock?.metrics ?? {},
    quarterly,
    valuation: valuation
      ? {
          ticker: valuation.ticker,
          name: valuation.name,
          sector: valuation.sector,
          price: valuation.price,
          methods: valuation.methods,
          avgFairValue: valuation.avgFairValue,
          medianFairValue: valuation.medianFairValue,
          methodsValid: valuation.methodsValid,
          undervaluedCount: valuation.undervaluedCount,
          avgMoS: valuation.avgMoS,
          verdict: valuation.verdict,
        }
      : null,
    valuationDetail: valuationDetail
      ? {
          ticker: valuationDetail.ticker,
          methods: valuationDetail.methods,
        }
      : null,
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
    quarterlyRevenue: takeLastQuarters(quarterly['Revenue']),
    quarterlyNetIncome: takeLastQuarters(quarterly['Net Income']),
    quarterlyEPS: takeLastQuarters(quarterly['EPS']),
    research: research
      ? { frontmatter: research.frontmatter, body: research.body }
      : null,
  }

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm flex-wrap" style={{ color: 'var(--ink-muted)' }}>
        <Link href="/dashboard/assets/investment" className="hover:underline">Investasi</Link>
        <span style={{ color: 'var(--ink-soft)' }}>›</span>
        <Link href="/dashboard/assets/investment/stock" className="hover:underline">Saham</Link>
        <span style={{ color: 'var(--ink-soft)' }}>›</span>
        <span style={{ color: 'var(--ink)' }}>Research · {ticker}</span>
      </nav>

      {/* Header — kartu putih: identitas (kiri) · panel harga snapshot (kanan) */}
      <header className="s-card p-6 sm:p-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Identitas emiten */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-4">
            <StockLogo ticker={ticker} size={52} />
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono font-bold tracking-tight" style={{ fontSize: 26, color: 'var(--ink)' }}>{ticker}</span>
                {verdict && (
                  <span
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: verdictColor.bg, color: verdictColor.fg }}
                  >
                    {verdict}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium mt-1" style={{ color: 'var(--ink-muted)' }}>{name}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 mt-6">
            {sector && (
              <div><p className="eyebrow">Sektor</p><p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{sector}</p></div>
            )}
            {stock?.board && (
              <div><p className="eyebrow">Papan</p><p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{stock.board}</p></div>
            )}
            {stock?.listingDate && (
              <div><p className="eyebrow">Listing</p><p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{stock.listingDate}</p></div>
            )}
          </div>
        </div>

        {/* Panel harga snapshot */}
        <div className="lg:w-[300px] shrink-0 flex flex-col gap-3">
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
            <div className="flex items-center justify-between gap-2">
              <p className="eyebrow">Harga Snapshot</p>
              <a
                href={`https://stockbit.com/symbol/${ticker}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-[11px] hover:underline"
                style={{ color: 'var(--ink-soft)' }}
              >
                Stockbit <ArrowUpRight className="size-2.5" />
              </a>
            </div>
            <p className="num tabular leading-none mt-2.5" style={{ fontSize: 40, fontWeight: 500, color: 'var(--ink)', letterSpacing: '-0.03em' }}>
              Rp {formatPrice(price)}
            </p>
            <p className="text-[11px] mt-2.5" style={{ color: 'var(--ink-soft)' }}>Snapshot terakhir · bukan harga real-time</p>
          </div>
          <ResearchLogButton ticker={ticker} name={name} />
        </div>
      </header>

      {/* Recommendation strip */}
      <div className="s-card overflow-hidden grid grid-cols-2 lg:grid-cols-4">
        <div
          className="p-5 border-b lg:border-b-0 lg:border-r"
          style={{ background: 'rgba(16,185,129,0.07)', borderColor: 'var(--border-soft)' }}
        >
          <p className="eyebrow" style={{ color: 'var(--c-mint)' }}>Rekomendasi · Equity Research</p>
          <p className="text-3xl font-bold mt-1 leading-none" style={{ color: 'var(--c-mint)' }}>
            {fm.recommendation ? String(fm.recommendation).toUpperCase() : '—'}
          </p>
          {fm.conviction && (
            <p className="text-xs mt-2" style={{ color: 'var(--ink-muted)' }}>Conviction <strong style={{ color: 'var(--ink)' }}>{fm.conviction}</strong></p>
          )}
          {fm.generated && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>Diperbarui {fm.generated}</p>
          )}
        </div>
        <div className="p-5 border-b lg:border-b-0 lg:border-r" style={{ borderColor: 'var(--border-soft)' }}>
          <p className="eyebrow">Fair Value</p>
          <p className="num tabular text-2xl font-bold mt-1" style={{ color: 'var(--ink)' }}>
            Rp {formatPrice(Number(fm.fair_value_low ?? valuation?.avgFairValue) || null)}
          </p>
          {fm.fair_value_high && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--ink-muted)' }}>– Rp {formatPrice(Number(fm.fair_value_high) || null)}</p>
          )}
        </div>
        <div className="p-5 lg:border-r" style={{ borderColor: 'var(--border-soft)' }}>
          <p className="eyebrow">Konsensus</p>
          <p className="num tabular text-2xl font-bold mt-1" style={{ color: 'var(--ink)' }}>
            {valuation?.undervaluedCount ?? '—'}/{totalMethods}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>metode: undervalued</p>
        </div>
        <div className="p-5">
          <p className="eyebrow">Avg MoS</p>
          <p className="num tabular text-2xl font-bold mt-1" style={{ color: isUp ? 'var(--c-mint)' : 'var(--c-coral)' }}>
            {avgMoS != null ? `${isUp ? '+' : ''}${(avgMoS * 100).toFixed(1)}%` : '—'}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>{valuation?.methodsValid ?? '—'}/{totalMethods} valid</p>
        </div>
      </div>

      <ResearchTabs {...tabsProps} />
    </div>
  )
}
