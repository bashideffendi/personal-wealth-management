import { describe, it, expect } from 'vitest'
import {
  computePiotroski,
  computeMagicFormulaMetrics,
  rankMagicFormula,
  type MagicFormulaMetrics,
} from './piotroski'
import type { Stock } from './stocks'

type Metrics = Record<string, Record<string, number>>
function mkStock(metrics: Metrics, opts: { ticker?: string; sector?: string | null } = {}): Stock {
  return {
    ticker: opts.ticker ?? 'TEST', name: 'Test', type: null, listingDate: null, board: null,
    sector: opts.sector ?? 'Tech', currentPrice: null, metrics,
  } as unknown as Stock
}

// 2023 (prev) → 2024 (anchor): semua 9 kriteria membaik.
const STRONG = mkStock({
  'Net Profit': { '2023': 50, '2024': 100 }, // +, dan naik
  CFO: { '2024': 150 }, // + dan > NP
  'Total Assets': { '2023': 1000, '2024': 1000 },
  'Liab J Pnjg': { '2023': 300, '2024': 200 }, // LT debt turun
  'Aset Lancar': { '2023': 200, '2024': 300 },
  'Liab J Pndk': { '2023': 200, '2024': 200 }, // CR 1.0 → 1.5
  'Jumlah Saham': { '2023': 1000, '2024': 1000 }, // no dilution (sama)
  Revenue: { '2023': 500, '2024': 600 }, // turnover 0.5 → 0.6
  'Gross Profit': { '2023': 100, '2024': 180 }, // margin 0.2 → 0.3
})

describe('computePiotroski — F-Score', () => {
  it('semua kriteria membaik → skor 9 / Strong', () => {
    const r = computePiotroski(STRONG)
    expect(r.anchorYear).toBe(2024)
    expect(r.score).toBe(9)
    expect(r.maxPossible).toBe(9)
    expect(r.verdict).toBe('Strong')
    expect(r.checks).toHaveLength(9)
  })

  it('cuma data tahun terbaru (tak ada pembanding) → <5 evaluable → Insufficient', () => {
    const r = computePiotroski(mkStock({
      'Net Profit': { '2024': 100 },
      CFO: { '2024': 150 },
      Revenue: { '2024': 600 },
    }))
    // Hanya kriteria current-only yang bisa dinilai: 1 (NP+), 2 (CFO+), 4 (CFO>NP)
    expect(r.maxPossible).toBe(3)
    expect(r.score).toBe(3)
    expect(r.verdict).toBe('Insufficient')
    expect(r.anchorYear).toBe(2024)
  })

  it('kriteria yang tak terhitung → pass null (bukan false)', () => {
    const r = computePiotroski(mkStock({
      'Net Profit': { '2024': 100 }, CFO: { '2024': 150 }, Revenue: { '2024': 600 },
    }))
    const roaCheck = r.checks.find((c) => c.id === 3)! // ROA naik — butuh prev
    expect(roaCheck.pass).toBeNull()
  })
})

describe('computeMagicFormulaMetrics', () => {
  it('earnings yield = EBIT/EV, ROC = EBIT/(NWC+fixed)', () => {
    const s = mkStock({
      EBIT: { '2024': 100 },
      'Aset Lancar': { '2024': 300 },
      'Liab J Pndk': { '2024': 100 }, // NWC = 200
      'Fixed Assets': { '2024': 300 }, // capital = 500
      Revenue: { '2024': 600 }, 'Net Profit': { '2024': 100 }, // buat canonicalYear
    })
    const m = computeMagicFormulaMetrics(s, 1000) // EV = 1000
    expect(m.earningsYield).toBeCloseTo(0.1, 6) // 100/1000
    expect(m.roc).toBeCloseTo(0.2, 6) // 100/500
    expect(m.ebit).toBe(100)
    expect(m.ev).toBe(1000)
  })
})

describe('rankMagicFormula', () => {
  const mk = (ticker: string, ey: number | null, roc: number | null): MagicFormulaMetrics => ({
    ticker, name: ticker, sector: 'Tech', earningsYield: ey, roc, ebit: 1, ev: 1,
  })

  it('combinedRank = rank EY + rank ROC; emiten lemah di kedua metrik = finalRank terburuk', () => {
    const ranked = rankMagicFormula([
      mk('A', 0.1, 0.2), // EY rank 2, ROC rank 1 → combined 3
      mk('B', 0.2, 0.1), // EY rank 1, ROC rank 2 → combined 3
      mk('C', 0.05, 0.05), // EY rank 3, ROC rank 3 → combined 6 (terburuk)
    ])
    expect(ranked).toHaveLength(3)
    const c = ranked.find((m) => m.ticker === 'C')!
    expect(c.combinedRank).toBe(6)
    expect(c.finalRank).toBe(3)
  })

  it('emiten dengan metrik null/≤0 dibuang dari ranking', () => {
    const ranked = rankMagicFormula([
      mk('A', 0.1, 0.2),
      mk('B', null, 0.1), // EY null → tidak eligible
      mk('C', 0.05, -0.01), // ROC negatif → tidak eligible
    ])
    expect(ranked.map((m) => m.ticker)).toEqual(['A'])
  })
})
