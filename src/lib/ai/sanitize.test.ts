import { describe, it, expect } from 'vitest'
import {
  amount,
  isoDate,
  sanitizeParsedTransaction,
  sanitizeReceipt,
  sanitizeMutasi,
  MAX_AMOUNT,
  MAX_MUTASI_ROWS,
} from './sanitize'

describe('amount', () => {
  it('membulatkan, membuang tanda negatif, dan clamp', () => {
    expect(amount(47000)).toBe(47000)
    expect(amount(1234.6)).toBe(1235)
    expect(amount(-500)).toBe(500)
    expect(amount('25000')).toBe(25000)
    expect(amount(1e30)).toBe(MAX_AMOUNT)
  })
  it('non-angka → null', () => {
    expect(amount('abc')).toBeNull()
    expect(amount(NaN)).toBeNull()
    expect(amount(Infinity)).toBeNull()
    expect(amount(undefined)).toBeNull()
    expect(amount({})).toBeNull()
  })
})

describe('isoDate', () => {
  it('menerima tanggal kalender valid', () => {
    expect(isoDate('2026-02-28')).toBe('2026-02-28')
  })
  it('menolak format/tanggal invalid', () => {
    expect(isoDate('2026-02-30')).toBeNull()
    expect(isoDate('28/02/2026')).toBeNull()
    expect(isoDate('1900-01-01')).toBeNull()
    expect(isoDate(20260228)).toBeNull()
  })
})

describe('sanitizeParsedTransaction', () => {
  it('meloloskan output valid apa adanya', () => {
    const out = sanitizeParsedTransaction({
      type: 'expense', amount: 47000, category: 'Makanan', description: 'indomaret', confidence: 'high',
    })
    expect(out).toEqual({
      type: 'expense', amount: 47000, category: 'Makanan', description: 'indomaret', payment_hint: '', confidence: 'high',
    })
  })
  it('menormalkan enum asing, kategori asing, string panjang (prompt injection)', () => {
    const out = sanitizeParsedTransaction({
      type: 'transfer_all_funds',
      amount: -9e20,
      category: 'DROP TABLE',
      description: 'x'.repeat(5000),
      confidence: 'absolutely',
      extra_action: 'delete_account',
    })!
    expect(out.type).toBe('expense')
    expect(out.amount).toBe(MAX_AMOUNT)
    expect(out.category).toBe('Lainnya')
    expect(out.description.length).toBe(200)
    expect(out.confidence).toBe('low')
    expect(out).not.toHaveProperty('extra_action')
  })
  it('tanpa amount → null', () => {
    expect(sanitizeParsedTransaction({ type: 'expense' })).toBeNull()
    expect(sanitizeParsedTransaction(null)).toBeNull()
  })
})

describe('sanitizeReceipt', () => {
  it('tanggal invalid → hari ini + confidence turun', () => {
    const out = sanitizeReceipt(
      { merchant: 'Toko', date: 'kemarin', total: 25500, type: 'expense', category: 'Makanan', description: 'd', payment_method: 'bitcoin', payment_detail: '', confidence: 'high' },
      '2026-10-21',
    )!
    expect(out.date).toBe('2026-10-21')
    expect(out.confidence).toBe('medium')
    expect(out.payment_method).toBe('unknown')
    expect(out.total).toBe(25500)
  })
  it('total bukan angka → null', () => {
    expect(sanitizeReceipt({ total: 'banyak' }, '2026-10-21')).toBeNull()
  })
})

describe('sanitizeMutasi', () => {
  it('membuang baris invalid dan clamp jumlah baris', () => {
    const rows = [
      { date: '2026-10-01', description: 'gaji', amount: 1000, type: 'income', category: 'Gaji', confidence: 'high', is_transfer: false },
      { date: 'bad', description: 'x', amount: 1, type: 'expense', category: 'Makanan', confidence: 'high', is_transfer: false },
      { date: '2026-10-02', description: 'nol', amount: 0, type: 'expense', category: 'Makanan', confidence: 'high', is_transfer: false },
      { date: '2026-10-03', description: 'aneh', amount: 5, type: 'saving', category: '???', confidence: 'x', is_transfer: 'yes' },
      'string row',
    ]
    const out = sanitizeMutasi({ transactions: rows, bank_name: 'BCA', period_start: '2026-10-01', period_end: 'nope' })
    expect(out.transactions).toHaveLength(2)
    expect(out.transactions[1]).toEqual({
      date: '2026-10-03', description: 'aneh', amount: 5, type: 'expense', category: 'Lainnya', confidence: 'low', is_transfer: false,
    })
    expect(out.bank_name).toBe('BCA')
    expect(out.period_start).toBe('2026-10-01')
    expect(out).not.toHaveProperty('period_end')
  })
  it('cap baris maksimum', () => {
    const many = Array.from({ length: MAX_MUTASI_ROWS + 50 }, () => ({ date: '2026-10-01', amount: 1, type: 'expense', category: 'Makanan' }))
    expect(sanitizeMutasi({ transactions: many }).transactions).toHaveLength(MAX_MUTASI_ROWS)
  })
  it('payload bukan objek → array kosong', () => {
    expect(sanitizeMutasi(undefined)).toEqual({ transactions: [] })
  })
})
