'use client'

/**
 * Research tab — list semua emiten IDX yang punya data valuasi.
 * Click ticker → buka halaman detail /stock/research/[ticker].
 *
 * Source: /api/idx-research (cached 1 day) — data dari kelolainvestasi
 * (snapshot quarterly).
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, ArrowUpRight, Loader2, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  formatIDRCompact,
  formatPercentValue,
  formatPrice,
  signColorVar,
  verdictStyle,
} from '@/lib/invest/format'

interface ResearchRow {
  ticker: string
  name: string
  sector: string | null
  price: number
  avgMoS: number | null
  verdict: string | null
  methodsValid: number
  avgFairValue: number | null
  medianFairValue: number | null
}

type SortKey = 'mos-desc' | 'mos-asc' | 'ticker' | 'price-desc'

export function StockResearchTab() {
  const [rows, setRows] = useState<ResearchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [verdictFilter, setVerdictFilter] = useState<string>('all')
  const [sectorFilter, setSectorFilter] = useState<string>('all')
  const [sort, setSort] = useState<SortKey>('mos-desc')

  useEffect(() => {
    let cancelled = false
    fetch('/api/idx-research')
      .then((r) => r.json())
      .then((data: { rows?: ResearchRow[] }) => {
        if (!cancelled) {
          setRows(data.rows ?? [])
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const sectors = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) if (r.sector) set.add(r.sector)
    return [...set].sort()
  }, [rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (q && !r.ticker.toLowerCase().includes(q) && !r.name.toLowerCase().includes(q)) {
        return false
      }
      if (sectorFilter !== 'all' && r.sector !== sectorFilter) return false
      if (verdictFilter !== 'all') {
        const v = (r.verdict || '').toUpperCase()
        if (verdictFilter === 'undervalued' && !v.includes('UNDER')) return false
        if (verdictFilter === 'fair' && !v.includes('FAIR')) return false
        if (verdictFilter === 'overvalued' && !v.includes('OVER')) return false
      }
      return true
    })
  }, [rows, query, sectorFilter, verdictFilter])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    switch (sort) {
      case 'mos-desc':
        arr.sort((a, b) => (b.avgMoS ?? -Infinity) - (a.avgMoS ?? -Infinity))
        break
      case 'mos-asc':
        arr.sort((a, b) => (a.avgMoS ?? Infinity) - (b.avgMoS ?? Infinity))
        break
      case 'ticker':
        arr.sort((a, b) => a.ticker.localeCompare(b.ticker))
        break
      case 'price-desc':
        arr.sort((a, b) => b.price - a.price)
        break
    }
    return arr
  }, [filtered, sort])

  if (loading) {
    return (
      <div className="py-16 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
        <Loader2 className="size-5 mx-auto animate-spin mb-2" />
        Memuat data riset…
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div
        className="rounded-xl border p-3 flex flex-wrap items-center gap-2"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="relative flex-1 min-w-[200px]">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5"
            style={{ color: 'var(--ink-soft)' }}
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari ticker atau nama emiten…"
            className="pl-9 h-9 text-sm"
          />
        </div>

        <Select value={verdictFilter} onValueChange={(v) => v && setVerdictFilter(v)}>
          <SelectTrigger className="h-9 w-[140px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua verdict</SelectItem>
            <SelectItem value="undervalued">Undervalued</SelectItem>
            <SelectItem value="fair">Fair Value</SelectItem>
            <SelectItem value="overvalued">Overvalued</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sectorFilter} onValueChange={(v) => v && setSectorFilter(v)}>
          <SelectTrigger className="h-9 w-[160px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua sektor</SelectItem>
            {sectors.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => v && setSort(v as SortKey)}>
          <SelectTrigger className="h-9 w-[140px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mos-desc">MoS terbesar</SelectItem>
            <SelectItem value="mos-asc">MoS terkecil</SelectItem>
            <SelectItem value="ticker">Alfabetis</SelectItem>
            <SelectItem value="price-desc">Harga termahal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
        {sorted.length} dari {rows.length} emiten · data snapshot dari
        kelolainvestasi (quarterly update)
      </p>

      <div
        className="rounded-2xl border overflow-hidden"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-left text-[10px] uppercase tracking-[0.08em] font-semibold border-b"
                style={{ color: 'var(--ink-soft)', borderColor: 'var(--border-soft)' }}
              >
                <th className="px-3 py-2.5">Ticker</th>
                <th className="px-3 py-2.5">Nama</th>
                <th className="px-3 py-2.5">Sektor</th>
                <th className="px-3 py-2.5 text-right">Harga</th>
                <th className="px-3 py-2.5 text-right">Fair Value</th>
                <th className="px-3 py-2.5 text-right">MoS</th>
                <th className="px-3 py-2.5">Verdict</th>
                <th className="px-3 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 200).map((r) => {
                const verdict = verdictStyle(r.verdict)
                return (
                  <tr
                    key={r.ticker}
                    className="border-t transition hover:bg-[var(--surface-2)]"
                    style={{ borderColor: 'var(--border-soft)' }}
                  >
                    <td className="px-3 py-2.5 font-mono font-semibold" style={{ color: 'var(--ink)' }}>
                      <Link
                        href={`/dashboard/assets/investment/stock/research/${r.ticker}`}
                        className="hover:underline inline-flex items-center gap-1"
                      >
                        {r.ticker}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 max-w-[200px] truncate text-xs" style={{ color: 'var(--ink-muted)' }}>
                      {r.name}
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--ink-soft)' }}>
                      {r.sector ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right num tabular text-xs" style={{ color: 'var(--ink)' }}>
                      {formatPrice(r.price)}
                    </td>
                    <td className="px-3 py-2.5 text-right num tabular text-xs" style={{ color: 'var(--ink-muted)' }}>
                      {formatIDRCompact(r.medianFairValue ?? r.avgFairValue)}
                    </td>
                    <td className="px-3 py-2.5 text-right num tabular text-xs font-semibold" style={{ color: signColorVar(r.avgMoS) }}>
                      {formatPercentValue(r.avgMoS)}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.verdict && (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
                          style={{ background: verdict.bg, color: verdict.fg }}
                        >
                          {r.verdict.toLowerCase()}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/dashboard/assets/investment/stock/research/${r.ticker}`}
                        className="inline-flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--c-mint)] transition"
                        aria-label={`Buka research ${r.ticker}`}
                      >
                        <ArrowUpRight className="size-4" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {sorted.length > 200 && (
          <p className="px-4 py-3 text-xs text-center border-t" style={{ color: 'var(--ink-soft)', borderColor: 'var(--border-soft)' }}>
            +{sorted.length - 200} emiten lain — filter lebih spesifik buat narrow down
          </p>
        )}
      </div>

      <div
        className="rounded-lg border p-3 text-[11px] flex items-start gap-2"
        style={{
          background: 'var(--surface-2)',
          borderColor: 'var(--border-soft)',
          color: 'var(--ink-muted)',
        }}
      >
        <Sparkles className="size-3.5 shrink-0 mt-0.5" style={{ color: 'var(--c-mint)' }} />
        <span>
          MoS = Margin of Safety. Positif berarti fair value di atas harga pasar
          (undervalued). Data dihitung dari 8 metode valuasi (DCF, Graham, EPV,
          RelPER, RelPBV, DDM, NAV, EV/EBIT). Bukan rekomendasi investasi.
        </span>
      </div>
    </div>
  )
}
