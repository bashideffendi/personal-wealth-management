import { describe, it, expect } from 'vitest'
import {
  canonicalYear,
  computeTTM,
  grahamNumber,
  ddm,
  epv,
  nav,
  peg,
  relativePER,
  relativePBV,
  relativePS,
  relativeEvEbit,
  computeAllSectorMedians,
  valuationVerdict,
  ASSUMPTIONS,
  type SectorMedians,
} from './valuation'
import type { Stock } from './stocks'

type Metrics = Record<string, Record<string, number>>

function mkStock(metrics: Metrics, opts: { sector?: string | null; price?: number | null } = {}): Stock {
  return {
    ticker: 'TEST', name: 'Test', type: null, listingDate: null, board: null,
    sector: opts.sector ?? 'Tech', currentPrice: opts.price ?? null, metrics,
  } as unknown as Stock
}

const NO_MEDIANS: SectorMedians = { per: null, pbv: null, evEbit: null, ps: null, sampleSize: 0 }

describe('canonicalYear — tahun lengkap terakhir (Revenue & Net Profit non-zero)', () => {
  it('ambil tahun terbaru di mana keduanya ada & bukan 0', () => {
    const s = mkStock({
      Revenue: { '2023': 100, '2024': 200, '2025': 0 },
      'Net Profit': { '2023': 10, '2024': 20, '2025': 0 },
    })
    expect(canonicalYear(s)).toBe(2024) // 2025 punya Revenue 0 → di-skip
  })
  it('tidak ada tahun yang lengkap → null', () => {
    const s = mkStock({ Revenue: { '2024': 100 }, 'Net Profit': { '2024': 0 } })
    expect(canonicalYear(s)).toBeNull()
  })
  it('metrik Revenue/Net Profit hilang → null', () => {
    expect(canonicalYear(mkStock({ EPS: { '2024': 5 } }))).toBeNull()
  })
})

describe('computeTTM — jumlah 4 kuartal terbaru', () => {
  it('4 kuartal pas → sum + end/start period benar', () => {
    const r = computeTTM({ '2025-Q1': 10, '2025-Q2': 20, '2025-Q3': 30, '2025-Q4': 40 })
    expect(r).toEqual({ value: 100, endPeriod: '2025-Q4', startPeriod: '2025-Q1' })
  })
  it('lebih dari 4 → ambil 4 terbaru saja', () => {
    const r = computeTTM({ '2024-Q4': 5, '2025-Q1': 10, '2025-Q2': 20, '2025-Q3': 30, '2025-Q4': 40 })
    expect(r?.value).toBe(100) // 2024-Q4 dibuang
    expect(r?.endPeriod).toBe('2025-Q4')
    expect(r?.startPeriod).toBe('2025-Q1')
  })
  it('kurang dari 4 kuartal non-zero → null', () => {
    expect(computeTTM({ '2025-Q1': 10, '2025-Q2': 0, '2025-Q3': 30 })).toBeNull()
  })
  it('undefined → null', () => {
    expect(computeTTM(undefined)).toBeNull()
  })
})

describe('grahamNumber — √(22.5 × EPS × BVPS)', () => {
  it('EPS 2 × BVPS 80 → 60 (22.5×2×80 = 3600)', () => {
    const s = mkStock({ EPS: { '2024': 2 }, BVPS: { '2024': 80 } })
    expect(grahamNumber(s, 2024)).toBe(60)
  })
  it('EPS ≤ 0 → null', () => {
    expect(grahamNumber(mkStock({ EPS: { '2024': -5 }, BVPS: { '2024': 80 } }), 2024)).toBeNull()
  })
})

describe('ddm — Gordon growth dari DPS', () => {
  it('DPS 100, hanya satu tahun (growth=0) → DPS / cost of equity', () => {
    const s = mkStock({ Dividend: { '2024': 100 } })
    expect(ddm(s, 2024)).toBeCloseTo(100 / ASSUMPTIONS.costOfEquity, 4) // 727.27
  })
  it('DPS tidak ada / ≤ 0 → null', () => {
    expect(ddm(mkStock({ Dividend: { '2024': 0 } }), 2024)).toBeNull()
    expect(ddm(mkStock({}), 2024)).toBeNull()
  })
  it('year null → null', () => {
    expect(ddm(mkStock({ Dividend: { '2024': 100 } }), null)).toBeNull()
  })
})

