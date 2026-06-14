import { describe, it, expect } from 'vitest'
import {
  parseISODate, toLocalISO, clampDay, isExpired, nextRunDate, occurrencesInRange,
  type RecurLike,
} from './recurrence'

// Semua test pakai `ref` eksplisit (bukan "hari ini") → deterministik lintas TZ/tanggal.

describe('parseISODate', () => {
  it('parse YYYY-MM-DD ke Date lokal 00:00', () => {
    const d = parseISODate('2026-03-15')!
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(2) // Maret = index 2
    expect(d.getDate()).toBe(15)
  })
  it('null/kosong/invalid → null', () => {
    expect(parseISODate(null)).toBeNull()
    expect(parseISODate(undefined)).toBeNull()
    expect(parseISODate('')).toBeNull()
    expect(parseISODate('bukan-tanggal')).toBeNull()
  })
})

describe('toLocalISO (anti geser WIB)', () => {
  it('pakai komponen lokal — tanggal tidak mundur sehari', () => {
    // Regresi: toISOString() di WIB(UTC+7) konversi ke UTC dulu → mundur 1 hari.
    expect(toLocalISO(new Date(2026, 0, 15))).toBe('2026-01-15')
    expect(toLocalISO(new Date(2026, 11, 1))).toBe('2026-12-01')
  })
  it('roundtrip parseISODate → toLocalISO stabil', () => {
    expect(toLocalISO(parseISODate('2026-07-09')!)).toBe('2026-07-09')
  })
})

describe('clampDay (clamp ke akhir bulan)', () => {
  it('tanggal 31 di Februari → 28 (non-kabisat)', () => {
    expect(toLocalISO(clampDay(2026, 1, 31))).toBe('2026-02-28')
  })
  it('tanggal 31 di Februari kabisat → 29', () => {
    expect(toLocalISO(clampDay(2024, 1, 31))).toBe('2024-02-29')
  })
  it('tanggal valid tidak diubah', () => {
    expect(toLocalISO(clampDay(2026, 5, 15))).toBe('2026-06-15')
  })
})

describe('isExpired', () => {
  const ref = new Date(2026, 5, 1)
  it('end_date lampau → expired', () => {
    expect(isExpired({ frequency: 'monthly', day_of_period: 1, end_date: '2026-01-01' }, ref)).toBe(true)
  })
  it('end_date depan / kosong → tidak expired', () => {
    expect(isExpired({ frequency: 'monthly', day_of_period: 1, end_date: '2026-12-31' }, ref)).toBe(false)
    expect(isExpired({ frequency: 'monthly', day_of_period: 1 }, ref)).toBe(false)
  })
})

describe('nextRunDate', () => {
  it('monthly: day_of_period belum lewat bulan ini → bulan ini', () => {
    const r: RecurLike = { frequency: 'monthly', day_of_period: 15 }
    expect(toLocalISO(nextRunDate(r, new Date(2026, 0, 10))!)).toBe('2026-01-15')
  })
  it('monthly: day_of_period sudah lewat → bulan depan', () => {
    const r: RecurLike = { frequency: 'monthly', day_of_period: 15 }
    expect(toLocalISO(nextRunDate(r, new Date(2026, 0, 20))!)).toBe('2026-02-15')
  })
  it('monthly: day 31 di bulan pendek → clamp akhir bulan', () => {
    const r: RecurLike = { frequency: 'monthly', day_of_period: 31 }
    expect(toLocalISO(nextRunDate(r, new Date(2026, 1, 1))!)).toBe('2026-02-28')
  })
  it('yearly: anchor ke bulan+tanggal start_date', () => {
    const r: RecurLike = { frequency: 'yearly', day_of_period: 1, start_date: '2025-03-10' }
    expect(toLocalISO(nextRunDate(r, new Date(2026, 0, 5))!)).toBe('2026-03-10')
    // sudah lewat anchor tahun ini → tahun depan
    expect(toLocalISO(nextRunDate(r, new Date(2026, 3, 5))!)).toBe('2027-03-10')
  })
  it('weekly: kemunculan berikut = weekday start_date, < 7 hari dari ref', () => {
    const r: RecurLike = { frequency: 'weekly', day_of_period: 0, start_date: '2026-01-07' }
    const ref = new Date(2026, 0, 10)
    const next = nextRunDate(r, ref)!
    expect(next.getDay()).toBe(parseISODate('2026-01-07')!.getDay())
    expect(next.getTime()).toBeGreaterThanOrEqual(ref.getTime())
    expect(next.getTime() - ref.getTime()).toBeLessThan(7 * 86_400_000)
  })
  it('daily: = ref', () => {
    const r: RecurLike = { frequency: 'daily', day_of_period: 1 }
    expect(toLocalISO(nextRunDate(r, new Date(2026, 0, 10))!)).toBe('2026-01-10')
  })
  it('start_date di masa depan → mulai dari start_date', () => {
    const r: RecurLike = { frequency: 'monthly', day_of_period: 15, start_date: '2026-06-01' }
    expect(toLocalISO(nextRunDate(r, new Date(2026, 0, 10))!)).toBe('2026-06-15')
  })
  it('sudah lewat end_date → null', () => {
    const r: RecurLike = { frequency: 'monthly', day_of_period: 15, end_date: '2025-01-01' }
    expect(nextRunDate(r, new Date(2026, 0, 10))).toBeNull()
  })
})

describe('occurrencesInRange', () => {
  it('daily inklusif: 6 hari → 7 kemunculan', () => {
    const r: RecurLike = { frequency: 'daily', day_of_period: 1 }
    expect(occurrencesInRange(r, new Date(2026, 0, 1), 6)).toHaveLength(7)
  })
  it('monthly lintas batas bulan + clamp', () => {
    const r: RecurLike = { frequency: 'monthly', day_of_period: 15 }
    const occ = occurrencesInRange(r, new Date(2026, 0, 1), 90).map(toLocalISO)
    expect(occ).toEqual(['2026-01-15', '2026-02-15', '2026-03-15'])
  })
  it('weekly: 21 hari → 3-4 kemunculan, jarak 7 hari', () => {
    const r: RecurLike = { frequency: 'weekly', day_of_period: 0, start_date: '2026-01-05' }
    const occ = occurrencesInRange(r, new Date(2026, 0, 1), 21)
    expect(occ.length).toBeGreaterThanOrEqual(3)
    for (let i = 1; i < occ.length; i++) {
      expect(occ[i].getTime() - occ[i - 1].getTime()).toBe(7 * 86_400_000)
    }
  })
  it('end_date memotong jendela', () => {
    const r: RecurLike = { frequency: 'monthly', day_of_period: 15, end_date: '2026-02-20' }
    const occ = occurrencesInRange(r, new Date(2026, 0, 1), 365).map(toLocalISO)
    expect(occ).toEqual(['2026-01-15', '2026-02-15'])
  })
  it('start_date di tengah jendela → mulai dari sana', () => {
    const r: RecurLike = { frequency: 'monthly', day_of_period: 10, start_date: '2026-03-01' }
    const occ = occurrencesInRange(r, new Date(2026, 0, 1), 120).map(toLocalISO)
    expect(occ[0]).toBe('2026-03-10')
  })
  it('expired (end_date lampau) → kosong', () => {
    const r: RecurLike = { frequency: 'daily', day_of_period: 1, end_date: '2025-01-01' }
    expect(occurrencesInRange(r, new Date(2026, 0, 1), 30)).toEqual([])
  })
})
