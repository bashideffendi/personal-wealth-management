import { NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'
import { createClient } from '@/lib/supabase/server'

// yahoo-finance2 v3 requires class instantiation (removed default instance)
const yahooFinance = new YahooFinance()

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface QuoteResult {
  ticker: string
  price: number
  currency: string
  changePct: number | null
  marketState: string | null
  name?: string
  fetchedAt: string
  source: 'cache' | 'yahoo'
}

function normalizeTicker(raw: string): string {
  return raw.trim().toUpperCase()
}

interface YahooQuoteShape {
  regularMarketPrice?: number
  postMarketPrice?: number
  preMarketPrice?: number
  regularMarketChangePercent?: number
  currency?: string
  marketState?: string
  longName?: string
  shortName?: string
}

async function fetchLive(ticker: string): Promise<QuoteResult> {
  const raw = (await yahooFinance.quote(ticker)) as YahooQuoteShape
  const price =
    raw.regularMarketPrice ??
    raw.postMarketPrice ??
    raw.preMarketPrice ??
    0

  return {
    ticker,
    price: Number(price) || 0,
    currency: raw.currency ?? 'USD',
    changePct:
      typeof raw.regularMarketChangePercent === 'number'
        ? Number(raw.regularMarketChangePercent.toFixed(4))
        : null,
    marketState: raw.marketState ?? null,
    name: raw.longName ?? raw.shortName,
    fetchedAt: new Date().toISOString(),
    source: 'yahoo',
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
  const raw = searchParams.get('tickers')
  if (!raw) {
    return NextResponse.json({ quotes: [] })
  }

  const tickers = Array.from(
    new Set(raw.split(',').map(normalizeTicker).filter(Boolean))
  )
  if (tickers.length === 0) {
    return NextResponse.json({ quotes: [] })
  }

  const now = Date.now()
  interface SnapshotRow {
    ticker: string
    price: number | string
    currency: string
    change_pct: number | string | null
    market_state: string | null
    fetched_at: string
  }

  const { data: cached } = await supabase
    .from('price_snapshots')
    .select('*')
    .in('ticker', tickers)

  const cachedRows = (cached ?? []) as SnapshotRow[]
  const cachedMap = new Map<string, SnapshotRow>(
    cachedRows.map((row) => [row.ticker, row])
  )

  const results: QuoteResult[] = []
  const toRefresh: string[] = []

  for (const ticker of tickers) {
    const row = cachedMap.get(ticker)
    const fresh = row && now - new Date(row.fetched_at).getTime() < CACHE_TTL_MS
    if (fresh && row) {
      results.push({
        ticker,
        price: Number(row.price),
        currency: row.currency,
        changePct: row.change_pct !== null ? Number(row.change_pct) : null,
        marketState: row.market_state,
        fetchedAt: row.fetched_at,
        source: 'cache',
      })
    } else {
      toRefresh.push(ticker)
    }
  }

  if (toRefresh.length > 0) {
    const settled = await Promise.allSettled(toRefresh.map(fetchLive))
    const successes: QuoteResult[] = []
    for (const r of settled) {
      if (r.status === 'fulfilled') {
        successes.push(r.value)
        results.push(r.value)
      }
    }
    if (successes.length > 0) {
      await supabase.from('price_snapshots').upsert(
        successes.map((q) => ({
          ticker: q.ticker,
          price: q.price,
          currency: q.currency,
          change_pct: q.changePct,
          market_state: q.marketState,
          fetched_at: q.fetchedAt,
          source: 'yahoo-finance',
        })),
        { onConflict: 'ticker' }
      )
    }
  }

  return NextResponse.json({ quotes: results })
}