describe('epv — 5y avg Net Profit / r, per share', () => {
  it('NP 1.375jt, 10.000 lembar → 1000', () => {
    const s = mkStock({ 'Net Profit': { '2024': 1_375_000 }, 'Jumlah Saham': { '2024': 10_000 } })
    expect(epv(s, 2024)).toBeCloseTo(1000, 6) // 1.375.000/10.000/0,1375
  })
  it('tanpa jumlah saham → null', () => {
    expect(epv(mkStock({ 'Net Profit': { '2024': 1_000_000 } }), 2024)).toBeNull()
  })
})

describe('nav — BVPS passthrough', () => {
  it('kembalikan BVPS di tahun anchor', () => {
    expect(nav(mkStock({ BVPS: { '2024': 1500 } }), 2024)).toBe(1500)
  })
})

describe('peg — EPS × growth% (Peter Lynch), capped 5-25', () => {
  it('EPS 110 dgn growth 10% → 1100', () => {
    const s = mkStock({
      EPS: { '2023': 100, '2024': 110 },
      Revenue: { '2024': 1 }, 'Net Profit': { '2024': 1 },
    })
    expect(peg(s, 2024)).toBeCloseTo(1100, 6)
  })
  it('growth ekstrem di-cap 25%', () => {
    const s = mkStock({ EPS: { '2023': 100, '2024': 300 } })
    expect(peg(s, 2024)).toBeCloseTo(300 * 25, 6) // 7500
  })
  it('growth ≤ 0 → null', () => {
    const s = mkStock({ EPS: { '2023': 200, '2024': 100 }, 'Net Profit': { '2023': 50, '2024': 50 } })
    expect(peg(s, 2024)).toBeNull()
  })
})

describe('metode relatif (median sektor)', () => {
  const med: SectorMedians = { per: 15, pbv: 2, evEbit: 10, ps: 3, sampleSize: 5 }
  it('relativePER = EPS × median PER', () => {
    expect(relativePER(mkStock({ EPS: { '2024': 100 } }), 2024, med)).toBe(1500)
  })
  it('relativePBV = BVPS × median PBV', () => {
    expect(relativePBV(mkStock({ BVPS: { '2024': 1000 } }), 2024, med)).toBe(2000)
  })
  it('relativePS = (Revenue/saham) × median P/S', () => {
    const s = mkStock({ Revenue: { '2024': 1_000_000 }, 'Jumlah Saham': { '2024': 10_000 } })
    expect(relativePS(s, 2024, med)).toBe(300) // 100 × 3
  })
  it('relativeEvEbit = (EBIT × mult − net debt) / saham', () => {
    const s = mkStock({
      EBIT: { '2024': 1_000_000 }, 'Jumlah Saham': { '2024': 10_000 },
      'Net Debt': { '2024': 2_000_000 },
    })
    expect(relativeEvEbit(s, 2024, med)).toBe(800) // (10jt − 2jt)/10.000
  })
  it('median sektor null → metode relatif null', () => {
    expect(relativePER(mkStock({ EPS: { '2024': 100 } }), 2024, NO_MEDIANS)).toBeNull()
  })
})

describe('computeAllSectorMedians — median PER per sektor', () => {
  const bankStock = (pe: number) =>
    mkStock(
      { 'PE Ratio': { '2024': pe }, Revenue: { '2024': 100 }, 'Net Profit': { '2024': 10 } },
      { sector: 'Bank' },
    )
  it('jumlah ganjil → nilai tengah', () => {
    const m = computeAllSectorMedians([bankStock(10), bankStock(20), bankStock(30)])
    expect(m.Bank.per).toBe(20)
    expect(m.Bank.sampleSize).toBe(3)
  })
  it('jumlah genap → rata-rata dua tengah', () => {
    const m = computeAllSectorMedians([bankStock(10), bankStock(20)])
    expect(m.Bank.per).toBe(15)
  })
  it('PER outlier (≥100) dibuang dari median', () => {
    const m = computeAllSectorMedians([bankStock(10), bankStock(20), bankStock(150)])
    expect(m.Bank.per).toBe(15) // [10,20] saja
    expect(m.Bank.sampleSize).toBe(2)
  })
})

describe('valuationVerdict — bucket dari MoS', () => {
  it('null → INSUFFICIENT DATA', () => {
    expect(valuationVerdict(null)).toBe('INSUFFICIENT DATA')
  })
  it('bucket sesuai ambang', () => {
    expect(valuationVerdict(0.6)).toBe('HIGHLY UNDERVALUED')
    expect(valuationVerdict(0.3)).toBe('UNDERVALUED')
    expect(valuationVerdict(0)).toBe('FAIR VALUE')
    expect(valuationVerdict(-0.3)).toBe('OVERVALUED')
    expect(valuationVerdict(-0.6)).toBe('HIGHLY OVERVALUED')
  })
})
