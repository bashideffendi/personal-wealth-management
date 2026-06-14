import { describe, it, expect } from 'vitest'
import { depreciate, type DepreciationInput } from './depreciation'

const base = { start: '2020-01-01', asOf: new Date('2022-01-01T00:00:00') } // ~2 thn
const future = new Date('2099-01-01T00:00:00')

const inp = (o: Partial<DepreciationInput>): DepreciationInput => ({
  cost: 100_000_000, residu: 0, masaManfaat: 10, metode: 'garis_lurus', ...base, ...o,
})

describe('depreciate — none / masa 0', () => {
  it("metode 'none' → nilai buku = harga perolehan, akumulasi 0", () => {
    const r = depreciate(inp({ metode: 'none' }))
    expect(r.bookValue).toBe(100_000_000)
    expect(r.accumulated).toBe(0)
    expect(r.fullyDepreciated).toBe(false)
  })
  it('masaManfaat 0 → diperlakukan seperti none', () => {
    expect(depreciate(inp({ masaManfaat: 0 })).bookValue).toBe(100_000_000)
  })
})

describe('depreciate — invariant nilai buku + akumulasi = harga perolehan', () => {
  it('garis lurus', () => {
    const r = depreciate(inp({ cost: 100_000_000, residu: 10_000_000, masaManfaat: 8 }))
    expect(r.bookValue + r.accumulated).toBeCloseTo(100_000_000, 2)
  })
  it('saldo menurun ganda', () => {
    const r = depreciate(inp({ cost: 100_000_000, residu: 10_000_000, masaManfaat: 5, metode: 'saldo_menurun_ganda' }))
    expect(r.bookValue + r.accumulated).toBeCloseTo(100_000_000, 2)
  })
})

describe('depreciate — beban tahun pertama (independen umur)', () => {
  it('garis lurus: perYearFirst = (cost−residu)/masa', () => {
    const r = depreciate(inp({ cost: 90_000_000, residu: 0, masaManfaat: 9 }))
    expect(r.perYearFirst).toBe(10_000_000)
  })
  it('saldo menurun ganda: perYearFirst = cost × 2/masa', () => {
    const r = depreciate(inp({ cost: 100_000_000, masaManfaat: 5, metode: 'saldo_menurun_ganda' }))
    expect(r.perYearFirst).toBe(40_000_000) // 100jt × 0.4
  })
})

describe('depreciate — floor di residu saat sudah tua', () => {
  it('garis lurus jauh di masa depan → nilai buku = residu, fully depreciated', () => {
    const r = depreciate(inp({ cost: 90_000_000, residu: 0, masaManfaat: 5, asOf: future }))
    expect(r.accumulated).toBeCloseTo(90_000_000, 2)
    expect(r.bookValue).toBeCloseTo(0, 2)
    expect(r.fullyDepreciated).toBe(true)
  })
  it('saldo menurun ganda tidak pernah turun di bawah residu', () => {
    const r = depreciate(inp({ cost: 100_000_000, residu: 10_000_000, masaManfaat: 5, metode: 'saldo_menurun_ganda', asOf: future }))
    expect(r.bookValue).toBeCloseTo(10_000_000, 2)
    expect(r.fullyDepreciated).toBe(true)
  })
})

describe('depreciate — guard input', () => {
  it('residu > cost → di-clamp (depreciable 0, nilai buku = cost)', () => {
    const r = depreciate(inp({ cost: 100_000_000, residu: 200_000_000, masaManfaat: 5 }))
    expect(r.perYearFirst).toBe(0)
    expect(r.bookValue).toBe(100_000_000)
  })
  it('akumulasi monoton: lebih tua → akumulasi lebih besar', () => {
    const oneYr = depreciate(inp({ asOf: new Date('2021-01-01T00:00:00') })).accumulated
    const twoYr = depreciate(inp({ asOf: new Date('2022-01-01T00:00:00') })).accumulated
    expect(twoYr).toBeGreaterThan(oneYr)
  })
})
