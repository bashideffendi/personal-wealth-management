/**
 * Formatter dataset IDX — IDR compact, persen, ratio, verdict color.
 * Diport dari kelolainvestasi/invest dengan minor tweaks buat Klunting theme.
 */

const NUM_NO_FRAC = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })
const PCT = new Intl.NumberFormat('id-ID', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '—'
  return NUM_NO_FRAC.format(value)
}

/** Format triliun/miliar/juta/ribu compact (Indonesia: T/M/Jt/rb). */
export function formatIDRCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '—'
  const abs = Math.abs(value)
  const sign = value < 0 ? '−' : ''
  if (abs >= 1e12) return `${sign}Rp ${(abs / 1e12).toFixed(2)} T`
  if (abs >= 1e9) return `${sign}Rp ${(abs / 1e9).toFixed(2)} M`
  if (abs >= 1e6) return `${sign}Rp ${(abs / 1e6).toFixed(2)} Jt`
  if (abs >= 1e3) return `${sign}Rp ${(abs / 1e3).toFixed(2)} rb`
  return `${sign}Rp ${NUM_NO_FRAC.format(abs)}`
}

/** Accepts fraction (0.12 = 12%) or whole (12 = 12%) — toggle via asWhole. */
export function formatPercentValue(
  value: number | null | undefined,
  asWhole = false,
): string {
  if (value === null || value === undefined || isNaN(value)) return '—'
  const v = asWhole ? value / 100 : value
  return PCT.format(v)
}

export function formatRatio(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '—'
  return `${value.toFixed(2)}x`
}

/** Yahoo IDX suffix: BBCA → BBCA.JK. */
export function yahooSymbol(ticker: string): string {
  const t = ticker.toUpperCase()
  return t.endsWith('.JK') ? t : `${t}.JK`
}

/** Inline style color for signed return / MoS. */
export function signColorVar(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return 'var(--ink-muted)'
  if (value > 0) return 'var(--emerald-600)'
  if (value < 0) return 'var(--coral-600)'
  return 'var(--ink-muted)'
}

/** Verdict color mapping → returns { bg, fg } CSS values. */
export function verdictStyle(v: string | null | undefined): { bg: string; fg: string } {
  if (!v) return { bg: 'var(--surface-2)', fg: 'var(--ink-muted)' }
  const u = v.toUpperCase()
  if (u.includes('HIGHLY UNDER')) return { bg: 'var(--emerald-600)', fg: '#FFFFFF' }
  if (u.includes('UNDER')) return { bg: 'var(--emerald-500)', fg: '#FFFFFF' }
  if (u.includes('FAIR')) return { bg: 'var(--amber-500)', fg: '#FFFFFF' }
  if (u.includes('HIGHLY OVER')) return { bg: 'var(--coral-600)', fg: '#FFFFFF' }
  if (u.includes('OVER')) return { bg: 'var(--coral-500)', fg: '#FFFFFF' }
  return { bg: 'var(--surface-2)', fg: 'var(--ink-muted)' }
}

/** Indonesia date format: 15 Mei 2026. */
export function formatIDXDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Parse IDX format "31 May 24" → Date. Returns null on fail. */
export function parseIDXShortDate(s: string | null): Date | null {
  if (!s) return null
  const m = /^(\d{1,2})\s+(\w{3})\s+(\d{2,4})$/.exec(s.trim())
  if (!m) return null
  const [, dStr, monStr, yStr] = m
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const monIdx = months.indexOf(monStr.toLowerCase())
  if (monIdx < 0) return null
  const day = parseInt(dStr, 10)
  let year = parseInt(yStr, 10)
  if (year < 100) year += 2000
  const d = new Date(year, monIdx, day)
  return isNaN(d.getTime()) ? null : d
}
