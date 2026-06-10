import 'server-only'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Ownership data per emiten — sumber dari Stockbit scrape (shareholding).
 * Static JSON, seed 3 ticker dulu (BRPT/CUAN/TPIA); full-universe nyusul.
 *
 * Tiga lapis data:
 *  - composition: breakdown pemegang saham (per kategori/nama) di periode terakhir
 *  - subsidiaries: anak usaha + persentase kepemilikan
 *  - network: grafik kepemilikan lintas-emiten (nodes = perusahaan/investor,
 *    edges = relasi "from memegang to" dengan pct & jumlah lembar)
 *
 * Structure: { TICKER: Ownership } keyed by ticker (uppercase).
 */

/** Satu baris komposisi pemegang saham (per kategori atau nama). */
export interface OwnershipComposition {
  label: string | null
  /** Persentase kepemilikan (number, mis. 73.94). */
  pct: number | null
  /** Jumlah lembar saham (number). */
  shares: number | null
}

/** Anak usaha. */
export interface OwnershipSubsidiary {
  name: string | null
  /** Persentase kepemilikan induk atas anak usaha. */
  pct: number | null
  location: string | null
  businessType: string | null
}

/** Node grafik kepemilikan: bisa perusahaan (ada symbol/icon) atau investor. */
export interface OwnershipNetworkNode {
  /** id ber-prefix, mis. "company:93" atau "investor:1000000624". */
  id: string
  kind: 'company' | 'investor' | null
  /** Ticker emiten (cuma untuk node kind="company"). */
  symbol?: string | null
  name: string | null
  /** URL logo (cuma untuk sebagian node kind="company"). */
  icon?: string | null
}

/** Edge grafik: `from` memegang saham `to`. */
export interface OwnershipNetworkEdge {
  /** id node pemegang (prefix company:/investor:). */
  from: string | null
  /** id node yang dipegang. */
  to: string | null
  /** Persentase kepemilikan pada relasi ini. */
  pct: number | null
  /** Jumlah lembar saham pada relasi ini. */
  shares: number | null
}

export interface OwnershipNetwork {
  nodes: OwnershipNetworkNode[]
  edges: OwnershipNetworkEdge[]
}

export interface Ownership {
  /** Tanggal laporan komposisi (ISO, mis. "2026-04-30"). */
  asOf: string | null
  /** Total lembar saham beredar di periode tsb. */
  totalShares: number | null
  composition: OwnershipComposition[]
  subsidiaries: OwnershipSubsidiary[]
  network: OwnershipNetwork
}

// Lazy load — ownership.json ~6,9 MB, file data terbesar yang dulunya
// di-parse di module load (cold start). Sekarang dibaca pas pertama diminta,
// cache module-level buat instance warm. Wajib terdaftar di
// outputFileTracingIncludes (next.config.ts) karena fs-read dinamis.
let RAW: Record<string, Ownership> | undefined
function load(): Record<string, Ownership> {
  RAW ??= JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'invest', 'ownership.json'), 'utf-8'),
  ) as Record<string, Ownership>
  return RAW
}

/** Ambil data ownership satu emiten. null kalau belum di-scrape. */
export function getOwnership(ticker: string): Ownership | null {
  const upper = ticker.toUpperCase()
  return load()[upper] ?? null
}

/** Daftar ticker yang punya data ownership (sorted). */
export function listOwnershipTickers(): string[] {
  return Object.keys(load()).sort()
}
