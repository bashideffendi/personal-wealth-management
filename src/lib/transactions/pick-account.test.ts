import { describe, expect, it } from 'vitest'
import { pickAccount } from './pick-account'

const BASE = {
  accounts: [
    { id: 'acc-bca', name: 'BCA Utama', type: 'bank' },
    { id: 'acc-cash', name: 'Dompet', type: 'cash' },
  ],
  creditCards: [{ id: 'cc-visa', name: 'Visa Platinum' }],
}

describe('pickAccount — 4 lapis prioritas', () => {
  it('nol akun & kartu → null', () => {
    expect(pickAccount({ accounts: [], creditCards: [] })).toBeNull()
  })
  it('lapis 1: payment_detail AI match nama akun (substring dua arah)', () => {
    expect(pickAccount({ ...BASE, extracted: { payment_detail: 'bca' } }))
      .toEqual({ id: 'acc-bca', source: 'ai' })
    expect(pickAccount({ ...BASE, extracted: { payment_detail: 'kredit visa platinum gold' } }))
      .toEqual({ id: 'cc-visa', source: 'ai' })
  })
  it('lapis 1: method credit_card → kartu pertama; cash → akun cash', () => {
    expect(pickAccount({ ...BASE, extracted: { payment_method: 'credit_card' } }))
      .toEqual({ id: 'cc-visa', source: 'ai' })
    expect(pickAccount({ ...BASE, extracted: { payment_method: 'cash' } }))
      .toEqual({ id: 'acc-cash', source: 'ai' })
  })
  it('lapis 2: default tersimpan menang atas last-used (dan divalidasi masih ada)', () => {
    expect(pickAccount({ ...BASE, defaultAccountId: 'cc-visa', lastUsedAccountId: 'acc-bca' }))
      .toEqual({ id: 'cc-visa', source: 'default' })
    expect(pickAccount({ ...BASE, defaultAccountId: 'acc-terhapus', lastUsedAccountId: 'acc-bca' }))
      .toEqual({ id: 'acc-bca', source: 'last_used' })
  })
  it('lapis 4: fallback prefer akun cash, lalu akun pertama', () => {
    expect(pickAccount(BASE)).toEqual({ id: 'acc-cash', source: 'first' })
    expect(pickAccount({ accounts: [{ id: 'acc-bca', name: 'BCA', type: 'bank' }], creditCards: [] }))
      .toEqual({ id: 'acc-bca', source: 'first' })
    expect(pickAccount({ accounts: [], creditCards: [{ id: 'cc-visa', name: 'Visa' }] }))
      .toEqual({ id: 'cc-visa', source: 'first' })
  })
})
