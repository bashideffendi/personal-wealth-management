'use client'

/**
 * Currency Rates widget — IDR rates for major currencies. Lives on the
 * Investment page since that's where FX rates actually matter
 * (USD-denominated stocks, gold pricing, crypto FX awareness, etc.).
 *
 * Uses the same /api/quotes endpoint (Yahoo Finance) that powers
 * stock prices, just with FX tickers like USDIDR=X. Server-side
 * cached 5 min in price_snapshots.
 */

import { useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import Image from 'next/image'

interface FxQuote {
  ticker: string
  price: number
  changePct: number | null
}

// `iso` = ISO 3166-1 alpha-2 country code (or 'eu' for European Union),
// matched to circle-flags filenames at hatscripts.github.io/circle-flags/flags/
const PAIRS: { ticker: string; code: string; iso: string; name: string }[] = [
  { ticker: 'USDIDR=X', code: 'USD', iso: 'us', name: 'US Dollar' },
  { ticker: 'SGDIDR=X', code: 'SGD', iso: 'sg', name: 'Singapore Dollar' },
  { ticker: 'EURIDR=X', code: 'EUR', iso: 'european_union', name: 'Euro' },
  { ticker: 'MYRIDR=X', code: 'MYR', iso: 'my', name: 'Malaysian Ringgit' },
  { ticker: 'JPYIDR=X', code: 'JPY', iso: 'jp', name: 'Japanese Yen' },
  { ticker: 'CNYIDR=X', code: 'CNY', iso: 'cn', name: 'Chinese Yuan' },
]

function formatRate(price: number): string {
  // JPY is around 105, USD is around 16500. Format both as IDR with separators.
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: price < 100 ? 2 : 0,
  }).format(price)
}

export function CurrencyRates() {
  const [quotes, setQuotes] = useState<Record<string, FxQuote>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  async function load() {
    setError(null)
    try {
      const tickers = PAIRS.map((p) => p.ticker).join(',')
      const res = await fetch(`/api/quotes?tickers=${encodeURIComponent(tickers)}`)
      if (!res.ok) throw new Error('Gagal ambil kurs')
      const json = (await res.json()) as { quotes?: FxQuote[] }
      const map: Record<string, FxQuote> = {}
      ;(json.quotes ?? []).forEach((q) => {
        map[q.ticker] = q
      })
      setQuotes(map)
      setUpdatedAt(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleRefresh() {
    setRefreshing(true)
    load()
  }

  return (
    <div className="s-card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="caps">Kurs Mata Uang</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
            1 unit ke Rupiah · update {updatedAt
              ? updatedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
              : '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="size-7 rounded-md flex items-center justify-center transition hover:bg-[var(--surface-2)] disabled:opacity-50"
          aria-label="Refresh kurs"
          title="Refresh kurs"
        >
          {refreshing ? (
            <Loader2 className="size-3.5 animate-spin" style={{ color: 'var(--ink-soft)' }} />
          ) : (
            <RefreshCw className="size-3.5" style={{ color: 'var(--ink-soft)' }} />
          )}
        </button>
      </div>

      {error ? (
        <p className="text-xs py-3 text-center" style={{ color: 'var(--ink-soft)' }}>
          {error}
        </p>
      ) : loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="size-4 animate-spin" style={{ color: 'var(--ink-soft)' }} />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2">
          {PAIRS.map((pair) => {
            const q = quotes[pair.ticker]
            const change = q?.changePct ?? null
            const changeColor =
              change === null
                ? 'var(--ink-soft)'
                : change >= 0
                  ? '#059669'
                  : '#DC2626'
            return (
              <div
                key={pair.ticker}
                className="rounded-lg border p-2.5"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border-soft)' }}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Image
                      src={`https://hatscripts.github.io/circle-flags/flags/${pair.iso}.svg`}
                      alt={`Bendera ${pair.name}`}
                      width={20}
                      height={20}
                      className="shrink-0 rounded-full ring-1 ring-black/5"
                      unoptimized
                    />
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--ink)' }}>
                      {pair.code}
                    </span>
                  </div>
                  {change !== null && (
                    <span
                      className="text-[10px] num tabular font-medium shrink-0"
                      style={{ color: changeColor }}
                    >
                      {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                    </span>
                  )}
                </div>
                <p className="text-[13px] num tabular font-semibold mt-1" style={{ color: 'var(--ink)' }}>
                  {q ? `Rp ${formatRate(q.price)}` : '—'}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
