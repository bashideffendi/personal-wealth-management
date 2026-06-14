import { describe, it, expect } from 'vitest'
import {
  cn,
  formatCurrency,
  formatRupiahPlain,
  formatCompactCurrency,
  formatPercent,
  getMonthName,
  formatDate,
} from './utils'

// Intl pakai non-breaking space (U+00A0) sebelum/sesudah simbol — normalisasi
// biar assertion gak getas ke codepoint spasi.
const norm = (s: string) => s.replace(/ /g, ' ')

describe('cn (class merge)', () => {
  it('gabung + dedup konflik tailwind (twMerge)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4') // konflik → yang terakhir menang
    expect(cn('text-sm', false && 'hidden', 'font-bold')).toBe('text-sm font-bold')
  })
})

describe('formatRupiahPlain', () => {
  it('format ASCII-space + grouping id-ID', () => {
    expect(formatRupiahPlain(149_000)).toBe('Rp 149.000')
    expect(formatRupiahPlain(1_000_000)).toBe('Rp 1.000.000')
  })
  it('bulatkan ke integer', () => {
    expect(formatRupiahPlain(149_999.6)).toBe('Rp 150.000')
    expect(formatRupiahPlain(0.4)).toBe('Rp 0')
  })
  it('negatif → tanda minus di depan angka', () => {
    expect(formatRupiahPlain(-5_000)).toBe('Rp -5.000')
  })
  it('non-finite / null / undefined → "—"', () => {
    expect(formatRupiahPlain(NaN)).toBe('—')
    expect(formatRupiahPlain(Infinity)).toBe('—')
    expect(formatRupiahPlain(null)).toBe('—')
    expect(formatRupiahPlain(undefined)).toBe('—')
  })
})

describe('formatCompactCurrency', () => {
  it('miliar → M, juta → jt, ribu → rb (trailing nol desimal dibuang)', () => {
    expect(formatCompactCurrency(40_000_000)).toBe('Rp 40jt')
    expect(formatCompactCurrency(4_500_000)).toBe('Rp 4.5jt')
    expect(formatCompactCurrency(1_000_000_000)).toBe('Rp 1M')
    expect(formatCompactCurrency(1_500_000_000)).toBe('Rp 1.5M')
    expect(formatCompactCurrency(4_000)).toBe('Rp 4rb')
  })
  it('< 1000 → tanpa suffix', () => {
    expect(formatCompactCurrency(500)).toBe('Rp 500')
  })
  it('negatif → prefix tanda minus', () => {
    expect(formatCompactCurrency(-40_000_000)).toBe('-Rp 40jt')
  })
})

describe('formatCurrency (Intl id-ID)', () => {
  it('ada "Rp" + grouping titik, tanpa desimal', () => {
    const s = norm(formatCurrency(1_000_000))
    expect(s).toContain('Rp')
    expect(s).toContain('1.000.000')
    expect(s).not.toContain(',00')
  })
})

describe('formatPercent', () => {
  it('selalu ada tanda; default 2 desimal', () => {
    expect(formatPercent(5)).toBe('+5.00%')
    expect(formatPercent(-3.2)).toBe('-3.20%')
    expect(formatPercent(0)).toBe('+0.00%')
  })
  it('digit bisa diatur', () => {
    expect(formatPercent(5, 0)).toBe('+5%')
  })
})

describe('getMonthName', () => {
  it('1-12 → nama bulan Indonesia', () => {
    expect(getMonthName(1)).toBe('Januari')
    expect(getMonthName(12)).toBe('Desember')
  })
  it('di luar range → string kosong', () => {
    expect(getMonthName(0)).toBe('')
    expect(getMonthName(13)).toBe('')
  })
})

describe('formatDate (Intl id-ID)', () => {
  it('tanggal panjang Indonesia', () => {
    const s = formatDate('2026-06-14')
    expect(s).toContain('2026')
    expect(s).toContain('Juni')
    expect(s).toContain('14')
  })
})
