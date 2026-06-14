import { describe, it, expect } from 'vitest'
import { computeFinancialHealth, type FHSInput } from './financial-health'

const base: FHSInput = {
  monthlyIncome: 0, monthlyExpense: 0, monthlySaved: 0,
  liquidBalance: 0, investmentValue: 0,
  totalDebt: 0, monthlyDebtPayments: 0, hasOverdueDebt: false,
  insuranceCount: 0, activeGoals: [],
}
const inp = (o: Partial<FHSInput>): FHSInput => ({ ...base, ...o })

describe('computeFinancialHealth — invariants', () => {
  it('selalu 7 indikator, bobot total = 1.0', () => {
    const r = computeFinancialHealth(base)
    expect(r.breakdown).toHaveLength(7)
    const totalWeight = r.breakdown.reduce((s, i) => s + i.weight, 0)
    expect(totalWeight).toBeCloseTo(1.0, 5)
  })
  it('skor selalu 0-100', () => {
    const r = computeFinancialHealth(inp({ monthlyIncome: 10_000_000, monthlyExpense: 8_000_000 }))
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(100)
  })
})

describe('computeFinancialHealth — arketipe (skor exact)', () => {
  it('user kosong (gak ada data) → 40 / coping (debt-status 100 no-debt nahan)', () => {
    const r = computeFinancialHealth(base)
    expect(r.score).toBe(40)
    expect(r.tier).toBe('coping')
  })

  it('user prima (semua optimal) → 100 / thriving', () => {
    const r = computeFinancialHealth(inp({
      monthlyIncome: 10_000_000, monthlyExpense: 5_000_000, monthlySaved: 3_000_000, // rate 30% → 100
      liquidBalance: 30_000_000, // 6× expense → 100
      investmentValue: 360_000_000, // 3× annual income (target default 3×) → 100
      totalDebt: 0, insuranceCount: 2,
      activeGoals: [{ current: 100, target: 100, deadline: null }], // 100% → 100
    }))
    expect(r.score).toBe(100)
    expect(r.tier).toBe('thriving')
  })

  it('user rentan (semua buruk + utang macet) → 7 / vulnerable', () => {
    const r = computeFinancialHealth(inp({
      monthlyIncome: 10_000_000, monthlyExpense: 9_000_000, monthlySaved: 0,
      liquidBalance: 0, investmentValue: 0,
      totalDebt: 50_000_000, monthlyDebtPayments: 5_000_000, hasOverdueDebt: true, // dti 50% →10, status →0
      insuranceCount: 0, activeGoals: [],
    }))
    expect(r.score).toBe(7)
    expect(r.tier).toBe('vulnerable')
  })
})

describe('computeFinancialHealth — N/A exclusion (data tipis gak dihukum)', () => {
  it('tanpa income → savings/dti/long-term jadi N/A, effectiveWeight turun', () => {
    const r = computeFinancialHealth(inp({ monthlyExpense: 5_000_000, insuranceCount: 1 }))
    const na = r.breakdown.filter((i) => i.status === 'na').map((i) => i.key).sort()
    expect(na).toEqual(['dti', 'long-term-savings', 'savings-rate'])
    // tersisa: liquid-buffer .20 + debt-status .10 + insurance .10 + goal .20 = .60
    expect(r.effectiveWeight).toBeCloseTo(0.6, 5)
  })
  it('indikator N/A score = -1 dan weighted = 0', () => {
    const r = computeFinancialHealth(base) // no income → savings N/A
    const savings = r.breakdown.find((i) => i.key === 'savings-rate')!
    expect(savings.status).toBe('na')
    expect(savings.score).toBe(-1)
    expect(savings.weighted).toBe(0)
  })
})

describe('computeFinancialHealth — tier threshold', () => {
  it('tierMeta konsisten dengan tier', () => {
    expect(computeFinancialHealth(base).tierMeta.label).toBe('Bertahan') // coping
  })
  it('no-debt memberi DTI + debt-status 100', () => {
    const r = computeFinancialHealth(inp({ monthlyIncome: 10_000_000, totalDebt: 0 }))
    expect(r.breakdown.find((i) => i.key === 'dti')!.score).toBe(100)
    expect(r.breakdown.find((i) => i.key === 'debt-status')!.score).toBe(100)
  })
})
