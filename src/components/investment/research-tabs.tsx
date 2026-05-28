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
  Calendar, Sparkles, AlertCircle, Loader2, Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import {
  formatIDRCompact,
  formatPercentValue,
  formatPrice,
  formatRatio,
  signColorVar,
  verdictStyle,
} from '@/lib/invest/format'
import { FinancialStatements } from './financial-statements'

interface MetricSeries {
  year: number
  value: number
}

interface ValuationData {
  ticker: string
  name: string
  sector: string | null
  price: number
  methods: Record<string, number | null>
  avgFairValue: number | null
  medianFairValue: number | null
  methodsValid: number
  undervaluedCount: number
  avgMoS: number
  verdict: string | null
}

interface ValuationDetailMethod {
  fairValue: number | null
  mos: number | null
}

interface ValuationDetailData {
  ticker: string
  methods: Record<string, ValuationDetailMethod>
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
  fair_value_low?: number
  fair_value_high?: number
  current_price?: number
}

interface QuarterlyMetric {
  period: string // "2025-Q2"
  value: number
}

export interface ResearchTabsProps {
  ticker: string
  name: string
  sector: string | null
  price: number
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
  valuation: ValuationData | null
  valuationDetail: ValuationDetailData | null
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
  quarterlyRevenue: QuarterlyMetric[]
  quarterlyNetIncome: QuarterlyMetric[]
  quarterlyEPS: QuarterlyMetric[]
  research: {
    frontmatter: ResearchFrontmatter
    body: string
  } | null
}

const METHOD_LABELS: Record<string, string> = {
  DCF: 'DCF',
  Graham: 'Graham',
  EPV: 'EPV',
  RelPER: 'Rel PER',
  'Rel PER': 'Rel PER',
  RelPBV: 'Rel PBV',
  'Rel PBV': 'Rel PBV',
  DDM: 'DDM',
  NAV: 'NAV',
  EVEBIT: 'EV/EBIT',
  'EV/EBIT': 'EV/EBIT',
}

