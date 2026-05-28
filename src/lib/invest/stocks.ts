import 'server-only'
import fs from 'node:fs'
import path from 'node:path'
import valuationsRaw from '@/data/invest/valuations.json'
import valuationDetailsRaw from '@/data/invest/valuation-details.json'
import dividendEventsRaw from '@/data/invest/dividend-events.json'
import emittenStatsRaw from '@/data/invest/emitten-stats.json'
import stocksRaw from '@/data/invest/stocks.json'
import quarterlyFinancialsRaw from '@/data/invest/quarterly-financials.json'
import pricePerformanceRaw from '@/data/invest/price-performance.json'

/**
 * Server-only data loaders untuk IDX stocks.
 * Source: kelolainvestasi/invest. Snapshot quarterly, gak real-time.
 *
 * NOTE: harga di file ini snapshot — gunakan /api/quotes untuk harga live.
 */

export interface Valuation {
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

export interface ValuationMethodDetail {
  fairValue: number | null
  mos: number | null
}

export interface ValuationDetail {
  ticker: string
  name: string
  sector: string | null
  price: number | null
  methods: Record<string, ValuationMethodDetail>
}

export interface DividendEvent {
  ticker: string
  period: string
  dividend: number
  exDate: string | null
  payDate: string | null
  recordingDate: string | null
  type: string | null
}

export interface EmittenStat {
  freeFloatPct: number | null
  marketCap: number | null
  enterpriseValue: number | null
  currentShareOutstanding: number | null
  freeFloatStr: string | null
  marketCapStr: string | null
}

const VALUATIONS = valuationsRaw as Valuation[]
const VALUATION_DETAILS = valuationDetailsRaw as unknown as ValuationDetail[]
const DIVIDEND_EVENTS = dividendEventsRaw as DividendEvent[]
const STATS = emittenStatsRaw as Record<string, EmittenStat>

// ─── Full stock metrics (5Y historical) ─────────────────────────

export interface Stock {
  ticker: string
  name: string | null
  type: string | null
  listingDate: string | null
  board: string | null
  sector: string | null
  currentPrice: number | null
  /** Metrics map: metric name → { year → value }. Years are string ("2024", "2025"). */
  metrics: Record<string, Record<string, number>>
}

// Cast via unknown first — stocksRaw is JSON with optional year keys
// that TS infers as undefined-prone; runtime data is always number.
const STOCKS = stocksRaw as unknown as Stock[]

export function getStock(ticker: string): Stock | undefined {
  const t = ticker.toUpperCase()
  return STOCKS.find((s) => s.ticker === t)
}

/** Return the most recent year with non-zero value from a metric series. */
export function latestMetricYear(
  series: Record<string, number> | undefined,
  skipZero = true,
): { year: number; value: number } | null {
  if (!series) return null
  const entries = Object.entries(series)
    .map(([y, v]) => [parseInt(y, 10), v] as const)
    .filter(([, v]) => v != null && (!skipZero || v !== 0))
    .sort((a, b) => b[0] - a[0])
  if (entries.length === 0) return null
  const [year, value] = entries[0]
  return { year, value }
}

/** Get last N years of a metric, oldest-to-newest. */
export function getMetricSeries(
  stock: Stock,
  metric: string,
  years = 5,
): Array<{ year: number; value: number }> {
  const series = stock.metrics[metric]
  if (!series) return []
  return Object.entries(series)
    .map(([y, v]) => ({ year: parseInt(y, 10), value: v }))
    .filter((e) => Number.isFinite(e.value))
    .sort((a, b) => a.year - b.year)
    .slice(-years)
}

// ─── Quarterly financials ──────────────────────────────────────

export type QuarterlyFinancials = Record<string, Record<string, number>>
// Outer key: metric name (Revenue, Net Income, EPS)
// Inner key: "2025-Q2", "2024-Q4", etc.
// Value: numeric value (cumulative within year)

const QUARTERLY = quarterlyFinancialsRaw as Record<string, QuarterlyFinancials>

export function getQuarterlyFinancialsFor(ticker: string): QuarterlyFinancials {
  return QUARTERLY[ticker.toUpperCase()] ?? {}
}

// ─── Price performance ────────────────────────────────────────

export interface PricePerformancePeriod {
  high: number | null
  low: number | null
  percentage: number | null  // change % over period
}

export interface PricePerformance {
  '1M'?: PricePerformancePeriod
  '3M'?: PricePerformancePeriod
  '6M'?: PricePerformancePeriod
  '1Y'?: PricePerformancePeriod
  '3Y'?: PricePerformancePeriod
  '5Y'?: PricePerformancePeriod
}

const PRICE_PERF = pricePerformanceRaw as Record<string, PricePerformance>

export function getPricePerformanceFor(ticker: string): PricePerformance | undefined {
  return PRICE_PERF[ticker.toUpperCase()]
}

// ─── Research markdown ────────────────────────────────────────

export interface ResearchDoc {
  ticker: string
  frontmatter: Record<string, string | number>
  body: string
  generated?: string
}

export function getResearchMarkdown(ticker: string): ResearchDoc | null {
  const filepath = path.join(process.cwd(), 'src', 'data', 'invest', 'research', `${ticker.toUpperCase()}.md`)
  if (!fs.existsSync(filepath)) return null

  const raw = fs.readFileSync(filepath, 'utf-8')
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)

