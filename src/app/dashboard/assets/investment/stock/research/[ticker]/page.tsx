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
import {
  formatPrice,
  signColorVar,
  verdictStyle,
} from '@/lib/invest/format'
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

      {/* Hero card — ticker + name + price + verdict + MoS */}
      <header
        className="rounded-2xl border p-6"
        style={{
          background: 'linear-gradient(135deg, var(--emerald-50) 0%, var(--surface) 60%)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p
                className="font-mono font-bold text-2xl tracking-tight"
                style={{ color: 'var(--ink)' }}
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
            <p className="mt-1 text-base font-semibold" style={{ color: 'var(--ink)' }}>
              {name}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs" style={{ color: 'var(--ink-muted)' }}>
              {sector && <span>Sektor <strong style={{ color: 'var(--ink)' }}>{sector}</strong></span>}
              {stock?.board && <span>Papan <strong style={{ color: 'var(--ink)' }}>{stock.board}</strong></span>}
              {stock?.listingDate && <span>Listing {stock.listingDate}</span>}
            </div>
          </div>

          <div className="text-right">
            <p className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'var(--ink-soft)' }}>
              Harga snapshot
            </p>
            <p className="num tabular text-3xl font-bold leading-none mt-1" style={{ color: 'var(--ink)' }}>
              Rp {formatPrice(price)}
            </p>
            {avgMoS != null && (
              <p
                className="text-xs font-semibold mt-2 inline-flex items-center gap-1"
                style={{ color: signColorVar(avgMoS) }}
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
                style={{ color: 'var(--ink-muted)' }}
              >
                Stockbit <ArrowUpRight className="size-2.5" />
              </a>
              <a
                href={`https://finance.yahoo.com/quote/${ticker}.JK`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 hover:underline"
                style={{ color: 'var(--ink-muted)' }}
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
