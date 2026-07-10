import { describe, expect, it } from 'vitest'
import { csvCell, parseCsvRows, parseFlexibleAmount, parseFlexibleDate, toCsv } from './csv'
import { applyRules, type RuleLike } from './rules'

const RULES: RuleLike[] = [
  { is_active: true, priority: 1, match_text: 'gopay', type: 'expense', category: 'Transport' },
  { is_active: true, priority: 9, match_text: 'GOPAY COFFEE', type: 'expense', category: 'Makan' },
  { is_active: false, priority: 99, match_text: 'gopay', type: 'income', category: 'SALAH' },
]

describe('applyRules', () => {
  it('prioritas tertinggi menang, case-insensitive, rule non-aktif dilewati', () => {
    expect(applyRules(RULES, 'Bayar GoPay Coffee Tebet')).toEqual({ type: 'expense', category: 'Makan' })
    expect(applyRules(RULES, 'top up gopay')).toEqual({ type: 'expense', category: 'Transport' })
    expect(applyRules(RULES, 'transfer BCA')).toBeNull()
  })
})

describe('parseFlexibleAmount (fix bug lama: "Rp 125.000" terbaca 125)', () => {
  it('format ribuan Indonesia & EN', () => {
    expect(parseFlexibleAmount('Rp 125.000')).toBe(125_000)
    expect(parseFlexibleAmount('1.250.000')).toBe(1_250_000)
    expect(parseFlexibleAmount('125,000')).toBe(125_000)
    expect(parseFlexibleAmount('125000')).toBe(125_000)
  })
  it('desimal tetap desimal (1-2 digit di belakang separator)', () => {
    expect(parseFlexibleAmount('125.5')).toBe(125.5)
    expect(parseFlexibleAmount('99,95')).toBe(99.95)
  })
  it('campuran ribuan+desimal & tanda minus', () => {
    expect(parseFlexibleAmount('1.250.000,5')).toBe(1_250_000.5)
    expect(parseFlexibleAmount('-25.000')).toBe(-25_000)
  })
  it('kosong/sampah → 0', () => {
    expect(parseFlexibleAmount('')).toBe(0)
    expect(parseFlexibleAmount('abc')).toBe(0)
  })
})

describe('parseFlexibleDate (fix bug lama: 05/07/2026 terbaca 7 Mei + geser timezone)', () => {
  const FB = '2026-07-10'
  it('d/m/yyyy konvensi bank ID', () => {
    expect(parseFlexibleDate('05/07/2026', FB)).toBe('2026-07-05')
    expect(parseFlexibleDate('25-12-2026', FB)).toBe('2026-12-25')
  })
  it('mm/dd sumber US (bulan>12 di posisi kedua) di-swap', () => {
    expect(parseFlexibleDate('07/25/2026', FB)).toBe('2026-07-25')
  })
  it('yyyy-mm-dd & format parseable lain tanpa geser timezone', () => {
    expect(parseFlexibleDate('2026-07-01', FB)).toBe('2026-07-01')
  })
  it('tak valid → fallback', () => {
    expect(parseFlexibleDate('bukan tanggal', FB)).toBe(FB)
    expect(parseFlexibleDate('', FB)).toBe(FB)
  })
})

describe('parseCsvRows', () => {
  const TODAY = '2026-07-10'
  it('header Indonesia (Tanggal/Keterangan/Jumlah) + dd/mm/yyyy', () => {
    const rows = parseCsvRows(
      [{ Tanggal: '05/07/2026', Keterangan: 'Belanja pasar', Jumlah: 'Rp 125.000' }],
      [], TODAY,
    )
    expect(rows).toEqual([{
      date: '2026-07-05', description: 'Belanja pasar', amount: 125000,
      type: 'income', category: 'Gaji',
    }])
  })
  it('nominal negatif = expense; nominal 0 dibuang', () => {
    const rows = parseCsvRows(
      [
        { date: '2026-07-01', description: 'QRIS Kopi', amount: '-25000' },
        { date: '2026-07-01', description: 'kosong', amount: '0' },
      ],
      [], TODAY,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].type).toBe('expense')
    expect(rows[0].amount).toBe(25000)
  })
  it('cue debit whole-word: "debit" kena, "Checkout"/"payout" TIDAK', () => {
    const [a, b, c] = parseCsvRows(
      [
        { date: '2026-07-01', description: 'debit belanja', amount: '10000' },
        { date: '2026-07-01', description: 'Checkout Tokopedia refund', amount: '10000' },
        { date: '2026-07-01', description: 'payout affiliate', amount: '10000' },
      ],
      [], TODAY,
    )
    expect(a.type).toBe('expense')
    expect(b.type).toBe('income')
    expect(c.type).toBe('income')
  })
  it('rule menang atas heuristik + tanggal tak valid fallback today', () => {
    const rows = parseCsvRows(
      [{ date: 'bukan tanggal', description: 'gopay top up', amount: '50000' }],
      RULES, TODAY,
    )
    expect(rows[0]).toMatchObject({ date: TODAY, type: 'expense', category: 'Transport' })
  })
})

describe('csvCell / toCsv (formula injection + quoting)', () => {
  it('cell berawalan =,+,-,@ dinetralkan leading quote', () => {
    expect(csvCell('=SUM(A1:A9)')).toBe('"\'=SUM(A1:A9)"')
    expect(csvCell('@cmd')).toBe('"\'@cmd"')
    expect(csvCell('-500')).toBe('"\'-500"')
  })
  it('kutip ganda di-escape, null/undefined jadi string kosong', () => {
    expect(csvCell('Warung "Bu Sri"')).toBe('"Warung ""Bu Sri"""')
    expect(csvCell(null)).toBe('""')
  })
  it('toCsv join per baris dengan koma + newline', () => {
    expect(toCsv([['a', 'b'], ['1', '=x']])).toBe('"a","b"\n"1","\'=x"')
  })
})
