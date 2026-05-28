import { NextResponse } from 'next/server'
import { getValuation, getValuationDetail, getEmittenStat, getDividendsForTicker } from '@/lib/invest/stocks'
import { getEmiten } from '@/lib/invest/emitten'

/**
 * Per-ticker research detail. Returns valuation methods + stats + dividend
 * history. Dipake buat halaman /stock/research/[ticker].
 */
export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ ticker: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { ticker: rawTicker } = await context.params
  const ticker = rawTicker.toUpperCase()

  const valuation = getValuation(ticker)
  const detail = getValuationDetail(ticker)
  const stats = getEmittenStat(ticker)
  const emiten = getEmiten(ticker)
  const dividends = getDividendsForTicker(ticker)

  if (!valuation && !detail && !emiten) {
    return NextResponse.json({ error: 'Ticker tidak ditemukan' }, { status: 404 })
  }

  return NextResponse.json(
    {
      ticker,
      emiten: emiten ?? null,
      valuation: valuation ?? null,
      detail: detail ?? null,
      stats: stats ?? null,
      dividends: dividends.slice(0, 20), // last 20 events
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=1800, s-maxage=86400',
      },
    },
  )
}
