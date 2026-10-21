/**
 * Screener IDX v2 — logika murni (tipe, preset, filter, sort, format).
 *
 * Sumber data: src/data/invest/screener-v2.json (ekspor bulanan IDX Screener),
 * disajikan apa adanya oleh /api/screener. Semua fungsi di sini pure supaya
 * bisa diuji tanpa DOM; halaman /dashboard/screener cuma merangkai.
 */

// ─── Tipe (mirror screener-v2.json) ─────────────────────────────

export type ValuationStatus = 'reliable' | 'unreliable' | 'not_valued' | 'bank_pb'

export interface ScreenerScore {
  /** Persentil sektor 0–1. Bank hanya punya composite. */
  composite: number | null
  value: number | null
  prof: number | null
  safety: number | null
}

export interface ScreenerValuation {
  status: ValuationStatus
  /** Nilai wajar per lembar (rupiah) — konservatif / dasar / optimistis. */
  cons?: number | null
  base?: number | null
  opt?: number | null
  /** Selisih nilai wajar dasar terhadap harga, fraksi. Null bila tak andal. */
  gap?: number | null
  /** Bank: P/B wajar vs P/B pasar. */
  pbJustified?: number | null
  pbMarket?: number | null
}

export interface ScreenerFlags {
  /** Skor manipulasi 0–3. */
  mrs: number | null
  /** Skor ketidakpastian 0–4. */
  up: number | null
  /** Penanda kualitas laba. */
  eqFlag: boolean
  /** Konsentrasi kepemilikan tinggi. */
  hsc: boolean
}

export interface ScreenerRow {
  ticker: string
  name: string
  sector: string | null
  subSector: string | null
  shariah: boolean
  price: number | null
  mcap: number | null
  /** Median nilai transaksi harian 60 hari, rupiah. */
  liq60: number | null
  chg1y: number | null
  per: number | null
  pbv: number | null
  evEbitda: number | null
  roe: number | null
  divYield: number | null
  /** Papan pemantauan khusus. */
  specialBoard: boolean
  hasScore: boolean
  group?: 'non_financial' | 'bank'
  score: ScreenerScore | null
  valuation: ScreenerValuation | null
  flags: ScreenerFlags | null
  modelClass: { code: string; label: string; note: string } | null
}

export interface ScreenerMeta {
  label: string
  disclaimer: string
  marketAsOf: string
  scoresAsOf: string
  scoresSource?: string
  generatedAt?: string
  n?: number
  nScored?: number
}

export interface ScreenerResponse {
  meta: ScreenerMeta
  rows: ScreenerRow[]
}

// ─── Preset ─────────────────────────────────────────────────────

export type PresetKey = 'scored' | 'quality' | 'cheap' | 'liquid' | 'shariah'

export const LIQUID_MIN = 10e9 // Rp10 miliar / hari
export const HIGH_PCTILE = 0.8

export const PRESETS: { key: PresetKey; label: string; test: (r: ScreenerRow) => boolean }[] = [
  { key: 'scored', label: 'Punya skor', test: (r) => r.hasScore },
  {
    key: 'quality',
    label: 'Kualitas tinggi',
    test: (r) => (r.score?.prof ?? -1) >= 0.8 && (r.score?.safety ?? -1) >= 0.6,
  },
  { key: 'cheap', label: 'Murah vs sektor', test: (r) => (r.score?.value ?? -1) >= 0.8 },
  { key: 'liquid', label: 'Likuid', test: (r) => (r.liq60 ?? 0) >= LIQUID_MIN },
  { key: 'shariah', label: 'Syariah', test: (r) => r.shariah },
]

/** Preset pilih-satu; null = semua emiten. Bawaan: "Punya skor". */
export const DEFAULT_PRESET: PresetKey = 'scored'

// ─── Filter ─────────────────────────────────────────────────────

export type RangeKey = 'per' | 'pbv' | 'roe' | 'divYield'

export const RANGE_FIELDS: { key: RangeKey; label: string; pct: boolean }[] = [
  { key: 'per', label: 'PER', pct: false },
  { key: 'pbv', label: 'PBV', pct: false },
  { key: 'roe', label: 'ROE %', pct: true },
  { key: 'divYield', label: 'Yield %', pct: true },
]

/** Input user (string, persen untuk field pct). Kosong = tanpa batas. */
export type Ranges = Record<RangeKey, { min: string; max: string }>

export const EMPTY_RANGES: Ranges = {
  per: { min: '', max: '' },
  pbv: { min: '', max: '' },
  roe: { min: '', max: '' },
  divYield: { min: '', max: '' },
}

