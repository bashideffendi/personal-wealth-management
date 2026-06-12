/**
 * Logika recurrence BERSAMA — satu implementasi untuk halaman Recurring dan
 * semua widget dashboard (Tagihan Mendatang, Sisa Aman, Forecast 30 Hari).
 *
 * Semantik (hasil benahan audit halaman Recurring):
 * - monthly : day_of_period = tanggal 1-31, di-clamp ke akhir bulan pendek.
 * - weekly  : anchor ke WEEKDAY start_date (day_of_period TIDAK dipakai).
 * - yearly  : anchor ke BULAN+TANGGAL start_date (day_of_period TIDAK dipakai).
 * - daily   : tiap hari.
 * - start_date dihormati (belum mulai = belum ditagih); lewat end_date = expired.
 */

export type RecurLike = {
  frequency: string
  day_of_period: number
  start_date?: string | null
  end_date?: string | null
}

export const DAY_MS = 86_400_000

/** Parse "YYYY-MM-DD" jadi Date lokal 00:00 (hindari geser timezone dari new Date(iso)). */
export function parseISODate(s: string | null | undefined): Date | null {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

/** Format Date jadi "YYYY-MM-DD" pakai komponen LOKAL — toISOString() menggeser
 *  tanggal mundur sehari di WIB (UTC+7) karena dikonversi dulu ke UTC. */
export function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/** Tanggal `day` di (year, month), di-clamp ke hari terakhir bulan itu. */
export function clampDay(year: number, month: number, day: number): Date {
  const last = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, last))
}

/** Sudah lewat end_date? (end_date kosong = jalan terus) */
export function isExpired(r: RecurLike, ref?: Date): boolean {
  const end = parseISODate(r.end_date)
  return !!end && end < (ref ?? startOfToday())
}

/** Jatuh tempo berikutnya (≥ ref & ≥ start_date); null kalau sudah lewat end_date. */
export function nextRunDate(r: RecurLike, ref?: Date): Date | null {
  const t = ref ? new Date(ref) : startOfToday()
  t.setHours(0, 0, 0, 0)
  const start = parseISODate(r.start_date)
  const from = start && start > t ? start : t
  const end = parseISODate(r.end_date)
  let next: Date
  if (r.frequency === 'monthly') {
    const cand = clampDay(from.getFullYear(), from.getMonth(), r.day_of_period)
    next = cand >= from ? cand : clampDay(from.getFullYear(), from.getMonth() + 1, r.day_of_period)
  } else if (r.frequency === 'yearly') {
    // Anchor ke bulan+tanggal start_date — day_of_period (1–31) gak cukup buat setahun.
    const anchor = start ?? from
    const cand = clampDay(from.getFullYear(), anchor.getMonth(), anchor.getDate())
    next = cand >= from ? cand : clampDay(from.getFullYear() + 1, anchor.getMonth(), anchor.getDate())
  } else if (r.frequency === 'weekly') {
    // Kemunculan berikutnya dari weekday start_date.
    const anchorDow = (start ?? from).getDay()
    const d = new Date(from)
    d.setDate(d.getDate() + ((anchorDow - d.getDay() + 7) % 7))
    next = d
  } else {
    next = new Date(from)
  }
  if (end && next > end) return null
  return next
}

/** Semua kemunculan dalam jendela [from, from + days hari] inklusif. */
export function occurrencesInRange(r: RecurLike, from: Date, days: number): Date[] {
  const start = new Date(from)
  start.setHours(0, 0, 0, 0)
  const winEnd = new Date(start.getTime() + days * DAY_MS)
  const end = parseISODate(r.end_date)
  const cap = end && end < winEnd ? end : winEnd
  const first = nextRunDate(r, start)
  if (!first || first > cap) return []
  if (r.frequency === 'daily') {
    const out: Date[] = []
    for (let d = new Date(first); d <= cap; d = new Date(d.getTime() + DAY_MS)) out.push(new Date(d))
    return out
  }
  if (r.frequency === 'weekly') {
    const out: Date[] = []
    for (let d = new Date(first); d <= cap; d = new Date(d.getTime() + 7 * DAY_MS)) out.push(new Date(d))
    return out
  }
  if (r.frequency === 'monthly') {
    const out = [first]
    let y = first.getFullYear()
    let m = first.getMonth()
    for (;;) {
      m += 1
      if (m > 11) { m -= 12; y += 1 }
      const d = clampDay(y, m, r.day_of_period)
      if (d > cap) break
      out.push(d)
    }
    return out
  }
  // yearly: jendela widget pendek (≤ ~1 thn) → maksimal satu kemunculan.
  return [first]
}
