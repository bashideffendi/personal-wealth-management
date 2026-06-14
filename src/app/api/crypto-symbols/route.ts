/**
 * GET /api/crypto-symbols
 *
 * Returns all currently-tradable USDT-quoted crypto pairs from Binance,
 * sorted alphabetically by base asset. Used by the CryptoSearch component
 * to populate its autocomplete dropdown with the full Binance universe
 * (~400 pairs) instead of just our curated 80.
 *
 * Cached in-memory for 1 hour — exchange listings don't change often
 * and we don't want to hammer Binance for every page open.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getExchangeSymbols } from '@/lib/binance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface CachedResult {
  fetchedAt: number
  symbols: Array<{ s: string; n?: string }>
}

let cache: CachedResult | null = null
const TTL_MS = 60 * 60 * 1000 // 1 hour

export async function GET() {
  // Auth gate — only logged-in users can hit this
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Serve from cache if fresh
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return NextResponse.json({ symbols: cache.symbols, source: 'cache' })
  }

  try {
    const all = await getExchangeSymbols()
    // Filter to USDT-quoted pairs (most relevant for retail) and dedupe by base
    const seen = new Set<string>()
    const symbols: Array<{ s: string; n?: string }> = []
    for (const sym of all) {
      if (sym.quoteAsset !== 'USDT') continue
      if (seen.has(sym.baseAsset)) continue
      seen.add(sym.baseAsset)
      symbols.push({ s: sym.baseAsset })
    }
    symbols.sort((a, b) => a.s.localeCompare(b.s))
    cache = { fetchedAt: Date.now(), symbols }
    return NextResponse.json({ symbols, source: 'binance' })
  } catch (err) {
    console.error('[crypto-symbols] failed:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: 'Gagal ambil daftar kripto. Coba lagi.' },
      { status: 502 },
    )
  }
}
