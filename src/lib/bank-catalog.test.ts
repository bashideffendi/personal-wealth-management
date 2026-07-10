import { describe, it, expect } from 'vitest'
import { BANK_CATALOG, filterCatalog, catalogInstitution } from './bank-catalog'

describe('BANK_CATALOG — integritas data', () => {
  it('semua item punya type valid & warna hex', () => {
    for (const it of BANK_CATALOG) {
      expect(['bank', 'digital_wallet', 'rdn']).toContain(it.type)
      expect(it.name.trim()).not.toBe('')
      expect(it.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })
  it('nama unik (gak ada duplikat di picker)', () => {
    const names = BANK_CATALOG.map((i) => i.name)
    expect(new Set(names).size).toBe(names.length)
  })
  it('punya minimal 1 item tiap grup', () => {
    for (const g of ['bank', 'digital_wallet', 'rdn'] as const) {
      expect(BANK_CATALOG.some((i) => i.type === g)).toBe(true)
    }
  })
})

describe('filterCatalog', () => {
  it('query kosong → hanya item grup terpilih', () => {
    const banks = filterCatalog('', 'bank')
    expect(banks.length).toBeGreaterThan(0)
    expect(banks.every((i) => i.type === 'bank')).toBe(true)

    const wallets = filterCatalog('   ', 'digital_wallet') // whitespace = kosong
    expect(wallets.every((i) => i.type === 'digital_wallet')).toBe(true)
  })

  it('query aktif → cari LINTAS grup (gak buntu di grup salah)', () => {
    // "GoPay" e-wallet harus ketemu walau grup terpilih 'bank'
    const res = filterCatalog('gopay', 'bank')
    expect(res.some((i) => i.name === 'GoPay')).toBe(true)
  })

  it('case-insensitive & cocokkan substring nama', () => {
    expect(filterCatalog('bca', 'bank').some((i) => i.name === 'BCA')).toBe(true)
    expect(filterCatalog('MANDIRI', 'rdn').some((i) => i.name === 'Mandiri')).toBe(true)
  })

  it('cocokkan lewat logoBrand juga (mis. "mega" → Bank Mega)', () => {
    const res = filterCatalog('mega', 'digital_wallet')
    expect(res.some((i) => i.name === 'Bank Mega')).toBe(true)
  })

  it('query gak match apa-apa → array kosong', () => {
    expect(filterCatalog('zzznotabank', 'bank')).toEqual([])
  })
})

describe('catalogInstitution', () => {
  it('mengembalikan undefined atau FinancialInstitution (gak melempar)', () => {
    for (const it of BANK_CATALOG) {
      const inst = catalogInstitution(it)
      expect(inst === undefined || typeof inst === 'object').toBe(true)
    }
  })
})
