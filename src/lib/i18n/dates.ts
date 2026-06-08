/**
 * Locale-aware date helpers — plain functions (NOT hooks), so they work both in
 * React components and in module-scope helpers. Pass the current locale from
 * useI18n().locale at the call site.
 *
 * These replace the hard-coded Indonesian month/weekday arrays and relative-time
 * strings ("Hari ini" / "Kemarin" / "N hari lalu") scattered across components,
 * which a hook-based t() couldn't reach when defined outside a component.
 */

import type { Locale } from './messages'

const MONTHS_SHORT: Record<Locale, readonly string[]> = {
  id: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}
const MONTHS_LONG: Record<Locale, readonly string[]> = {
  id: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}
const WEEKDAYS_SHORT: Record<Locale, readonly string[]> = {
  id: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
}

/** Month short name by 0-based index (0 = Jan). */
export const monthShort = (i: number, locale: Locale): string => MONTHS_SHORT[locale][((i % 12) + 12) % 12] ?? ''
/** Month long name by 0-based index. */
export const monthLong = (i: number, locale: Locale): string => MONTHS_LONG[locale][((i % 12) + 12) % 12] ?? ''
/** Whole short-month array for the locale (for `.map()` over 12 months). */
export const monthsShort = (locale: Locale): readonly string[] => MONTHS_SHORT[locale]
/** Whole long-month array for the locale. */
export const monthsLong = (locale: Locale): readonly string[] => MONTHS_LONG[locale]
/** Weekday short name by 0-based index (0 = Sunday). */
export const weekdayShort = (i: number, locale: Locale): string => WEEKDAYS_SHORT[locale][((i % 7) + 7) % 7] ?? ''
/** Whole short-weekday array for the locale. */
export const weekdaysShort = (locale: Locale): readonly string[] => WEEKDAYS_SHORT[locale]

function toDate(input: string | number | Date): Date {
  return input instanceof Date ? input : new Date(input)
}

/** "8 Jun 2026" / short month-year "Jun 2026". */
export function formatDateShort(input: string | number | Date, locale: Locale, withDay = true): string {
  const d = toDate(input)
  if (Number.isNaN(d.getTime())) return '—'
  const mon = monthShort(d.getMonth(), locale)
  return withDay ? `${d.getDate()} ${mon} ${d.getFullYear()}` : `${mon} ${d.getFullYear()}`
}

/** "Jun 2026" — month + year only. */
export function formatMonthYear(input: string | number | Date, locale: Locale): string {
  return formatDateShort(input, locale, false)
}

/**
 * Relative day label: Today / Yesterday / N days ago (or future: in N days),
 * falling back to a short date for anything beyond a week.
 */
export function relativeDate(input: string | number | Date, locale: Locale): string {
  const d = toDate(input)
  if (Number.isNaN(d.getTime())) return '—'
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const now = new Date()
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000)
  const id = locale === 'id'
  if (diffDays === 0) return id ? 'Hari ini' : 'Today'
  if (diffDays === 1) return id ? 'Kemarin' : 'Yesterday'
  if (diffDays === -1) return id ? 'Besok' : 'Tomorrow'
  if (diffDays > 1 && diffDays <= 7) return id ? `${diffDays} hari lalu` : `${diffDays} days ago`
  if (diffDays < -1 && diffDays >= -7) return id ? `${-diffDays} hari lagi` : `in ${-diffDays} days`
  return formatDateShort(d, locale)
}

/** Relative time including sub-day granularity (just now / N min ago / N hr ago). */
export function relativeTime(input: string | number | Date, locale: Locale): string {
  const d = toDate(input)
  if (Number.isNaN(d.getTime())) return '—'
  const diffMs = Date.now() - d.getTime()
  const id = locale === 'id'
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return id ? 'Baru saja' : 'Just now'
  if (mins < 60) return id ? `${mins} menit lalu` : `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return id ? `${hrs} jam lalu` : `${hrs} hr ago`
  return relativeDate(d, locale)
}
