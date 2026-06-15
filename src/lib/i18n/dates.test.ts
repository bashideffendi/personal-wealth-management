import { describe, it, expect } from 'vitest'
import {
  monthShort,
  monthLong,
  weekdayShort,
  formatDateShort,
  formatMonthYear,
  relativeDate,
  relativeTime,
} from './dates'

describe('month/weekday by index (locale + wrap)', () => {
  it('index 0-based, dua locale', () => {
    expect(monthShort(0, 'id')).toBe('Jan')
    expect(monthShort(4, 'id')).toBe('Mei')
    expect(monthShort(4, 'en')).toBe('May')
    expect(monthLong(11, 'id')).toBe('Desember')
    expect(monthLong(11, 'en')).toBe('December')
    expect(weekdayShort(0, 'id')).toBe('Min')
    expect(weekdayShort(6, 'en')).toBe('Sat')
  })
  it('wrap index negatif / overflow', () => {
    expect(monthShort(-1, 'id')).toBe('Des') // -1 → Desember
    expect(monthShort(12, 'id')).toBe('Jan') // 12 → Januari
    expect(weekdayShort(-1, 'id')).toBe('Sab') // -1 → Sabtu
  })
})

describe('formatDateShort / formatMonthYear', () => {
  it('"D Mon YYYY" dgn nama bulan locale', () => {
    const d = new Date(2026, 4, 8) // 8 Mei 2026
    expect(formatDateShort(d, 'id')).toBe('8 Mei 2026')
    expect(formatDateShort(d, 'en')).toBe('8 May 2026')
  })
  it('withDay=false → bulan+tahun', () => {
    const d = new Date(2026, 4, 8)
    expect(formatDateShort(d, 'id', false)).toBe('Mei 2026')
    expect(formatMonthYear(d, 'en')).toBe('May 2026')
  })
  it('tanggal invalid → "—"', () => {
    expect(formatDateShort('bukan tanggal', 'id')).toBe('—')
  })
})

describe('relativeDate (relatif ke hari ini)', () => {
  const dayOffset = (n: number) => {
    const d = new Date()
    d.setDate(d.getDate() + n)
    return d
  }
  it('hari ini / kemarin / besok', () => {
    expect(relativeDate(dayOffset(0), 'id')).toBe('Hari ini')
    expect(relativeDate(dayOffset(0), 'en')).toBe('Today')
    expect(relativeDate(dayOffset(-1), 'id')).toBe('Kemarin')
    expect(relativeDate(dayOffset(1), 'id')).toBe('Besok')
  })
  it('N hari lalu (dalam seminggu)', () => {
    expect(relativeDate(dayOffset(-3), 'id')).toBe('3 hari lalu')
    expect(relativeDate(dayOffset(-3), 'en')).toBe('3 days ago')
  })
  it('invalid → "—"', () => {
    expect(relativeDate('xxx', 'id')).toBe('—')
  })
})

describe('relativeTime (sub-hari relatif ke sekarang)', () => {
  it('baru saja / N menit / N jam', () => {
    expect(relativeTime(new Date(), 'id')).toBe('Baru saja')
    expect(relativeTime(new Date(Date.now() - 5 * 60_000), 'id')).toBe('5 menit lalu')
    expect(relativeTime(new Date(Date.now() - 2 * 3_600_000), 'en')).toBe('2 hr ago')
  })
  it('invalid → "—"', () => {
    expect(relativeTime('xxx', 'id')).toBe('—')
  })
})
