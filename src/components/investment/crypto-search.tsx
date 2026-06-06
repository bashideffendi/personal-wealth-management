'use client'

/**
 * Crypto coin autocomplete — typeahead over the FULL Binance USDT
 * universe (~400 pairs), enriched with full names from our curated
 * top-100 catalog so popular coins show "Bitcoin" not just "BTC".
 *
 * Two data sources combined on first focus:
 *   1. /api/crypto-symbols → live Binance exchangeInfo (filtered to
 *      USDT pairs, deduped by base asset). Cached server-side 1h.
 *   2. /crypto-symbols.json → our curated symbol→name mapping (~85
 *      top coins). Provides full names for the popular ones.
 *
 * Coins on Binance but not in our name catalog still appear in
 * results — just without a full name (only symbol shown). User can
 * still pick them.
 */

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { CryptoLogo } from './crypto-logo'
import { useT } from '@/lib/i18n/context'

interface CryptoSymbol {
  s: string  // symbol (BTC, ETH)
  n?: string // full name (Bitcoin, Ethereum) — optional, only set for top-100
}

interface Props {
  /** Current ticker value (whatever form — we just pre-fill) */
  value?: string | null
  /** Called when user picks a coin */
  onSelect: (sym: CryptoSymbol) => void
  placeholder?: string
}

let catalogCache: CryptoSymbol[] | null = null
let catalogPromise: Promise<CryptoSymbol[]> | null = null

async function loadCatalog(): Promise<CryptoSymbol[]> {
  if (catalogCache) return catalogCache
  if (catalogPromise) return catalogPromise
  catalogPromise = (async () => {
    // Fetch both in parallel
    const [binanceRes, curatedRes] = await Promise.all([
      fetch('/api/crypto-symbols').then((r) => r.ok ? r.json() : { symbols: [] }) as Promise<{ symbols: { s: string }[] }>,
      fetch('/crypto-symbols.json').then((r) => r.ok ? r.json() : []) as Promise<CryptoSymbol[]>,
    ])

    // Build symbol → name map from curated catalog
    const nameMap = new Map<string, string>()
    for (const c of curatedRes) if (c.n) nameMap.set(c.s, c.n)

    // Merge: prefer Binance list (full universe), enrich with names where we have them
    const seen = new Set<string>()
    const merged: CryptoSymbol[] = []

    // Curated coins first (preserves market-cap order for popular results)
    for (const c of curatedRes) {
      if (seen.has(c.s)) continue
      seen.add(c.s)
      merged.push(c)
    }
    // Then Binance coins not already in curated
    for (const b of binanceRes.symbols) {
      if (seen.has(b.s)) continue
      seen.add(b.s)
      merged.push({ s: b.s, n: nameMap.get(b.s) })
    }

    catalogCache = merged
    return merged
  })().finally(() => { catalogPromise = null })
  return catalogPromise
}

export function CryptoSearch({ value, onSelect, placeholder }: Props) {
  const t = useT()
  // Show whatever the user previously chose / typed (extract bare symbol if present)
  const initialDisplay = value
    ? value.split(/[-_]/)[0].replace(/USDT$|BUSD$|USDC$|USD$/i, '').toUpperCase()
    : ''
  const [query, setQuery] = useState(initialDisplay)
  const [open, setOpen] = useState(false)
  const [catalog, setCatalog] = useState<CryptoSymbol[] | null>(null)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || catalog) return
    setLoading(true)
    loadCatalog()
      .then((data) => setCatalog(data))
      .catch(() => setCatalog([]))
      .finally(() => setLoading(false))
  }, [open, catalog])

  useEffect(() => {
    if (!open) return
    function onPointer(e: PointerEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  // Defer the filter input so typing stays buttery even on large catalogs
  // (Binance has ~400 USDT pairs). React batches the filter work behind the
  // input update — equivalent of a debounce without the timer plumbing.
  const deferredQuery = useDeferredValue(query)
  const results = useMemo(() => {
    if (!catalog) return []
    const q = deferredQuery.trim().toUpperCase()
    if (!q) return catalog.slice(0, 20)  // initial: top 20 by market cap order
    const symMatches: CryptoSymbol[] = []
    const nameMatches: CryptoSymbol[] = []
    for (const c of catalog) {
      if (c.s.startsWith(q)) {
        symMatches.push(c)
      } else if (c.n && c.n.toUpperCase().includes(q)) {
        nameMatches.push(c)
      }
      if (symMatches.length + nameMatches.length >= 30) break
    }
    return [...symMatches, ...nameMatches].slice(0, 20)
  }, [catalog, deferredQuery])

  function pick(c: CryptoSymbol) {
    setQuery(c.s)
    onSelect(c)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4"
          style={{ color: 'var(--ink-soft)' }}
        />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? t('crypto_search.placeholder')}
          className="w-full h-9 pl-8 pr-3 text-sm rounded-md border outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            color: 'var(--ink)',
          }}
        />
      </div>

      {open && (
        <div
          className="absolute z-50 left-0 right-0 mt-1 rounded-lg border shadow-xl max-h-72 overflow-y-auto"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            boxShadow: '0 10px 30px -8px rgba(0,0,0,0.18)',
          }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="size-4 animate-spin" style={{ color: 'var(--ink-soft)' }} />
            </div>
          ) : results.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs" style={{ color: 'var(--ink-soft)' }}>
              {query
                ? `${t('crypto_search.no_results')} "${query}-USD")`
                : t('crypto_search.loading_catalog')}
            </p>
          ) : (
            results.map((c) => (
              <button
                key={c.s}
                type="button"
                onClick={() => pick(c)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--surface-2)] transition border-b last:border-0"
                style={{ borderColor: 'var(--border-soft)' }}
              >
                <CryptoLogo symbol={c.s} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[11px] font-mono font-bold tabular px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}
                    >
                      {c.s}
                    </span>
                  </div>
                  <p className="text-xs truncate mt-0.5" style={{ color: 'var(--ink)' }}>
                    {c.n ?? <span style={{ color: 'var(--ink-soft)' }}>{t('crypto_search.no_name')}</span>}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
