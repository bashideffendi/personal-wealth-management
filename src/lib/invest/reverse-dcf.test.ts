import { describe, it, expect } from 'vitest'
import { reverseDCF } from './reverse-dcf'
import { ASSUMPTIONS } from './valuation'

const r = ASSUMPTIONS.costOfEquity
const gt = ASSUMPTIONS.terminalGrowth

// Salinan model forward (5y proyeksi + terminal Gordon) — dipakai buat bikin
// harga target dari growth yang DIKETAHUI, lalu cek solver balik ke growth itu.
function fairValue(fcf: number, g: number, netDebt: number, shares: number): number {
  let pv = 0
  let f = fcf
  for (let t = 1; t <= 5; t++) {
    f = f * (1 + g)
    pv += f / Math.pow(1 + r, t)
  }
  const terminal = (f * (1 + gt)) / (r - gt)
  pv += terminal / Math.pow(1 + r, 5)
  return (pv - netDebt) / shares
}

const FCF = 1_000_000_000
const SHARES = 1_000_000

describe('reverseDCF — round-trip (solver invers model)', () => {
  it('harga dari growth 10% → impliedGrowth ≈ 10%', () => {
    const price = fairValue(FCF, 0.1, 0, SHARES)
    const res = reverseDCF({ currentPrice: price, latestFCF: FCF, shares: SHARES, netDebt: 0 })
    expect(res.convergence).toBe('ok')
    expect(res.impliedGrowth).toBeCloseTo(0.1, 3)
  })

  it('round-trip dengan net debt', () => {
    const netDebt = 200_000_000
    const price = fairValue(FCF, 0.07, netDebt, SHARES)
    const res = reverseDCF({ currentPrice: price, latestFCF: FCF, shares: SHARES, netDebt })
    expect(res.impliedGrowth).toBeCloseTo(0.07, 3)
  })

  it('monoton: harga lebih tinggi → implied growth lebih tinggi', () => {
    const lo = reverseDCF({ currentPrice: fairValue(FCF, 0.05, 0, SHARES), latestFCF: FCF, shares: SHARES, netDebt: 0 })
    const hi = reverseDCF({ currentPrice: fairValue(FCF, 0.2, 0, SHARES), latestFCF: FCF, shares: SHARES, netDebt: 0 })
    expect(hi.impliedGrowth!).toBeGreaterThan(lo.impliedGrowth!)
  })
})

describe('reverseDCF — kasus tak bisa diselesaikan', () => {
  it('FCF ≤ 0 → impossible', () => {
    const res = reverseDCF({ currentPrice: 1000, latestFCF: -5, shares: SHARES, netDebt: 0 })
    expect(res.convergence).toBe('impossible')
    expect(res.impliedGrowth).toBeNull()
  })
  it('shares ≤ 0 → impossible', () => {
    const res = reverseDCF({ currentPrice: 1000, latestFCF: FCF, shares: 0, netDebt: 0 })
    expect(res.convergence).toBe('impossible')
  })
  it('harga jauh di bawah fair value no-growth → no-solution (deep value)', () => {
    const res = reverseDCF({ currentPrice: 1, latestFCF: FCF, shares: SHARES, netDebt: 0 })
    expect(res.convergence).toBe('no-solution')
    expect(res.impliedGrowth).toBeNull()
  })
  it('harga jauh di atas fair value growth maksimum → no-solution (explosive)', () => {
    const res = reverseDCF({ currentPrice: 1e12, latestFCF: FCF, shares: SHARES, netDebt: 0 })
    expect(res.convergence).toBe('no-solution')
    expect(res.impliedGrowth).toBeNull()
  })
})
