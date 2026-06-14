import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Rupiah "plain" — "Rp 149.000" dgn SPASI ASCII + bulat ke integer + non-finite
 * → "—". Beda dari formatCurrency (Intl): itu pakai non-breaking space (U+00A0)
 * & tanda minus di depan simbol ("-Rp 5.000"). Util ini nyatuin beberapa
 * formatter ad-hoc `'Rp ' + n.toLocaleString('id-ID')` yang tersebar; output
 * byte-identik dgn yang lama. JANGAN tukar ke formatCurrency (beda codepoint).
 */
export function formatRupiahPlain(n: number | null | undefined): string {
  return Number.isFinite(n) ? 'Rp ' + Math.round(n as number).toLocaleString('id-ID') : '—'
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatCompactCurrency(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount)
  // Trailing nol desimal dibuang — "Rp 40jt", bukan "Rp 40.0jt".
  const trim = (s: string) => s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
  if (abs >= 1_000_000_000) return `${sign}Rp ${trim((abs / 1_000_000_000).toFixed(2))}M`
  if (abs >= 1_000_000) return `${sign}Rp ${trim((abs / 1_000_000).toFixed(1))}jt`
  if (abs >= 1_000) return `${sign}Rp ${(abs / 1_000).toFixed(0)}rb`
  return `${sign}Rp ${abs.toFixed(0)}`
}

export function formatPercent(value: number, digits = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`
}

export function getMonthName(month: number): string {
  const months = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ]
  return months[month - 1] || ''
}
