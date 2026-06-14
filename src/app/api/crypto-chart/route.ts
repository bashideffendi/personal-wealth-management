import { NextRequest, NextResponse } from 'next/server'
import { getKlines, type Interval } from '@/lib/binance'

// Crypto price chart via Binance public klines (realtime, free, no geoblock).
// Mirrors the shape of /api/stock-chart so the shared chart component can
// consume either: { points: [{t,c}], meta: {currency, previousClose, regularMarketPrice} }.
export const dynamic = 'force-dynamic'

// Range → Binance (interval, limit). Limits stay under Binance's 1000 cap.
const RANGE_MAP: Record<string, { interval: Interval; limit: number }> = {
  '1D': { interval: '15m', limit: 96 }, // 24h
  '1W': { interval: '1h', limit: 168 }, // 7d
  '1M': { interval: '4h', limit: 180 }, // 30d
  '3M': { interval: '12h', limit: 180 }, // 90d
  YTD: { interval: '1d', limit: 366 }, // trimmed to Jan 1 below
  '1Y': { interval: '1d', limit: 365 },
  '3Y': { interval: '1w', limit: 157 },
  '5Y': { interval: '1w', limit: 260 },
}

// Cache TTL per-range (detik) — data candle makin panjang range makin jarang
// berubah. Route ini TIDAK auth-gated & identik buat semua caller → boleh
// shared (s-maxage di CDN Vercel). [performance-5]
const CACHE_TTL: Record<string, number> = {
  '1D': 60, '1W': 300, '1M': 1800, '3M': 1800, YTD: 3600, '1Y': 3600, '3Y': 21600, '5Y': 21600,
}

// "BTC-USD" / "BTC-USDT" / "BTCUSDT" / "BTC" → "BTCUSDT" (Binance spot pair).
function toBinanceSymbol(raw: string): string {
  const base = raw.trim().toUpperCase().replace(/[-_]?(USDT|USD)$/i, '').replace(/[-_]+$/, '')
  return `${base}USDT`
}

export async function GET(req: NextRequest) {
  const symbolRaw = req.nextUrl.searchParams.get('symbol') ?? ''
  const range = req.nextUrl.searchParams.get('range') ?? '1D'
  if (!symbolRaw.trim()) {
    return NextResponse.json({ points: [], meta: null }, { status: 400 })
  }
  const cfg = RANGE_MAP[range] ?? RANGE_MAP['1D']
  const symbol = toBinanceSymbol(symbolRaw)

  try {
    const klines = await getKlines(symbol, cfg.interval, cfg.limit)
    let points = klines.map((k) => ({ t: Math.floor(k.closeTime / 1000), c: k.close }))
    if (range === 'YTD') {
      const jan1 = Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000)
      points = points.filter((p) => p.t >= jan1)
    }
    const last = points.length ? points[points.length - 1].c : null
    const prev = points.length ? points[0].c : null
    const ttl = CACHE_TTL[range] ?? 60
    return NextResponse.json(
      {
        points,
        meta: { currency: 'USD', previousClose: prev, regularMarketPrice: last },
      },
      // Cache cuma response SUKSES; empty/error (di bawah) tetap tak ter-cache.
      { headers: { 'Cache-Control': `public, s-maxage=${ttl}, stale-while-revalidate=${ttl}` } },
    )
  } catch (err) {
    // Symbol not on Binance (e.g. exotic alt) or transient error — empty, no 500.
    // Log so a real Binance outage leaves a trace instead of looking like "no data".
    console.error('[crypto-chart] klines failed:', symbol, err instanceof Error ? err.message : err)
    return NextResponse.json({ points: [], meta: null }, { status: 200 })
  }
}
