'use client'

/**
 * Stock ticker autocomplete — typeahead over the IDX symbol catalog
 * (1082 stocks + reksadana, loaded once from /idx-symbols.json).
 *
 * Search matches on either ticker (case-insensitive prefix) or name
 * (case-insensitive substring). Results show ticker badge + name +
 * sector. Picking a result fires onSelect with the full record so the
 * parent form can auto-fill ticker + name + sector.
 *
 * Lazy-loads the catalog JSON only when the component first opens —
 * avoids shipping ~100KB to every page.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { StockLogo } from './stock-logo'

interface IdxSymbol {
  t: string  // ticker
  n: string  // name
  s: string  // sector
  ss: string | null  // subsector
}

interface Props {
  /** Current ticker value (just the bare ticker, no .JK) */
  value?: string | null
  /** Called when user picks a result */
  onSelect: (symbol: IdxSymbol) => void
  placeholder?: string
}

let catalogCache: IdxSymbol[] | null = null
let catalogPromise: Promise<IdxSymbol[]> | null = null

async function loadCatalog(): Promise<IdxSymbol[]> {
  if (catalogCache) return catalogCache
  if (catalogPromise) return catalogPromise
  catalogPromise = fetch('/idx-symbols.json')
    .then((r) => r.json() as Promise<IdxSymbol[]>)
    .then((data) => {
      catalogCache = data
      return data
    })
    .finally(() => {
      catalogPromise = null
    })
  return catalogPromise
}

export function StockTickerSearch({ value, onSelect, placeholder }: Props) {
  const [query, setQuery] = useState(value ?? '')
  const [open, setOpen] = useState(false)
  const [catalog, setCatalog] = useState<IdxSymbol[] | null>(null)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync value prop into local state
  useEffect(() => {
    setQuery(value ?? '')
  }, [value])

  // Lazy-load catalog when first opened
  useEffect(() => {
    if (!open || catalog) return
    setLoading(true)
    loadCatalog()
      .then((data) => setCatalog(data))
      .catch(() => setCatalog([]))
      .finally(() => setLoading(false))
  }, [open, catalog])

  // Click-outside to close
  useEffect(() => {
    if (!open) return
    function onPointer(e: PointerEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const results = useMemo(() => {
    if (!catalog) return []
    const q = query.trim().toUpperCase()
    if (!q) return catalog.slice(0, 25) // initial: show first 25
    const tickerMatches: IdxSymbol[] = []
    const nameMatches: IdxSymbol[] = []
    for (const item of catalog) {
      if (item.t.startsWith(q)) {
        tickerMatches.push(item)
      } else if (item.n.toUpperCase().includes(q)) {
        nameMatches.push(item)
      }
      if (tickerMatches.length + nameMatches.length >= 50) break
    }
    return [...tickerMatches, ...nameMatches].slice(0, 25)
  }, [catalog, query])

  function pick(s: IdxSymbol) {
    setQuery(s.t)
    onSelect(s)
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
          placeholder={placeholder ?? 'Cari ticker / nama (BBCA, telkom, ...)'}
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
              {query ? `Tidak ada hasil untuk "${query}"` : 'Memuat katalog...'}
            </p>
          ) : (
            results.map((s) => (
              <button
                key={s.t}
                type="button"
                onClick={() => pick(s)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--surface-2)] transition border-b last:border-0"
                style={{ borderColor: 'var(--border-soft)' }}
              >
                <StockLogo ticker={s.t} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[11px] font-mono font-bold tabular px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}
                    >
                      {s.t}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>
                      {s.s}
                    </span>
                  </div>
                  <p className="text-xs truncate mt-0.5" style={{ color: 'var(--ink)' }}>
                    {s.n}
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
