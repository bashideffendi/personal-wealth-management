import { describe, it, expect } from 'vitest'
import { simulatePayoff, type PayoffDebt } from './debt-payoff'

const debt = (o: Partial<PayoffDebt> & { id: string }): PayoffDebt => ({
  name: o.id, remaining: 0, interest_rate: 0, monthly_payment: 0, ...o,
})

describe('simulatePayoff', () => {
  it('tanpa utang → 0 bulan, 0 bunga, feasible', () => {
    const r = simulatePayoff([], 'snowball')
    expect(r.months).toBe(0)
    expect(r.totalInterest).toBe(0)
    expect(r.feasible).toBe(true)
  })

  it('utang 0% bunga: payoff = saldo/cicilan persis, bunga 0', () => {
    const r = simulatePayoff([debt({ id: 'a', remaining: 1000, interest_rate: 0, monthly_payment: 100 })], 'snowball')
    expect(r.months).toBe(10)
    expect(r.totalInterest).toBe(0)
    expect(r.perDebt['a']).toBe(10)
    expect(r.feasible).toBe(true)
  })

  it('cicilan < bunga bulanan → tidak akan lunas (MAX_MONTHS, infeasible)', () => {
    // 24%/thn = 2%/bln × Rp1jt = Rp20rb bunga/bln, cicilan cuma Rp10rb → saldo naik
    const r = simulatePayoff([debt({ id: 'a', remaining: 1_000_000, interest_rate: 24, monthly_payment: 10_000 })], 'avalanche')
    expect(r.feasible).toBe(false)
    expect(r.months).toBe(600)
  })

  it('berbunga: total bunga > 0 dan tetap lunas (feasible)', () => {
    const r = simulatePayoff([debt({ id: 'a', remaining: 1_000_000, interest_rate: 12, monthly_payment: 100_000 })], 'avalanche')
    expect(r.feasible).toBe(true)
    expect(r.totalInterest).toBeGreaterThan(0)
    expect(r.perDebt['a']).toBeGreaterThan(0)
  })

  it('snowball (saldo terkecil dulu) ≠ avalanche (bunga tertinggi dulu) di urutan', () => {
    const debts = [
      debt({ id: 'small_lowrate', remaining: 1_000_000, interest_rate: 5, monthly_payment: 50_000 }),
      debt({ id: 'big_highrate', remaining: 5_000_000, interest_rate: 20, monthly_payment: 100_000 }),
    ]
    expect(simulatePayoff(debts, 'snowball').order[0].id).toBe('small_lowrate')
    expect(simulatePayoff(debts, 'avalanche').order[0].id).toBe('big_highrate')
  })

  it('semua utang akhirnya lunas (multi-debt feasible) + rollover bikin lunas', () => {
    const debts = [
      debt({ id: 'a', remaining: 2_000_000, interest_rate: 10, monthly_payment: 200_000 }),
      debt({ id: 'b', remaining: 3_000_000, interest_rate: 18, monthly_payment: 200_000 }),
    ]
    const r = simulatePayoff(debts, 'avalanche')
    expect(r.feasible).toBe(true)
    expect(r.perDebt['a']).toBeGreaterThan(0)
    expect(r.perDebt['b']).toBeGreaterThan(0)
  })

  it('extra payment mempercepat (months ≤ tanpa extra)', () => {
    const debts = [debt({ id: 'a', remaining: 5_000_000, interest_rate: 15, monthly_payment: 300_000 })]
    const withExtra = simulatePayoff(debts, 'avalanche', 500_000).months
    const noExtra = simulatePayoff(debts, 'avalanche', 0).months
    expect(withExtra).toBeLessThanOrEqual(noExtra)
    expect(withExtra).toBeLessThan(noExtra) // extra besar harus benar-benar mempercepat
  })

  it('saldo 0 / negatif di-skip (tidak dihitung)', () => {
    const r = simulatePayoff([
      debt({ id: 'paid', remaining: 0, interest_rate: 20, monthly_payment: 100_000 }),
      debt({ id: 'a', remaining: 1000, interest_rate: 0, monthly_payment: 100 }),
    ], 'snowball')
    expect(r.order.map((o) => o.id)).toEqual(['a'])
    expect(r.months).toBe(10)
  })
})
