import 'server-only'
import fs from 'node:fs'
import path from 'node:path'

/**
 * IDX emiten registry — sumber data dari kelolainvestasi (Stockbit scrape).
 * Static JSON, ~990 emiten aktif. Dipake buat autocomplete watchlist,
 * research page, compare, dll.
 *
 * Structure: { TICKER: { name, sector_id, ... } } keyed by ticker.
 */

interface RawEmittenInfo {
  name: string
  fullname: string | null
  sector_id: string | null
  subsector_id: string | null
  exchange: string
  status: string
  typeCompany: string
  tradeable: number
  iconUrl: string | null
  followers: number
  averageVolume: number
  volume: number
  previousClose: number | null
  updated: string
}

export interface EmittenInfo {
  ticker: string
  name: string
  sector: string | null
  subsector: string | null
  iconUrl: string | null
  previousClose: number | null
  averageVolume: number
}

// Lazy load (pola sama stocks.ts/ownership.ts) — dibaca pas pertama diminta,
// bukan saat module load. Terdaftar di outputFileTracingIncludes.
let RAW: Record<string, RawEmittenInfo> | undefined
function load(): Record<string, RawEmittenInfo> {
  RAW ??= JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'invest', 'emitten-info.json'), 'utf-8'),
  ) as Record<string, RawEmittenInfo>
  return RAW
}

let _cached: EmittenInfo[] | null = null

/** All IDX emiten yang masih aktif & tradeable. Sorted by ticker. */
export function listEmiten(): EmittenInfo[] {
  if (_cached) return _cached
  const out: EmittenInfo[] = []
  for (const [ticker, info] of Object.entries(load())) {
    if (info.status !== 'STATUS_ACTIVE') continue
    if (info.tradeable !== 1) continue
    out.push({
      ticker,
      name: (info.name || '').trim(),
      sector: info.sector_id,
      subsector: info.subsector_id,
      iconUrl: info.iconUrl,
      previousClose: info.previousClose,
      averageVolume: info.averageVolume,
    })
  }
  out.sort((a, b) => a.ticker.localeCompare(b.ticker))
  _cached = out
  return out
}

// Map ticker→info, dibangun sekali dari listEmiten() (performance-4): getEmiten
// dulu .find() linear ~990 entri tiap panggil. Memoized se-instance, sama
// profil staleness dgn _cached (JSON build-time static).
let _byTicker: Map<string, EmittenInfo> | null = null
export function getEmiten(ticker: string): EmittenInfo | undefined {
  if (!_byTicker) _byTicker = new Map(listEmiten().map((e) => [e.ticker, e]))
  return _byTicker.get(ticker.toUpperCase())
}

/** Lookup batch — return map keyed by ticker. Tickers not found → omitted. */
export function getEmitenMap(tickers: string[]): Map<string, EmittenInfo> {
  const set = new Set(tickers.map((t) => t.toUpperCase()))
  const out = new Map<string, EmittenInfo>()
  for (const e of listEmiten()) {
    if (set.has(e.ticker)) out.set(e.ticker, e)
  }
  return out
}

/** Yahoo Finance pakai suffix .JK untuk IDX. Helper biar konsisten. */
export function toYahooTicker(ticker: string): string {
  const t = ticker.toUpperCase()
  return t.endsWith('.JK') ? t : `${t}.JK`
}

export function fromYahooTicker(yticker: string): string {
  return yticker.toUpperCase().replace(/\.JK$/, '')
}
