'use client'

/**
 * HoldingTable — all positions with a per-class filter, PLUS the wedge:
 * IDX stock holdings show their fair value + margin-of-safety inline (from
 * the bundled valuation engine) and deep-link into the research page. This
 * is the connective tissue between "your money" and "the research" — the
 * combination no other local product has.
 *
 * Filter-tab state lives HERE, so clicking a pill re-renders just this table.
 * Framing rule: estimates from public financial statements — informational,
 * never prescriptive (no "beli/jual"), disclaimer lives on the research page.
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ArrowUpRight, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { toCsv } from '@/lib/transactions/csv'
import { useT } from '@/lib/i18n/context'
import { assetClassKey, ASSET_CLASS_META, ASSET_CLASS_ORDER, type AssetClassKey } from '@/lib/invest/asset-class'
import { tickerToQuoteSymbol, type EnrichedHolding, type LiveQuote } from '@/lib/invest/enrich'

export interface HoldingTableProps {
  enriched: EnrichedHolding[]
  quotes: Record<string, LiveQuote>
}

interface ValuationRow {
  ticker: string
  avgMoS: number | null
  verdict: string
  avgFairValue: number | null
  medianFairValue: number | null
}

const priceFmt = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

/** Kolom yang bisa di-sort (desktop). P/L & day change sort by PERSEN. */
type SortKey = 'sym' | 'qty' | 'market' | 'fairValue' | 'plPct' | 'changePct'
const NUMERIC_SORT_KEYS = new Set<SortKey>(['qty', 'market', 'fairValue', 'plPct', 'changePct'])

/** Verdict → visual tone + casual-ID label. MoS > 0 = price below fair value. */
function verdictTone(verdict: string | undefined, t: (k: string) => string) {
  if (!verdict) return null
  if (verdict.includes('UNDER')) return { bg: 'var(--c-mint-soft)', color: 'var(--c-mint-ink)', label: t('investment.verdict_under') }
  if (verdict.includes('OVER')) return { bg: 'var(--c-coral-soft)', color: 'var(--c-coral-ink)', label: t('investment.verdict_over') }
  if (verdict.includes('FAIR')) return { bg: 'var(--c-amber-soft)', color: 'var(--c-amber-ink)', label: t('investment.verdict_fair') }
  return null
}

