import { NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withResilience } from '@/lib/retry'

// yahoo-finance2 v3 requires class instantiation (removed default instance)
const yahooFinance = new YahooFinance()

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const QUOTE_TIMEOUT_MS = 5000 // cap a slow/hanging Yahoo call so it can't eat the function budget

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

const MAX_TICKERS = 100
// Format Yahoo: BBCA.JK, BTC-USD, USDIDR=X, GC=F, ^JKSE.
const TICKER_RE = /^[A-Z0-9.\-=^]{1,20}$/

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
  const raw = (await Promise.race([
    // retry+breaker (reliability-9); QUOTE_TIMEOUT_MS tetap jadi cap luar total.
    withResilience('yahoo', () => yahooFinance.quote(ticker), { retries: 1 }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('yahoo-timeout')), QUOTE_TIMEOUT_MS),
    ),
  ])) as YahooQuoteShape
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

  // Batasi jumlah & format ticker: tiap ticker baru = 1 fetch Yahoo + 1 baris
  // cache SHARED (ditulis service-role). Tanpa batas, satu request bisa fan-out
  // ribuan panggilan upstream / mengisi price_snapshots dengan sampah.
  const tickers = Array.from(
    new Set(raw.split(',').map(normalizeTicker).filter((t) => TICKER_RE.test(t)))
  ).slice(0, MAX_TICKERS)
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
    settled.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        successes.push(r.value)
        results.push(r.value)
      } else {
        // Refresh failed (timeout / upstream) — serve the stale cached price
        // if we have one rather than dropping the ticker entirely.
        const stale = cachedMap.get(toRefresh[idx])
        if (stale) {
          results.push({
            ticker: stale.ticker,
            price: Number(stale.price),
            currency: stale.currency,
            changePct: stale.change_pct !== null ? Number(stale.change_pct) : null,
            marketState: stale.market_state,
            fetchedAt: stale.fetched_at,
            source: 'cache',
          })
        }
      }
    })
    // Harga 0 (Yahoo gak kasih harga) jangan masuk cache SHARED — kalau masuk,
    // semua user dapat valuasi Rp 0 selama TTL.
    const cacheable = successes.filter((q) => q.price > 0)
    if (cacheable.length > 0) {
      // Cache harga SHARED → tulis via service-role (security-4/5). price_snapshots
      // RLS gak punya policy write buat authenticated (migrasi 002), jadi upsert
      // user-client sebelumnya sebenernya silently ditolak; admin bikin warm-cache
      // ini jalan + nutup vektor. Fallback ke user client kalau key absen.
      const writer = createAdminClient() ?? supabase
      await writer.from('price_snapshots').upsert(
        cacheable.map((q) => ({
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
