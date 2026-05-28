import 'server-only'
import valuationsRaw from '@/data/invest/valuations.json'
import valuationDetailsRaw from '@/data/invest/valuation-details.json'
import dividendEventsRaw from '@/data/invest/dividend-events.json'
import emittenStatsRaw from '@/data/invest/emitten-stats.json'

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
