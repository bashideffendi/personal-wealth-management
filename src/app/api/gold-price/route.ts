import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Harga emas per-gram dari harga publik provider Indonesia, dinormalisasi.
 *
 * Upstream: logam-mulia-api (MIT, Cloudflare Worker) — agregator harga publik
 * Antam/Pegadaian/Treasury/Indogold/dll. Satuan tiap source beda (Pegadaian
 * per 0,01 g, Indogold per 0,5 g, Antam multi-gramasi) → dinormalisasi ke
 * per-gram di sini, pilih baris bobot TERBESAR (premium gramasi kecil paling
 * mendistorsi harga per gram).
 *
 * Cache dua lapis: in-memory TTL 1 jam (harga provider cuma update 1-2x/hari)
 * + header s-maxage buat CDN Vercel. Source yang gagal di-skip — sebagian
 * data lebih berguna daripada error total; client fallback ke harga manual.
 */

const UPSTREAM = 'https://logam-mulia-api.iamutaki.workers.dev/api/prices'
const SOURCES = ['anekalogam', 'pegadaian', 'treasury', 'indogold', 'lakuemas', 'galeri24'] as const
const TTL_MS = 60 * 60 * 1000

interface Provider {
  source: string
  sellPerGram: number | null
  buybackPerGram: number | null
  recordedDate: string | null
}

let memCache: { at: number; providers: Provider[] } | null = null

interface UpstreamRow {
  weight?: number
  sellPrice?: number
  buybackPrice?: number
  recordedDate?: string
}

async function fetchSource(source: string): Promise<Provider | null> {
  try {
    const res = await fetch(`${UPSTREAM}/${source}`, { signal: AbortSignal.timeout(8000), cache: 'no-store' })
    if (!res.ok) return null
    const json = (await res.json()) as { data?: UpstreamRow[] }
    const rows = (json.data ?? []).filter((r) => (Number(r.weight) || 0) > 0)
    if (rows.length === 0) return null
    // Bobot terbesar = premium per-gram terkecil; kalau ada baris tepat 1 g, pakai itu.
    const exact = rows.find((r) => Number(r.weight) === 1)
    const row = exact ?? rows.reduce((a, b) => ((Number(a.weight) || 0) >= (Number(b.weight) || 0) ? a : b))
    const w = Number(row.weight) || 1
    const sell = Number(row.sellPrice) > 0 ? Math.round(Number(row.sellPrice) / w) : null
    const buyback = Number(row.buybackPrice) > 0 ? Math.round(Number(row.buybackPrice) / w) : null
    if (!sell && !buyback) return null
    return { source, sellPerGram: sell, buybackPerGram: buyback, recordedDate: row.recordedDate ?? null }
  } catch {
    return null
  }
}

export async function GET() {
  if (memCache && Date.now() - memCache.at < TTL_MS) {
    return NextResponse.json(
      { providers: memCache.providers, fetchedAt: new Date(memCache.at).toISOString(), cached: true },
      { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=600' } },
    )
  }
  const results = await Promise.all(SOURCES.map(fetchSource))
  const providers = results.filter((p): p is Provider => p !== null)
  if (providers.length === 0) {
    // Upstream tumbang total — jangan cache kegagalan; client fallback manual.
    return NextResponse.json({ providers: [], fetchedAt: new Date().toISOString() }, { status: 502 })
  }
  memCache = { at: Date.now(), providers }
  return NextResponse.json(
    { providers, fetchedAt: new Date(memCache.at).toISOString() },
    { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=600' } },
  )
}
