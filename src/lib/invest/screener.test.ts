import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PRESET,
  EMPTY_RANGES,
  activeRangeCount,
  filterRows,
  fmtDateShort,
  fmtIdrCompact,
  fmtPct,
  fmtPctile,
  fmtPrice,
  fmtRatio,
  isHighPctile,
  presetCounts,
  sectorCounts,
  riskNotes,
  sortRows,
  type FilterState,
  type ScreenerRow,
} from './screener'

function row(p: Partial<ScreenerRow> & { ticker: string }): ScreenerRow {
  return {
    name: `${p.ticker} Tbk.`,
    sector: 'Energi',
    subSector: null,
    shariah: false,
    price: 1000,
    mcap: 1e12,
    liq60: 5e9,
    chg1y: 0,
    per: 10,
    pbv: 1,
    evEbitda: 5,
    roe: 0.1,
    divYield: 0.03,
    specialBoard: false,
    hasScore: false,
    score: null,
    valuation: null,
    flags: null,
    modelClass: null,
    ...p,
  }
}

const scored = (ticker: string, s: Partial<NonNullable<ScreenerRow['score']>>, extra: Partial<ScreenerRow> = {}) =>
  row({
    ticker,
    hasScore: true,
    score: { composite: 0.5, value: 0.5, prof: 0.5, safety: 0.5, ...s },
    ...extra,
  })

function state(p: Partial<FilterState> = {}): FilterState {
  return { preset: null, sectors: new Set(), search: '', ranges: EMPTY_RANGES, ...p }
}

const ROWS: ScreenerRow[] = [
  scored('AAAA', { prof: 0.9, safety: 0.7, value: 0.85 }, { shariah: true, liq60: 20e9 }),
  scored('BBBB', { prof: 0.95, safety: 0.5, value: 0.2 }, { sector: 'Teknologi' }),
  row({ ticker: 'CCCC', name: 'Cahaya Abadi', per: null, liq60: 12e9 }),
  row({ ticker: 'DDDD', per: 150, roe: 0.25, shariah: true }),
]

describe('filterRows — preset', () => {
  it('default "Punya skor" hanya meloloskan baris berskor', () => {
    expect(filterRows(ROWS, state({ preset: DEFAULT_PRESET })).map((r) => r.ticker)).toEqual(['AAAA', 'BBBB'])
  })
  it('Kualitas tinggi = prof ≥ 0,8 DAN safety ≥ 0,6', () => {
    expect(filterRows(ROWS, state({ preset: 'quality' })).map((r) => r.ticker)).toEqual(['AAAA'])
  })
  it('Murah vs sektor = value ≥ 0,8', () => {
    expect(filterRows(ROWS, state({ preset: 'cheap' })).map((r) => r.ticker)).toEqual(['AAAA'])
  })
  it('Likuid = liq60 ≥ Rp10 M; Syariah; null = semua', () => {
    expect(filterRows(ROWS, state({ preset: 'liquid' })).map((r) => r.ticker)).toEqual(['AAAA', 'CCCC'])
    expect(filterRows(ROWS, state({ preset: 'shariah' })).map((r) => r.ticker)).toEqual(['AAAA', 'DDDD'])
    expect(filterRows(ROWS, state({ preset: null }))).toHaveLength(4)
  })
  it('presetCounts menghitung tiap preset dengan filter lain tetap berlaku', () => {
    const c = presetCounts(ROWS, state({ preset: 'quality', search: 'a' }))
    expect(c.get(null)).toBe(2) // AAAA + CCCC (nama "Cahaya")
    expect(c.get('scored')).toBe(1)
    expect(c.get('liquid')).toBe(2)
    expect(c.get('shariah')).toBe(1)
  })
  it('sectorCounts mengabaikan pilihan sektor sendiri', () => {
    const c = sectorCounts(ROWS, state({ sectors: new Set(['Teknologi']) }))
    expect(c.get('Energi')).toBe(3)
    expect(c.get('Teknologi')).toBe(1)
  })
})

describe('filterRows — sektor, pencarian, rentang', () => {
  it('sektor OR, pencarian ticker/nama tak peka huruf', () => {
    expect(filterRows(ROWS, state({ sectors: new Set(['Teknologi']) })).map((r) => r.ticker)).toEqual(['BBBB'])
    expect(filterRows(ROWS, state({ search: 'cahaya' })).map((r) => r.ticker)).toEqual(['CCCC'])
    expect(filterRows(ROWS, state({ search: ' dd ' })).map((r) => r.ticker)).toEqual(['DDDD'])
  })
  it('rentang PER membuang metrik kosong; persen diinput sebagai persen', () => {
    const ranges = { ...EMPTY_RANGES, per: { min: '', max: '100' } }
    expect(filterRows(ROWS, state({ ranges })).map((r) => r.ticker)).toEqual(['AAAA', 'BBBB'])
    const roe = { ...EMPTY_RANGES, roe: { min: '20', max: '' } }
    expect(filterRows(ROWS, state({ ranges: roe })).map((r) => r.ticker)).toEqual(['DDDD'])
  })
  it('batas tak valid diabaikan; koma desimal diterima', () => {
    expect(filterRows(ROWS, state({ ranges: { ...EMPTY_RANGES, pbv: { min: 'abc', max: '' } } }))).toHaveLength(4)
    expect(filterRows(ROWS, state({ ranges: { ...EMPTY_RANGES, divYield: { min: '2,5', max: '3,5' } } }))).toHaveLength(4)
    expect(activeRangeCount({ ...EMPTY_RANGES, per: { min: '1', max: '' }, pbv: { min: 'x', max: '' } })).toBe(1)
  })
})

