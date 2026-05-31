import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Range → Yahoo chart query mapping. Yahoo has no native "3y" range, so that
// one is built from period1/period2 (unix seconds) instead of range=.
type RangeKey = '1D' | '1W' | '1M' | '3M' | 'YTD' | '1Y' | '3Y' | '5Y'

const RANGE_QUERY: Record<Exclude<RangeKey, '3Y'>, string> = {
  '1D': 'range=1d&interval=5m',
  '1W': 'range=5d&interval=30m',
  '1M': 'range=1mo&interval=1d',
  '3M': 'range=3mo&interval=1d',
  YTD: 'range=ytd&interval=1d',
  '1Y': 'range=1y&interval=1d',
  '5Y': 'range=5y&interval=1wk',
}

function buildQuery(range: RangeKey): string {
  if (range === '3Y') {
    const now = Math.floor(Date.now() / 1000)
    const period1 = now - 3 * 365 * 86400
    return `period1=${period1}&period2=${now}&interval=1wk`
  }
  return RANGE_QUERY[range]
}

function normalizeRange(raw: string | null): RangeKey {
  const u = (raw ?? '1D').toUpperCase()
  const valid: RangeKey[] = ['1D', '1W', '1M', '3M', 'YTD', '1Y', '3Y', '5Y']
  return (valid.includes(u as RangeKey) ? u : '1D') as RangeKey
}

interface ChartPoint {
  t: number
  c: number
}

interface ChartMeta {
  currency: string | null
  previousClose: number | null
  regularMarketPrice: number | null
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[]
      indicators?: { quote?: Array<{ close?: Array<number | null> }> }
      meta?: {
        currency?: string
        regularMarketPrice?: number
        chartPreviousClose?: number
        previousClose?: number
      }
    }>
  }
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
  const ticker = (searchParams.get('ticker') ?? '').trim()
  const range = normalizeRange(searchParams.get('range'))

  // Graceful empty response — never throw to the client. Returns 200 so the
  // component can render its "data belum tersedia" state without a fetch error.
  const empty = NextResponse.json({ points: [], meta: null, range })

  if (!ticker) return empty

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker,
    )}?${buildQuery(range)}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
    })
    if (!res.ok) return empty

    const json = (await res.json()) as YahooChartResponse
    const result = json.chart?.result?.[0]
    if (!result) return empty

    const timestamps = result.timestamp ?? []
    const closes = result.indicators?.quote?.[0]?.close ?? []

    const points: ChartPoint[] = []
    for (let i = 0; i < timestamps.length; i++) {
      const c = closes[i]
      const t = timestamps[i]
      if (c == null || t == null) continue
      points.push({ t, c })
    }

    const m = result.meta
    const meta: ChartMeta = {
      currency: m?.currency ?? null,
      previousClose: m?.chartPreviousClose ?? m?.previousClose ?? null,
      regularMarketPrice: m?.regularMarketPrice ?? null,
    }

    return NextResponse.json({ points, meta, range })
  } catch {
    return empty
  }
}
