import { describe, it, expect } from 'vitest'
import { IDX_BROKERS, getBrokerByCode, getBrokerByName, computeFee } from './idx-brokers'

// Ambil broker nyata dgn rate > 0 dan buyRate ≠ sellRate (decouple dari nilai
// rate spesifik biar test gak getas saat data broker diperbarui).
const sample = IDX_BROKERS.find((b) => b.code && b.buyRate > 0 && b.sellRate !== b.buyRate)!

describe('getBrokerByCode', () => {
  it('ketemu by code (case-insensitive)', () => {
    expect(getBrokerByCode(sample.code)?.code).toBe(sample.code)
    expect(getBrokerByCode(sample.code.toLowerCase())?.code).toBe(sample.code)
  })
  it('null / kosong / tak dikenal → undefined', () => {
    expect(getBrokerByCode(null)).toBeUndefined()
    expect(getBrokerByCode('')).toBeUndefined()
    expect(getBrokerByCode('ZZZ')).toBeUndefined()
  })
})

describe('getBrokerByName', () => {
  it('match by name / short', () => {
    expect(getBrokerByName(sample.name)?.code).toBe(sample.code)
    expect(getBrokerByName(sample.short)?.code).toBe(sample.code)
  })
  it('null / tak dikenal → undefined', () => {
    expect(getBrokerByName(null)).toBeUndefined()
    expect(getBrokerByName('Bukan Broker')).toBeUndefined()
  })
})

describe('computeFee', () => {
  it('buy pakai buyRate, sell pakai sellRate, dibulatkan', () => {
    const V = 10_000_000
    expect(computeFee(sample.code, 'buy', V)).toBe(Math.round(V * sample.buyRate))
    expect(computeFee(sample.code, 'sell', V)).toBe(Math.round(V * sample.sellRate))
  })
  it('buy ≠ sell saat rate beda', () => {
    const V = 10_000_000
    expect(computeFee(sample.code, 'buy', V)).not.toBe(computeFee(sample.code, 'sell', V))
  })
  it('broker tak dikenal / kosong → null', () => {
    expect(computeFee('ZZZ', 'buy', 1_000_000)).toBeNull()
    expect(computeFee('', 'buy', 1_000_000)).toBeNull() // Tunai (code '') → guard !code
    expect(computeFee(null, 'sell', 1_000_000)).toBeNull()
  })
})
