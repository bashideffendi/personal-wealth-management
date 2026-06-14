import { describe, it, expect } from 'vitest'
import {
  formatNumber,
  formatPrice,
  formatIDRCompact,
  formatPercentValue,
  formatRatio,
  yahooSymbol,
  signColorVar,
  verdictStyle,
  formatTanggalID,
  parseIDXShortDate,
} from './format'

describe('formatNumber / formatPrice', () => {
  it('null/NaN → "—"', () => {
    expect(formatNumber(null)).toBe('—')
    expect(formatNumber(NaN)).toBe('—')
    expect(formatPrice(undefined)).toBe('—')
  })
  it('formatNumber 0 frac vs 2 frac', () => {
    expect(formatNumber(1000, 0)).toBe('1.000')
    expect(formatNumber(12.5)).toBe('12,50') // id-ID 2 frac, koma desimal
  })
  it('formatPrice = integer grouping', () => {
    expect(formatPrice(1500)).toBe('1.500')
  })
})

describe('formatIDRCompact (T/M/Jt/rb, minus U+2212)', () => {
  it('skala besar', () => {
    expect(formatIDRCompact(1.5e12)).toBe('Rp 1.50 T')
    expect(formatIDRCompact(40e6)).toBe('Rp 40.00 Jt')
    expect(formatIDRCompact(2e9)).toBe('Rp 2.00 M')
    expect(formatIDRCompact(5e3)).toBe('Rp 5.00 rb')
  })
  it('< 1000 → grouping biasa', () => {
    expect(formatIDRCompact(500)).toBe('Rp 500')
  })
  it('negatif pakai minus matematika (−)', () => {
    expect(formatIDRCompact(-5e9)).toBe('−Rp 5.00 M')
  })
  it('null → "—"', () => {
    expect(formatIDRCompact(null)).toBe('—')
  })
})

describe('formatPercentValue', () => {
  it('fraction vs whole', () => {
    expect(formatPercentValue(0.12).replace(/ /g, ' ')).toMatch(/12,00\s?%/)
    expect(formatPercentValue(12, true).replace(/ /g, ' ')).toMatch(/12,00\s?%/)
  })
  it('null → "—"', () => {
    expect(formatPercentValue(null)).toBe('—')
  })
})

describe('formatRatio', () => {
  it('2 desimal + x', () => {
    expect(formatRatio(1.5)).toBe('1.50x')
    expect(formatRatio(null)).toBe('—')
  })
})

describe('yahooSymbol', () => {
  it('tambah .JK kalau belum ada, uppercase', () => {
    expect(yahooSymbol('bbca')).toBe('BBCA.JK')
    expect(yahooSymbol('TLKM.JK')).toBe('TLKM.JK')
  })
})

describe('signColorVar', () => {
  it('positif emerald, negatif coral, 0/null muted', () => {
    expect(signColorVar(5)).toBe('var(--emerald-600)')
    expect(signColorVar(-5)).toBe('var(--coral-600)')
    expect(signColorVar(0)).toBe('var(--ink-muted)')
    expect(signColorVar(null)).toBe('var(--ink-muted)')
  })
})

describe('verdictStyle (HIGHLY dicek sebelum plain)', () => {
  it('mapping verdict → warna', () => {
    expect(verdictStyle('HIGHLY UNDERVALUED').bg).toBe('var(--emerald-600)')
    expect(verdictStyle('UNDERVALUED').bg).toBe('var(--emerald-500)')
    expect(verdictStyle('FAIR VALUE').bg).toBe('var(--amber-500)')
    expect(verdictStyle('OVERVALUED').bg).toBe('var(--coral-500)')
    expect(verdictStyle('HIGHLY OVERVALUED').bg).toBe('var(--coral-600)')
    expect(verdictStyle(null).bg).toBe('var(--surface-2)')
  })
})

describe('formatTanggalID', () => {
  it('ISO → "DD Bulan YYYY"', () => {
    expect(formatTanggalID('2026-05-31')).toBe('31 Mei 2026')
  })
  it('invalid → raw; kosong → "—"; bulan di luar range → raw', () => {
    expect(formatTanggalID('bukan-tanggal')).toBe('bukan-tanggal')
    expect(formatTanggalID(null)).toBe('—')
    expect(formatTanggalID('2026-13-01')).toBe('2026-13-01')
  })
})

describe('parseIDXShortDate', () => {
  it('"31 May 24" → Date 2024-05-31', () => {
    const d = parseIDXShortDate('31 May 24')!
    expect(d.getFullYear()).toBe(2024)
    expect(d.getMonth()).toBe(4) // Mei = index 4
    expect(d.getDate()).toBe(31)
  })
  it('format/bulan invalid → null', () => {
    expect(parseIDXShortDate('foo')).toBeNull()
    expect(parseIDXShortDate('31 Xxx 24')).toBeNull()
    expect(parseIDXShortDate(null)).toBeNull()
  })
})
