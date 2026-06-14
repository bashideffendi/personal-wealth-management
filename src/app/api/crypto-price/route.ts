/**
 * GET /api/crypto-price?symbols=BTCUSDT,ETHUSDT,...
 *
 * Returns current price + 24h change for the requested crypto symbols
 * via Binance public market data. Used by the investment crypto page
 * to refresh `current_price` on each holding.
 *
 * Symbols use Binance format: base + quote concatenated (BTCUSDT,
 * ETHUSDT, BNBUSDT). User stores their crypto with `ticker` like
 * "BTC-USD" (Yahoo style) — the page-side helper translates before
 * calling this endpoint.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { get24hTickers } from '@/lib/binance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Auth gate — only logged-in users can hit this
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('symbols') || ''
  const symbols = raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)

  if (symbols.length === 0) {
    return NextResponse.json({ tickers: [] })
  }

  try {
    const tickers = await get24hTickers(symbols)
    return NextResponse.json({ tickers })
  } catch (err) {
    console.error('[crypto-price] failed:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: 'Gagal ambil harga kripto. Coba lagi.' },
      { status: 502 },
    )
  }
}
