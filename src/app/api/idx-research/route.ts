import { NextResponse } from 'next/server'
import { getValuations } from '@/lib/invest/stocks'
import { listEmiten } from '@/lib/invest/emitten'

/**
 * Research list — semua emiten yang punya data valuasi. Dipake buat
 * tab Research di saham page dan tab Compare.
 *
 * Output: slim list dengan ticker, name, sector, price (snapshot),
 * verdict, MoS — bukan full valuation detail (terlalu berat untuk list view).
 */
export const runtime = 'nodejs'

export async function GET(request: Request) {
  // ?tickers=BBCA,TLKM → only those rows (hub holdings wedge); absent → all.
  const tickersParam = new URL(request.url).searchParams.get('tickers')
  const wanted = tickersParam
    ? new Set(tickersParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))
    : null

  const valuations = getValuations()
  const emitenMap = new Map(listEmiten().map((e) => [e.ticker, e]))

  const rows = (wanted ? valuations.filter((v) => wanted.has(v.ticker.toUpperCase())) : valuations).map((v) => {
    const meta = emitenMap.get(v.ticker)
    return {
      ticker: v.ticker,
      name: v.name || meta?.name || v.ticker,
      sector: v.sector || meta?.sector || null,
      price: v.price,
      avgMoS: v.avgMoS,
      verdict: v.verdict,
      methodsValid: v.methodsValid,
      avgFairValue: v.avgFairValue,
      medianFairValue: v.medianFairValue,
    }
  })

  return NextResponse.json(
    { rows },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  )
}
