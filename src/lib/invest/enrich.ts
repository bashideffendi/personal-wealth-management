import type { Investment } from '@/types'

/**
 * Shared live-price enrichment for investment holdings.
 *
 * One source of truth used by the investment hub AND the per-class [slug]
 * page so their numbers can't diverge (they used to: the hub ignored quote
 * prices entirely and the slug page skipped FX conversion for US stocks).
 *
 * Conventions this encodes:
 *  - avg_cost is entered in IDR app-wide, so market value must also be IDR.
 *  - Quotes priced in USD (US stocks, forex) are converted with usdIdr.
 *  - Crypto quotes are stored PRE-converted to IDR (currency: 'IDR') by the
 *    fetch layer, so they pass through unmultiplied.
 *  - No quote (or zero price) falls back to the manually-stored current_price
 *    — load-bearing for gold/deposito/bonds and anything Yahoo can't quote.
 */

export interface LiveQuote {
  price: number
  currency: string
  changePct: number | null
}

export interface EnrichedHolding {
  i: Investment
  q?: LiveQuote
  /** Live price per unit, in IDR. */
  live: number
  invested: number
  market: number
  pl: number
  plPct: number
}

export const quoteKey = (t: string | null | undefined) => (t ?? '').trim().toUpperCase()

/**
 * The symbol a holding should be quoted under.
 *  - crypto  → the user's stored ticker (BTC-USD); priced via Binance separately
 *  - forex   → normalized to Yahoo FX form (USD / USD/IDR / USDIDR=X → USDIDR=X);
 *              a bare "USD" would otherwise hit a real US ETF
 *  - others  → the stored ticker as-is (BBCA.JK / AAPL)
 */
export function tickerToQuoteSymbol(i: Investment): string | null {
  const t = quoteKey(i.ticker)
  if (!t) return null
  if (i.category === 'forex') {
    const base = t.replace(/=X$/, '').replace(/[/\-]?IDR$/, '')
    return base ? `${base}IDR=X` : null
  }
  return t
}

export function enrichHolding(
  i: Investment,
  q: LiveQuote | undefined,
  usdIdr: number,
): EnrichedHolding {
  const shares = i.quantity || 0
  const live =
    q && q.price > 0
      ? q.price * (q.currency === 'USD' ? usdIdr : 1)
      : i.current_price || i.avg_cost || 0
  const invested = shares * (i.avg_cost || 0)
  const market = shares * live
  const pl = market - invested
  return { i, q, live, invested, market, pl, plPct: invested > 0 ? (pl / invested) * 100 : 0 }
}
