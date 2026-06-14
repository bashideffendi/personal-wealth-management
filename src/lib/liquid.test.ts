import { describe, it, expect } from 'vitest'
import {
  sumLiquid, sumCashEquivalent, sumReceivable, findDuplicates,
  type UnifiedLiquidEntry,
} from './liquid'

const e = (o: Partial<UnifiedLiquidEntry> & { id: string }): UnifiedLiquidEntry => ({
  name: o.id, type: 'bank', balance: 0, source: 'account', ...o,
})

const entries: UnifiedLiquidEntry[] = [
  e({ id: 'bca', type: 'bank', balance: 5_000_000, source: 'account' }),
  e({ id: 'cash', type: 'cash', balance: 200_000, source: 'account' }),
  e({ id: 'gopay', type: 'digital_wallet', balance: 150_000, source: 'account' }),
  e({ id: 'piutang', type: 'receivable', balance: 1_000_000, source: 'asset_liquid' }),
]

describe('sumLiquid', () => {
  it('jumlahkan semua saldo', () => {
    expect(sumLiquid(entries)).toBe(6_350_000)
  })
  it('list kosong → 0', () => {
    expect(sumLiquid([])).toBe(0)
  })
  it('balance null/undefined dianggap 0 (tidak NaN)', () => {
    const r = sumLiquid([e({ id: 'x', balance: undefined as unknown as number }), e({ id: 'y', balance: 100 })])
    expect(r).toBe(100)
  })
})

describe('sumCashEquivalent (exclude receivable)', () => {
  it('semua kecuali receivable', () => {
    expect(sumCashEquivalent(entries)).toBe(5_350_000) // 6.35jt - 1jt piutang
  })
})

describe('sumReceivable (hanya receivable)', () => {
  it('hanya tipe receivable', () => {
    expect(sumReceivable(entries)).toBe(1_000_000)
  })
  it('cash+equivalent + receivable = total (tidak ada dobel/bocor)', () => {
    expect(sumCashEquivalent(entries) + sumReceivable(entries)).toBe(sumLiquid(entries))
  })
})

describe('findDuplicates', () => {
  it('asset_liquid yang namanya sama dengan account (case-insensitive, trim)', () => {
    const list: UnifiedLiquidEntry[] = [
      e({ id: 'a1', name: 'BCA', source: 'account' }),
      e({ id: 'd1', name: ' bca ', source: 'asset_liquid' }), // dup (trim + lowercase)
      e({ id: 'd2', name: 'Tabungan Haji', source: 'asset_liquid' }), // bukan dup
    ]
    const dups = findDuplicates(list)
    expect(dups.map((d) => d.id)).toEqual(['d1'])
  })
  it('tidak ada dup → kosong', () => {
    expect(findDuplicates(entries)).toEqual([])
  })
})
