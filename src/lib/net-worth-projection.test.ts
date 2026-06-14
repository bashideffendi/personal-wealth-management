import { describe, it, expect } from 'vitest'
import { projectNetWorth } from './net-worth-projection'
import type { PayoffDebt } from './debt-payoff'

const debt = (o: Partial<PayoffDebt> & { id: string }): PayoffDebt => ({
  name: o.id, remaining: 0, interest_rate: 0, monthly_payment: 0, ...o,
})

describe('projectNetWorth', () => {
  it('tanpa utang → net worth = total aset, 0 bulan', () => {
    const r = projectNetWorth(50_000_000, [], 'avalanche')
    expect(r.startNetWorth).toBe(50_000_000)
    expect(r.endNetWorth).toBe(50_000_000)
    expect(r.months).toBe(0)
    expect(r.points[0]).toEqual({ month: 0, debt: 0, netWorth: 50_000_000 })
  })

  it('titik awal: net worth = aset − total utang', () => {
    const debts = [debt({ id: 'a', remaining: 20_000_000, interest_rate: 0, monthly_payment: 2_000_000 })]
    const r = projectNetWorth(50_000_000, debts, 'avalanche')
    expect(r.points[0]).toEqual({ month: 0, debt: 20_000_000, netWorth: 30_000_000 })
    expect(r.startNetWorth).toBe(30_000_000)
  })

  it('saat bebas utang: net worth = total aset (endNetWorth)', () => {
    const debts = [debt({ id: 'a', remaining: 12_000_000, interest_rate: 0, monthly_payment: 1_000_000 })]
    const r = projectNetWorth(80_000_000, debts, 'avalanche')
    expect(r.endNetWorth).toBe(80_000_000)
    expect(r.feasible).toBe(true)
    // titik terakhir mendekati total aset (utang ~0)
    const last = r.points[r.points.length - 1]
    expect(last.netWorth).toBeCloseTo(80_000_000, 0)
    expect(last.debt).toBeLessThan(0.02)
  })

  it('net worth naik seiring utang turun (monoton non-turun)', () => {
    const debts = [debt({ id: 'a', remaining: 10_000_000, interest_rate: 0, monthly_payment: 1_000_000 })]
    const r = projectNetWorth(40_000_000, debts, 'snowball')
    for (let i = 1; i < r.points.length; i++) {
      expect(r.points[i].netWorth).toBeGreaterThanOrEqual(r.points[i - 1].netWorth - 0.01)
    }
  })

  it('infeasible diteruskan dari simulatePayoff', () => {
    const debts = [debt({ id: 'a', remaining: 1_000_000, interest_rate: 24, monthly_payment: 10_000 })]
    const r = projectNetWorth(5_000_000, debts, 'avalanche')
    expect(r.feasible).toBe(false)
  })
})
