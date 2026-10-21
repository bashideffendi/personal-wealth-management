'use client'

/**
 * Screener IDX v2 — alat kerja padat ala daftar isu Linear / Koyfin.
 *
 * Satu bilah kontrol: pencarian · menu preset (pilih satu, dengan jumlah
 * hasil) · menu sektor (multi-pilih) · Lanjutan (rentang angka) · set kolom.
 * Filter aktif tampil sebagai token yang bisa dihapus satu per satu, di
 * samping "N dari 967 emiten" — tidak ada filter tersembunyi.
 *
 * Tabel: skor gabungan selalu kolom kedua dan jadi fokus baca; kolom lain
 * sekunder. Mobile: daftar baris ringkas + filter di sheet bawah.
 * Klik baris → panel samping kanan (sheet bawah di mobile).
 *
 * Data: /api/screener (screener-v2.json). Logika di lib/invest/screener.
 * Warna hanya di data: teal persentil ≥ 0,80 / positif, coral negatif.
 */

import { useDeferredValue, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Popover } from '@base-ui/react/popover'
import { ArrowDown, ArrowUp, ArrowUpRight, Check, ChevronDown, Download, Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { QuietPageHeader } from '@/components/layout/quiet-page-header'
import { toCsv } from '@/lib/transactions/csv'
import {
  COLUMN_SETS,
  DEFAULT_PRESET,
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
  presetCounts,
  reliableValuation,
  riskNotes,
  sectorCounts,
  sortRows,
  type ColKey,
  type ColumnSet,
  type FilterState,
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
/** Border kontrol ≥ 3:1 terhadap permukaan (hairline --border cuma ±1,4:1). */
const CTL_BORDER = 'color-mix(in srgb, var(--ink) 48%, var(--surface))'
const NUM = { fontVariantNumeric: 'tabular-nums' } as const

const PRESET_HINT: Record<PresetKey, string> = {
  scored: 'Emiten dengan skor riset',
  quality: 'Profitabilitas ≥ 80 dan keamanan ≥ 60',
  cheap: 'Persentil nilai ≥ 80 di sektornya',
  liquid: 'Transaksi harian ≥ Rp10 M',
  shariah: 'Daftar efek syariah',
}

function presetLabel(k: PresetKey | null): string {
  return k ? PRESETS.find((p) => p.key === k)!.label : 'Semua emiten'
}

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

const yesNo = (v: boolean | null | undefined) => (v ? <span style={{ color: 'var(--ink)' }}>Ya</span> : EMPTY)
const riskScore = (v: number | null | undefined) =>
  v == null ? EMPTY : <span style={{ color: v >= 2 ? NEG : undefined }}>{v}</span>
const signed = (v: number | null | undefined) => <span style={{ color: signColor(v) }}>{fmtPct(v)}</span>

const COLS: Record<ColKey, ColDef> = {
  ticker: { label: 'Emiten', w: 30, numeric: false, render: () => null },
  composite: { label: 'Skor', w: 12, numeric: true, render: (r) => <ScoreCell v={r.score?.composite} /> },
  sector: { label: 'Sektor', w: 20, numeric: false, render: (r) => r.sector ?? EMPTY },
  price: { label: 'Harga', w: 10, numeric: true, render: (r) => fmtPrice(r.price) },
  chg1y: { label: '1 tahun', w: 10, numeric: true, render: (r) => signed(r.chg1y) },
  mcap: { label: 'Kapitalisasi', w: 12, numeric: true, render: (r) => fmtIdrCompact(r.mcap) },
  per: { label: 'PER', w: 8, numeric: true, render: (r) => fmtRatio(r.per) },
  pbv: { label: 'PBV', w: 8, numeric: true, render: (r) => fmtRatio(r.pbv) },
  evEbitda: { label: 'EV/EBITDA', w: 10, numeric: true, render: (r) => fmtRatio(r.evEbitda) },
  divYield: { label: 'Yield', w: 8, numeric: true, render: (r) => fmtPct(r.divYield) },
  fairBase: { label: 'Nilai wajar', w: 11, numeric: true, render: (r) => fmtPrice(reliableValuation(r)?.base) },
  gap: { label: 'Selisih', w: 10, numeric: true, render: (r) => signed(reliableValuation(r)?.gap) },
  value: { label: 'Nilai', w: 14, numeric: true, render: (r) => <Pctile v={r.score?.value} /> },
  prof: { label: 'Profitabilitas', w: 14, numeric: true, render: (r) => <Pctile v={r.score?.prof} /> },
  safety: { label: 'Keamanan', w: 14, numeric: true, render: (r) => <Pctile v={r.score?.safety} /> },
  roe: { label: 'ROE', w: 9, numeric: true, render: (r) => <span style={{ color: (r.roe ?? 0) < 0 ? NEG : undefined }}>{fmtPct(r.roe)}</span> },
  liq60: { label: 'Likuiditas 60H', w: 12, numeric: true, render: (r) => fmtIdrCompact(r.liq60) },
  mrs: { label: 'MRS', w: 6, numeric: true, render: (r) => riskScore(r.flags?.mrs) },
  up: { label: 'UP', w: 6, numeric: true, render: (r) => riskScore(r.flags?.up) },
  eqFlag: { label: 'Kual. laba', w: 9, numeric: true, render: (r) => yesNo(r.flags?.eqFlag) },
  specialBoard: { label: 'Papan khusus', w: 10, numeric: true, render: (r) => yesNo(r.specialBoard) },
  shariah: { label: 'Syariah', w: 8, numeric: true, render: (r) => yesNo(r.shariah) },
}

const MOBILE_SORTS: { key: ColKey; label: string }[] = [
  { key: 'composite', label: 'Skor' },
  { key: 'mcap', label: 'Kapitalisasi' },
  { key: 'liq60', label: 'Likuiditas' },
  { key: 'chg1y', label: '1 tahun' },
  { key: 'ticker', label: 'Ticker' },
]

// ─── Primitif ───────────────────────────────────────────────────

function Meter({ v, className = 'w-10' }: { v: number; className?: string }) {
  return (
    <span className={`relative h-[2px] shrink-0 ${className}`} style={{ background: 'var(--border)' }} aria-hidden>
      <span
        className="absolute inset-y-0 left-0"
        style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%`, background: isHighPctile(v) ? 'var(--accent)' : 'var(--text-faint)' }}
      />
    </span>
  )
}

/** Persentil sekunder: meter 2px + angka kecil. */
function Pctile({ v }: { v: number | null | undefined }) {
  if (v == null) return <>{EMPTY}</>
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <Meter v={v} className="w-8" />
      <span className="w-5 text-right">{fmtPctile(v)}</span>
    </span>
  )
}

/** Skor gabungan: fokus baca — angka lebih besar + meter. */
function ScoreCell({ v }: { v: number | null | undefined }) {
  if (v == null) return <span style={{ color: 'var(--text-faint)' }}>{EMPTY}</span>
  return (
    <span className="inline-flex items-center justify-end gap-2.5">
      <Meter v={v} className="w-9" />
      <span className="w-7 text-right text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>{fmtPctile(v)}</span>
    </span>
  )
}

const ctlClass =
  'inline-flex h-11 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-colors duration-100 hover:bg-[var(--surface-2)] md:h-8 md:px-2.5'
const ctlStyle = { borderColor: CTL_BORDER, background: 'var(--surface)', color: 'var(--ink)' }

function Menu({ trigger, children, width = 280, label }: {
  trigger: React.ReactNode
  children: React.ReactNode
  width?: number
  label: string
}) {
  return (
    <Popover.Root>
      <Popover.Trigger className={ctlClass} style={ctlStyle} aria-label={label}>
        {trigger}
        <ChevronDown className="size-3.5" style={{ color: 'var(--ink-soft)' }} aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} className="z-50">
          <Popover.Popup
            className="max-h-[min(70vh,520px)] overflow-y-auto rounded-xl border p-1 outline-none"
            style={{ width: `min(${width}px, calc(100vw - 2rem))`, background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-lg)' }}
          >
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** Baris pilihan di menu/sheet: tanda centang, label (+ petunjuk), jumlah. */
function Option({ checked, onClick, label, hint, count, multi = false }: {
  checked: boolean
  onClick: () => void
  label: string
  hint?: string
  count?: number
  multi?: boolean
}) {
  return (
    <button
      type="button"
      role={multi ? 'menuitemcheckbox' : 'menuitemradio'}
      aria-checked={checked}
      onClick={onClick}
      className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors duration-100 hover:bg-[var(--surface-2)] md:min-h-9"
    >
      <span
        className={`grid size-4 shrink-0 place-items-center ${multi ? 'rounded-[4px] border' : ''}`}
        style={{
          borderColor: multi ? (checked ? 'var(--ink)' : CTL_BORDER) : undefined,
          background: multi && checked ? 'var(--ink)' : undefined,
          color: multi ? 'var(--surface)' : 'var(--ink)',
        }}
        aria-hidden
      >
        {checked && <Check className="size-3" strokeWidth={2.5} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate" style={{ color: 'var(--ink)', fontWeight: checked ? 600 : 400 }}>{label}</span>
        {hint && <span className="block truncate text-[11px]" style={{ color: 'var(--text-faint)' }}>{hint}</span>}
      </span>
      {count != null && <span className="shrink-0 text-[11px]" style={{ ...NUM, color: 'var(--text-faint)' }}>{count}</span>}
    </button>
  )
}

/** Token filter aktif — teks kecil + tombol hapus. */
function Token({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      className="inline-flex h-7 items-center gap-1 rounded-lg border pl-2 text-[11px]"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--ink-muted)' }}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Hapus filter ${label}`}
        className="grid h-7 w-7 place-items-center rounded-r-lg hover:bg-[var(--surface-2)] max-md:h-11 max-md:w-9"
        style={{ color: 'var(--ink-soft)' }}
      >
        <X className="size-3" />
      </button>
    </span>
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
  const [preset, setPreset] = useState<PresetKey | null>(DEFAULT_PRESET)
  const [sectors, setSectors] = useState<ReadonlySet<string>>(new Set())
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [ranges, setRanges] = useState<Ranges>(EMPTY_RANGES)
  const [sort, setSort] = useState<{ key: ColKey; dir: SortDir }>({ key: 'composite', dir: 'desc' })
  const [selected, setSelected] = useState<string | null>(null)
  const [filterSheet, setFilterSheet] = useState(false)
  const isDesktop = useIsDesktop()

  const filter: FilterState = useMemo(
    () => ({ preset, sectors, search: deferredSearch, ranges }),
    [preset, sectors, deferredSearch, ranges],
  )
  const visible = useMemo(() => sortRows(filterRows(rows, filter), sort.key, sort.dir), [rows, filter, sort])
  const pCounts = useMemo(() => presetCounts(rows, filter), [rows, filter])
  const sCounts = useMemo(() => sectorCounts(rows, filter), [rows, filter])
  const sectorList = useMemo(
    () => [...new Set(rows.map((r) => r.sector).filter((s): s is string => !!s))].sort(),
    [rows],
  )
  const summary = useMemo(() => ({
    scored: rows.filter((r) => r.hasScore).length,
    bank: rows.filter((r) => r.group === 'bank').length,
    reliable: rows.filter((r) => r.valuation?.status === 'reliable').length,
  }), [rows])
  const selectedRow = useMemo(() => rows.find((r) => r.ticker === selected) ?? null, [rows, selected])

  const nRanges = activeRangeCount(ranges)
  const nFilters = (preset ? 1 : 0) + sectors.size + nRanges
  const isDefault = preset === DEFAULT_PRESET && sectors.size === 0 && nRanges === 0 && search === ''

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
    setPreset(DEFAULT_PRESET)
  }

  function exportCsv() {
    const pct = (v: number | null | undefined) => (v != null ? (v * 100).toFixed(2) : '')
    const num = (v: number | null | undefined, d = 2) => (v != null ? v.toFixed(d) : '')
    const csv = toCsv([
      [
        'Ticker', 'Nama', 'Sektor', 'Sub-sektor', 'Syariah', 'Harga', 'Perubahan 1 tahun %', 'Kapitalisasi', 'Likuiditas 60H',
        'PER', 'PBV', 'EV/EBITDA', 'ROE %', 'Yield %', 'Skor gabungan', 'Nilai', 'Profitabilitas', 'Keamanan',
        'Status valuasi', 'Nilai wajar konservatif', 'Nilai wajar dasar', 'Nilai wajar optimistis', 'Selisih %',
        'MRS', 'UP', 'Penanda kualitas laba', 'Papan pemantauan khusus',
      ],
      ...visible.map((r) => {
        const v = reliableValuation(r)
        return [
          r.ticker, r.name, r.sector ?? '', r.subSector ?? '', r.shariah ? 'Ya' : 'Tidak',
          r.price ?? '', pct(r.chg1y), r.mcap != null ? Math.round(r.mcap) : '', r.liq60 != null ? Math.round(r.liq60) : '',
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

  // Isi pilihan dipakai bersama oleh menu desktop dan sheet filter mobile.
  const presetOptions = (
    <>
      {[null, ...PRESETS.map((p) => p.key)].map((k) => (
        <Option
          key={k ?? 'all'}
          checked={preset === k}
          onClick={() => setPreset(k)}
          label={presetLabel(k)}
          hint={k ? PRESET_HINT[k] : 'Tanpa batasan'}
          count={pCounts.get(k)}
        />
      ))}
    </>
  )
  const sectorOptions = (
    <>
      {sectorList.map((s) => (
        <Option key={s} multi checked={sectors.has(s)} onClick={() => setSectors((p) => toggleIn(p, s))} label={s} count={sCounts.get(s) ?? 0} />
      ))}
    </>
  )

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
        <p className="-mt-1 text-xs" style={{ color: 'var(--text-faint)' }}>
          {meta.disclaimer} {asOfLine(meta)}
        </p>
      )}

      {/* ─── Bilah kontrol: satu baris ─── */}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1 md:max-w-[260px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2" style={{ color: 'var(--ink-soft)' }} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari ticker atau nama"
            aria-label="Cari ticker atau nama emiten"
            className="h-11 pl-9 text-sm md:h-8 md:text-xs"
            style={{ borderColor: CTL_BORDER }}
          />
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Menu label="Pilih preset" trigger={<>{presetLabel(preset)}<span style={{ ...NUM, color: 'var(--text-faint)' }}>{pCounts.get(preset)}</span></>}>
            <div role="menu" aria-label="Preset">{presetOptions}</div>
          </Menu>
          <Menu label="Pilih sektor" trigger={sectors.size === 0 ? 'Semua sektor' : sectors.size === 1 ? [...sectors][0] : `${sectors.size} sektor`}>
            <div role="menu" aria-label="Sektor">{sectorOptions}</div>
            {sectors.size > 0 && (
              <div className="border-t p-1" style={{ borderColor: 'var(--border-soft)' }}>
                <button type="button" onClick={() => setSectors(new Set())} className="h-8 w-full rounded-lg text-xs hover:bg-[var(--surface-2)]" style={{ color: 'var(--ink-soft)' }}>
                  Kosongkan sektor
                </button>
              </div>
            )}
          </Menu>
          <Menu label="Filter lanjutan" width={320} trigger={<><SlidersHorizontal className="size-3.5" aria-hidden />Lanjutan{nRanges > 0 && <span style={{ ...NUM, color: 'var(--text-faint)' }}>{nRanges}</span>}</>}>
            <RangeInputs ranges={ranges} onChange={setRanges} />
          </Menu>
        </div>

        <button
          type="button"
          onClick={() => setFilterSheet(true)}
          className={`${ctlClass} md:hidden`}
          style={ctlStyle}
        >
          <SlidersHorizontal className="size-3.5" aria-hidden />
          Filter{nFilters > 0 && <span style={{ ...NUM, color: 'var(--text-faint)' }}>{nFilters}</span>}
        </button>

        <div
          role="group"
          aria-label="Set kolom"
          className="ml-auto hidden rounded-lg border p-0.5 md:inline-flex"
          style={{ borderColor: CTL_BORDER, background: 'var(--surface)' }}
        >
          {COLUMN_SETS.map((s) => {
            const active = s.key === colSet
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={active}
                onClick={() => setColSet(s.key)}
                className="h-7 rounded-md px-2.5 text-xs font-medium transition-colors duration-100"
                style={{ background: active ? 'var(--surface-2)' : 'transparent', color: active ? 'var(--ink)' : 'var(--ink-soft)' }}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── Status: jumlah + token filter aktif + ringkasan ─── */}
      {!isLoading && !isError && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-xs" style={{ ...NUM, color: 'var(--ink)' }}>
            <span className="font-semibold">{visible.length.toLocaleString('id-ID')}</span>
            <span style={{ color: 'var(--ink-soft)' }}> dari {rows.length.toLocaleString('id-ID')} emiten</span>
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {preset && <Token label={presetLabel(preset)} onRemove={() => setPreset(null)} />}
            {[...sectors].map((s) => (
              <Token key={s} label={s} onRemove={() => setSectors((p) => toggleIn(p, s))} />
            ))}
            {RANGE_FIELDS.map(({ key, label }) => {
              const { min, max } = ranges[key]
              if (min.trim() === '' && max.trim() === '') return null
              const text = `${label} ${min.trim() || '…'}–${max.trim() || '…'}`
              return <Token key={key} label={text} onRemove={() => setRanges({ ...ranges, [key]: { min: '', max: '' } })} />
            })}
            {!isDefault && (
              <button
                type="button"
                onClick={resetFilters}
                className="h-7 px-1.5 text-[11px] underline-offset-4 hover:underline max-md:h-11"
                style={{ color: 'var(--ink-soft)' }}
              >
                Kembalikan bawaan
              </button>
            )}
          </div>
          <p className="ml-auto hidden text-[11px] lg:block" style={{ ...NUM, color: 'var(--text-faint)' }}>
            {summary.scored} berskor · {summary.reliable} nilai wajar andal · {summary.bank} bank
          </p>
        </div>
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
        <div className={panelOpen ? 'grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_340px]' : ''}>
          {/* Desktop: tabel; thead sticky ke bawah TopNav via .tx-scroll */}
          <div className="tx-scroll s-card hidden md:block">
            <table className="w-full text-xs" style={{ ...NUM, tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0 }}>
              <colgroup>
                {cols.map((k) => <col key={k} style={{ width: `${(COLS[k].w / totalW) * 100}%` }} />)}
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
                        className="h-9 px-3 text-[11px] font-medium"
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
                      style={{ background: isSel ? 'var(--surface-2)' : undefined, contentVisibility: 'auto', containIntrinsicSize: 'auto 40px' }}
                    >
                      {cols.map((k, i) => (
                        <td
                          key={k}
                          className={`h-10 border-t px-3 ${COLS[k].numeric ? 'text-right' : ''}`}
                          style={{
                            borderColor: 'var(--border-soft)',
                            color: 'var(--ink-muted)',
                            boxShadow: i === 0 && isSel ? 'inset 2px 0 0 var(--ink)' : undefined,
                          }}
                        >
                          {k === 'ticker' ? (
                            <button
                              type="button"
                              aria-expanded={isSel}
                              onClick={(e) => { e.stopPropagation(); setSelected(isSel ? null : r.ticker) }}
                              className="flex w-full min-w-0 items-baseline gap-2 text-left"
                            >
                              <span className="w-12 shrink-0 text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{r.ticker}</span>
                              <span className="truncate" style={{ color: 'var(--text-faint)' }}>{r.name}</span>
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
                      Tidak ada emiten yang cocok. Hapus salah satu filter di atas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: daftar baris ringkas */}
          <ul className="s-card overflow-hidden md:hidden">
            {visible.map((r, i) => (
              <li key={r.ticker} style={{ borderTop: i ? '1px solid var(--border-soft)' : undefined, contentVisibility: 'auto', containIntrinsicSize: 'auto 56px' }}>
                <button type="button" onClick={() => setSelected(r.ticker)} className="flex min-h-14 w-full items-center gap-3 px-3.5 text-left active:bg-[var(--surface-2)]">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{r.ticker}</span>
                    <span className="block truncate text-xs" style={{ color: 'var(--text-faint)' }}>{r.name}</span>
                  </span>
                  <span className="shrink-0 text-right" style={NUM}>
                    <ScoreCell v={r.score?.composite} />
                    <span className="block text-[11px]" style={{ color: 'var(--ink-soft)' }}>{fmtPrice(r.price)}</span>
                  </span>
                </button>
              </li>
            ))}
            {visible.length === 0 && (
              <li className="px-6 py-12 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>Tidak ada emiten yang cocok.</li>
            )}
          </ul>

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
        <BottomSheet open onOpenChange={(o) => { if (!o) setSelected(null) }} title={`${selectedRow.ticker} · ${selectedRow.name}`} hideTitle>
          <DetailPanel row={selectedRow} meta={meta} onClose={() => setSelected(null)} />
        </BottomSheet>
      )}

      {!isDesktop && (
        <BottomSheet open={filterSheet} onOpenChange={setFilterSheet} title="Filter">
          <div className="space-y-4 overflow-y-auto px-2 pb-6">
            <SheetGroup title="Tampilkan"><div role="menu" aria-label="Preset">{presetOptions}</div></SheetGroup>
            <SheetGroup title="Urutkan">
              <div role="menu" aria-label="Urutkan">
                {MOBILE_SORTS.map((s) => (
                  <Option key={s.key} checked={sort.key === s.key} onClick={() => setSort({ key: s.key, dir: defaultDir(s.key) })} label={s.label} />
                ))}
              </div>
            </SheetGroup>
            <SheetGroup title="Sektor"><div role="menu" aria-label="Sektor">{sectorOptions}</div></SheetGroup>
            <SheetGroup title="Rentang"><RangeInputs ranges={ranges} onChange={setRanges} /></SheetGroup>
            <div className="sticky bottom-0 flex gap-2 px-2.5 pt-2" style={{ background: 'var(--surface)' }}>
              <Button variant="outline" className="h-11 flex-1" onClick={resetFilters} disabled={isDefault}>Kembalikan bawaan</Button>
              <Button className="h-11 flex-1" onClick={() => setFilterSheet(false)}>Lihat {visible.length} emiten</Button>
            </div>
          </div>
        </BottomSheet>
      )}
    </div>
  )
}

function SheetGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="px-2.5 pb-1 text-[11px] font-medium" style={{ color: 'var(--ink-soft)' }}>{title}</h3>
      {children}
    </section>
  )
}

function RangeInputs({ ranges, onChange }: { ranges: Ranges; onChange: (r: Ranges) => void }) {
  const set = (key: keyof Ranges, bound: 'min' | 'max', v: string) =>
    onChange({ ...ranges, [key]: { ...ranges[key], [bound]: v } })
  return (
    <div className="space-y-2 p-2">
      {RANGE_FIELDS.map(({ key, label }) => (
        <div key={key} className="grid grid-cols-[64px_1fr_auto_1fr] items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>{label}</span>
          <Input value={ranges[key].min} onChange={(e) => set(key, 'min', e.target.value)} placeholder="min" inputMode="decimal"
            aria-label={`${label} minimum`} className="h-11 px-2 text-xs md:h-8" style={{ ...NUM, borderColor: CTL_BORDER }} />
          <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>–</span>
          <Input value={ranges[key].max} onChange={(e) => set(key, 'max', e.target.value)} placeholder="maks" inputMode="decimal"
            aria-label={`${label} maksimum`} className="h-11 px-2 text-xs md:h-8" style={{ ...NUM, borderColor: CTL_BORDER }} />
        </div>
      ))}
      <p className="pt-1 text-[11px]" style={{ color: 'var(--text-faint)' }}>ROE dan yield dalam persen. Kosong berarti tanpa batas.</p>
    </div>
  )
}

// ─── Panel detail ───────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t px-5 py-4" style={{ borderColor: 'var(--border-soft)' }}>
      <h3 className="mb-3 text-[11px] font-medium" style={{ color: 'var(--ink-soft)' }}>{title}</h3>
      {children}
    </section>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <dt className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{label}</dt>
      <dd className="mt-0.5 text-[13px] font-medium" style={{ ...NUM, color: color ?? 'var(--ink)' }}>{value}</dd>
    </div>
  )
}

function DetailPanel({ row: r, meta, onClose }: { row: ScreenerRow; meta: ScreenerMeta; onClose: () => void }) {
  const notes = riskNotes(r)
  const composite = r.score?.composite
  const sub: { label: string; v: number | null | undefined }[] = [
    { label: 'Nilai', v: r.score?.value },
    { label: 'Profitabilitas', v: r.score?.prof },
    { label: 'Keamanan', v: r.score?.safety },
  ]
  return (
    <div className="text-sm">
      <div className="flex items-start gap-3 px-5 pt-5">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{r.ticker}</p>
          <p className="mt-0.5 truncate text-sm" style={{ color: 'var(--ink-muted)' }}>{r.name}</p>
          <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--text-faint)' }}>
            {[...new Set([r.sector, r.subSector].filter(Boolean))].join(' · ') || EMPTY}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup detail"
          className="-mr-2 -mt-1 grid size-11 shrink-0 place-items-center rounded-lg hover:bg-[var(--surface-2)] md:size-8"
          style={{ color: 'var(--ink-soft)' }}
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Skor gabungan sebagai angka utama */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-end gap-3">
          <span className="text-[44px] font-semibold leading-none tracking-tight" style={{ ...NUM, color: composite != null ? 'var(--ink)' : 'var(--text-faint)' }}>
            {fmtPctile(composite)}
          </span>
          <span className="pb-1 text-[11px] leading-tight" style={{ color: 'var(--ink-soft)' }}>
            Skor gabungan<br />persentil sektor, 0–100
          </span>
        </div>
        {composite != null && <Meter v={composite} className="mt-3 block w-full" />}
      </div>

      <dl className="grid grid-cols-3 gap-3 px-5 pb-4">
        <Stat label="Harga" value={fmtPrice(r.price)} />
        <Stat label="1 tahun" value={fmtPct(r.chg1y)} color={signColor(r.chg1y)} />
        <Stat label="Kapitalisasi" value={fmtIdrCompact(r.mcap)} />
      </dl>

      {r.hasScore && r.group !== 'bank' && (
        <Section title="Persentil faktor">
          <div className="space-y-2.5">
            {sub.map((p) => (
              <div key={p.label} className="grid grid-cols-[88px_1fr_28px] items-center gap-3 text-xs">
                <span style={{ color: 'var(--ink-muted)' }}>{p.label}</span>
                {p.v != null ? <Meter v={p.v} className="w-full" /> : <span />}
                <span className="text-right font-medium" style={{ ...NUM, color: 'var(--ink)' }}>{fmtPctile(p.v)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Nilai wajar model">
        <FairValue row={r} />
      </Section>

      <Section title="Penanda risiko">
        {notes.length > 0 ? (
          <ul className="space-y-1.5 text-xs" style={{ color: 'var(--ink-muted)' }}>
            {notes.map((n) => (
              <li key={n} className="flex gap-2">
                <span className="mt-[7px] size-1 shrink-0 rounded-full" style={{ background: 'var(--ink-soft)' }} aria-hidden />
                {n}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>{r.flags ? 'Tidak ada penanda aktif.' : EMPTY}</p>
        )}
      </Section>

      <div className="space-y-2 border-t px-5 py-4" style={{ borderColor: 'var(--border-soft)' }}>
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
  if (!v) return muted(r.hasScore ? 'Belum ada nilai wajar model.' : 'Belum ada skor riset untuk emiten ini.')
  if (v.status === 'unreliable') return muted('Valuasi belum andal')
  if (v.status === 'not_valued') return muted('Riwayat laba belum cukup')
  if (v.status === 'bank_pb') {
    return (
      <dl className="grid grid-cols-2 gap-3">
        <Stat label="P/B wajar" value={fmtRatio(v.pbJustified)} />
        <Stat label="P/B pasar" value={fmtRatio(v.pbMarket)} />
      </dl>
    )
  }

  const { cons, base, opt, gap } = v
  if (cons == null || base == null || opt == null) return muted('Valuasi belum andal')
  const price = r.price
  const lo = Math.min(cons, price ?? cons)
  const hi = Math.max(opt, price ?? opt)
  const span = hi - lo || 1
  const pos = (x: number) => ((x - lo) / span) * 100

  return (
    <div>
      <div className="relative mx-1.5 mt-6 h-6">
        {/* jalur penuh + rentang konservatif–optimistis */}
        <span className="absolute inset-x-0 top-3 h-px" style={{ background: 'var(--border)' }} />
        <span className="absolute top-[11px] h-[3px] rounded-full" style={{ left: `${pos(cons)}%`, width: `${pos(opt) - pos(cons)}%`, background: 'var(--text-faint)' }} />
        <span className="absolute top-[7px] h-[11px] w-px" style={{ left: `${pos(base)}%`, background: 'var(--ink)' }} aria-hidden />
        {price != null && (
          <>
            {/* label dijepit ke tepi supaya tidak keluar panel */}
            <span
              className="absolute -top-4 whitespace-nowrap text-[10px] leading-none"
              style={{
                ...NUM,
                color: 'var(--ink)',
                left: `${pos(price)}%`,
                transform: pos(price) < 15 ? 'translateX(-5px)' : pos(price) > 85 ? 'translateX(calc(-100% + 5px))' : 'translateX(-50%)',
              }}
            >
              Harga {fmtPrice(price)}
            </span>
            <span
              className="absolute top-[7px] size-2.5 -translate-x-1/2 rounded-full border-2"
              style={{ left: `${pos(price)}%`, borderColor: 'var(--ink)', background: 'var(--surface)' }}
              aria-hidden
            />
          </>
        )}
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-3">
        <Stat label="Konservatif" value={fmtPrice(cons)} />
        <Stat label="Dasar" value={fmtPrice(base)} />
        <Stat label="Optimistis" value={fmtPrice(opt)} />
      </dl>
      <p className="mt-3 text-xs" style={{ color: 'var(--ink-muted)' }}>
        Nilai wajar dasar vs harga:{' '}
        <span className="font-medium" style={{ ...NUM, color: signColor(gap) }}>{fmtPct(gap)}</span>
      </p>
    </div>
  )
}
