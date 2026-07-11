import { describe, expect, it } from 'vitest'
import { ccContribution, computeCardDeltas, reverseCardDeltas } from './cc-delta'

const isCard = (id: string) => id.startsWith('cc-')

describe('ccContribution', () => {
  it('expense di kartu = amount', () => {
    expect(ccContribution({ type: 'expense', account_id: 'cc-1', amount: 150_000 }, isCard)).toBe(150_000)
  })
  it('expense di rekening biasa = 0', () => {
    expect(ccContribution({ type: 'expense', account_id: 'acc-1', amount: 150_000 }, isCard)).toBe(0)
  })
  it('income/saving/investment di kartu = 0 (refund tidak menurunkan otomatis — konsisten jalur manual)', () => {
    expect(ccContribution({ type: 'income', account_id: 'cc-1', amount: 99_000 }, isCard)).toBe(0)
    expect(ccContribution({ type: 'saving', account_id: 'cc-1', amount: 99_000 }, isCard)).toBe(0)
  })
  it('amount 0/negatif = 0', () => {
    expect(ccContribution({ type: 'expense', account_id: 'cc-1', amount: 0 }, isCard)).toBe(0)
    expect(ccContribution({ type: 'expense', account_id: 'cc-1', amount: -5 }, isCard)).toBe(0)
  })
})

describe('computeCardDeltas', () => {
  it('create expense di kartu: +amount', () => {
    expect(computeCardDeltas(null, { type: 'expense', account_id: 'cc-1', amount: 200_000 }, isCard))
      .toEqual({ 'cc-1': 200_000 })
  })
  it('edit nominal di kartu yang sama: net delta (kartu di dua sisi TIDAK dobel)', () => {
    expect(computeCardDeltas(
      { type: 'expense', account_id: 'cc-1', amount: 200_000 },
      { type: 'expense', account_id: 'cc-1', amount: 250_000 }, isCard,
    )).toEqual({ 'cc-1': 50_000 })
  })
  it('edit tanpa perubahan: kosong (delta 0 dibuang)', () => {
    expect(computeCardDeltas(
      { type: 'expense', account_id: 'cc-1', amount: 200_000 },
      { type: 'expense', account_id: 'cc-1', amount: 200_000 }, isCard,
    )).toEqual({})
  })
  it('pindah kartu CC-A → CC-B: -A dan +B simetris', () => {
    expect(computeCardDeltas(
      { type: 'expense', account_id: 'cc-a', amount: 100_000 },
      { type: 'expense', account_id: 'cc-b', amount: 100_000 }, isCard,
    )).toEqual({ 'cc-a': -100_000, 'cc-b': 100_000 })
  })
  it('pindah kartu → rekening biasa: kontribusi lama dibatalkan saja', () => {
    expect(computeCardDeltas(
      { type: 'expense', account_id: 'cc-1', amount: 100_000 },
      { type: 'expense', account_id: 'acc-1', amount: 100_000 }, isCard,
    )).toEqual({ 'cc-1': -100_000 })
  })
  it('ubah tipe expense → income di kartu: kontribusi dibatalkan', () => {
    expect(computeCardDeltas(
      { type: 'expense', account_id: 'cc-1', amount: 100_000 },
      { type: 'income', account_id: 'cc-1', amount: 100_000 }, isCard,
    )).toEqual({ 'cc-1': -100_000 })
  })
})

describe('reverseCardDeltas', () => {
  it('bulk delete: net negatif per kartu, non-kartu & non-expense diabaikan', () => {
    expect(reverseCardDeltas([
      { type: 'expense', account_id: 'cc-1', amount: 100_000 },
      { type: 'expense', account_id: 'cc-1', amount: 50_000 },
      { type: 'expense', account_id: 'cc-2', amount: 75_000 },
      { type: 'expense', account_id: 'acc-1', amount: 999_999 },
      { type: 'income', account_id: 'cc-1', amount: 10_000 },
    ], isCard)).toEqual({ 'cc-1': -150_000, 'cc-2': -75_000 })
  })
  it('kosong → kosong', () => {
    expect(reverseCardDeltas([], isCard)).toEqual({})
  })
})