  if (!fmMatch) {
    return { ticker: ticker.toUpperCase(), frontmatter: {}, body: raw }
  }

  const frontmatter: Record<string, string | number> = {}
  for (const line of fmMatch[1].split('\n')) {
    const m = line.match(/^([a-z_]+):\s*(.+)$/)
    if (!m) continue
    const value = m[2].trim()
    frontmatter[m[1]] = /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value
  }

  return {
    ticker: ticker.toUpperCase(),
    frontmatter,
    body: fmMatch[2].trim(),
    generated: frontmatter.generated as string | undefined,
  }
}

export function getValuations(): Valuation[] {
  return VALUATIONS
}

export function getValuation(ticker: string): Valuation | undefined {
  const t = ticker.toUpperCase()
  return VALUATIONS.find((v) => v.ticker === t)
}

export function getValuationDetail(ticker: string): ValuationDetail | undefined {
  const t = ticker.toUpperCase()
  return VALUATION_DETAILS.find((v) => v.ticker === t)
}

export function getEmittenStat(ticker: string): EmittenStat | undefined {
  return STATS[ticker.toUpperCase()]
}

/** All dividend events. ~3000+ rows. */
export function getDividendEvents(): DividendEvent[] {
  return DIVIDEND_EVENTS
}

/** Dividend events for a specific ticker, sorted by exDate desc. */
export function getDividendsForTicker(ticker: string): DividendEvent[] {
  const t = ticker.toUpperCase()
  return DIVIDEND_EVENTS.filter((d) => d.ticker === t).sort((a, b) => {
    if (!a.exDate || !b.exDate) return 0
    return b.exDate.localeCompare(a.exDate)
  })
}

/** Dividend events with ex-date in the future (upcoming). Sorted ascending. */
export function getUpcomingDividends(): DividendEvent[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const out: Array<DividendEvent & { _exDate: Date }> = []
  for (const ev of DIVIDEND_EVENTS) {
    if (!ev.exDate) continue
    const d = parseShortDate(ev.exDate)
    if (!d) continue
    if (d.getTime() >= today.getTime()) {
      out.push({ ...ev, _exDate: d })
    }
  }
  out.sort((a, b) => a._exDate.getTime() - b._exDate.getTime())
  return out.map(({ _exDate: _x, ...rest }) => rest as DividendEvent)
}

function parseShortDate(s: string): Date | null {
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
