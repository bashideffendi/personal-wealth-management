'use client'

/**
 * Research tabs — full feature parity dengan kelolainvestasi: Research,
 * Overview, Valuasi, Laporan, Charts. Klunting theme (emerald/Plus Jakarta).
 *
 * Server component (page.tsx) pre-fetch semua data, kita render UI di sini.
 */

import { useMemo, useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  BookOpen, BarChart3, Calculator, FileText, TrendingUp,
  Calendar, Sparkles, AlertCircle, Loader2, Zap, Network, RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import {
  formatIDRCompact,
  formatPercentValue,
  formatPrice,
  formatRatio,
  signColorVar,
} from '@/lib/invest/format'
import { useT } from '@/lib/i18n/context'
import { FinancialStatements } from './financial-statements'
import { KeyStatsGrid } from './keystats-grid'
import { ValuationConsensus } from './valuation-consensus'
import { TrendsPanel } from './trends-panel'
import { OwnershipTab } from './ownership-tab'
import type { ValuationSummary } from '@/lib/invest/valuation'
import type { Ownership } from '@/lib/invest/ownership'

interface MetricSeries {
  year: number
  value: number
}

interface DividendEvent {
  ticker: string
  period: string
  dividend: number
  exDate: string | null
  payDate: string | null
}

interface EmittenStat {
  freeFloatPct: number | null
  marketCap: number | null
  enterpriseValue: number | null
  currentShareOutstanding: number | null
  freeFloatStr: string | null
}

interface PricePerf {
  high: number | null
  low: number | null
  percentage: number | null
}

interface ResearchFrontmatter {
  ticker?: string
  name?: string
  sector?: string
  generated?: string
  recommendation?: string
  conviction?: string
  thesis?: string
  fair_value_low?: number
  fair_value_high?: number
  current_price?: number
}

export interface ResearchTabsProps {
  ticker: string
  name: string
  sector: string | null
  price: number
  /** Valuasi konsensus 13-metode (live compute). Null kalau stock gak ketemu. */
  valuationV2: ValuationSummary | null
  latestYear: number | null
  // Annual metrics — last 5 years (derived series for charts/overview)
  metrics5Y: {
    revenue: MetricSeries[]
    netProfit: MetricSeries[]
    eps: MetricSeries[]
    bvps: MetricSeries[]
    dps: MetricSeries[]
    roe: MetricSeries[]
    npm: MetricSeries[]
    revenueYoY: MetricSeries[]
    netProfitYoY: MetricSeries[]
    perRatio: MetricSeries[]
    pbv: MetricSeries[]
    der: MetricSeries[]
    marketCap: MetricSeries[]
  }
  // Raw stock metrics (full history per metric) — buat FinancialStatements
  stockMetrics: Record<string, Record<string, number>>
  // Raw quarterly financials (period → metric → value) — buat FinancialStatements
  quarterly: Record<string, Record<string, number>>
  stats: EmittenStat | null
  pricePerf: {
    '1M'?: PricePerf
    '3M'?: PricePerf
    '6M'?: PricePerf
    '1Y'?: PricePerf
    '3Y'?: PricePerf
    '5Y'?: PricePerf
  } | null
  dividends: DividendEvent[]
  research: {
    frontmatter: ResearchFrontmatter
    body: string
  } | null
  /** Jaring kepemilikan (ownership network). Null kalau emiten belum di-scrape. */
  ownership: Ownership | null
}

export function ResearchTabs(props: ResearchTabsProps) {
  const t = useT()
  const {
    ticker, name, sector, price, valuationV2, latestYear, metrics5Y,
    stockMetrics, quarterly,
    stats, pricePerf, dividends,
    research: initialResearch,
    ownership,
  } = props

  // Research bisa di-generate ulang di client (lokal state). Initial value
  // dari server (bundled markdown OR cached AI generation).
  const [research, setResearch] = useState(initialResearch)

  // Basis laporan keuangan riset (tahun fiskal terbaru yang dipakai valuasi) —
  // ditampilkan di bar regenerate biar user tahu data riset dari periode mana.
  const dataPeriod = latestYear ? `FY${latestYear}` : null

  // Latest annual values
  const latestRevenue = metrics5Y.revenue.at(-1)?.value ?? null
  const latestNetProfit = metrics5Y.netProfit.at(-1)?.value ?? null
  const latestRevYoY = metrics5Y.revenueYoY.at(-1)?.value ?? null
  const latestPER = metrics5Y.perRatio.at(-1)?.value ?? null
  const latestPBV = metrics5Y.pbv.at(-1)?.value ?? null
  const latestROE = metrics5Y.roe.at(-1)?.value ?? null
  const latestNPM = metrics5Y.npm.at(-1)?.value ?? null
  const latestDER = metrics5Y.der.at(-1)?.value ?? null
  const latestMarketCap = metrics5Y.marketCap.at(-1)?.value ?? null

  const oneYear = pricePerf?.['1Y']

  const upcomingDividends = useMemo(
    () => dividends.filter((d) => {
      const ex = parseIDXDate(d.exDate)
      return ex && ex >= new Date()
    }),
    [dividends],
  )
  const pastDividends = useMemo(
    () => dividends.filter((d) => {
      const ex = parseIDXDate(d.exDate)
      return !ex || ex < new Date()
    }).slice(0, 24),
    [dividends],
  )

  return (
    <Tabs defaultValue="research" className="w-full">
      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <TabsList variant="pill" className="inline-flex gap-1.5 w-auto">
          <TabsTrigger value="research">
            <BookOpen className="size-3.5 mr-1.5" />
            Research
          </TabsTrigger>
          <TabsTrigger value="overview">
            <BarChart3 className="size-3.5 mr-1.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="valuasi">
            <Calculator className="size-3.5 mr-1.5" />
            {t('research_tabs.tab_valuation')}
          </TabsTrigger>
          <TabsTrigger value="laporan">
            <FileText className="size-3.5 mr-1.5" />
            {t('research_tabs.tab_statements')}
          </TabsTrigger>
          <TabsTrigger value="charts">
            <TrendingUp className="size-3.5 mr-1.5" />
            Charts
          </TabsTrigger>
          <TabsTrigger value="kepemilikan">
            <Network className="size-3.5 mr-1.5" />
            {t('research_tabs.tab_ownership')}
          </TabsTrigger>
        </TabsList>
      </div>

      {/* ─── Research — 2 kolom: sidebar metrik (kiri) + narasi (kanan) ─── */}
      <TabsContent value="research" className="mt-4">
        {research ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 items-start">
            {/* Sidebar metrik */}
            <aside className="lg:col-span-1 space-y-4">
              {oneYear?.low != null && oneYear?.high != null && (
                <div className="s-card p-4">
                  <p className="eyebrow">{t('research_tabs.range_52w')}</p>
                  <p className="num tabular text-base font-bold mt-1" style={{ color: 'var(--ink)' }}>
                    Rp {formatPrice(oneYear.low)} – Rp {formatPrice(oneYear.high)}
                  </p>
                  {price != null && oneYear.high > oneYear.low && (() => {
                    const pct = Math.min(100, Math.max(0, ((price - oneYear.low) / (oneYear.high - oneYear.low)) * 100))
                    return (
                      <>
                        <div className="relative h-1.5 rounded-full mt-3" style={{ background: 'var(--surface-2)' }}>
                          <div className="absolute size-3 rounded-full -top-[3px] -translate-x-1/2" style={{ left: `${pct}%`, background: 'var(--c-primary)' }} />
                        </div>
                        <p className="text-[11px] mt-2" style={{ color: 'var(--ink-soft)' }}>{t('research_tabs.price_in_range_prefix')} {Math.round(pct)}{t('research_tabs.price_in_range_suffix')}</p>
                      </>
                    )
                  })()}
                </div>
              )}

              <div className="s-card p-4">
                <p className="eyebrow mb-3">{t('research_tabs.key_ratios')}</p>
                <div className="space-y-2.5 text-sm">
                  {[
                    { k: 'PER', v: formatRatio(latestPER) },
                    { k: 'PBV', v: formatRatio(latestPBV) },
                    { k: 'ROE', v: formatPercentValue(latestROE), accent: true },
                    { k: 'NPM', v: formatPercentValue(latestNPM) },
                    { k: 'DER', v: formatRatio(latestDER) },
                    { k: 'Free Float', v: stats?.freeFloatPct != null ? `${(stats.freeFloatPct * 100).toFixed(1)}%` : '—' },
                  ].map((r) => (
                    <div key={r.k} className="flex items-center justify-between gap-2">
                      <span style={{ color: 'var(--ink-muted)' }}>{r.k}</span>
                      <span className="num tabular font-semibold" style={{ color: r.accent ? 'var(--c-mint)' : 'var(--ink)' }}>{r.v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="s-card p-4">
                <p className="eyebrow mb-3">{t('research_tabs.fundamental')}</p>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{latestYear ? `Revenue FY${latestYear}` : 'Revenue'}</p>
                    <p className="num tabular font-bold" style={{ color: 'var(--ink)' }}>{formatIDRCompact(latestRevenue)}</p>
                    <p className="text-[11px]" style={{ color: signColorVar(latestRevYoY) }}>YoY {formatPercentValue(latestRevYoY)}</p>
                  </div>
                  <div>
                    <p className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>Net Profit</p>
                    <p className="num tabular font-bold" style={{ color: 'var(--ink)' }}>{formatIDRCompact(latestNetProfit)}</p>
                    <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>Margin {formatPercentValue(latestNPM)}</p>
                  </div>
                  <div>
                    <p className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>Market Cap</p>
                    <p className="num tabular font-bold" style={{ color: 'var(--ink)' }}>{formatIDRCompact(latestMarketCap ?? stats?.marketCap ?? null)}</p>
                  </div>
                </div>
              </div>
            </aside>

            {/* Narasi */}
            <div className="lg:col-span-3 min-w-0">
              <ResearchView research={research} ticker={ticker} dataPeriod={dataPeriod} onRegenerated={setResearch} />
            </div>
          </div>
        ) : (
          <GenerateResearchEmpty
            ticker={ticker}
            name={name}
            sector={sector}
            onGenerated={setResearch}
          />
        )}
      </TabsContent>

      {/* ─── Overview / Key Statistics — real compute dari stocks.json + emitten-stats + quarterly ─── */}
      <TabsContent value="overview" className="mt-4">
        <KeyStatsGrid
          stock={{ sector, currentPrice: price, metrics: stockMetrics }}
          quarterly={quarterly}
          emittenStats={stats}
          pricePerformance={pricePerf}
          dividendEvents={dividends}
        />
      </TabsContent>

      {/* ─── Valuasi (konsensus 13 metode, live compute, weighted sector-fit) ─── */}
      <TabsContent value="valuasi" className="mt-4 space-y-4">
        {valuationV2 ? (
          <ValuationConsensus data={valuationV2} price={price} sector={sector} />
        ) : (
          <div
            className="rounded-2xl border p-8 text-center text-sm"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink-muted)' }}
          >
            {t('research_tabs.valuation_no_data')}
          </div>
        )}

        <DisclaimerBox />
      </TabsContent>

      {/* ─── Laporan (full financial statements: Laba Rugi / Neraca / Arus Kas / Market) ─── */}
      <TabsContent value="laporan" className="mt-4 space-y-4">
        <FinancialStatements
          stock={{ ticker, metrics: stockMetrics }}
          quarterly={quarterly}
        />

        {/* Dividend history */}
        {dividends.length > 0 && (
          <div
            className="rounded-2xl border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            {upcomingDividends.length > 0 && (
              <>
                <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-soft)' }}>
                  <Calendar className="size-4" style={{ color: 'var(--c-mint)' }} />
                  <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                    {t('research_tabs.upcoming_dividends')}
                  </p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('research_tabs.col_period')}</TableHead>
                      <TableHead>Ex-Date</TableHead>
                      <TableHead>Pay Date</TableHead>
                      <TableHead className="text-right">{t('research_tabs.col_per_share')}</TableHead>
                      <TableHead className="text-right">Yield*</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upcomingDividends.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell>{e.period}</TableCell>
                        <TableCell className="font-medium">{e.exDate}</TableCell>
                        <TableCell>{e.payDate}</TableCell>
                        <TableCell className="text-right num">Rp {formatPrice(e.dividend)}</TableCell>
                        <TableCell className="text-right num" style={{ color: 'var(--c-mint)' }}>
                          {price > 0 ? formatPercentValue(e.dividend / price) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
            <div className="px-5 py-3 flex items-center gap-2" style={{ borderTop: upcomingDividends.length > 0 ? '1px solid var(--border-soft)' : undefined, borderBottom: '1px solid var(--border-soft)' }}>
              <FileText className="size-4" style={{ color: 'var(--ink-muted)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                {t('research_tabs.dividend_history')}
              </p>
              <span className="ml-auto text-xs" style={{ color: 'var(--ink-muted)' }}>
                {pastDividends.length} {t('research_tabs.payments_suffix')}
              </span>
            </div>
            <div className="overflow-x-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('research_tabs.col_period')}</TableHead>
                    <TableHead>Ex-Date</TableHead>
                    <TableHead>Pay Date</TableHead>
                    <TableHead className="text-right">{t('research_tabs.col_per_share')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pastDividends.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell>{e.period}</TableCell>
                      <TableCell style={{ color: 'var(--ink-muted)' }}>{e.exDate}</TableCell>
                      <TableCell style={{ color: 'var(--ink-muted)' }}>{e.payDate}</TableCell>
                      <TableCell className="text-right num">Rp {formatPrice(e.dividend)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </TabsContent>

      {/* ─── Charts — tren metrik per kategori (Growth/Profitability/Valuation/Health) ─── */}
      <TabsContent value="charts" className="mt-4 space-y-4">
        <TrendsPanel metrics={stockMetrics} />
      </TabsContent>

      {/* ─── Struktur Kepemilikan — jaring kepemilikan (graf Sigma + komposisi + anak usaha) ─── */}
      <TabsContent value="kepemilikan" className="mt-4">
        <OwnershipTab ticker={ticker} ownership={ownership} />
      </TabsContent>
    </Tabs>
  )
}

// ─── Subcomponents ────────────────────────────────────────────────

function ResearchView({
  research,
  ticker,
  dataPeriod,
  onRegenerated,
}: {
  research: { frontmatter: ResearchFrontmatter; body: string }
  ticker: string
  dataPeriod: string | null
  onRegenerated: (next: { frontmatter: ResearchFrontmatter; body: string }) => void
}) {
  const t = useT()
  return (
    <div className="space-y-4">
      {/* Markdown body (header rekomendasi + fair value sekarang di strip atas) */}
      <article
        className="rounded-2xl border p-5 sm:p-6"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {research.frontmatter.thesis && (
          <div className="mb-5 pb-5 border-b" style={{ borderColor: 'var(--border-soft)' }}>
            <p className="eyebrow" style={{ color: 'var(--c-mint)' }}>{t('research_tabs.investment_thesis')}</p>
            <p
              className="mt-2 pl-4 border-l-2 italic leading-relaxed text-base sm:text-lg"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)', borderColor: 'var(--c-mint)' }}
            >
              {research.frontmatter.thesis}
            </p>
          </div>
        )}
        <div className="prose-research max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{research.body}</ReactMarkdown>
        </div>
      </article>

      <RegenerateBar ticker={ticker} dataPeriod={dataPeriod} generated={research.frontmatter.generated} onRegenerated={onRegenerated} />

      <DisclaimerBox />

      <style jsx>{`
        :global(.prose-research) {
          font-size: 14px;
          color: var(--ink);
          line-height: 1.65;
        }
        :global(.prose-research h2) {
          font-size: 18px;
          font-weight: 700;
          margin-top: 1.75em;
          margin-bottom: 0.6em;
          color: var(--ink);
          letter-spacing: -0.015em;
        }
        :global(.prose-research h2:first-child) {
          margin-top: 0;
        }
        :global(.prose-research h3) {
          font-size: 15px;
          font-weight: 700;
          margin-top: 1.4em;
          margin-bottom: 0.4em;
          color: var(--ink);
        }
        :global(.prose-research p) {
          margin: 0.7em 0;
          color: var(--ink-muted);
          text-align: justify;
          text-justify: inter-word;
          hyphens: auto;
        }
        :global(.prose-research strong) {
          color: var(--ink);
          font-weight: 600;
        }
        :global(.prose-research ul),
        :global(.prose-research ol) {
          margin: 0.6em 0;
          padding-left: 1.5em;
          color: var(--ink-muted);
        }
        :global(.prose-research li) {
          margin: 0.3em 0;
        }
        :global(.prose-research li > strong:first-child) {
          color: var(--ink);
        }
        :global(.prose-research blockquote) {
          border-left: 3px solid var(--c-mint);
          padding-left: 1em;
          margin: 1em 0;
          color: var(--ink-muted);
          font-style: italic;
        }
        :global(.prose-research code) {
          background: var(--surface-2);
          padding: 0.1em 0.4em;
          border-radius: 4px;
          font-size: 0.85em;
        }
        :global(.prose-research a) {
          color: var(--c-mint);
          text-decoration: underline;
        }
        :global(.prose-research table) {
          width: 100%;
          border-collapse: collapse;
          margin: 1em 0;
          font-size: 13px;
        }
        :global(.prose-research th),
        :global(.prose-research td) {
          padding: 0.4em 0.6em;
          text-align: left;
          border-bottom: 1px solid var(--border-soft);
        }
        :global(.prose-research th) {
          font-weight: 600;
          color: var(--ink);
          background: var(--surface-2);
        }
        :global(.prose-research hr) {
          border: 0;
          border-top: 1px solid var(--border-soft);
          margin: 2em 0;
        }
      `}</style>
    </div>
  )
}

// ─── Generate Research (empty state + regenerate bar) ─────────

const RESEARCH_CREDIT_COST = 30

function GenerateResearchEmpty({
  ticker,
  name,
  sector,
  onGenerated,
}: {
  ticker: string
  name: string
  sector: string | null
  onGenerated: (next: { frontmatter: ResearchFrontmatter; body: string }) => void
}) {
  const t = useT()
  const [generating, setGenerating] = useState(false)

  async function generate() {
    setGenerating(true)
    try {
      const res = await fetch(`/api/idx-research/${ticker}/generate`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? `${t('research_tabs.generate_failed_prefix')} ${res.status}`)
        return
      }
      // Strip frontmatter dari body (sudah disimpan terpisah)
      const body = String(json.content ?? '').replace(/^---\n[\s\S]*?\n---\n?/, '').trim()
      onGenerated({
        frontmatter: (json.frontmatter as ResearchFrontmatter) ?? {},
        body,
      })
      toast.success(t('research_tabs.generate_success'), {
        description: json.cached ? t('research_tabs.generate_from_cache') : t('research_tabs.generate_saved_to_cache'),
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Network error')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl border p-8 sm:p-10 text-center"
        style={{
          boxShadow: 'var(--card-shadow)', background: 'linear-gradient(135deg, var(--c-mint-soft), var(--surface) 60%)',
          borderColor: 'var(--border)',
        }}
      >
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{
            background: 'var(--c-primary)',
            color: 'var(--c-primary-foreground)',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          <Sparkles className="size-6" />
        </div>
        <h3 className="mt-4 text-lg font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
          {t('research_tabs.empty_heading_prefix')} {ticker}
        </h3>
        <p className="mt-2 text-sm max-w-md mx-auto" style={{ color: 'var(--ink-muted)' }}>
          {t('research_tabs.empty_desc_prefix')} {name}
          {sector ? ` ${t('research_tabs.empty_desc_sector_prefix')} ${sector})` : ''}. {t('research_tabs.empty_desc_suffix')}
        </p>

        <div
          className="mt-5 mx-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: 'var(--amber-100)', color: 'var(--amber-700)' }}
        >
          <Zap className="size-3.5" />
          {RESEARCH_CREDIT_COST} {t('research_tabs.credit_cost_suffix')}
        </div>

        <Button
          onClick={generate}
          disabled={generating}
          className="mt-5"
          style={{ background: 'var(--c-mint)', color: '#FFFFFF' }}
        >
          {generating ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t('research_tabs.generating_label')}
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              {t('research_tabs.generate_label')}
            </>
          )}
        </Button>

        <p className="mt-4 text-[11px] max-w-md mx-auto" style={{ color: 'var(--ink-soft)' }}>
          {t('research_tabs.cache_hint_prefix')} {ticker} {t('research_tabs.cache_hint_suffix')}
        </p>
      </div>

      <DisclaimerBox />
    </div>
  )
}

function RegenerateBar({
  ticker,
  dataPeriod,
  generated,
  onRegenerated,
}: {
  ticker: string
  dataPeriod: string | null
  generated?: string
  onRegenerated: (next: { frontmatter: ResearchFrontmatter; body: string }) => void
}) {
  const t = useT()
  const [busy, setBusy] = useState(false)

  async function regenerate() {
    setBusy(true)
    try {
      // ?force=1 bypasses the shared cache → fresh generation (charges credits).
      const res = await fetch(`/api/idx-research/${ticker}/generate?force=1`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? `${t('research_tabs.generate_failed_prefix')} ${res.status}`)
        return
      }
      const body = String(json.content ?? '').replace(/^---\n[\s\S]*?\n---\n?/, '').trim()
      onRegenerated({ frontmatter: (json.frontmatter as ResearchFrontmatter) ?? {}, body })
      toast.success(t('research_tabs.regenerate_success'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
      style={{ background: 'var(--surface-2)', borderColor: 'var(--border-soft)' }}
    >
      <span className="text-[11px] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        {dataPeriod ? `${t('research_tabs.based_on')} ${dataPeriod}` : ''}
        {generated ? `${dataPeriod ? ' · ' : ''}${t('research_tabs.generated_on')} ${generated}` : ''}
      </span>
      <button
        type="button"
        onClick={regenerate}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors hover:bg-[var(--surface)] disabled:opacity-50"
        style={{ borderColor: 'var(--border)', color: 'var(--ink-muted)' }}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
        {t('research_tabs.regenerate_label')} · {RESEARCH_CREDIT_COST} {t('research_tabs.credit_cost_suffix')}
      </button>
    </div>
  )
}

function DisclaimerBox() {
  const t = useT()
  return (
    <div
      className="rounded-lg border p-3 text-[11px] flex items-start gap-2"
      style={{
        boxShadow: 'var(--card-shadow)', background: 'var(--surface-2)',
        borderColor: 'var(--border-soft)',
        color: 'var(--ink-muted)',
      }}
    >
      <AlertCircle className="size-3.5 shrink-0 mt-0.5" style={{ color: 'var(--amber-700)' }} />
      <span>
        {t('research_tabs.disclaimer')}
      </span>
    </div>
  )
}

function parseIDXDate(s: string | null): Date | null {
  if (!s) return null
  const m = /^(\d{1,2})\s+(\w{3})\s+(\d{2,4})$/.exec(s.trim())
  if (!m) return null
  const [, dStr, monStr, yStr] = m
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const monIdx = months.indexOf(monStr.toLowerCase())
  if (monIdx < 0) return null
  let year = parseInt(yStr, 10)
  if (year < 100) year += 2000
  const d = new Date(year, monIdx, parseInt(dStr, 10))
  return isNaN(d.getTime()) ? null : d
}
