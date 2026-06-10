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
import { useT } from '@/lib/i18n/context'

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
  const t = useT()
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
      if (!res.ok) throw new Error('fx')
      const json = (await res.json()) as { quotes?: FxQuote[] }
      const map: Record<string, FxQuote> = {}
      ;(json.quotes ?? []).forEach((q) => {
        map[q.ticker] = q
      })
      setQuotes(map)
      setUpdatedAt(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fx')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function handleRefresh() {
    setRefreshing(true)
    load()
  }

  return (
    <div className="s-card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="eyebrow">{t('investment.fx_title')}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
            {t('investment.fx_subtitle')} {updatedAt
              ? updatedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
              : '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="size-7 rounded-md flex items-center justify-center transition hover:bg-[var(--surface-2)] disabled:opacity-50"
          aria-label={t('investment.fx_refresh')}
          title={t('investment.fx_refresh')}
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
          {t('investment.fx_error')}
        </p>
      ) : loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="size-4 animate-spin" style={{ color: 'var(--ink-soft)' }} />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
          {PAIRS.map((pair) => {
            const q = quotes[pair.ticker]
            const change = q?.changePct ?? null
            const changeColor =
              change === null
                ? 'var(--ink-soft)'
                : change >= 0
                  ? 'var(--c-mint-ink)'
                  : 'var(--c-coral-ink)'
            return (
              <div
                key={pair.ticker}
                className="rounded-xl border p-3"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border-soft)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Flag bumped from 20px → 32px per user feedback —
                        feels more "country card" less microbadge */}
                    <Image
                      src={`/flag-logos/${pair.iso}.svg`}
                      alt={`${t('investment.fx_flag_alt')} ${pair.name}`}
                      width={32}
                      height={32}
                      className="shrink-0 rounded-full ring-1 ring-black/10 shadow-sm"
                      unoptimized
                    />
                    <span className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
                      {pair.code}
                    </span>
                  </div>
                  {change !== null && (
                    <span
                      className="text-[10px] num tabular font-semibold shrink-0 px-1.5 py-0.5 rounded"
                      style={{
                        color: changeColor,
                        background: change >= 0 ? 'var(--c-mint-soft)' : 'var(--c-coral-soft)',
                      }}
                    >
                      {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                    </span>
                  )}
                </div>
                <p className="num tabular text-base font-bold mt-2" style={{ color: 'var(--ink)' }}>
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
