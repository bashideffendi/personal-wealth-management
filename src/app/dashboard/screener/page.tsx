'use client'

/**
 * Screener IDX v2 — satu tabel padat semua emiten (±970) dengan set kolom
 * bersegmen (Ringkas · Valuasi · Kualitas · Risiko), preset sebaris, chip
 * sektor, pencarian, dan popover "Lanjutan" untuk rentang angka.
 *
 * Data: /api/screener (screener-v2.json, ekspor bulanan IDX Screener).
 * Logika filter/sort/format ada di lib/invest/screener (diuji unit).
 * Klik baris → panel samping kanan (sheet bawah di mobile), bukan modal.
 *
 * Warna hanya di data: teal untuk persentil ≥ 0,80 dan selisih positif,
 * coral untuk negatif. Kontrol mono.
 */

import { useDeferredValue, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Popover } from '@base-ui/react/popover'
import { ArrowDown, ArrowUp, ArrowUpRight, Download, Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { QuietPageHeader } from '@/components/layout/quiet-page-header'
import { toCsv } from '@/lib/transactions/csv'
import {
  COLUMN_SETS,
  DEFAULT_PRESETS,
  EMPTY,
  EMPTY_RANGES,
  PRESETS,
  RANGE_FIELDS,
  activeRangeCount,
  defaultDir,
  filterRows,
  fmtDateShort,
  fmtIdrCompact,
  fmtPct,
  fmtPctile,
  fmtPrice,
  fmtRatio,
  isHighPctile,
  reliableValuation,
  riskNotes,
  sortRows,
  type ColKey,
  type ColumnSet,
  type PresetKey,
  type Ranges,
  type ScreenerMeta,
  type ScreenerResponse,
  type ScreenerRow,
  type SortDir,
} from '@/lib/invest/screener'

const RESEARCH_HREF = '/dashboard/assets/investment/stock/research'
const POS = 'var(--c-mint-ink)'
const NEG = 'var(--c-coral-ink)'

// ─── Kolom ──────────────────────────────────────────────────────

interface ColDef {
  label: string
  /** Lebar relatif (table-layout fixed). */
  w: number
  numeric: boolean
  render: (r: ScreenerRow) => React.ReactNode
}

function signColor(v: number | null | undefined): string | undefined {
  if (v == null || !Number.isFinite(v) || v === 0) return undefined
  return v > 0 ? POS : NEG
}

function yesNo(v: boolean | null | undefined) {
  return v ? <span style={{ color: 'var(--ink)' }}>Ya</span> : EMPTY
}

function riskScore(v: number | null | undefined) {
  if (v == null) return EMPTY
  return <span style={{ color: v >= 2 ? NEG : undefined }}>{v}</span>
}

const COLS: Record<ColKey, ColDef> = {
  ticker: { label: 'Emiten', w: 30, numeric: false, render: () => null },
  sector: { label: 'Sektor', w: 22, numeric: false, render: (r) => r.sector ?? EMPTY },
  price: { label: 'Harga', w: 12, numeric: true, render: (r) => fmtPrice(r.price) },
  mcap: { label: 'Kapitalisasi', w: 14, numeric: true, render: (r) => fmtIdrCompact(r.mcap) },
  composite: { label: 'Skor', w: 16, numeric: true, render: (r) => <Pctile v={r.score?.composite} /> },
  per: { label: 'PER', w: 10, numeric: true, render: (r) => fmtRatio(r.per) },
  pbv: { label: 'PBV', w: 10, numeric: true, render: (r) => fmtRatio(r.pbv) },
  evEbitda: { label: 'EV/EBITDA', w: 12, numeric: true, render: (r) => fmtRatio(r.evEbitda) },
  divYield: { label: 'Yield', w: 10, numeric: true, render: (r) => fmtPct(r.divYield) },
  fairBase: { label: 'Nilai wajar', w: 13, numeric: true, render: (r) => fmtPrice(reliableValuation(r)?.base) },
  gap: {
    label: 'Selisih',
    w: 11,
    numeric: true,
    render: (r) => {
      const g = reliableValuation(r)?.gap
      return <span style={{ color: signColor(g) }}>{fmtPct(g)}</span>
    },
  },
  value: { label: 'Nilai', w: 16, numeric: true, render: (r) => <Pctile v={r.score?.value} /> },
  prof: { label: 'Profitabilitas', w: 16, numeric: true, render: (r) => <Pctile v={r.score?.prof} /> },
  safety: { label: 'Keamanan', w: 16, numeric: true, render: (r) => <Pctile v={r.score?.safety} /> },
  roe: { label: 'ROE', w: 10, numeric: true, render: (r) => <span style={{ color: (r.roe ?? 0) < 0 ? NEG : undefined }}>{fmtPct(r.roe)}</span> },
  liq60: { label: 'Likuiditas 60H', w: 14, numeric: true, render: (r) => fmtIdrCompact(r.liq60) },
  mrs: { label: 'MRS', w: 7, numeric: true, render: (r) => riskScore(r.flags?.mrs) },
  up: { label: 'UP', w: 7, numeric: true, render: (r) => riskScore(r.flags?.up) },
  eqFlag: { label: 'Kual. laba', w: 10, numeric: true, render: (r) => yesNo(r.flags?.eqFlag) },
  specialBoard: { label: 'Papan khusus', w: 11, numeric: true, render: (r) => yesNo(r.specialBoard) },
  shariah: { label: 'Syariah', w: 9, numeric: true, render: (r) => yesNo(r.shariah) },
}

/** Mobile: ticker + maksimal tiga kolom terpenting per set. */
const MOBILE_COLS: Record<ColumnSet, ReadonlySet<ColKey>> = {
  ringkas: new Set(['ticker', 'price', 'composite']),
  valuasi: new Set(['ticker', 'per', 'pbv', 'gap']),
  kualitas: new Set(['ticker', 'value', 'prof', 'safety']),
  risiko: new Set(['ticker', 'liq60', 'mrs', 'specialBoard']),
}

// ─── Primitif kecil ─────────────────────────────────────────────

/** Persentil: meter 2px + angka. Teal hanya ≥ 0,80, selebihnya abu. */
function Pctile({ v, wide = false }: { v: number | null | undefined; wide?: boolean }) {
  if (v == null) return <>{EMPTY}</>
  const high = isHighPctile(v)
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span
        className={`relative h-[2px] ${wide ? 'flex-1' : 'w-8 md:w-10'}`}
        style={{ background: 'var(--border)' }}
        aria-hidden
      >
        <span
          className="absolute inset-y-0 left-0"
          style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%`, background: high ? 'var(--accent)' : 'var(--text-faint)' }}
        />
      </span>
      <span className="num w-6 text-right" style={{ color: 'var(--ink)' }}>{fmtPctile(v)}</span>
    </span>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors duration-100 md:min-h-0 md:h-7 md:px-2.5"
      style={{
        background: active ? 'var(--ink)' : 'var(--surface)',
        borderColor: active ? 'var(--ink)' : 'var(--border)',
        color: active ? 'var(--surface)' : 'var(--ink-muted)',
      }}
    >
      {children}
    </button>
  )
}

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia('(min-width: 1024px)')
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia('(min-width: 1024px)').matches,
    () => true,
  )
}

function toggleIn<T>(set: ReadonlySet<T>, v: T): Set<T> {
  const next = new Set(set)
  if (next.has(v)) next.delete(v)
  else next.add(v)
  return next
}

function asOfLine(meta: ScreenerMeta): string {
  return `Data pasar ${fmtDateShort(meta.marketAsOf)} · Skor riset ${fmtDateShort(meta.scoresAsOf)}`
}

// ─── Halaman ────────────────────────────────────────────────────

export default function ScreenerPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['screener', 'v2'],
    queryFn: async () => {
      const res = await fetch('/api/screener')
      if (!res.ok) throw new Error(`screener ${res.status}`)
      return res.json() as Promise<ScreenerResponse>
    },
    staleTime: 5 * 60 * 1000,
  })
  const rows = useMemo(() => data?.rows ?? [], [data])
  const meta = data?.meta

  const [colSet, setColSet] = useState<ColumnSet>('ringkas')
  const [presets, setPresets] = useState<ReadonlySet<PresetKey>>(DEFAULT_PRESETS)
  const [sectors, setSectors] = useState<ReadonlySet<string>>(new Set())
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [ranges, setRanges] = useState<Ranges>(EMPTY_RANGES)
  const [sort, setSort] = useState<{ key: ColKey; dir: SortDir }>({ key: 'composite', dir: 'desc' })
  const [selected, setSelected] = useState<string | null>(null)
  const isDesktop = useIsDesktop()

  const sectorList = useMemo(
    () => [...new Set(rows.map((r) => r.sector).filter((s): s is string => !!s))].sort(),
    [rows],
  )
  const visible = useMemo(
    () => sortRows(filterRows(rows, { presets, sectors, search: deferredSearch, ranges }), sort.key, sort.dir),
    [rows, presets, sectors, deferredSearch, ranges, sort],
  )
  const selectedRow = useMemo(() => rows.find((r) => r.ticker === selected) ?? null, [rows, selected])
  const nRanges = activeRangeCount(ranges)
  const isDefault =
    search === '' && sectors.size === 0 && nRanges === 0 &&
    presets.size === DEFAULT_PRESETS.size && [...presets].every((p) => DEFAULT_PRESETS.has(p))

  useEffect(() => {
    if (!selected || !isDesktop) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, isDesktop])

  const cols = COLUMN_SETS.find((s) => s.key === colSet)!.cols
  const totalW = cols.reduce((a, k) => a + COLS[k].w, 0)

  function toggleSort(key: ColKey) {
    setSort((p) => (p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: defaultDir(key) }))
  }

  function resetFilters() {
    setSearch('')
    setSectors(new Set())
    setRanges(EMPTY_RANGES)
    setPresets(DEFAULT_PRESETS)
  }

  function exportCsv() {
    const pct = (v: number | null | undefined) => (v != null ? (v * 100).toFixed(2) : '')
    const num = (v: number | null | undefined, d = 2) => (v != null ? v.toFixed(d) : '')
    const csv = toCsv([
      [
        'Ticker', 'Nama', 'Sektor', 'Sub-sektor', 'Syariah', 'Harga', 'Kapitalisasi', 'Likuiditas 60H',
        'PER', 'PBV', 'EV/EBITDA', 'ROE %', 'Yield %', 'Skor gabungan', 'Nilai', 'Profitabilitas', 'Keamanan',
        'Status valuasi', 'Nilai wajar konservatif', 'Nilai wajar dasar', 'Nilai wajar optimistis', 'Selisih %',
        'MRS', 'UP', 'Penanda kualitas laba', 'Papan pemantauan khusus',
      ],
      ...visible.map((r) => {
        const v = reliableValuation(r)
        return [
          r.ticker, r.name, r.sector ?? '', r.subSector ?? '', r.shariah ? 'Ya' : 'Tidak',
          r.price ?? '', r.mcap != null ? Math.round(r.mcap) : '', r.liq60 != null ? Math.round(r.liq60) : '',
          num(r.per), num(r.pbv), num(r.evEbitda), pct(r.roe), pct(r.divYield),
          num(r.score?.composite, 4), num(r.score?.value, 4), num(r.score?.prof, 4), num(r.score?.safety, 4),
          r.valuation?.status ?? '', v?.cons ?? '', v?.base ?? '', v?.opt ?? '', pct(v?.gap),
          r.flags?.mrs ?? '', r.flags?.up ?? '', r.flags ? (r.flags.eqFlag ? 'Ya' : 'Tidak') : '',
          r.specialBoard ? 'Ya' : 'Tidak',
        ]
      }),
    ])
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `screener-idx-${meta?.marketAsOf ?? new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const panelOpen = !!selectedRow && isDesktop

  return (
    <div className="space-y-3">
      <QuietPageHeader
        title="Screener IDX"
        actions={
          <Button variant="outline" size="sm" className="max-md:h-11" onClick={exportCsv} disabled={isLoading || visible.length === 0}>
            <Download data-icon="inline-start" />
            Ekspor CSV
          </Button>
        }
      />
      {meta && (
        <p className="text-xs -mt-1" style={{ color: 'var(--text-faint)' }}>
          {meta.disclaimer} {asOfLine(meta)}
        </p>
      )}

      {/* ─── Kontrol ─── */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Set kolom"
            className="inline-flex rounded-lg border p-0.5"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            {COLUMN_SETS.map((s) => {
              const active = s.key === colSet
              return (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setColSet(s.key)}
                  className="min-h-10 rounded-md px-3 text-xs font-medium transition-colors duration-100 md:min-h-0 md:h-7"
                  style={{
                    background: active ? 'var(--surface-2)' : 'transparent',
                    color: active ? 'var(--ink)' : 'var(--ink-soft)',
                  }}
                >
                  {s.label}
                </button>
              )
            })}
          </div>

          <div className="relative min-w-[180px] flex-1 md:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2" style={{ color: 'var(--ink-soft)' }} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari ticker atau nama"
              aria-label="Cari ticker atau nama emiten"
              className="h-11 pl-9 text-sm md:h-8"
            />
          </div>

          <AdvancedFilter ranges={ranges} onChange={setRanges} count={nRanges} />

          {!isDefault && (
            <button
              type="button"
              onClick={resetFilters}
              className="min-h-11 px-2 text-xs font-medium underline-offset-4 hover:underline md:min-h-0"
              style={{ color: 'var(--ink-soft)' }}
            >
              Reset
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p) => (
            <Chip key={p.key} active={presets.has(p.key)} onClick={() => setPresets((s) => toggleIn(s, p.key))}>
              {p.label}
            </Chip>
          ))}
        </div>
        {/* Sektor: satu baris geser horizontal di mobile, membungkus di desktop */}
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0" aria-label="Filter sektor" role="group">
          {sectorList.map((s) => (
            <Chip key={s} active={sectors.has(s)} onClick={() => setSectors((prev) => toggleIn(prev, s))}>
              {s}
            </Chip>
          ))}
        </div>
      </div>

      {!isLoading && !isError && (
        <p className="text-xs num" style={{ color: 'var(--ink-soft)' }}>
          {visible.length.toLocaleString('id-ID')} dari {rows.length.toLocaleString('id-ID')} emiten
        </p>
      )}

      {isError && (
        <div className="s-card flex flex-col items-center p-10 text-center">
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Gagal memuat data screener</p>
          <Button size="sm" className="mt-4" onClick={() => void refetch()}>Coba lagi</Button>
        </div>
      )}

      {isLoading && (
        <div className="s-card overflow-hidden" aria-busy="true" aria-label="Memuat tabel screener">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex h-10 items-center gap-3 border-b px-3" style={{ borderColor: 'var(--border-soft)' }}>
              <div className="h-3 w-12 animate-pulse rounded" style={{ background: 'var(--surface-2)' }} />
              <div className="h-3 max-w-[220px] flex-1 animate-pulse rounded" style={{ background: 'var(--surface-2)' }} />
            </div>
          ))}
        </div>
      )}

      {!isLoading && !isError && (
        <div className={panelOpen ? 'grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_360px]' : ''}>
          {/* Satu area gulir (halaman); thead sticky ke bawah TopNav via .tx-scroll */}
          <div className="tx-scroll s-card">
            <table className="w-full text-xs" style={{ tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0 }}>
              <colgroup>
                {cols.map((k) => (
                  <col
                    key={k}
                    className={MOBILE_COLS[colSet].has(k) ? '' : 'max-md:hidden'}
                    style={{ width: `${(COLS[k].w / totalW) * 100}%` }}
                  />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {cols.map((k) => {
                    const c = COLS[k]
                    const active = sort.key === k
                    return (
                      <th
                        key={k}
                        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        className={`h-9 px-3 text-[11px] font-medium ${MOBILE_COLS[colSet].has(k) ? '' : 'max-md:hidden'}`}
                        style={{ color: 'var(--ink-soft)' }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(k)}
                          className={`inline-flex w-full items-center gap-0.5 whitespace-nowrap ${c.numeric ? 'justify-end' : ''}`}
                          style={{ color: active ? 'var(--ink)' : undefined }}
                        >
                          <span className="truncate">{c.label}</span>
                          {active && (sort.dir === 'asc'
                            ? <ArrowUp className="size-3 shrink-0" aria-hidden />
                            : <ArrowDown className="size-3 shrink-0" aria-hidden />)}
                        </button>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const isSel = r.ticker === selected
                  return (
                    <tr
                      key={r.ticker}
                      onClick={() => setSelected(isSel ? null : r.ticker)}
                      className="cursor-pointer transition-colors duration-100 hover:bg-[var(--surface-2)]"
                      style={{
                        background: isSel ? 'var(--surface-2)' : undefined,
                        contentVisibility: 'auto',
                        containIntrinsicSize: 'auto 40px',
                      }}
                    >
                      {cols.map((k) => (
                        <td
                          key={k}
                          className={`h-11 border-t px-3 md:h-10 ${COLS[k].numeric ? 'num text-right' : ''} ${MOBILE_COLS[colSet].has(k) ? '' : 'max-md:hidden'}`}
                          style={{ borderColor: 'var(--border-soft)', color: 'var(--ink-muted)' }}
                        >
                          {k === 'ticker' ? (
                            <button
                              type="button"
                              aria-expanded={isSel}
                              onClick={(e) => { e.stopPropagation(); setSelected(isSel ? null : r.ticker) }}
                              className="flex w-full min-w-0 items-baseline gap-2 text-left"
                            >
                              <span className="font-semibold" style={{ color: 'var(--ink)' }}>{r.ticker}</span>
                              <span className="truncate" style={{ color: 'var(--ink-soft)' }}>{r.name}</span>
                            </button>
                          ) : (
                            <span className="block truncate">{COLS[k].render(r)}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  )
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={cols.length} className="px-6 py-12 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
                      Tidak ada emiten yang cocok. Longgarkan filter atau tekan Reset.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {panelOpen && meta && (
            <aside
              aria-label={`Detail ${selectedRow.ticker}`}
              className="s-card sticky top-[69px] max-h-[calc(100dvh-81px)] overflow-y-auto overscroll-contain"
            >
              <DetailPanel row={selectedRow} meta={meta} onClose={() => setSelected(null)} />
            </aside>
          )}
        </div>
      )}

      {!isDesktop && selectedRow && meta && (
        <BottomSheet
          open
          onOpenChange={(o) => { if (!o) setSelected(null) }}
          title={`${selectedRow.ticker} · ${selectedRow.name}`}
          hideTitle
        >
          <DetailPanel row={selectedRow} meta={meta} onClose={() => setSelected(null)} />
        </BottomSheet>
      )}
    </div>
  )
}

// ─── Popover "Lanjutan" ─────────────────────────────────────────

function AdvancedFilter({ ranges, onChange, count }: { ranges: Ranges; onChange: (r: Ranges) => void; count: number }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium md:min-h-0 md:h-8"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--ink)' }}
      >
        <SlidersHorizontal className="size-3.5" aria-hidden />
        Lanjutan{count > 0 && <span className="num" style={{ color: 'var(--ink-soft)' }}>· {count}</span>}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={8} className="z-50">
          <Popover.Popup
            className="w-[min(320px,calc(100vw-2rem))] rounded-xl border p-3 outline-none"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-lg)' }}
          >
            <div className="space-y-2">
              {RANGE_FIELDS.map(({ key, label }) => (
                <div key={key} className="grid grid-cols-[72px_1fr_auto_1fr] items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>{label}</span>
                  <Input
                    value={ranges[key].min}
                    onChange={(e) => onChange({ ...ranges, [key]: { ...ranges[key], min: e.target.value } })}
                    placeholder="min"
                    inputMode="decimal"
                    aria-label={`${label} minimum`}
                    className="num h-11 px-2 text-xs md:h-8"
                  />
                  <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>–</span>
                  <Input
                    value={ranges[key].max}
                    onChange={(e) => onChange({ ...ranges, [key]: { ...ranges[key], max: e.target.value } })}
                    placeholder="maks"
                    inputMode="decimal"
                    aria-label={`${label} maksimum`}
                    className="num h-11 px-2 text-xs md:h-8"
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_RANGES)} disabled={count === 0}>
                Kosongkan
              </Button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

// ─── Panel detail ───────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t px-4 py-3" style={{ borderColor: 'var(--border-soft)' }}>
      <h3 className="mb-2 text-[11px] font-medium" style={{ color: 'var(--ink-soft)' }}>{title}</h3>
      {children}
    </section>
  )
}

function DetailPanel({ row: r, meta, onClose }: { row: ScreenerRow; meta: ScreenerMeta; onClose: () => void }) {
  const notes = riskNotes(r)
  const pctiles: { label: string; v: number | null | undefined }[] = [
    { label: 'Nilai', v: r.score?.value },
    { label: 'Profitabilitas', v: r.score?.prof },
    { label: 'Keamanan', v: r.score?.safety },
  ]
  return (
    <div className="text-sm">
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold" style={{ color: 'var(--ink)' }}>{r.name}</p>
          <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--ink-soft)' }}>
            {r.ticker} · {[...new Set([r.sector, r.subSector].filter(Boolean))].join(' · ') || EMPTY}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup detail"
          className="grid size-11 shrink-0 place-items-center rounded-md md:size-8 hover:bg-[var(--surface-2)]"
          style={{ color: 'var(--ink-soft)' }}
        >
          <X className="size-4" />
        </button>
      </div>

      <dl className="grid grid-cols-3 gap-2 px-4 pb-3 text-xs">
        {[
          ['Harga', fmtPrice(r.price)],
          ['Kapitalisasi', fmtIdrCompact(r.mcap)],
          ['Skor gabungan', fmtPctile(r.score?.composite)],
        ].map(([k, v]) => (
          <div key={k}>
            <dt style={{ color: 'var(--ink-soft)' }}>{k}</dt>
            <dd className="num mt-0.5 text-sm" style={{ color: 'var(--ink)' }}>{v}</dd>
          </div>
        ))}
      </dl>

      <Section title="Persentil sektor">
        {r.hasScore && r.group !== 'bank' ? (
          <div className="space-y-2">
            {pctiles.map((p) => (
              <div key={p.label} className="grid grid-cols-[96px_1fr] items-center gap-3 text-xs">
                <span style={{ color: 'var(--ink-muted)' }}>{p.label}</span>
                <Pctile v={p.v} wide />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            {r.group === 'bank' ? 'Bank hanya punya skor gabungan.' : 'Belum ada skor riset untuk emiten ini.'}
          </p>
        )}
      </Section>

      <Section title="Nilai wajar">
        <FairValue row={r} />
      </Section>

      <Section title="Penanda risiko">
        {notes.length > 0 ? (
          <ul className="space-y-1 text-xs" style={{ color: 'var(--ink-muted)' }}>
            {notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        ) : (
          <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            {r.flags ? 'Tidak ada penanda aktif.' : EMPTY}
          </p>
        )}
      </Section>

      <div className="space-y-3 border-t px-4 py-3" style={{ borderColor: 'var(--border-soft)' }}>
        <Link
          href={`${RESEARCH_HREF}/${r.ticker}`}
          className="inline-flex min-h-11 items-center gap-1 text-xs font-medium underline-offset-4 hover:underline md:min-h-0"
          style={{ color: 'var(--ink)' }}
        >
          Buka halaman riset {r.ticker}
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
        {r.modelClass && (
          <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
            {r.modelClass.label} · kelas model riset, belum tervalidasi
          </p>
        )}
        <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{asOfLine(meta)}</p>
      </div>
    </div>
  )
}

/** Rentang konservatif–dasar–optimistis + penanda harga; hanya status andal. */
function FairValue({ row: r }: { row: ScreenerRow }) {
  const v = r.valuation
  const muted = (t: string) => <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>{t}</p>
  if (!v) return muted('Belum ada nilai wajar model untuk emiten ini.')
  if (v.status === 'unreliable') return muted('Valuasi belum andal')
  if (v.status === 'not_valued') return muted('Riwayat laba belum cukup')
  if (v.status === 'bank_pb') {
    return (
      <dl className="grid grid-cols-2 gap-2 text-xs">
        {[['P/B wajar', fmtRatio(v.pbJustified)], ['P/B pasar', fmtRatio(v.pbMarket)]].map(([k, val]) => (
          <div key={k}>
            <dt style={{ color: 'var(--ink-soft)' }}>{k}</dt>
            <dd className="num mt-0.5 text-sm" style={{ color: 'var(--ink)' }}>{val}</dd>
          </div>
        ))}
      </dl>
    )
  }

  const { cons, base, opt, gap } = v
  if (cons == null || base == null || opt == null) return muted('Valuasi belum andal')
  const price = r.price
  const lo = Math.min(cons, price ?? cons)
  const hi = Math.max(opt, price ?? opt)
  const span = hi - lo || 1
  const at = (x: number) => `${((x - lo) / span) * 100}%`

  return (
    <div>
      <div className="relative mx-1 mt-5 mb-2 h-[2px]" style={{ background: 'var(--border)' }}>
        <span
          className="absolute inset-y-0"
          style={{ left: at(cons), width: `calc(${at(opt)} - ${at(cons)})`, background: 'var(--text-faint)' }}
        />
        <span className="absolute -top-[3px] h-2 w-px" style={{ left: at(base), background: 'var(--ink)' }} aria-hidden />
        {price != null && (
          <span className="absolute -top-5 -translate-x-1/2 text-center" style={{ left: at(price) }}>
            <span className="num block text-[10px] leading-none" style={{ color: 'var(--ink)' }}>{fmtPrice(price)}</span>
            <span className="mx-auto mt-1 block size-2 rounded-full border-2" style={{ borderColor: 'var(--ink)', background: 'var(--surface)' }} />
          </span>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        {[['Konservatif', cons], ['Dasar', base], ['Optimistis', opt]].map(([k, val]) => (
          <div key={k as string}>
            <dt style={{ color: 'var(--ink-soft)' }}>{k}</dt>
            <dd className="num mt-0.5" style={{ color: 'var(--ink)' }}>{fmtPrice(val as number)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs" style={{ color: 'var(--ink-muted)' }}>
        Selisih nilai wajar dasar terhadap harga{' '}
        <span className="num" style={{ color: signColor(gap) }}>{fmtPct(gap)}</span>
      </p>
    </div>
  )
}