export function ResearchTabs(props: ResearchTabsProps) {
  const {
    ticker, name, sector, price, latestYear, metrics5Y,
    stockMetrics, quarterly,
    valuation, valuationDetail, stats, pricePerf, dividends,
    quarterlyRevenue, quarterlyNetIncome, quarterlyEPS, research: initialResearch,
  } = props

  // Research bisa di-generate ulang di client (lokal state). Initial value
  // dari server (bundled markdown OR cached AI generation).
  const [research, setResearch] = useState(initialResearch)

  const verdict = valuation?.verdict ?? null
  const verdictColor = verdictStyle(verdict)
  const avgMoS = valuation?.avgMoS ?? null

  // Latest annual values
  const latestRevenue = metrics5Y.revenue.at(-1)?.value ?? null
  const latestNetProfit = metrics5Y.netProfit.at(-1)?.value ?? null
  const latestRevYoY = metrics5Y.revenueYoY.at(-1)?.value ?? null
  const latestNPYoY = metrics5Y.netProfitYoY.at(-1)?.value ?? null
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
  const nextDividend = upcomingDividends[0] ?? null

  return (
    <Tabs defaultValue="research" className="w-full">
      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <TabsList className="inline-flex gap-1 w-auto">
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
            Valuasi
          </TabsTrigger>
          <TabsTrigger value="laporan">
            <FileText className="size-3.5 mr-1.5" />
            Laporan
          </TabsTrigger>
          <TabsTrigger value="charts">
            <TrendingUp className="size-3.5 mr-1.5" />
            Charts
          </TabsTrigger>
        </TabsList>
      </div>

      {/* ─── Research (markdown narrative + Generate button kalau kosong) ─── */}
      <TabsContent value="research" className="mt-4">
        {research ? (
          <ResearchView research={research} ticker={ticker} onRegenerated={setResearch} />
        ) : (
          <GenerateResearchEmpty
            ticker={ticker}
            name={name}
            sector={sector}
            onGenerated={setResearch}
          />
        )}
      </TabsContent>

      {/* ─── Overview ─── */}
      <TabsContent value="overview" className="mt-4 space-y-4">
        {/* Headline 4 stats */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <StatCard
            label={latestYear ? `Revenue FY${latestYear}` : 'Revenue'}
            value={formatIDRCompact(latestRevenue)}
            sub={`YoY ${formatPercentValue(latestRevYoY)}`}
            subColor={signColorVar(latestRevYoY)}
          />
          <StatCard
            label={latestYear ? `Net Profit FY${latestYear}` : 'Net Profit'}
            value={formatIDRCompact(latestNetProfit)}
            sub={`Margin ${formatPercentValue(latestNPM)}`}
            subColor={signColorVar(latestNPYoY)}
          />
          <StatCard
            label="PER / PBV"
            value={
              <span>
                {formatRatio(latestPER)}
                <span style={{ color: 'var(--ink-soft)' }}> / </span>
                {formatRatio(latestPBV)}
              </span>
            }
            sub={`ROE ${formatPercentValue(latestROE)} · DER ${formatRatio(latestDER)}`}
          />
          <StatCard
            label="Market Cap"
            value={formatIDRCompact(latestMarketCap ?? stats?.marketCap ?? null)}
            sub={
              stats?.freeFloatPct != null
                ? `Free Float ${(stats.freeFloatPct * 100).toFixed(2)}%`
                : oneYear
                  ? `52W ${formatPrice(oneYear.low)} – ${formatPrice(oneYear.high)}`
                  : ''
            }
          />
        </div>

        {/* 52W range + extras */}
        {(oneYear || stats || nextDividend) && (
          <div
            className="rounded-xl border p-4"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="grid gap-4 md:grid-cols-4">
              {oneYear && (
                <div>
                  <p className="caps">52-Week Range</p>
                  <p className="num font-semibold mt-1" style={{ color: 'var(--ink)' }}>
                    {formatPrice(oneYear.low)} – {formatPrice(oneYear.high)}
                  </p>
                  {price && oneYear.high && oneYear.low && (
                    <div className="mt-2 relative h-1 rounded-full" style={{ background: 'var(--surface-3)' }}>
                      <div
                        className="absolute inset-y-0 w-0.5"
                        style={{
                          left: `${((price - oneYear.low) / (oneYear.high - oneYear.low)) * 100}%`,
                          background: 'var(--emerald-500)',
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
              {stats?.freeFloatPct != null && (
                <div>
                  <p className="caps">Free Float</p>
                  <p className="num font-semibold mt-1" style={{ color: 'var(--ink)' }}>
                    {(stats.freeFloatPct * 100).toFixed(2)}%
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                    {formatIDRCompact((stats.currentShareOutstanding ?? 0) * stats.freeFloatPct)} shares
                  </p>
                </div>
              )}
              {stats?.currentShareOutstanding != null && (
                <div>
                  <p className="caps">Saham Beredar</p>
                  <p className="num font-semibold mt-1" style={{ color: 'var(--ink)' }}>
                    {formatIDRCompact(stats.currentShareOutstanding).replace('Rp ', '')}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                    EV {formatIDRCompact(stats.enterpriseValue)}
                  </p>
                </div>
              )}
              {nextDividend && (
                <div>
                  <p className="caps">Dividen Mendatang</p>
                  <p className="num font-semibold mt-1" style={{ color: 'var(--c-mint)' }}>
                    Rp {formatPrice(nextDividend.dividend)}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                    Ex-date {nextDividend.exDate}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Price performance grid */}
        {pricePerf && (
          <div
            className="rounded-xl border p-4"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <p className="caps mb-3">Performance Saham</p>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              {(['1M', '3M', '6M', '1Y', '3Y', '5Y'] as const).map((p) => {
                const period = pricePerf[p]
                if (!period) return null
                const pct = period.percentage
                return (
                  <div key={p}>
                    <p className="text-[10px] uppercase font-semibold tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                      {p}
                    </p>
                    <p
                      className="num font-bold text-base mt-1"
                      style={{ color: signColorVar(pct) }}
                    >
                      {pct != null ? `${pct >= 0 ? '+' : ''}${(pct * 100).toFixed(1)}%` : '—'}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </TabsContent>

      {/* ─── Valuasi (consensus 8 methods) ─── */}
      <TabsContent value="valuasi" className="mt-4 space-y-4">
        {/* Recommendation card (from research frontmatter if available) */}
        {research?.frontmatter.recommendation && (
          <div
            className="rounded-2xl border p-5"
            style={{
              background: 'linear-gradient(135deg, var(--c-mint-soft), var(--surface) 60%)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <p className="caps">Rekomendasi (Equity Research)</p>
                <p className="text-2xl font-bold tracking-tight mt-1" style={{ color: 'var(--ink)' }}>
                  {String(research.frontmatter.recommendation).toUpperCase()}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
                  Conviction: <span className="font-semibold">{research.frontmatter.conviction ?? '—'}</span>
                  {research.frontmatter.generated && (
                    <span> · Generated {research.frontmatter.generated}</span>
                  )}
                </p>
              </div>
              {(research.frontmatter.fair_value_low || research.frontmatter.fair_value_high) && (
                <div className="text-right">
                  <p className="caps">Fair Value Range</p>
                  <p className="num text-xl font-bold mt-1" style={{ color: 'var(--ink)' }}>
                    Rp {formatPrice(research.frontmatter.fair_value_low ?? null)}
                    {' – '}
                    Rp {formatPrice(research.frontmatter.fair_value_high ?? null)}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
                    vs current Rp {formatPrice(research.frontmatter.current_price ?? price)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Consensus summary */}
        {valuation && (
          <div
            className="rounded-2xl border p-5"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-baseline justify-between flex-wrap gap-2 mb-4">
              <div>
                <p className="caps">Valuasi Consensus</p>
                <h2 className="text-lg font-bold mt-0.5" style={{ color: 'var(--ink)' }}>
                  8 Metode Independen
                </h2>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {verdict && (
                  <span
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: verdictColor.bg, color: verdictColor.fg }}
                  >
                    {verdict}
                  </span>
                )}
                <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                  {valuation.methodsValid}/8 valid · {valuation.undervaluedCount} bilang undervalued
                </span>
              </div>
            </div>

            {/* Method-by-method grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {valuationDetail
                ? Object.entries(valuationDetail.methods).map(([method, m]) => (
                    <MethodCard
                      key={method}
                      label={METHOD_LABELS[method] ?? method}
                      fairValue={m.fairValue}
                      mos={m.mos}
                    />
                  ))
                : Object.entries(valuation.methods).map(([method, fv]) => {
                    if (fv == null) return null
                    const mos = (fv - price) / price
                    return (
                      <MethodCard
                        key={method}
                        label={METHOD_LABELS[method] ?? method}
                        fairValue={fv}
                        mos={mos}
                      />
                    )
                  })}
            </div>

            {/* Consensus row */}
            <div
              className="mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-3 gap-3"
              style={{ borderColor: 'var(--border-soft)' }}
            >
              <div>
                <p className="caps">Median Fair Value</p>
                <p className="num text-xl font-bold mt-1" style={{ color: 'var(--ink)' }}>
                  {formatIDRCompact(valuation.medianFairValue)}
                </p>
              </div>
              <div>
                <p className="caps">Average Fair Value</p>
                <p className="num text-xl font-bold mt-1" style={{ color: 'var(--ink)' }}>
                  {formatIDRCompact(valuation.avgFairValue)}
                </p>
              </div>
              <div>
                <p className="caps">Avg Margin of Safety</p>
                <p className="num text-xl font-bold mt-1" style={{ color: signColorVar(avgMoS) }}>
                  {formatPercentValue(avgMoS)}
                </p>
              </div>
            </div>
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
                    Dividen Mendatang
                  </p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Periode</TableHead>
                      <TableHead>Ex-Date</TableHead>
                      <TableHead>Pay Date</TableHead>
                      <TableHead className="text-right">Per Lembar</TableHead>
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
                Riwayat Dividen
              </p>
              <span className="ml-auto text-xs" style={{ color: 'var(--ink-muted)' }}>
                {pastDividends.length} pembayaran
              </span>
            </div>
            <div className="overflow-x-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Periode</TableHead>
                    <TableHead>Ex-Date</TableHead>
                    <TableHead>Pay Date</TableHead>
                    <TableHead className="text-right">Per Lembar</TableHead>
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

      {/* ─── Charts (trends) ─── */}
      <TabsContent value="charts" className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ChartCard
            title="Revenue (5Y Annual)"
            data={metrics5Y.revenue}
            color="var(--emerald-500)"
            format="idr-compact"
          />
          <ChartCard
            title="Net Profit (5Y Annual)"
            data={metrics5Y.netProfit}
            color="var(--sky-500)"
            format="idr-compact"
          />
          <ChartCard
            title="EPS (5Y Annual)"
            data={metrics5Y.eps}
            color="var(--amber-500)"
            format="price"
          />
          <ChartCard
            title="ROE (5Y Annual)"
            data={metrics5Y.roe}
            color="var(--c-mint)"
            format="percent"
          />
          <ChartCard
            title="PER (5Y Annual)"
            data={metrics5Y.perRatio}
            color="var(--coral-500)"
            format="ratio"
          />
          <ChartCard
            title="PBV (5Y Annual)"
            data={metrics5Y.pbv}
            color="#8B5CF6"
            format="ratio"
          />
        </div>

        {/* Quarterly bars */}
        {(quarterlyRevenue.length > 0 || quarterlyNetIncome.length > 0) && (
          <div className="grid gap-3 lg:grid-cols-3">
            <QuarterlyCard title="Revenue Quarterly" data={quarterlyRevenue} format="idr-compact" />
            <QuarterlyCard title="Net Income Quarterly" data={quarterlyNetIncome} format="idr-compact" />
            <QuarterlyCard title="EPS Quarterly" data={quarterlyEPS} format="price" />
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}

// ─── Subcomponents ────────────────────────────────────────────────

function StatCard({
  label, value, sub, subColor,
}: {
  label: string
  value: React.ReactNode
  sub?: string
  subColor?: string
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)' }}
    >
      <p className="text-[10px] uppercase font-semibold tracking-wide" style={{ color: 'var(--ink-soft)' }}>
        {label}
      </p>
      <p className="num font-bold text-lg mt-1" style={{ color: 'var(--ink)' }}>
        {value}
      </p>
      {sub && (
        <p className="text-[11px] mt-0.5" style={{ color: subColor ?? 'var(--ink-muted)' }}>
          {sub}
        </p>
      )}
    </div>
  )
}

function MethodCard({
  label, fairValue, mos,
}: {
  label: string
  fairValue: number | null
  mos: number | null
}) {
  if (fairValue == null) {
    return (
      <div
        className="rounded-xl border p-3"
        style={{ background: 'var(--paper)', borderColor: 'var(--border-soft)', opacity: 0.6 }}
      >
        <p className="text-[10px] uppercase font-semibold" style={{ color: 'var(--ink-soft)' }}>
          {label}
        </p>
        <p className="num text-base font-bold mt-1" style={{ color: 'var(--ink-soft)' }}>—</p>
      </div>
    )
  }
  return (
    <div
      className="rounded-xl border p-3"
      style={{ background: 'var(--paper)', borderColor: 'var(--border-soft)' }}
    >
      <p className="text-[10px] uppercase font-semibold" style={{ color: 'var(--ink-soft)' }}>
        {label}
      </p>
      <p className="num text-lg font-bold mt-1" style={{ color: 'var(--ink)' }}>
        Rp {formatPrice(fairValue)}
      </p>
      <p className="text-xs num font-semibold mt-0.5" style={{ color: signColorVar(mos) }}>
        {mos != null ? `${mos >= 0 ? '+' : ''}${(mos * 100).toFixed(0)}% MoS` : ''}
      </p>
    </div>
  )
}

function ChartCard({
  title, data, color, format,
}: {
  title: string
  data: MetricSeries[]
  color: string
  format: 'idr-compact' | 'percent' | 'price' | 'ratio'
}) {
  if (data.length === 0) {
    return (
      <div
        className="rounded-xl border p-4"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <p className="caps">{title}</p>
        <p className="text-sm py-8 text-center" style={{ color: 'var(--ink-soft)' }}>
          Data tidak tersedia
        </p>
      </div>
    )
  }
  const fmtVal = (v: number): string => {
    if (format === 'idr-compact') return formatIDRCompact(v)
    if (format === 'percent') return formatPercentValue(v)
    if (format === 'ratio') return formatRatio(v)
    return formatPrice(v)
  }
  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <p className="caps mb-2">{title}</p>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" />
          <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'var(--ink-muted)' }} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--ink-muted)' }} tickFormatter={(v) => fmtVal(v)} width={70} />
          <Tooltip
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v) => fmtVal(Number(v))}
          />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function QuarterlyCard({
  title, data, format,
}: {
  title: string
  data: QuarterlyMetric[]
  format: 'idr-compact' | 'price'
}) {
  if (data.length === 0) {
    return (
      <div
        className="rounded-xl border p-4"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <p className="caps">{title}</p>
        <p className="text-sm py-8 text-center" style={{ color: 'var(--ink-soft)' }}>
          Data quarterly tidak tersedia
        </p>
      </div>
    )
  }
  const fmtVal = (v: number): string =>
    format === 'idr-compact' ? formatIDRCompact(v) : formatPrice(v)
  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <p className="caps mb-2">{title}</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" />
          <XAxis dataKey="period" tick={{ fontSize: 9, fill: 'var(--ink-muted)' }} angle={-30} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--ink-muted)' }} tickFormatter={(v) => fmtVal(v)} width={70} />
          <Tooltip
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v) => fmtVal(Number(v))}
          />
          <Bar dataKey="value" fill="var(--emerald-500)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ResearchView({
  research,
  ticker,
  onRegenerated,
}: {
  research: { frontmatter: ResearchFrontmatter; body: string }
  ticker: string
  onRegenerated: (next: { frontmatter: ResearchFrontmatter; body: string }) => void
}) {
  const recommendation = research.frontmatter.recommendation
  const conviction = research.frontmatter.conviction

  return (
    <div className="space-y-4">
      {/* Recommendation header */}
      {recommendation && (
        <div
          className="rounded-xl border p-4 flex items-start justify-between flex-wrap gap-3"
          style={{
            background: 'linear-gradient(135deg, var(--c-mint-soft), var(--surface) 60%)',
            borderColor: 'var(--border)',
          }}
        >
          <div>
            <p className="caps">Equity Research · {ticker}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
                {String(recommendation).toUpperCase()}
              </span>
              {conviction && (
                <Badge className="bg-[var(--c-mint-soft)] text-[var(--c-mint)]">
                  Conviction: {conviction}
                </Badge>
              )}
            </div>
            {research.frontmatter.generated && (
              <p className="text-[11px] mt-1" style={{ color: 'var(--ink-muted)' }}>
                Generated {research.frontmatter.generated}
              </p>
            )}
          </div>
          {(research.frontmatter.fair_value_low || research.frontmatter.fair_value_high) && (
            <div className="text-right">
              <p className="caps">Fair Value Range</p>
              <p className="num text-lg font-bold mt-1" style={{ color: 'var(--ink)' }}>
                Rp {formatPrice(research.frontmatter.fair_value_low ?? null)}
                {' – '}
                Rp {formatPrice(research.frontmatter.fair_value_high ?? null)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Markdown body */}
      <article
        className="rounded-2xl border p-5 sm:p-6"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="prose-research max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{research.body}</ReactMarkdown>
        </div>
      </article>

      <RegenerateBar ticker={ticker} onRegenerated={onRegenerated} />

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
          border-left: 3px solid var(--emerald-500);
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
  const [generating, setGenerating] = useState(false)

  async function generate() {
    setGenerating(true)
    try {
      const res = await fetch(`/api/idx-research/${ticker}/generate`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? `Gagal generate: ${res.status}`)
        return
      }
      // Strip frontmatter dari body (sudah disimpan terpisah)
      const body = String(json.content ?? '').replace(/^---\n[\s\S]*?\n---\n?/, '').trim()
      onGenerated({
        frontmatter: (json.frontmatter as ResearchFrontmatter) ?? {},
        body,
      })
      toast.success('Research selesai di-generate.', {
        description: json.cached ? 'Diambil dari cache (gratis).' : 'Tersimpan ke cache, user lain bisa baca tanpa bayar credits.',
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
          background: 'linear-gradient(135deg, var(--c-mint-soft), var(--surface) 60%)',
          borderColor: 'var(--border)',
        }}
      >
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{
            background: 'var(--c-ink)',
            color: '#FFFFFF',
          }}
        >
          <Sparkles className="size-6" />
        </div>
        <h3 className="mt-4 text-lg font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
          Belum ada research untuk {ticker}
        </h3>
        <p className="mt-2 text-sm max-w-md mx-auto" style={{ color: 'var(--ink-muted)' }}>
          Generate research AI berdasarkan data laporan keuangan {name}
          {sector ? ` (sektor ${sector})` : ''}. AI bakal kasih ringkasan
          eksekutif, bull/bear case, katalis, dan risiko material.
        </p>

        <div
          className="mt-5 mx-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: 'var(--amber-100)', color: 'var(--amber-700)' }}
        >
          <Zap className="size-3.5" />
          {RESEARCH_CREDIT_COST} kredit AI · ~30 detik
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
              AI lagi nyusun research...
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Generate research
            </>
          )}
        </Button>

        <p className="mt-4 text-[11px] max-w-md mx-auto" style={{ color: 'var(--ink-soft)' }}>
          Hasil generate disimpan di cache shared — user lain yang buka {ticker} bakal lihat
          hasil yang sama tanpa bayar credit lagi (sampai kamu regenerate dengan data baru).
        </p>
      </div>

      <DisclaimerBox />
    </div>
  )
}

function RegenerateBar({
  ticker,
  onRegenerated,
}: {
  ticker: string
  onRegenerated: (next: { frontmatter: ResearchFrontmatter; body: string }) => void
}) {
  // Note: regenerate behavior bypasses cache (server logic akan dipindah)
  // For now, this just hints to user — actual regenerate butuh delete cache + call API
  // Disable for now untuk simplicity; tinggal kirim pesan kalau mau update content
  return null
}

function DisclaimerBox() {
  return (
    <div
      className="rounded-lg border p-3 text-[11px] flex items-start gap-2"
      style={{
        background: 'var(--surface-2)',
        borderColor: 'var(--border-soft)',
        color: 'var(--ink-muted)',
      }}
    >
      <AlertCircle className="size-3.5 shrink-0 mt-0.5" style={{ color: 'var(--amber-700)' }} />
      <span>
        Data snapshot dari kelolainvestasi (update kuartalan). Bukan rekomendasi
        investasi — selalu lakukan due diligence sendiri sebelum keputusan finansial.
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
