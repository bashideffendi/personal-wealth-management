import { describe, it, expect } from 'vitest'
import { computeRealizedPL } from './fifo'
import type { StockTransaction } from '@/types'

function tx(o: {
  ticker?: string; date: string; side: 'buy' | 'sell'; shares: number; price: number; fee?: number
}): StockTransaction {
  return {
    ticker: o.ticker ?? 'BBCA', date: o.date, side: o.side,
    shares: o.shares, price: o.price, fee: o.fee ?? 0,
  } as unknown as StockTransaction
}

describe('computeRealizedPL (FIFO)', () => {
  it('kosong → 0', () => {
    expect(computeRealizedPL([])).toBe(0)
  })

  it('beli saja (belum jual) → 0 realized', () => {
    expect(computeRealizedPL([tx({ date: '2026-01-01', side: 'buy', shares: 100, price: 1000 })])).toBe(0)
  })

  it('beli lalu jual semua, tanpa fee → (jual−beli)×lembar', () => {
    const r = computeRealizedPL([
      tx({ date: '2026-01-01', side: 'buy', shares: 100, price: 1000 }),
      tx({ date: '2026-02-01', side: 'sell', shares: 100, price: 1500 }),
    ])
    expect(r).toBe(50_000) // 100×(1500−1000)
  })

  it('fee BELI masuk cost basis (guard money-4): gain TIDAK overstate', () => {
    const r = computeRealizedPL([
      tx({ date: '2026-01-01', side: 'buy', shares: 100, price: 1000, fee: 10_000 }), // cost/lembar = 1100
      tx({ date: '2026-02-01', side: 'sell', shares: 100, price: 1500 }),
    ])
    expect(r).toBe(40_000) // 100×(1500−1100), BUKAN 50.000
  })

  it('fee JUAL dikurangkan', () => {
    const r = computeRealizedPL([
      tx({ date: '2026-01-01', side: 'buy', shares: 100, price: 1000 }),
      tx({ date: '2026-02-01', side: 'sell', shares: 100, price: 1500, fee: 5_000 }),
    ])
    expect(r).toBe(45_000) // 100×500 − 5.000
  })

  it('FIFO: lot tertua dikonsumsi dulu', () => {
    const r = computeRealizedPL([
      tx({ date: '2026-01-01', side: 'buy', shares: 50, price: 1000 }),
      tx({ date: '2026-01-15', side: 'buy', shares: 50, price: 2000 }),
      tx({ date: '2026-02-01', side: 'sell', shares: 50, price: 3000 }),
    ])
    expect(r).toBe(100_000) // konsumsi lot 1000: 50×(3000−1000)
  })

  it('jual lintas dua lot (partial)', () => {
    const r = computeRealizedPL([
      tx({ date: '2026-01-01', side: 'buy', shares: 50, price: 1000 }),
      tx({ date: '2026-01-15', side: 'buy', shares: 50, price: 2000 }),
      tx({ date: '2026-02-01', side: 'sell', shares: 100, price: 3000 }),
    ])
    expect(r).toBe(150_000) // 50×(3000−1000) + 50×(3000−2000)
  })

  it('per-ticker terpisah (tidak campur lot antar emiten)', () => {
    const r = computeRealizedPL([
      tx({ ticker: 'BBCA', date: '2026-01-01', side: 'buy', shares: 10, price: 1000 }),
      tx({ ticker: 'TLKM', date: '2026-01-01', side: 'buy', shares: 10, price: 5000 }),
      tx({ ticker: 'BBCA', date: '2026-02-01', side: 'sell', shares: 10, price: 1200 }),
      tx({ ticker: 'TLKM', date: '2026-02-01', side: 'sell', shares: 10, price: 4000 }),
    ])
    expect(r).toBe(10 * 200 + 10 * -1000) // BBCA +2.000, TLKM −10.000 = −8.000
  })

  it('input tidak urut tanggal → tetap FIFO benar', () => {
    const r = computeRealizedPL([
      tx({ date: '2026-02-01', side: 'sell', shares: 50, price: 3000 }),
      tx({ date: '2026-01-15', side: 'buy', shares: 50, price: 2000 }),
      tx({ date: '2026-01-01', side: 'buy', shares: 50, price: 1000 }),
    ])
    expect(r).toBe(100_000) // diurut → lot 1000 dulu
  })
})
