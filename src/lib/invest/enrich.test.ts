import { describe, it, expect } from 'vitest'
import { enrichHolding, tickerToQuoteSymbol, quoteKey, type LiveQuote } from './enrich'
import type { Investment } from '@/types'

// Holding minimal — cuma field yang dibaca enrich.
function inv(partial: Partial<Investment>): Investment {
  return {
    id: 'x', user_id: 'u', name: 'Test', category: 'stock_idx',
    ticker: null, quantity: 0, avg_cost: 0, current_price: 0,
    ...partial,
  } as Investment
}

const USD_IDR = 16_000

describe('enrichHolding', () => {
  it('converts USD quotes to IDR (US stock)', () => {
    const e = enrichHolding(
      inv({ category: 'stock_us', ticker: 'AAPL', quantity: 10, avg_cost: 2_000_000 }),
      { price: 150, currency: 'USD', changePct: 1 },
      USD_IDR,
    )
    expect(e.live).toBe(150 * USD_IDR)
    expect(e.invested).toBe(20_000_000)
    expect(e.market).toBe(10 * 150 * USD_IDR)
    expect(e.pl).toBe(e.market - e.invested)
  })

  it('passes IDR quotes through unmultiplied (IDX stock)', () => {
    const e = enrichHolding(
      inv({ ticker: 'BBCA.JK', quantity: 100, avg_cost: 9_000 }),
      { price: 10_000, currency: 'IDR', changePct: null },
      USD_IDR,
    )
    expect(e.live).toBe(10_000)
    expect(e.market).toBe(1_000_000)
  })

  it('does NOT double-convert crypto (quote pre-converted to IDR)', () => {
    // Regresi nyata: crypto pernah ke-kali usdIdr dua kali di [slug] page.
    const q: LiveQuote = { price: 1_600_000_000, currency: 'IDR', changePct: 2 }
    const e = enrichHolding(inv({ category: 'crypto', ticker: 'BTC-USD', quantity: 0.5, avg_cost: 1_500_000_000 }), q, USD_IDR)
    expect(e.live).toBe(1_600_000_000)
    expect(e.market).toBe(800_000_000)
  })

  it('falls back to stored current_price when quote is missing', () => {
    const e = enrichHolding(inv({ quantity: 2, avg_cost: 500, current_price: 700 }), undefined, USD_IDR)
    expect(e.live).toBe(700)
    expect(e.market).toBe(1_400)
  })

  it('falls back to stored price when quote price is 0 (failed fetch)', () => {
    const e = enrichHolding(
      inv({ quantity: 2, avg_cost: 500, current_price: 700 }),
      { price: 0, currency: 'USD', changePct: null },
      USD_IDR,
    )
    expect(e.live).toBe(700)
  })

  it('falls back to avg_cost when current_price is also empty', () => {
    const e = enrichHolding(inv({ quantity: 3, avg_cost: 500, current_price: 0 }), undefined, USD_IDR)
    expect(e.live).toBe(500)
    expect(e.pl).toBe(0)
  })

  it('never returns NaN/Infinity for plPct on zero cost basis', () => {
    const e = enrichHolding(inv({ quantity: 5, avg_cost: 0, current_price: 100 }), undefined, USD_IDR)
    expect(e.invested).toBe(0)
    expect(e.plPct).toBe(0)
    expect(Number.isFinite(e.plPct)).toBe(true)
  })
})

describe('tickerToQuoteSymbol', () => {
  const forex = (ticker: string) => tickerToQuoteSymbol(inv({ category: 'forex', ticker }))

  it('normalizes every forex spelling to Yahoo FX form', () => {
    expect(forex('USD')).toBe('USDIDR=X')
    expect(forex('USD/IDR')).toBe('USDIDR=X')
    expect(forex('USD-IDR')).toBe('USDIDR=X')
    expect(forex('USDIDR=X')).toBe('USDIDR=X')
    expect(forex('sgd')).toBe('SGDIDR=X')
  })

  it('returns null for forex with no base currency', () => {
    expect(forex('IDR')).toBeNull()
    expect(forex('')).toBeNull()
  })

  it('passes non-forex tickers through uppercased', () => {
    expect(tickerToQuoteSymbol(inv({ ticker: 'bbca.jk' }))).toBe('BBCA.JK')
    expect(tickerToQuoteSymbol(inv({ ticker: null }))).toBeNull()
  })
})

describe('quoteKey', () => {
  it('trims, uppercases, and tolerates null/undefined', () => {
    expect(quoteKey('  aapl ')).toBe('AAPL')
    expect(quoteKey(null)).toBe('')
    expect(quoteKey(undefined)).toBe('')
  })
})
