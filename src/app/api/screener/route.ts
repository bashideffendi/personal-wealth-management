import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { getValuations, getEmittenStat } from '@/lib/invest/stocks'
import type { Stock } from '@/lib/invest/stocks'
import { canonicalYear } from '@/lib/invest/valuation'

/**
 * Screener IDX — dataset fundamental ringkas SEMUA emiten ter-cover
 * (union valuations.json + file per-ticker src/data/invest/stocks/).
 *
 * Kolom fundamental (PER, PBV, ROE, yield) dihitung dari file per-ticker
 * pada tahun kanonik (canonicalYear — tahun buku lengkap terakhir), dengan
 * harga snapshot SEKARANG (konsisten dgn basis MoS), BUKAN kolom
 * 'PE Ratio'/'PBV' historis yang basisnya harga akhir tahun buku.
 *
 * Baca ±1.005 file per-ticker itu mahal (±20 MB parse) → dilakukan SEKALI
 * per instance lalu di-cache module-level; hanya field ringkas yang ditahan
 * (bukan Stock utuh) biar memory tetap kecil. Rebuild kalau valuations.json
 * berubah (mtime — deploy data baru) atau cache lewat interval.
 *
 * NOTE: route ini WAJIB terdaftar di outputFileTracingIncludes
 * (next.config.ts) — fs-read dinamis gak kelihatan sama tracer Next.
 */
export const runtime = 'nodejs'

interface ScreenerRow {
  ticker: string
  name: string
  sector: string | null
  /** Harga snapshot (bukan real-time) */
  price: number | null
  /** Median fair value konsensus (fallback average) — per lembar */
  fairValue: number | null
  /** Margin of safety, fraksi (0.15 = 15%) */
  mos: number | null
  /** PER = harga snapshot / EPS tahun kanonik */
  per: number | null
  /** PBV = harga snapshot / BVPS tahun kanonik */
  pbv: number | null
  /** ROE tahun kanonik, fraksi */
  roe: number | null
  /** Dividend yield = DPS tahun kanonik / harga snapshot, fraksi */
  divYield: number | null
  /** Market cap rupiah (emitten-stats; fallback harga × jumlah saham) */
  mcap: number | null
  verdict: string | null
}

const DATA_DIR = path.join(process.cwd(), 'src', 'data', 'invest')
const STOCK_DIR = path.join(DATA_DIR, 'stocks')

/** Baca metric di tahun tertentu; 0/null dianggap kosong (rasio gak valid). */
function atYear(series: Record<string, number> | undefined, year: number | null): number | null {
  if (!series || year === null) return null
  const v = series[String(year)]
  return v === null || v === undefined || v === 0 ? null : v
}

/** Beberapa emiten punya sector '0' (data kotor) → normalisasi jadi null. */
function cleanSector(s: string | null | undefined): string | null {
  return s && s !== '0' ? s : null
}

let cache: {
  rows: ScreenerRow[]
  generatedAt: string
  builtAt: number
  srcMtime: number
} | null = null
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 jam — data snapshot kuartalan

function buildRows(): ScreenerRow[] {
  const valuationByTicker = new Map(getValuations().map((v) => [v.ticker.toUpperCase(), v]))
  const tickers = fs
    .readdirSync(STOCK_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))

  const rows: ScreenerRow[] = []
  const seen = new Set<string>()

  for (const ticker of tickers) {
    let stock: Stock
    try {
      // Parse lokal + buang setelah ekstraksi — SENGAJA gak lewat getStock()
      // supaya 1.005 Stock utuh gak ketahan permanen di stockCache stocks.ts.
      stock = JSON.parse(fs.readFileSync(path.join(STOCK_DIR, `${ticker}.json`), 'utf-8')) as Stock
    } catch {
      continue // file hilang/korup → skip baris, jangan gagalkan seluruh dataset
    }
    const key = ticker.toUpperCase()
    seen.add(key)
    const v = valuationByTicker.get(key)
    const year = canonicalYear(stock)
    const price = v?.price ?? stock.currentPrice ?? null

    const eps = atYear(stock.metrics['EPS'], year)
    const bvps = atYear(stock.metrics['BVPS'], year)
    const roe = atYear(stock.metrics['ROE'], year)
    // "Dividend"/"DPS" sudah per-share rupiah dari parser (lihat valuation.ts)
    const dps = atYear(stock.metrics['Dividend'], year) ?? atYear(stock.metrics['DPS'], year)
    const shares = atYear(stock.metrics['Jumlah Saham'], year)

    const per = price && eps && eps > 0 ? price / eps : null
    const pbv = price && bvps && bvps > 0 ? price / bvps : null
    const divYield = price && dps && dps > 0 ? dps / price : null
    const mcap = getEmittenStat(key)?.marketCap ?? (price && shares ? price * shares : null)

    rows.push({
      ticker: key,
      name: v?.name || stock.name || key,
      sector: cleanSector(v?.sector) ?? cleanSector(stock.sector),
      price,
      fairValue: v ? (v.medianFairValue ?? v.avgFairValue) : null,
      mos: v && v.methodsValid > 0 ? v.avgMoS : null,
      per,
      pbv,
      roe,
      divYield,
      mcap,
      verdict: v?.verdict ?? null,
    })
  }

  // Emiten yang cuma ada di valuations.json (gak punya file per-ticker) tetap masuk
  for (const [key, v] of valuationByTicker) {
    if (seen.has(key)) continue
    rows.push({
      ticker: key,
      name: v.name || key,
      sector: cleanSector(v.sector),
      price: v.price ?? null,
      fairValue: v.medianFairValue ?? v.avgFairValue,
      mos: v.methodsValid > 0 ? v.avgMoS : null,
      per: null,
      pbv: null,
      roe: null,
      divYield: null,
      mcap: getEmittenStat(key)?.marketCap ?? null,
      verdict: v.verdict,
    })
  }

  rows.sort((a, b) => a.ticker.localeCompare(b.ticker))
  return rows
}

export async function GET() {
  let srcMtime = 0
  try {
    srcMtime = fs.statSync(path.join(DATA_DIR, 'valuations.json')).mtimeMs
  } catch {
    // stat gagal → fallback refresh interval saja
  }

  if (!cache || cache.srcMtime !== srcMtime || Date.now() - cache.builtAt > CACHE_TTL_MS) {
    cache = {
      rows: buildRows(),
      generatedAt: new Date().toISOString(),
      builtAt: Date.now(),
      srcMtime,
    }
  }

  return NextResponse.json(
    { rows: cache.rows, generatedAt: cache.generatedAt },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  )
}
