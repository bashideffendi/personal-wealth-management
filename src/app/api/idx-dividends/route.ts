import { NextResponse } from 'next/server'
import { getUpcomingDividends, getDividendsForTicker } from '@/lib/invest/stocks'

/**
 * Dividend events endpoint. Two modes:
 *   - GET /api/idx-dividends             → upcoming dividends (ex-date >= today)
 *   - GET /api/idx-dividends?ticker=BBCA → historical dividends for ticker
 */
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get('ticker')

  if (ticker) {
    const events = getDividendsForTicker(ticker)
    return NextResponse.json(
      { ticker: ticker.toUpperCase(), events },
      { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } },
    )
  }

  const upcoming = getUpcomingDividends().slice(0, 200)
  return NextResponse.json(
    { upcoming },
    { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } },
  )
}