export interface FilterState {
  preset: PresetKey | null
  sectors: ReadonlySet<string>
  search: string
  ranges: Ranges
}

function parseBound(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export function activeRangeCount(ranges: Ranges): number {
  return RANGE_FIELDS.filter(
    ({ key }) => parseBound(ranges[key].min) !== null || parseBound(ranges[key].max) !== null,
  ).length
}

/** Satu preset, sektor di-OR, pencarian ticker/nama, rentang inklusif. */
export function filterRows(rows: readonly ScreenerRow[], f: FilterState): ScreenerRow[] {
  const q = f.search.trim().toLowerCase()
  const preset = PRESETS.find((p) => p.key === f.preset)
  const bounds = RANGE_FIELDS.map(({ key, pct }) => ({
    key,
    pct,
    lo: parseBound(f.ranges[key].min),
    hi: parseBound(f.ranges[key].max),
  })).filter((b) => b.lo !== null || b.hi !== null)

  return rows.filter((r) => {
    if (q && !r.ticker.toLowerCase().includes(q) && !r.name.toLowerCase().includes(q)) return false
    if (f.sectors.size > 0 && (!r.sector || !f.sectors.has(r.sector))) return false
    if (preset && !preset.test(r)) return false
    for (const b of bounds) {
      const raw = r[b.key]
      if (raw === null || raw === undefined) return false // batas aktif, metrik kosong → keluar
      const v = b.pct ? raw * 100 : raw
      if (b.lo !== null && v < b.lo) return false
      if (b.hi !== null && v > b.hi) return false
    }
    return true
  })
}

/** Jumlah hasil per preset (null = semua) dengan filter lain tetap berlaku. */
export function presetCounts(rows: readonly ScreenerRow[], f: FilterState): Map<PresetKey | null, number> {
  const base = filterRows(rows, { ...f, preset: null })
  const out = new Map<PresetKey | null, number>([[null, base.length]])
  for (const p of PRESETS) out.set(p.key, base.filter(p.test).length)
  return out
}

/** Jumlah emiten per sektor di bawah preset/pencarian/rentang aktif. */
export function sectorCounts(rows: readonly ScreenerRow[], f: FilterState): Map<string, number> {
  const out = new Map<string, number>()
  for (const r of filterRows(rows, { ...f, sectors: new Set() })) {
    if (r.sector) out.set(r.sector, (out.get(r.sector) ?? 0) + 1)
  }
  return out
}

// ─── Kolom & sort ───────────────────────────────────────────────

export type ColKey =
  | 'ticker' | 'sector' | 'price' | 'chg1y' | 'mcap' | 'composite'
  | 'per' | 'pbv' | 'evEbitda' | 'divYield' | 'fairBase' | 'gap'
  | 'value' | 'prof' | 'safety' | 'roe'
  | 'liq60' | 'mrs' | 'up' | 'eqFlag' | 'specialBoard' | 'shariah'

export type ColumnSet = 'ringkas' | 'valuasi' | 'kualitas' | 'risiko'

/** Skor gabungan ada di setiap set, tepat setelah emiten — fokus baca. */
export const COLUMN_SETS: { key: ColumnSet; label: string; cols: ColKey[] }[] = [
  { key: 'ringkas', label: 'Ringkas', cols: ['ticker', 'composite', 'price', 'chg1y', 'mcap', 'sector'] },
  { key: 'valuasi', label: 'Valuasi', cols: ['ticker', 'composite', 'per', 'pbv', 'evEbitda', 'divYield', 'fairBase', 'gap'] },
  { key: 'kualitas', label: 'Kualitas', cols: ['ticker', 'composite', 'value', 'prof', 'safety', 'roe'] },
  { key: 'risiko', label: 'Risiko', cols: ['ticker', 'composite', 'liq60', 'mrs', 'up', 'eqFlag', 'specialBoard', 'shariah'] },
]

/** Nilai wajar dasar hanya dipakai bila valuasi andal — selain itu kosong. */
export function reliableValuation(r: ScreenerRow): ScreenerValuation | null {
  return r.valuation?.status === 'reliable' ? r.valuation : null
}

export function sortValue(r: ScreenerRow, key: ColKey): number | string | null {
  switch (key) {
    case 'ticker': return r.ticker
    case 'sector': return r.sector
    case 'composite': return r.score?.composite ?? null
    case 'value': return r.score?.value ?? null
    case 'prof': return r.score?.prof ?? null
    case 'safety': return r.score?.safety ?? null
    case 'fairBase': return reliableValuation(r)?.base ?? null
    case 'gap': return reliableValuation(r)?.gap ?? null
    case 'mrs': return r.flags?.mrs ?? null
    case 'up': return r.flags?.up ?? null
    case 'eqFlag': return r.flags ? Number(r.flags.eqFlag) : null
    case 'specialBoard': return Number(r.specialBoard)
    case 'shariah': return Number(r.shariah)
    default: return r[key] ?? null
  }
}

export type SortDir = 'asc' | 'desc'

/** Stabil; null selalu di bawah apa pun arahnya; seri dipecah ticker A–Z. */
export function sortRows(rows: readonly ScreenerRow[], key: ColKey, dir: SortDir): ScreenerRow[] {
  const mul = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const va = sortValue(a, key)
    const vb = sortValue(b, key)
    if (va === null && vb === null) return a.ticker.localeCompare(b.ticker)
    if (va === null) return 1
    if (vb === null) return -1
    const c = typeof va === 'string' && typeof vb === 'string'
      ? va.localeCompare(vb)
      : (va as number) - (vb as number)
    return c !== 0 ? c * mul : a.ticker.localeCompare(b.ticker)
  })
}

