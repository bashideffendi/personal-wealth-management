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
import { useT } from '@/lib/i18n/context'

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
  const t = useT()
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
        {t('stock_research.loading_research')}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div
        className="rounded-xl border p-3 flex flex-wrap items-center gap-2"
        style={{ boxShadow: 'var(--card-shadow)', background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="relative flex-1 min-w-[200px]">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5"
            style={{ color: 'var(--ink-soft)' }}
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('stock_research.search_placeholder')}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <Select value={verdictFilter} onValueChange={(v) => v && setVerdictFilter(v)}>
          <SelectTrigger className="h-9 w-[140px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('stock_research.verdict_all')}</SelectItem>
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
            <SelectItem value="all">{t('stock_research.sector_all')}</SelectItem>
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
            <SelectItem value="mos-desc">{t('stock_research.sort_mos_desc')}</SelectItem>
            <SelectItem value="mos-asc">{t('stock_research.sort_mos_asc')}</SelectItem>
            <SelectItem value="ticker">{t('stock_research.sort_ticker')}</SelectItem>
            <SelectItem value="price-desc">{t('stock_research.sort_price_desc')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
        {sorted.length} {t('stock_research.count_of')} {rows.length} {t('stock_research.count_emiten_suffix')}
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
                <th className="px-3 py-2.5">{t('stock_research.col_ticker')}</th>
                <th className="px-3 py-2.5">{t('stock_research.col_name')}</th>
                <th className="px-3 py-2.5">{t('stock_research.col_sector')}</th>
                <th className="px-3 py-2.5 text-right">{t('stock_research.col_price')}</th>
                <th className="px-3 py-2.5 text-right">{t('stock_research.col_fair_value')}</th>
                <th className="px-3 py-2.5 text-right">{t('stock_research.col_mos')}</th>
                <th className="px-3 py-2.5">{t('stock_research.col_verdict')}</th>
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
                        aria-label={`${t('stock_research.aria_open_research')} ${r.ticker}`}
                      >
                        <ArrowUpRight className="size-4" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {loading && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>{t('stock_research.loading_emiten')}</td>
                </tr>
              )}
              {!loading && sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>{t('stock_research.empty_filter')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {sorted.length > 200 && (
          <p className="px-4 py-3 text-xs text-center border-t" style={{ color: 'var(--ink-soft)', borderColor: 'var(--border-soft)' }}>
            +{sorted.length - 200} {t('stock_research.overflow_more')}
          </p>
        )}
      </div>

      <div
        className="rounded-lg border p-3 text-[11px] flex items-start gap-2"
        style={{
          boxShadow: 'var(--card-shadow)', background: 'var(--surface-2)',
          borderColor: 'var(--border-soft)',
          color: 'var(--ink-muted)',
        }}
      >
        <Sparkles className="size-3.5 shrink-0 mt-0.5" style={{ color: 'var(--c-mint)' }} />
        <span>
          {t('stock_research.footer_disclaimer')}
        </span>
      </div>
    </div>
  )
}