export function HoldingTable({ enriched, quotes }: HoldingTableProps) {
  const t = useT()
  const [tab, setTab] = useState<'all' | AssetClassKey>('all')
  // Sort desktop-only (header sortable disembunyikan <md); default nilai desc.
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'market', dir: 'desc' })

  // IDX tickers in the portfolio → valuation lookup (1k+ emiten engine).
  const idxTickers = useMemo(() => {
    return Array.from(new Set(
      enriched
        .filter((e) => assetClassKey(e.i) === 'stock_idx')
        .map((e) => (e.i.ticker ?? '').replace(/\.JK$/i, '').trim().toUpperCase())
        .filter(Boolean),
    )).sort()
  }, [enriched])

  const valuationQuery = useQuery({
    queryKey: ['idx-valuations', idxTickers.join(',')],
    enabled: idxTickers.length > 0,
    staleTime: 60 * 60 * 1000, // valuations move quarterly, not per-render
    queryFn: async () => {
      const res = await fetch(`/api/idx-research?tickers=${encodeURIComponent(idxTickers.join(','))}`)
      if (!res.ok) throw new Error('valuations')
      const json = (await res.json()) as { rows?: ValuationRow[] }
      const map = new Map<string, ValuationRow>()
      for (const r of json.rows ?? []) map.set(r.ticker.toUpperCase(), r)
      return map
    },
  })
  const valuations = valuationQuery.data

  // Tabs: Semua + each class that actually has positions.
  const holdingTabs = useMemo(() => {
    const counts = new Map<AssetClassKey, number>()
    for (const e of enriched) {
      const k = assetClassKey(e.i)
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    const present = ASSET_CLASS_ORDER.filter((k) => (counts.get(k) ?? 0) > 0)
    return [
      { key: 'all' as const, label: t('investment.tab_all') },
      ...present.map((k) => ({ key: k as 'all' | AssetClassKey, label: ASSET_CLASS_META[k].label })),
    ]
  }, [enriched, t])

  const holdingRows = useMemo(() => {
    return enriched
      .filter((e) => tab === 'all' || assetClassKey(e.i) === tab)
      .map((e) => {
        const ck = assetClassKey(e.i)
        const sym = tickerToQuoteSymbol(e.i)
        const bare = (e.i.ticker ?? '').replace(/\.JK$/i, '').toUpperCase()
        const val = ck === 'stock_idx' && valuations ? valuations.get(bare) : undefined
        return {
          id: e.i.id,
          name: e.i.name,
          sym: bare,
          classKey: ck,
          classLabel: ASSET_CLASS_META[ck].label,
          classColor: ASSET_CLASS_META[ck].color,
          qty: e.i.quantity,
          price: e.live,
          market: e.market,
          pl: e.pl,
          plPct: e.invested > 0 ? (e.pl / e.invested) * 100 : null,
          changePct: sym ? (quotes[sym]?.changePct ?? null) : null,
          fairValue: val?.avgFairValue ?? val?.medianFairValue ?? null,
          mos: val?.avgMoS ?? null,
          verdict: val?.verdict,
          href: ck === 'stock_idx' && bare
            ? `/dashboard/assets/investment/stock/research/${bare}`
            : ck === 'crypto' && bare
              ? `/dashboard/assets/investment/crypto/${bare}`
              : null,
        }
      })
      .sort((a, b) => b.market - a.market)
  }, [enriched, tab, quotes, valuations])

  // Urutan desktop mengikuti sort klik-header; mobile TETAP pakai holdingRows
  // (nilai desc) — jadi tampilan <md tidak berubah. Null/kosong selalu di bawah.
  const sortedRows = useMemo(() => {
    const { key, dir } = sort
    const mul = dir === 'asc' ? 1 : -1
    const arr = [...holdingRows]
    arr.sort((a, b) => {
      const va = a[key] === '' ? null : a[key]
      const vb = b[key] === '' ? null : b[key]
      if (va == null && vb == null) return b.market - a.market
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'string' || typeof vb === 'string') return String(va).localeCompare(String(vb)) * mul
      return (va - vb) * mul
    })
    return arr
  }, [holdingRows, sort])

  function toggleSort(key: SortKey) {
    setSort((prev) => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: NUMERIC_SORT_KEYS.has(key) ? 'desc' : 'asc' })
  }

  // Export CSV — REUSE toCsv (quoting + anti formula-injection, tested);
  // pola download blob sama dengan exportCSV di transactions/page.tsx.
  function exportCsv() {
    const header = ['Simbol', 'Nama', 'Lot/Unit', 'Nilai', 'Fair Value', 'P/L', 'P/L%', 'Day Change']
    const csv = toCsv([
      header,
      ...sortedRows.map((r) => [
        r.sym,
        r.name,
        r.qty,
        Math.round(r.market),
        r.fairValue != null ? Math.round(r.fairValue) : '',
        Math.round(r.pl),
        r.plPct != null ? r.plPct.toFixed(2) : '',
        r.changePct != null ? r.changePct.toFixed(2) : '',
      ]),
    ])
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `holdings-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Wedge headline: how many IDX holdings sit below their estimated fair value.
  const wedgeSummary = useMemo(() => {
    if (!valuations || idxTickers.length === 0) return null
    let under = 0
    let covered = 0
    for (const tk of idxTickers) {
      const v = valuations.get(tk)
      if (!v || v.avgMoS == null) continue
      covered++
      if (v.verdict.includes('UNDER')) under++
    }
    return covered > 0 ? { under, covered } : null
  }, [valuations, idxTickers])

  if (enriched.length === 0) return null

  return (
    <div className="s-card overflow-hidden">
      <div className="p-5 sm:p-6 pb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">{t('investment.holding')}</p>
          <h2 className="text-xl font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{t('investment.holding_list')}</h2>
          {wedgeSummary && (
            <p className="text-[12px] mt-1" style={{ color: 'var(--ink-muted)' }}>
              <span className="num tabular font-semibold" style={{ color: 'var(--c-mint-ink)' }}>{wedgeSummary.under}</span>
              {' '}{t('investment.wedge_of')} {wedgeSummary.covered} {t('investment.wedge_summary')}{' '}
              <Link href="/dashboard/assets/investment/stock?tab=research" className="inline-flex items-center gap-0.5 font-medium hover:underline" style={{ color: 'var(--c-mint-ink)' }}>
                {t('investment.wedge_link')} <ArrowUpRight className="size-3" />
              </Link>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {holdingTabs.map((tabItem) => {
              const active = tab === tabItem.key
              return (
                <button
                  key={tabItem.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTab(tabItem.key)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium transition"
                  style={active
                    ? { background: 'var(--c-primary)', color: 'var(--on-black)' }
                    : { background: 'var(--surface-2)', color: 'var(--ink-muted)' }}
                >
                  {tabItem.label}
                </button>
              )
            })}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="hidden md:inline-flex"
            onClick={exportCsv}
            disabled={sortedRows.length === 0}
          >
            <Download data-icon="inline-start" />
            Export CSV
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto hidden md:block">
        <table className="w-full text-sm border-collapse" style={{ minWidth: 760 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              {([
                { key: 'sym' as SortKey, label: t('investment.col_sym'), numeric: false },
                { key: null, label: t('investment.col_name'), numeric: false },
                { key: 'qty' as SortKey, label: t('investment.col_lot_unit'), numeric: true },
                { key: 'market' as SortKey, label: t('investment.col_value'), numeric: true },
                { key: 'fairValue' as SortKey, label: t('investment.col_fair_value'), numeric: true },
                { key: 'plPct' as SortKey, label: t('investment.col_pl'), numeric: true },
                { key: 'changePct' as SortKey, label: t('investment.col_day_change'), numeric: true },
              ] as { key: SortKey | null; label: string; numeric: boolean }[]).map((col, i) => {
                const active = col.key != null && sort.key === col.key
                return (
                  <th
                    key={col.key ?? `static-${i}`}
                    scope="col"
                    aria-sort={col.key == null ? undefined : active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`${col.numeric ? 'text-right' : 'text-left'} text-[11px] uppercase tracking-[0.08em] font-medium px-3 py-2 whitespace-nowrap`}
                    style={{ color: 'var(--ink-soft)' }}
                  >
                    {col.key == null ? (
                      col.label
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key as SortKey)}
                        className={`inline-flex w-full items-center gap-0.5 uppercase tracking-[0.08em] font-medium transition-colors duration-100 hover:text-[var(--ink)] ${col.numeric ? 'justify-end' : 'justify-start'}`}
                        style={{ color: active ? 'var(--ink)' : 'inherit' }}
                      >
                        {col.label}
                        {active && (sort.dir === 'asc'
                          ? <ArrowUp className="size-3 shrink-0" aria-hidden="true" />
                          : <ArrowDown className="size-3 shrink-0" aria-hidden="true" />)}
                      </button>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => {
              const plUp = (r.plPct ?? 0) >= 0
              const dUp = (r.changePct ?? 0) >= 0
              const tone = verdictTone(r.verdict, t)
              return (
                <tr key={r.id} className="border-b transition-colors hover:bg-[var(--surface-2)]" style={{ borderColor: 'var(--border-soft)' }}>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="num tabular text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${r.classColor}1A`, color: `color-mix(in srgb, ${r.classColor} 60%, var(--ink))` }}>
                      {r.sym || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 max-w-[260px]">
                    {r.href ? (
                      <Link href={r.href} className="group/name block">
                        <p className="truncate font-medium group-hover/name:underline" style={{ color: 'var(--ink)' }}>{r.name}</p>
                        <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{r.classLabel}</p>
                      </Link>
                    ) : (
                      <>
                        <p className="truncate font-medium" style={{ color: 'var(--ink)' }}>{r.name}</p>
                        <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{r.classLabel}</p>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right num tabular whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>
                    {r.qty.toLocaleString('id-ID')}
                  </td>
                  <td className="px-3 py-2.5 text-right num tabular font-semibold whitespace-nowrap" style={{ color: 'var(--ink)' }}>
                    {formatCurrency(r.market)}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {r.fairValue != null && r.mos != null && tone ? (
                      <Link
                        href={r.href ?? '#'}
                        className="inline-flex flex-col items-end gap-0.5 group/fv"
                        title={`${tone.label} · ${t('investment.fair_value_hint')}`}
                      >
                        <span className="num tabular text-[12px] group-hover/fv:underline" style={{ color: 'var(--ink-muted)' }}>
                          Rp {priceFmt.format(r.fairValue)}
                        </span>
                        <span className="num tabular text-[10px] font-semibold px-1.5 py-px rounded" style={{ background: tone.bg, color: tone.color }}>
                          MoS {r.mos >= 0 ? '+' : ''}{(r.mos * 100).toFixed(0)}%
                        </span>
                      </Link>
                    ) : (
                      <span className="text-[12px]" style={{ color: 'var(--ink-soft)' }}>—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right num tabular whitespace-nowrap" data-calm-hide="" data-loss={r.plPct != null && !plUp ? 'true' : undefined} style={{ color: r.plPct == null ? 'var(--ink-soft)' : plUp ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}>
                    {r.plPct == null ? '—' : `${plUp ? '+' : ''}${r.plPct.toFixed(1)}%`}
                  </td>
                  <td className="px-3 py-2.5 text-right num tabular whitespace-nowrap" data-calm-hide="" data-loss={r.changePct != null && !dUp ? 'true' : undefined} style={{ color: r.changePct == null ? 'var(--ink-soft)' : dUp ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}>
                    {r.changePct == null ? '—' : `${dUp ? '+' : ''}${r.changePct.toFixed(2)}%`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {/* Mobile: baris-compact (1 baris + hairline; tap → riset saham IDX/crypto) */}
      <div className="md:hidden border-t" style={{ borderColor: 'var(--border-soft)' }}>
        {holdingRows.map((r, i) => {
          const plUp = (r.plPct ?? 0) >= 0
          const tone = verdictTone(r.verdict, t)
          const rowClass = 'flex items-center gap-3 px-3.5 transition-colors active:bg-[var(--surface-2)]'
          const rowStyle = { minHeight: 56, borderTop: i ? '1px solid var(--border-soft)' : 'none' }
          const inner = (
            <>
              <span className="num tabular text-[11px] font-bold px-1.5 py-1 rounded shrink-0" style={{ background: `${r.classColor}1A`, color: `color-mix(in srgb, ${r.classColor} 60%, var(--ink))` }}>
                {r.sym || '—'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium truncate leading-tight" style={{ color: 'var(--ink)' }}>{r.name}</p>
                <p className="text-[11px] truncate leading-tight mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                  {r.classLabel} · {r.qty.toLocaleString('id-ID')}
                  {tone && r.mos != null ? <span className="num font-semibold" style={{ color: tone.color }}> · MoS {r.mos >= 0 ? '+' : ''}{(r.mos * 100).toFixed(0)}%</span> : null}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="num tabular text-[14px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>{formatCurrency(r.market)}</p>
                {r.plPct != null && (
                  <p className="num tabular text-[11.5px] font-semibold leading-tight mt-0.5" data-calm-hide="" data-loss={!plUp ? 'true' : undefined} style={{ color: plUp ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}>
                    {plUp ? '+' : ''}{r.plPct.toFixed(1)}%
                  </p>
                )}
              </div>
            </>
          )
          return r.href
            ? <Link key={r.id} href={r.href} className={rowClass} style={rowStyle}>{inner}</Link>
            : <div key={r.id} className={rowClass} style={rowStyle}>{inner}</div>
        })}
      </div>
      {wedgeSummary && (
        <p className="px-5 sm:px-6 py-2.5 text-[10px] border-t" style={{ color: 'var(--ink-soft)', borderColor: 'var(--border-soft)' }}>
          {t('investment.fair_value_hint')}
        </p>
      )}
    </div>
  )
}
