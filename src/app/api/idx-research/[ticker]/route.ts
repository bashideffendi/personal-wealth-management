import { NextResponse } from 'next/server'
import { getValuation, getValuationDetail, getEmittenStat, getDividendsForTicker, getStock } from '@/lib/invest/stocks'
import { getEmiten } from '@/lib/invest/emitten'
import { computePiotroski } from '@/lib/invest/piotroski'

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

  // Metrik multi-tahun + Piotroski buat Compare (sparkline Revenue/Laba 10 thn
  // + skor F). getStock = fs-read per-ticker (±19KB, cache Map) — file bisa
  // tidak ter-ship (tracing gagal) → degrade ke null, jangan 500.
  let metrics: Record<string, Record<string, number>> | null = null
  let piotroski: ReturnType<typeof computePiotroski> | null = null
  try {
    const stock = getStock(ticker)
    if (stock) {
      metrics = stock.metrics ?? null
      piotroski = computePiotroski(stock)
    }
  } catch {
    metrics = null
    piotroski = null
  }

  return NextResponse.json(
    {
      ticker,
      emiten: emiten ?? null,
      valuation: valuation ?? null,
      detail: detail ?? null,
      stats: stats ?? null,
      metrics,
      piotroski,
      dividends: dividends.slice(0, 20), // last 20 events
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=1800, s-maxage=86400',
      },
    },
  )
}
