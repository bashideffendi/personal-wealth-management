import { describe, expect, it } from 'vitest'
import { isSplitValid, splitAllocated, splitRemaining } from './split'

describe('split math (kontrak uang: total pecahan = nominal sumber persis)', () => {
  const rows = [
    { category: 'Makan', amount: 60_000 },
    { category: 'Transport', amount: 40_000 },
  ]
  it('allocated & remaining', () => {
    expect(splitAllocated(rows)).toBe(100_000)
    expect(splitRemaining(rows, 100_000)).toBe(0)
    expect(splitRemaining(rows, 150_000)).toBe(50_000)
  })
  it('valid hanya saat remaining tepat 0', () => {
    expect(isSplitValid(rows, 100_000)).toBe(true)
    expect(isSplitValid(rows, 100_001)).toBe(false)
    expect(isSplitValid(rows, 99_999)).toBe(false)
  })
  it('minimal 2 baris', () => {
    expect(isSplitValid([{ category: 'Makan', amount: 100_000 }], 100_000)).toBe(false)
  })
  it('semua baris wajib kategori + amount > 0', () => {
    expect(isSplitValid([...rows, { category: '', amount: 0 }], 100_000)).toBe(false)
    expect(isSplitValid([{ category: 'A', amount: 100_000 }, { category: 'B', amount: 0 }], 100_000)).toBe(false)
  })
  it('sumber 0/negatif tidak pernah valid', () => {
    expect(isSplitValid(rows, 0)).toBe(false)
  })
})
