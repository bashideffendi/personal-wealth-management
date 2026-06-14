import { describe, it, expect } from 'vitest'
import {
  getSuitability,
  getAvoidReason,
  suitabilityBadgeClass,
  suitabilityLabel,
  METHOD_INFO,
  METHOD_ORDER,
} from './valuation-methods'

describe('getSuitability', () => {
  it('mapping sektor yang dispesifikkan', () => {
    expect(getSuitability('DCF', 'Healthcare')).toBe('ideal')
    expect(getSuitability('DCF', 'Financials')).toBe('avoid')
    expect(getSuitability('DDM', 'Utilities')).toBe('ideal')
    expect(getSuitability('EV/EBIT', 'Financials')).toBe('avoid')
  })
  it('default "works": sektor null / tidak dikenal / metode tidak dikenal', () => {
    expect(getSuitability('DCF', null)).toBe('works')
    expect(getSuitability('DCF', 'Sektor Ngaco')).toBe('works')
    expect(getSuitability('MetodeNgaco', 'Healthcare')).toBe('works')
  })
})

describe('getAvoidReason', () => {
  it('sektor avoid → alasan (string non-kosong)', () => {
    expect(getAvoidReason('DCF', 'Financials')).toMatch(/[Bb]ank/)
    expect(getAvoidReason('Graham', 'Technology')).toBeTruthy()
  })
  it('non-avoid / null / metode tak dikenal → null', () => {
    expect(getAvoidReason('DCF', 'Healthcare')).toBeNull()
    expect(getAvoidReason('DCF', null)).toBeNull()
    expect(getAvoidReason('MetodeNgaco', 'Financials')).toBeNull()
  })
})

describe('badge/label helpers', () => {
  it('label Indonesia', () => {
    expect(suitabilityLabel('ideal')).toBe('Ideal')
    expect(suitabilityLabel('works')).toBe('Berlaku')
    expect(suitabilityLabel('avoid')).toBe('Kurang cocok')
  })
  it('badge class beda per tier', () => {
    expect(suitabilityBadgeClass('ideal')).toContain('emerald')
    expect(suitabilityBadgeClass('avoid')).toContain('rose')
    expect(suitabilityBadgeClass('works')).toContain('muted')
  })
})

describe('METHOD_INFO / METHOD_ORDER — integritas data', () => {
  it('METHOD_ORDER (13) semuanya ada di METHOD_INFO', () => {
    expect(METHOD_ORDER).toHaveLength(13)
    for (const k of METHOD_ORDER) {
      expect(METHOD_INFO[k], k).toBeDefined()
      expect(METHOD_INFO[k].key, k).toBe(k)
    }
  })

  it('semua nilai sectorSuitability valid (ideal/works/avoid)', () => {
    const valid = new Set(['ideal', 'works', 'avoid'])
    for (const [k, info] of Object.entries(METHOD_INFO)) {
      for (const [sector, s] of Object.entries(info.sectorSuitability)) {
        expect(valid.has(s), `${k}.${sector}=${s}`).toBe(true)
      }
    }
  })

  it('setiap sektor "avoid" PUNYA avoidReason (kontrak: jangan ada avoid tanpa alasan)', () => {
    for (const [k, info] of Object.entries(METHOD_INFO)) {
      for (const [sector, s] of Object.entries(info.sectorSuitability)) {
        if (s === 'avoid') {
          expect(getAvoidReason(k, sector), `${k}.${sector} avoid tanpa reason`).toBeTruthy()
        }
      }
    }
  })
})