describe('sortRows', () => {
  it('angka desc, null selalu di bawah', () => {
    expect(sortRows(ROWS, 'per', 'desc').map((r) => r.ticker)).toEqual(['DDDD', 'AAAA', 'BBBB', 'CCCC'])
    expect(sortRows(ROWS, 'per', 'asc').map((r) => r.ticker)).toEqual(['AAAA', 'BBBB', 'DDDD', 'CCCC'])
  })
  it('skor bersarang + seri dipecah ticker', () => {
    expect(sortRows(ROWS, 'composite', 'desc').map((r) => r.ticker)).toEqual(['AAAA', 'BBBB', 'CCCC', 'DDDD'])
    expect(sortRows(ROWS, 'prof', 'desc').map((r) => r.ticker)).toEqual(['BBBB', 'AAAA', 'CCCC', 'DDDD'])
  })
  it('nilai wajar dasar hanya dari valuasi andal', () => {
    const rows = [
      row({ ticker: 'X', valuation: { status: 'unreliable', base: 9999, gap: 5 } }),
      row({ ticker: 'Y', valuation: { status: 'reliable', base: 500, gap: -0.5 } }),
    ]
    expect(sortRows(rows, 'fairBase', 'desc').map((r) => r.ticker)).toEqual(['Y', 'X'])
    expect(sortRows(rows, 'gap', 'asc').map((r) => r.ticker)).toEqual(['Y', 'X'])
  })
  it('tidak memutasi input', () => {
    const before = ROWS.map((r) => r.ticker)
    sortRows(ROWS, 'ticker', 'desc')
    expect(ROWS.map((r) => r.ticker)).toEqual(before)
  })
})

describe('format', () => {
  it('kosong → "–"', () => {
    for (const f of [fmtPrice, fmtRatio, fmtPct, fmtPctile, fmtIdrCompact]) {
      expect(f(null)).toBe('–')
      expect(f(NaN)).toBe('–')
    }
    expect(fmtDateShort(null)).toBe('–')
  })
  it('rasio dibatasi: > 100 dan negatif', () => {
    expect(fmtRatio(12.345)).toBe('12,3')
    expect(fmtRatio(16096)).toBe('> 100')
    expect(fmtRatio(-3)).toBe('< 0')
  })
  it('persen 1 desimal, minus tipografis, dibatasi ±1.000%', () => {
    expect(fmtPct(0.1441)).toBe('14,4%')
    expect(fmtPct(-0.0758)).toBe('−7,6%')
    expect(fmtPct(13.88)).toBe('> 1.000%')
    expect(fmtPct(-20)).toBe('< −1.000%')
  })
  it('persentil, harga, rupiah ringkas', () => {
    expect(fmtPctile(0.8602)).toBe('86')
    expect(isHighPctile(0.8)).toBe(true)
    expect(isHighPctile(0.79)).toBe(false)
    expect(isHighPctile(null)).toBe(false)
    expect(fmtPrice(12500)).toBe('12.500')
    expect(fmtIdrCompact(8729553875200)).toBe('8,73 T')
    expect(fmtIdrCompact(13300467000)).toBe('13,30 M')
  })
  it('tanggal pendek Indonesia', () => {
    expect(fmtDateShort('2026-10-16')).toBe('16 Okt 2026')
    expect(fmtDateShort('2026-09-30')).toBe('30 Sep 2026')
    expect(fmtDateShort('kemarin')).toBe('kemarin')
  })
})

describe('riskNotes', () => {
  it('hanya penanda aktif yang ditulis', () => {
    expect(riskNotes(row({ ticker: 'A', liq60: 5e9 }))).toEqual([])
    const notes = riskNotes(
      row({ ticker: 'B', specialBoard: true, liq60: 1e8, flags: { mrs: 2, up: 0, eqFlag: true, hsc: false } }),
    )
    expect(notes).toEqual([
      'Skor manipulasi (MRS) 2 dari 3',
      'Kualitas laba perlu dicek',
      'Papan pemantauan khusus',
      'Likuiditas harian di bawah Rp1 M',
    ])
  })
})