/** Arah awal saat header diklik: teks A–Z, angka terbesar dulu. */
export function defaultDir(key: ColKey): SortDir {
  return key === 'ticker' || key === 'sector' ? 'asc' : 'desc'
}

// ─── Format ─────────────────────────────────────────────────────

export const EMPTY = '–'

const ID_0 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })
const ID_1 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const ID_2 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function isNum(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Minus tipografis (U+2212) seperti formatter invest lain. */
function signed(s: string, neg: boolean): string {
  return neg ? `−${s}` : s
}

export function fmtPrice(v: number | null | undefined): string {
  return isNum(v) ? signed(ID_0.format(Math.abs(v)), v < 0) : EMPTY
}

/** Rasio dengan batas tampil: > cap → "> cap", negatif → "< 0". */
export function fmtRatio(v: number | null | undefined, cap = 100): string {
  if (!isNum(v)) return EMPTY
  if (v > cap) return `> ${ID_0.format(cap)}`
  if (v < 0) return '< 0'
  return ID_1.format(v)
}

/** Fraksi → persen 1 desimal; dibatasi ±cap (fraksi). */
export function fmtPct(v: number | null | undefined, cap = 10): string {
  if (!isNum(v)) return EMPTY
  if (v > cap) return `> ${ID_0.format(cap * 100)}%`
  if (v < -cap) return `< −${ID_0.format(cap * 100)}%`
  return `${signed(ID_1.format(Math.abs(v * 100)), v < 0)}%`
}

/** Persentil 0–1 → bilangan bulat 0–100. */
export function fmtPctile(v: number | null | undefined): string {
  return isNum(v) ? ID_0.format(Math.round(v * 100)) : EMPTY
}

export function isHighPctile(v: number | null | undefined): boolean {
  return isNum(v) && v >= HIGH_PCTILE
}

/** Rupiah ringkas: T / M / Jt. */
export function fmtIdrCompact(v: number | null | undefined): string {
  if (!isNum(v)) return EMPTY
  const a = Math.abs(v)
  const out =
    a >= 1e12 ? `${ID_2.format(a / 1e12)} T`
      : a >= 1e9 ? `${ID_2.format(a / 1e9)} M`
        : a >= 1e6 ? `${ID_2.format(a / 1e6)} Jt`
          : ID_0.format(a)
  return signed(out, v < 0)
}

const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/** '2026-10-16' → '16 Okt 2026'. Input tak valid dikembalikan apa adanya. */
export function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return EMPTY
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const mo = Number(m[2]) - 1
  if (mo < 0 || mo > 11) return iso
  return `${Number(m[3])} ${BULAN_PENDEK[mo]} ${m[1]}`
}

/** Penanda risiko → daftar teks pendek untuk panel samping. */
export function riskNotes(r: ScreenerRow): string[] {
  const out: string[] = []
  const f = r.flags
  if (f?.mrs != null && f.mrs >= 1) out.push(`Skor manipulasi (MRS) ${f.mrs} dari 3`)
  if (f?.up != null && f.up >= 1) out.push(`Skor ketidakpastian (UP) ${f.up} dari 4`)
  if (f?.eqFlag) out.push('Kualitas laba perlu dicek')
  if (f?.hsc) out.push('Kepemilikan sangat terkonsentrasi')
  if (r.specialBoard) out.push('Papan pemantauan khusus')
  if (r.liq60 != null && r.liq60 < 1e9) out.push('Likuiditas harian di bawah Rp1 M')
  return out
}
