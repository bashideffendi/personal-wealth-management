import { NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'
import { createClient } from '@/lib/supabase/server'

// yahoo-finance2 v3 requires class instantiation (removed default instance)
const yahooFinance = new YahooFinance()

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Cache freshness: re-fetch from Yahoo if the newest cached bar is
// older than this many hours (weekly data updates at EOW, so 12h is plenty).
const CACHE_MAX_AGE_HOURS = 12

interface HistoryBar {
  date: string // ISO date (yyyy-mm-dd)
  close: number
}

interface TickerHistory {
  ticker: string
  bars: HistoryBar[]
}

function normalizeTicker(raw: string): string {
  return raw.trim().toUpperCase()
}

function toISODate(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d
  return x.toISOString().slice(0, 10)
}

interface YahooChartQuote {
  date?: Date | string
  close?: number | null
  adjclose?: number | null
}

interface YahooChartResult {
  quotes?: YahooChartQuote[]
}

async function fetchLiveHistory(
  ticker: string,
  weeks: number
): Promise<HistoryBar[]> {
  const now = new Date()
  const period1 = new Date(now)
  period1.setDate(period1.getDate() - (weeks + 4) * 7)

  // validateResult: false — yahoo-finance2's schema occasionally rejects
  // valid responses for index tickers (e.g. ^JKSE). We handle shape defensively.
  const raw = (await yahooFinance.chart(
    ticker,
    {
      period1,
      period2: now,
      interval: '1wk',
    },
    { validateResult: false }
  )) as YahooChartResult

  const quotes = raw?.quotes ?? []
  const bars: HistoryBar[] = []
  for (const q of quotes) {
    const close = q.adjclose ?? q.close
    if (q.date && typeof close === 'number' && Number.isFinite(close)) {
      bars.push({ date: toISODate(q.date), close: Number(close) })
    }
  }
  // Dedup + sort ascending
  const byDate = new Map<string, HistoryBar>()
  for (const b of bars) byDate.set(b.date, b)
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('tickers')
  const weeksParam = Number(searchParams.get('weeks') ?? '65')
  const weeks = Math.max(20, Math.min(260, Number.isFinite(weeksParam) ? weeksParam : 65))

  if (!raw) {
    return NextResponse.json({ series: [] })
  }

  const tickers = Array.from(
    new Set(raw.split(',').map(normalizeTicker).filter(Boolean))
  )
  if (tickers.length === 0) {
    return NextResponse.json({ series: [] })
  }

  // Read cache for all tickers in one shot
  interface HistoryRow {
    ticker: string
    date: string
    close: number | string
    fetched_at: string
  }

  const { data: cached } = await supabase
    .from('price_history')
    .select('ticker, date, close, fetched_at')
    .eq('interval', '1wk')
    .in('ticker', tickers)
    .order('date', { ascending: true })

  const cachedRows = (cached ?? []) as HistoryRow[]
  const byTicker = new Map<string, HistoryRow[]>()
  for (const r of cachedRows) {
    if (!byTicker.has(r.ticker)) byTicker.set(r.ticker, [])
    byTicker.get(r.ticker)!.push(r)
  }

  const nowMs = Date.now()
  const cacheMaxAgeMs = CACHE_MAX_AGE_HOURS * 3600 * 1000
  const results: TickerHistory[] = []
  const toFetch: string[] = []

  for (const ticker of tickers) {
    const rows = byTicker.get(ticker)
    const newest = rows && rows.length > 0 ? rows[rows.length - 1] : null
    const isFresh = newest && nowMs - new Date(newest.fetched_at).getTime() < cacheMaxAgeMs
    const hasEnough = rows && rows.length >= Math.min(weeks, 40)
    if (isFresh && hasEnough) {
      results.push({
        ticker,
        bars: rows!.map((r) => ({
          date: r.date,
          close: Number(r.close),
        })),
      })
    } else {
      toFetch.push(ticker)
    }
  }

  const failures: Array<{ ticker: string; reason: string }> = []

  if (toFetch.length > 0) {
    const settled = await Promise.allSettled(
      toFetch.map(async (t) => ({ ticker: t, bars: await fetchLiveHistory(t, weeks) }))
    )
    const toUpsert: Array<{
      ticker: string
      date: string
      close: number
      interval: string
      source: string
      fetched_at: string
    }> = []
    const nowIso = new Date().toISOString()

    for (let i = 0; i < settled.length; i++) {
      const r = settled[i]
      const ticker = toFetch[i]
      if (r.status === 'fulfilled') {
        if (r.value.bars.length === 0) {
          failures.push({ ticker, reason: 'empty response from Yahoo' })
          console.warn(`[history] ${ticker}: Yahoo returned 0 bars`)
          continue
        }
        results.push(r.value)
        for (const b of r.value.bars) {
          toUpsert.push({
            ticker: r.value.ticker,
            date: b.date,
            close: b.close,
            interval: '1wk',
            source: 'yahoo-finance',
            fetched_at: nowIso,
          })
        }
      } else {
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason)
        failures.push({ ticker, reason: msg })
        console.error(`[history] ${ticker} failed:`, msg)
      }
    }

    if (toUpsert.length > 0) {
      // Upsert in chunks to stay under payload limits
      const CHUNK = 500
      for (let i = 0; i < toUpsert.length; i += CHUNK) {
        await supabase
          .from('price_history')
          .upsert(toUpsert.slice(i, i + CHUNK), {
            onConflict: 'ticker,interval,date',
          })
      }
    }
  }

  // Keep output order stable = request order
  const orderMap = new Map(tickers.map((t, i) => [t, i]))
  results.sort(
    (a, b) => (orderMap.get(a.ticker) ?? 0) - (orderMap.get(b.ticker) ?? 0)
  )

  return NextResponse.json({ series: results, weeks, failures })
}
