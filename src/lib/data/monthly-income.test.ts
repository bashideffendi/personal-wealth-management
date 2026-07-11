import { describe, expect, it } from 'vitest'
import { averageMonthlyIncome } from './monthly-income'

describe('averageMonthlyIncome', () => {
  it('0 kalau tidak ada baris', () => {
    expect(averageMonthlyIncome([])).toBe(0)
  })

  it('bulan tunggal: dibagi 1, BUKAN /3 tetap (bug lama Goals)', () => {
    const rows = [
      { amount: 6_000_000, date: '2026-07-01' },
      { amount: 3_000_000, date: '2026-07-15' },
    ]
    expect(averageMonthlyIncome(rows)).toBe(9_000_000)
  })

  it('3 bulan distinct: dibagi 3', () => {
    const rows = [
      { amount: 10_000_000, date: '2026-05-01' },
      { amount: 10_000_000, date: '2026-06-01' },
      { amount: 10_000_000, date: '2026-07-01' },
    ]
    expect(averageMonthlyIncome(rows)).toBe(10_000_000)
  })

  it('lebih dari cap: pembagi di-cap (default 3)', () => {
    const rows = [
      { amount: 3_000_000, date: '2026-03-01' },
      { amount: 3_000_000, date: '2026-04-01' },
      { amount: 3_000_000, date: '2026-05-01' },
      { amount: 3_000_000, date: '2026-06-01' },
    ]
    expect(averageMonthlyIncome(rows)).toBe(4_000_000)
  })

  it('amount null/undefined dianggap 0, date kosong tidak dihitung sebagai bulan', () => {
    const rows = [
      { amount: 5_000_000, date: '2026-07-01' },
      { amount: 0, date: '' },
    ]
    expect(averageMonthlyIncome(rows)).toBe(5_000_000)
  })

  it('capMonths custom dihormati', () => {
    const rows = [
      { amount: 2_000_000, date: '2026-01-01' },
      { amount: 2_000_000, date: '2026-02-01' },
      { amount: 2_000_000, date: '2026-03-01' },
      { amount: 2_000_000, date: '2026-04-01' },
      { amount: 2_000_000, date: '2026-05-01' },
      { amount: 2_000_000, date: '2026-06-01' },
      { amount: 2_000_000, date: '2026-07-01' },
    ]
    expect(averageMonthlyIncome(rows, 6)).toBeCloseTo(14_000_000 / 6)
  })
})
