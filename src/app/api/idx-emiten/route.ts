import { NextResponse } from 'next/server'
import { listEmiten } from '@/lib/invest/emitten'

/**
 * Slim list of IDX active emiten — buat autocomplete watchlist, compare, dll.
 * Cached aggressively (1 day) karena data jarang berubah (daftar emiten IDX
 * cuma update kalau ada IPO baru / delist).
 */
export const runtime = 'nodejs'

export async function GET() {
  const emiten = listEmiten().map((e) => ({
    ticker: e.ticker,
    name: e.name,
    sector: e.sector,
  }))

  return NextResponse.json(
    { emiten },
    {
      headers: {
        // Browser cache 1 jam, CDN cache 1 hari
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  )
}
