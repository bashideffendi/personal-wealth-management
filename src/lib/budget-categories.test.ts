import { describe, it, expect } from 'vitest'
import {
  computeTargetAmount,
  subKey,
  rootCategory,
  categoryOptions,
  leafKeys,
  isEnabled,
  SUB_SEP,
  type CatNode,
  type CatTarget,
} from './budget-categories'

const ctx = (o: Partial<{ year: number; month: number; incomeThisMonth: number; avgActual: number }> = {}) => ({
  year: 2026, month: 6, incomeThisMonth: 0, avgActual: 0, ...o,
})

// Helper bikin CatNode ringkas (id sub auto, gak relevan buat assertion).
const sub = (name: string) => ({ id: `s-${name}`, name })
const cat = (name: string, subs: string[] = [], extra: Partial<CatNode> = {}): CatNode => ({
  id: `c-${name}`, name, subs: subs.map(sub), ...extra,
})

describe('computeTargetAmount — fixed', () => {
  it('bulatkan & clamp ≥ 0', () => {
    expect(computeTargetAmount({ mode: 'fixed', amount: 1234.6 }, ctx())).toBe(1235)
    expect(computeTargetAmount({ mode: 'fixed', amount: -100 }, ctx())).toBe(0)
  })
})

describe('computeTargetAmount — percentIncome', () => {
  it('persen dari pemasukan bulan itu, dibulatkan', () => {
    expect(computeTargetAmount({ mode: 'percentIncome', percent: 10 }, ctx({ incomeThisMonth: 1_000_000 }))).toBe(100_000)
    // 1.001.000 × 33% = 330.330 (pas), tapi uji pembulatan dengan angka pecahan:
    expect(computeTargetAmount({ mode: 'percentIncome', percent: 33 }, ctx({ incomeThisMonth: 1001 }))).toBe(330) // 330,33
  })
  it('income 0 → 0', () => {
    expect(computeTargetAmount({ mode: 'percentIncome', percent: 50 }, ctx({ incomeThisMonth: 0 }))).toBe(0)
  })
})

describe('computeTargetAmount — average', () => {
  it('pakai rata-rata realisasi yang dihitung pemanggil, dibulatkan', () => {
    expect(computeTargetAmount({ mode: 'average', months: 3 }, ctx({ avgActual: 5000.4 }))).toBe(5000)
    expect(computeTargetAmount({ mode: 'average', months: 3 }, ctx({ avgActual: 5000.6 }))).toBe(5001)
  })
})

describe('computeTargetAmount — byDate (bagi rata sisa bulan, inklusif)', () => {
  it('target 1.2jt sampai Des dari Jun → 7 bulan tersisa', () => {
    const t: CatTarget = { mode: 'byDate', amount: 1_200_000, by: '2026-12' }
    expect(computeTargetAmount(t, ctx({ year: 2026, month: 6 }))).toBe(171429) // round(1.200.000/7)
  })
  it('bulan target = bulan ini → 1 bulan (full)', () => {
    const t: CatTarget = { mode: 'byDate', amount: 1_200_000, by: '2026-06' }
    expect(computeTargetAmount(t, ctx({ year: 2026, month: 6 }))).toBe(1_200_000)
  })
  it('deadline sudah lewat → fallback full amount', () => {
    const t: CatTarget = { mode: 'byDate', amount: 1_200_000, by: '2026-01' }
    expect(computeTargetAmount(t, ctx({ year: 2026, month: 6 }))).toBe(1_200_000)
  })
  it('by tidak valid → fallback full amount', () => {
    const t: CatTarget = { mode: 'byDate', amount: 999, by: 'ngaco' }
    expect(computeTargetAmount(t, ctx())).toBe(999)
  })
})

describe('subKey / rootCategory', () => {
  it('subKey gabung pakai SUB_SEP', () => {
    expect(subKey('Makanan', 'Restoran')).toBe(`Makanan${SUB_SEP}Restoran`)
  })
  it('rootCategory: induk dari composite key', () => {
    expect(rootCategory('Makanan › Restoran')).toBe('Makanan')
  })
  it('rootCategory: key tanpa sub → dirinya sendiri', () => {
    expect(rootCategory('Makanan')).toBe('Makanan')
  })
  it('round-trip rootCategory(subKey(a,b)) === a', () => {
    expect(rootCategory(subKey('Tagihan', 'Listrik'))).toBe('Tagihan')
  })
})

describe('isEnabled', () => {
  it('default (enabled tak diset) = aktif', () => {
    expect(isEnabled({})).toBe(true)
    expect(isEnabled({ enabled: true })).toBe(true)
  })
  it('enabled === false → nonaktif', () => {
    expect(isEnabled({ enabled: false })).toBe(false)
  })
})

describe('categoryOptions — dropdown transaksi', () => {
  const nodes = [
    cat('A', ['a1']),
    cat('B', [], { enabled: false }), // nonaktif → di-skip
    cat('C'),
  ]
  it('skip kategori nonaktif, induk depth 0, sub depth 1 dengan composite value', () => {
    expect(categoryOptions(nodes)).toEqual([
      { value: 'A', label: 'A', depth: 0 },
      { value: `A${SUB_SEP}a1`, label: 'a1', depth: 1 },
      { value: 'C', label: 'C', depth: 0 },
    ])
  })
})

describe('leafKeys — baris anggaran (rollup vs leaf)', () => {
  it('kategori ber-sub → kontribusi composite sub-key (induk jadi rollup); tanpa sub → dirinya leaf', () => {
    const nodes = [cat('A', ['a1', 'a2']), cat('B', [], { enabled: false }), cat('C')]
    expect(leafKeys(nodes)).toEqual([`A${SUB_SEP}a1`, `A${SUB_SEP}a2`, 'C'])
  })
  it('kategori nonaktif keluar dari tabel & total', () => {
    expect(leafKeys([cat('X', [], { enabled: false })])).toEqual([])
  })
})
