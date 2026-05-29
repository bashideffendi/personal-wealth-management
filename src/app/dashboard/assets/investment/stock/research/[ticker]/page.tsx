import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react'
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
      <Link
        href="/dashboard/assets/investment/stock"
        className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        style={{ color: 'var(--ink-muted)' }}
      >
        <ArrowLeft className="size-3.5" />
        Kembali ke Saham
      </Link>

      {/* Hero — dark gradient ticker anchor */}
      <header
        className="relative overflow-hidden rounded-3xl"
        style={{
          background: 'linear-gradient(135deg, #0A0A0F 0%, #14141A 50%, #0F1F1A 100%)',
          color: '#F5F5F7',
          boxShadow: '0 24px 60px -20px rgba(0,0,0,0.40)',
        }}
      >
        <div
          className="absolute pointer-events-none"
          style={{
            top: -100, right: -60, width: 360, height: 360,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${isUp ? 'rgba(16, 185, 129, 0.18)' : 'rgba(251, 113, 133, 0.16)'}, transparent 65%)`,
          }}
        />
        <div className="relative p-6 sm:p-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p
                className="font-mono font-bold text-3xl tracking-tight"
                style={{ color: '#FFFFFF' }}
              >
                {ticker}
              </p>
              {verdict && (
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide"
                  style={{ background: verdictColor.bg, color: verdictColor.fg }}
                >
                  {verdict}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-base font-semibold" style={{ color: '#FFFFFF' }}>
              {name}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {sector && <span>Sektor <strong style={{ color: '#FFFFFF' }}>{sector}</strong></span>}
              {stock?.board && <span>Papan <strong style={{ color: '#FFFFFF' }}>{stock.board}</strong></span>}
              {stock?.listingDate && <span>Listing {stock.listingDate}</span>}
            </div>
          </div>

          <div className="text-right">
            <p
              className="text-[10px] font-bold tracking-[0.14em] uppercase"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              Harga snapshot
            </p>
            <p
              className="num tabular font-bold leading-none mt-1"
              style={{ fontSize: 36, color: '#FFFFFF', letterSpacing: '-0.035em' }}
            >
              Rp {formatPrice(price)}
            </p>
            {avgMoS != null && (
              <p
                className="text-xs font-bold mt-2 inline-flex items-center gap-1"
                style={{ color: isUp ? '#6EE7B7' : '#FDA4AF' }}
              >
                {isUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                Avg MoS {(avgMoS * 100).toFixed(1)}%
              </p>
            )}
            <div className="mt-3 flex gap-3 text-[11px] justify-end flex-wrap">
              <a
                href={`https://stockbit.com/symbol/${ticker}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 hover:underline"
                style={{ color: 'rgba(255,255,255,0.55)' }}
              >
                Stockbit <ArrowUpRight className="size-2.5" />
              </a>
              <a
                href={`https://finance.yahoo.com/quote/${ticker}.JK`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 hover:underline"
                style={{ color: 'rgba(255,255,255,0.55)' }}
              >
                Yahoo <ArrowUpRight className="size-2.5" />
              </a>
            </div>
          </div>
        </div>
      </header>

      <ResearchTabs {...tabsProps} />
    </div>
  )
}
