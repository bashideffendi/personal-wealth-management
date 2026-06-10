import { describe, it, expect } from 'vitest'
import {
  computeGoalProbability, mulberry32, seedFromString, monthsUntil,
  categoryToPyramidLayer, suggestedRiskProfile,
} from './goal-probability'

const NO_VOL = { annualReturn: 0, annualStdev: 0 }

describe('computeGoalProbability', () => {
  it('deadline passed: 100 if reached, 0 if not', () => {
    const base = { monthsLeft: 0, monthlyContribution: 0, assumptions: NO_VOL }
    expect(computeGoalProbability({ ...base, current: 10, target: 10 }).probability).toBe(100)
    expect(computeGoalProbability({ ...base, current: 9, target: 10 }).probability).toBe(0)
  })

  it('already at target → 100 without simulating', () => {
    const r = computeGoalProbability({
      current: 1_000, target: 1_000, monthsLeft: 12, monthlyContribution: 0, assumptions: NO_VOL,
    })
    expect(r.probability).toBe(100)
    expect(r.requiredMonthlyFor90).toBe(0)
  })

  it('zero volatility: sufficient contribution → 100, insufficient → 0', () => {
    const base = { current: 0, target: 12_000, monthsLeft: 12, assumptions: NO_VOL, simulations: 100 }
    expect(computeGoalProbability({ ...base, monthlyContribution: 1_000 }).probability).toBe(100)
    expect(computeGoalProbability({ ...base, monthlyContribution: 100 }).probability).toBe(0)
  })

  it('is deterministic under a seeded RNG (same seed → same result)', () => {
    const input = {
      current: 5_000_000, target: 100_000_000, monthsLeft: 36, monthlyContribution: 2_000_000,
      assumptions: { annualReturn: 0.08, annualStdev: 0.08 }, simulations: 500,
    }
    const a = computeGoalProbability({ ...input, rng: mulberry32(seedFromString('goal-1')) })
    const b = computeGoalProbability({ ...input, rng: mulberry32(seedFromString('goal-1')) })
    expect(a.probability).toBe(b.probability)
    expect(a.medianFinal).toBe(b.medianFinal)
    expect(a.requiredMonthlyFor90).toBe(b.requiredMonthlyFor90)
  })

  it('probability tidak turun saat setoran naik (seeded)', () => {
    const mk = (contribution: number) =>
      computeGoalProbability({
        current: 0, target: 50_000_000, monthsLeft: 24, monthlyContribution: contribution,
        assumptions: { annualReturn: 0.05, annualStdev: 0.05 }, simulations: 500,
        rng: mulberry32(42),
      }).probability
    expect(mk(2_500_000)).toBeGreaterThanOrEqual(mk(1_000_000))
  })

  it('percentiles are ordered: p10 ≤ median ≤ p90', () => {
    const r = computeGoalProbability({
      current: 10_000_000, target: 50_000_000, monthsLeft: 24, monthlyContribution: 1_000_000,
      assumptions: { annualReturn: 0.08, annualStdev: 0.15 }, simulations: 500,
      rng: mulberry32(7),
    })
    expect(r.p10Final).toBeLessThanOrEqual(r.medianFinal)
    expect(r.medianFinal).toBeLessThanOrEqual(r.p90Final)
  })
})

describe('monthsUntil (day-aware)', () => {
  const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10)

  it('null deadline → null', () => {
    expect(monthsUntil(null)).toBeNull()
  })

  it('passed deadline → 0 (bukan negatif)', () => {
    expect(monthsUntil(daysFromNow(-40))).toBe(0)
  })

  it('deadline akhir bulan ini ≈ 20 hari lagi → 1 bulan, BUKAN 0', () => {
    // Regresi: diff kalender bulan dulu bikin iuran & probabilitas hilang
    // padahal masih ada hitungan minggu.
    expect(monthsUntil(daysFromNow(20))).toBe(1)
  })

  it('≈45 hari → 2 bulan', () => {
    expect(monthsUntil(daysFromNow(45))).toBe(2)
  })

  it('tanggal invalid → null', () => {
    expect(monthsUntil('bukan-tanggal')).toBeNull()
  })
})

describe('categoryToPyramidLayer (kategori × horizon)', () => {
  it('dana darurat selalu fondasi, horizon berapa pun', () => {
    expect(categoryToPyramidLayer('emergency', 1)).toBe('pelindung')
    expect(categoryToPyramidLayer('emergency', 240)).toBe('pelindung')
  })

  it('keinginan (travel/gadget/business) selalu Ambisi', () => {
    expect(categoryToPyramidLayer('travel', 6)).toBe('mimpi')
    expect(categoryToPyramidLayer('gadget', 120)).toBe('mimpi')
    expect(categoryToPyramidLayer('business', null)).toBe('mimpi')
  })

  it('kebutuhan inti ikut horizon: ≤24 bln aman, lebih → bertumbuh', () => {
    // Regresi: dana pendidikan 15 tahun dulu nangkring di tier Aman dan
    // piramida nyuruh prioritasin dia di atas goal yang due tahun depan.
    expect(categoryToPyramidLayer('education', 180)).toBe('pertumbuhan')
    expect(categoryToPyramidLayer('education', 12)).toBe('pelindung')
    expect(categoryToPyramidLayer('property', 24)).toBe('pelindung')
    expect(categoryToPyramidLayer('property', 25)).toBe('pertumbuhan')
    expect(categoryToPyramidLayer('retirement', 300)).toBe('pertumbuhan')
  })

  it('tanpa deadline → bertumbuh (kecuali aturan di atas)', () => {
    expect(categoryToPyramidLayer('other', null)).toBe('pertumbuhan')
    expect(categoryToPyramidLayer('other', undefined)).toBe('pertumbuhan')
  })
})

describe('suggestedRiskProfile', () => {
  it('horizon pendek selalu konservatif', () => {
    expect(suggestedRiskProfile('retirement', 12)).toBe('conservative')
    expect(suggestedRiskProfile('business', 24)).toBe('conservative')
  })

  it('horizon panjang: growth-oriented agresif, lainnya moderat', () => {
    expect(suggestedRiskProfile('retirement', 150)).toBe('aggressive')
    expect(suggestedRiskProfile('property', 150)).toBe('moderate')
  })

  it('horizon menengah ikut tipe goal', () => {
    expect(suggestedRiskProfile('travel', 60)).toBe('conservative')
    expect(suggestedRiskProfile('business', 60)).toBe('aggressive')
    expect(suggestedRiskProfile('property', 60)).toBe('moderate')
  })
})

describe('seeded RNG', () => {
  it('mulberry32: deterministik + range [0,1)', () => {
    const a = mulberry32(123)
    const b = mulberry32(123)
    for (let i = 0; i < 100; i++) {
      const va = a()
      expect(va).toBe(b())
      expect(va).toBeGreaterThanOrEqual(0)
      expect(va).toBeLessThan(1)
    }
  })

  it('seedFromString: stabil + beda string beda seed', () => {
    expect(seedFromString('abc')).toBe(seedFromString('abc'))
    expect(seedFromString('abc')).not.toBe(seedFromString('abd'))
  })
})
