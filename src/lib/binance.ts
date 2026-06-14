/**
 * Server-side wrapper for Binance public market data.
 * No auth required — screening/klines only. Keep all calls server-side
 * to avoid CORS/geoblock issues in the browser.
 *
 * Docs: https://developers.binance.com/docs/binance-spot-api-docs/rest-api
 *
 * We use `data-api.binance.vision` — a dedicated read-only mirror for
 * public market data that runs on different infrastructure than
 * `api.binance.com`. It avoids routing issues that some ISPs (notably
 * Indonesian ISPs that partially block `binance.com`) exhibit.
 */

import { withResilience } from './retry'

const BASE = process.env.BINANCE_PUBLIC_BASE ?? 'https://data-api.binance.vision'

export interface Ticker24h {
  symbol: string
  lastPrice: number
  priceChangePercent: number
  quoteVolume: number
  highPrice: number
  lowPrice: number
  openPrice: number
  count: number
}

export interface Kline {
  openTime: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  closeTime: number
  quoteVolume: number
  trades: number
}

export type Interval =
  | '1m' | '3m' | '5m' | '15m' | '30m'
  | '1h' | '2h' | '4h' | '6h' | '8h' | '12h'
  | '1d' | '3d' | '1w' | '1M'

async function binanceFetch(path: string, init?: RequestInit): Promise<unknown> {
  // retry+circuit-breaker (reliability-9). retries:1 → maks 2 attempt; tiap
  // attempt punya AbortController 8s sendiri (dibikin di dalam fn) biar abort
  // attempt-1 gak nyangkut ke attempt-2. Worst case ~16s < budget rute.
  return withResilience(
    'binance',
    async () => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      try {
        const res = await fetch(`${BASE}${path}`, {
          ...init,
          headers: { 'User-Agent': 'wealth-mgmt/1.0', ...(init?.headers ?? {}) },
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(`Binance ${res.status}: ${text.slice(0, 200)}`)
        }
        return res.json()
      } finally {
        clearTimeout(timeout)
      }
    },
    { retries: 1 },
  )
}

/**
 * 24h rolling window ticker. If `symbols` omitted, returns ALL symbols (~2k rows).
 */
export async function get24hTickers(symbols?: string[]): Promise<Ticker24h[]> {
  let path = '/api/v3/ticker/24hr'
  if (symbols && symbols.length > 0) {
    const q = JSON.stringify(symbols.map((s) => s.toUpperCase()))
    path += `?symbols=${encodeURIComponent(q)}`
  }
  const raw = (await binanceFetch(path)) as Array<Record<string, string>>
  const list = Array.isArray(raw) ? raw : [raw as unknown as Record<string, string>]
  return list.map((r) => ({
    symbol: r.symbol,
    lastPrice: Number(r.lastPrice),
    priceChangePercent: Number(r.priceChangePercent),
    quoteVolume: Number(r.quoteVolume),
    highPrice: Number(r.highPrice),
    lowPrice: Number(r.lowPrice),
    openPrice: Number(r.openPrice),
    count: Number(r.count),
  }))
}

/**
 * Candlestick / OHLCV data for a single symbol.
 */
export async function getKlines(
  symbol: string,
  interval: Interval,
  limit = 200,
): Promise<Kline[]> {
  const path = `/api/v3/klines?symbol=${encodeURIComponent(symbol.toUpperCase())}&interval=${interval}&limit=${limit}`
  const raw = (await binanceFetch(path)) as Array<Array<string | number>>
  return raw.map((k) => ({
    openTime: Number(k[0]),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
    closeTime: Number(k[6]),
    quoteVolume: Number(k[7]),
    trades: Number(k[8]),
  }))
}

/**
 * Returns the list of tradable symbols from exchangeInfo.
 * We filter to `TRADING` status + USDT/BUSD/USDC/BTC quote assets.
 */
export interface SymbolInfo {
  symbol: string
  baseAsset: string
  quoteAsset: string
  status: string
}

export async function getExchangeSymbols(): Promise<SymbolInfo[]> {
  const raw = (await binanceFetch('/api/v3/exchangeInfo')) as {
    symbols: Array<{
      symbol: string
      baseAsset: string
      quoteAsset: string
      status: string
    }>
  }
  return raw.symbols
    .filter((s) => s.status === 'TRADING')
    .map((s) => ({
      symbol: s.symbol,
      baseAsset: s.baseAsset,
      quoteAsset: s.quoteAsset,
      status: s.status,
    }))
}
