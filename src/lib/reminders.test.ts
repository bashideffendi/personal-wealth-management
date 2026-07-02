import { describe, it, expect } from 'vitest'
import { reminderDaysLeft, shouldRemind, REMINDER_THRESHOLDS } from './reminders'

// Date lokal-konstruktor (new Date(y, m, d, ...)) → komponen Y/M/D deterministik
// lintas timezone runner (fungsi baca getFullYear/Month/Date lokal).
describe('reminderDaysLeft', () => {
  const now = new Date(2026, 6, 2, 10, 0) // 2 Jul 2026, 10:00 lokal

  it('0 kalau expire hari ini (jam berapa pun)', () => {
    expect(reminderDaysLeft(new Date(2026, 6, 2, 23, 59), now)).toBe(0)
  })
  it('14 kalau expire 14 hari lagi', () => {
    expect(reminderDaysLeft(new Date(2026, 6, 16), now)).toBe(14)
  })
  it('3 kalau expire 3 hari lagi', () => {
    expect(reminderDaysLeft(new Date(2026, 6, 5, 8), now)).toBe(3)
  })
  it('negatif kalau sudah lewat', () => {
    expect(reminderDaysLeft(new Date(2026, 6, 1), now)).toBe(-1)
  })
  it('date-only: jam cron pagi vs malam gak geser hasil', () => {
    const exp = new Date(2026, 6, 5, 12, 0)
    const morning = new Date(2026, 6, 2, 0, 30)
    const night = new Date(2026, 6, 2, 23, 30)
    expect(reminderDaysLeft(exp, morning)).toBe(reminderDaysLeft(exp, night))
    expect(reminderDaysLeft(exp, morning)).toBe(3)
  })
})

describe('shouldRemind', () => {
  it('true tepat di threshold H-14/3/0', () => {
    for (const d of REMINDER_THRESHOLDS) expect(shouldRemind(d)).toBe(true)
  })
  it('false di luar threshold', () => {
    for (const d of [15, 13, 5, 2, 1, -1, -3]) expect(shouldRemind(d)).toBe(false)
  })
})
