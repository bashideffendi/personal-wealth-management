import { NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'
import { createAdminClient } from '@/lib/supabase/admin'
import { get24hTickers } from '@/lib/binance'
import { enrichHolding, tickerToQuoteSymbol, quoteKey, type LiveQuote } from '@/lib/invest/enrich'
import { FX_FALLBACK_USDIDR } from '@/lib/constants'
import type { Investment } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Daily cron → portfolio_snapshots for EVERY user, priced server-side.
 *
 * Replaces the old client-side "snapshot on page open" upsert, which recorded
 * attendance (only users who visited got points) and stale values (manual
 * current_price). This refreshes prices per unique ticker once, then writes
 * one consistent snapshot per user with the Asia/Jakarta calendar date.
 *
 * Wiring (mirrors /api/cron/reminders):
 *  - vercel.json crons → { "path": "/api/cron/portfolio-snapshots", "schedule": "0 10 * * *" }
 *    (10:00 UTC = 17:00 WIB, after the IDX close; crypto is 24/7 anyway)
 *  - env CRON_SECRET — Vercel sends `Authorization: Bearer $CRON_SECRET`
 *  - env SUPABASE_SERVICE_ROLE_KEY — scans all users (RLS bypass, server-only)
 */

const yahooFinance = new YahooFinance()

interface YahooQuoteShape {
  regularMarketPrice?: number
  postMarketPrice?: number
  preMarketPrice?: number
  regularMarketChangePercent?: number
  currency?: string
  marketState?: string
}

async function fetchYahoo(ticker: string) {
  const raw = (await yahooFinance.quote(ticker)) as YahooQuoteShape
  const price = raw.regularMarketPrice ?? raw.postMarketPrice ?? raw.preMarketPrice ?? 0
  return {
    ticker,
    price: Number(price) || 0,
    currency: raw.currency ?? 'USD',
    changePct:
      typeof raw.regularMarketChangePercent === 'number'
        ? Number(raw.regularMarketChangePercent.toFixed(4))
        : null,
    marketState: raw.marketState ?? null,
  }
}

export async function GET(request: Request) {
  // Only Vercel Cron (or a caller with the secret) may trigger this.
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY not configured' },
      { status: 503 },
    )
  }

  // All holdings across users — only the fields the pricing math needs.
  const { data, error } = await admin
    .from('investments')
    .select('user_id, category, ticker, quantity, avg_cost, current_price')
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const rows = (data ?? []) as (Investment & { user_id: string })[]
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, users: 0, tickers: 0 })
  }

  // Unique quote symbols, split by venue (same logic as the hub client).
  const cryptoSyms = Array.from(new Set(
    rows.filter((r) => r.category === 'crypto' && quoteKey(r.ticker))
      .map((r) => quoteKey(r.ticker).replace(/-USD$/, 'USDT')),
  ))
  const stockSyms = Array.from(new Set(
    rows.filter((r) => r.category !== 'crypto')
      .map((r) => tickerToQuoteSymbol(r))
      .filter(Boolean) as string[],
  ))
  const yahooSyms = Array.from(new Set([...stockSyms, 'USDIDR=X']))

  const quotes: Record<string, LiveQuote> = {}
  let fx = FX_FALLBACK_USDIDR

  const settled = await Promise.allSettled(yahooSyms.map(fetchYahoo))
  const fetchedAt = new Date().toISOString()
  const cacheRows: Array<Record<string, unknown>> = []
  for (const r of settled) {
    if (r.status !== 'fulfilled' || r.value.price <= 0) continue
    const q = r.value
    if (q.ticker === 'USDIDR=X') fx = q.price
    quotes[quoteKey(q.ticker)] = { price: q.price, currency: q.currency, changePct: q.changePct }
    cacheRows.push({
      ticker: q.ticker, price: q.price, currency: q.currency,
      change_pct: q.changePct, market_state: q.marketState,
      fetched_at: fetchedAt, source: 'cron',
    })
  }
  // Refresh the shared price cache too — users landing later get warm quotes.
  if (cacheRows.length > 0) {
    await admin.from('price_snapshots').upsert(cacheRows, { onConflict: 'ticker' })
  }

  if (cryptoSyms.length > 0) {
    try {
      const tickers = await get24hTickers(cryptoSyms)
      for (const tk of tickers) {
        const userTicker = tk.symbol.replace(/USDT$/, '-USD')
        quotes[userTicker] = {
          price: (Number(tk.lastPrice) || 0) * fx,
          currency: 'IDR',
          changePct: Number(tk.priceChangePercent),
        }
      }
    } catch (err) {
      // Crypto best-effort — stored prices cover the gap. Log so a Binance
      // outage during the nightly run leaves a trace.
      console.error('[cron/portfolio-snapshots] crypto 24h tickers failed:', err instanceof Error ? err.message : err)
    }
  }

  // One snapshot per user, dated in Asia/Jakarta (the product's home market).
  const snapshotDate = new Date().toLocaleDateString('sv', { timeZone: 'Asia/Jakarta' })
  const byUser = new Map<string, { invested: number; market: number }>()
  for (const r of rows) {
    const sym = tickerToQuoteSymbol(r)
    const e = enrichHolding(r, sym ? quotes[sym] : undefined, fx)
    const agg = byUser.get(r.user_id) ?? { invested: 0, market: 0 }
    agg.invested += e.invested
    agg.market += e.market
    byUser.set(r.user_id, agg)
  }

  const snapshotRows = [...byUser.entries()].map(([user_id, v]) => ({
    user_id,
    snapshot_date: snapshotDate,
    market_value: Math.round(v.market),
    invested: Math.round(v.invested),
  }))
  const { error: upErr } = await admin
    .from('portfolio_snapshots')
    .upsert(snapshotRows, { onConflict: 'user_id,snapshot_date' })
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    date: snapshotDate,
    users: snapshotRows.length,
    tickers: yahooSyms.length + cryptoSyms.length,
  })
}
