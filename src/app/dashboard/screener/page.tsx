'use client'

/**
 * Screener IDX — halaman kelas satu (P3 #1, diferensiator terbesar).
 *
 * Tabel dense SEMUA emiten ter-cover (±1.000, tanpa cap) dengan kolom
 * fundamental (PER, PBV, ROE, yield, MCap) + valuasi konsensus (fair value,
 * MoS, verdict). Filter: search deferred, chip multi-select sektor/verdict,
 * min-max numerik per metrik. Sort semua kolom, sticky header pola .tx-scroll,
 * baris pakai content-visibility:auto biar ringan tanpa virtualization.
 *
 * Data: /api/screener (snapshot kuartalan) via useQuery, staleTime 5 menit.
 * Klik baris → halaman riset per emiten.
 */

import { useMemo, useState, useDeferredValue } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ArrowUpRight, Download, RotateCcw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { QuietPageHeader } from '@/components/layout/quiet-page-header'
import { toCsv } from '@/lib/transactions/csv'
import {
  formatIDRCompact,
  formatPercentValue,
  formatPrice,
  formatRatio,
  signColorVar,
} from '@/lib/invest/format'

// Mirror bentuk response /api/screener (pola sama ResearchRow di
// stock-research-tab — interface diduplikasi, route gak meng-export type).
interface ScreenerRow {
  ticker: string
  name: string
  sector: string | null
  price: number | null
  fairValue: number | null
  /** fraksi (0.15 = 15%) */
  mos: number | null
  per: number | null
  pbv: number | null
  /** fraksi */
  roe: number | null
  /** fraksi */
  divYield: number | null
  mcap: number | null
  verdict: string | null
}

type ColKey =
  | 'ticker' | 'name' | 'sector' | 'price' | 'fairValue' | 'mos'
  | 'per' | 'pbv' | 'roe' | 'divYield' | 'mcap' | 'verdict'

const COLUMNS: { key: ColKey; label: string; numeric?: boolean }[] = [
  { key: 'ticker', label: 'Ticker' },
  { key: 'name', label: 'Nama' },
  { key: 'sector', label: 'Sektor' },
  { key: 'price', label: 'Harga', numeric: true },
  { key: 'fairValue', label: 'Fair Value', numeric: true },
  { key: 'mos', label: 'MoS%', numeric: true },
  { key: 'per', label: 'PER', numeric: true },
  { key: 'pbv', label: 'PBV', numeric: true },
  { key: 'roe', label: 'ROE%', numeric: true },
  { key: 'divYield', label: 'Yield%', numeric: true },
  { key: 'mcap', label: 'MCap', numeric: true },
  { key: 'verdict', label: 'Verdict' },
]

// ─── Filter min/max numerik ─────────────────────────────────────
type RangeKey = 'mos' | 'per' | 'pbv' | 'roe' | 'divYield'
type RangeState = Record<RangeKey, { min: string; max: string }>

const RANGE_FIELDS: { key: RangeKey; label: string }[] = [
  { key: 'mos', label: 'MoS %' },
  { key: 'per', label: 'PER' },
  { key: 'pbv', label: 'PBV' },
  { key: 'roe', label: 'ROE %' },
  { key: 'divYield', label: 'Yield %' },
]
/** Metrik yang disimpan fraksi tapi diinput user sebagai persen. */
const PCT_KEYS = new Set<RangeKey>(['mos', 'roe', 'divYield'])
const EMPTY_RANGES: RangeState = {
  mos: { min: '', max: '' },
  per: { min: '', max: '' },
  pbv: { min: '', max: '' },
  roe: { min: '', max: '' },
  divYield: { min: '', max: '' },
}

// ─── Verdict ────────────────────────────────────────────────────
type VerdictBucket = 'undervalued' | 'fair' | 'overvalued'

const VERDICT_OPTIONS: { key: VerdictBucket; label: string }[] = [
  { key: 'undervalued', label: 'Undervalued' },
  { key: 'fair', label: 'Fair Value' },
  { key: 'overvalued', label: 'Overvalued' },
]

/** Data pakai istilah 'UNDERVALUED'/'FAIR VALUE'/'OVERVALUED' (+ varian HIGHLY, 'N/A'). */
function verdictBucket(v: string | null): VerdictBucket | null {
  if (!v) return null
  const u = v.toUpperCase()
  if (u.includes('UNDER')) return 'undervalued'
  if (u.includes('FAIR')) return 'fair'
  if (u.includes('OVER')) return 'overvalued'
  return null
}

/** Chip verdict — warna DATA (soft bg + teks -ink), bukan aksen chrome. */
function verdictChipStyle(bucket: VerdictBucket | null): { background: string; color: string } {
  if (bucket === 'undervalued') return { background: 'var(--c-mint-soft)', color: 'var(--c-mint-ink)' }
  if (bucket === 'overvalued') return { background: 'var(--c-coral-soft)', color: 'var(--c-coral-ink)' }
  return { background: 'var(--surface-2)', color: 'var(--ink-muted)' }
}

// ─── Chip filter kecil (sektor + verdict) ───────────────────────
function FilterChip({
  label, active, onToggle,
}: {
  label: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-100"
      style={{
        background: active ? 'var(--c-primary)' : 'var(--surface)',
        borderColor: active ? 'var(--c-primary)' : 'var(--border)',
        color: active ? 'var(--c-primary-foreground)' : 'var(--ink-muted)',
      }}
    >
      {label}
    </button>
  )
}

const RESEARCH_HREF = '/dashboard/assets/investment/stock/research'

export default function ScreenerPage() {
  const router = useRouter()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['screener'],
    queryFn: async () => {
      const res = await fetch('/api/screener')
      if (!res.ok) throw new Error(`screener ${res.status}`)
      return res.json() as Promise<{ rows: ScreenerRow[]; generatedAt: string }>
    },
    staleTime: 5 * 60 * 1000,
  })
  const rows = useMemo(() => data?.rows ?? [], [data])

  // ─── State filter ───────────────────────────────────────────
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [sectorSel, setSectorSel] = useState<Set<string>>(new Set())
  const [verdictSel, setVerdictSel] = useState<Set<VerdictBucket>>(new Set())
  const [ranges, setRanges] = useState<RangeState>(EMPTY_RANGES)
  const [sort, setSort] = useState<{ key: ColKey; dir: 'asc' | 'desc' }>({ key: 'mos', dir: 'desc' })

  const hasFilter =
    search !== '' || sectorSel.size > 0 || verdictSel.size > 0 ||
    RANGE_FIELDS.some(({ key }) => ranges[key].min !== '' || ranges[key].max !== '')

  const sectors = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) if (r.sector) set.add(r.sector)
    return [...set].sort()
  }, [rows])

  function toggleIn<T>(set: Set<T>, value: T): Set<T> {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  }

  function setRange(key: RangeKey, bound: 'min' | 'max', value: string) {
    setRanges((prev) => ({ ...prev, [key]: { ...prev[key], [bound]: value } }))
  }

  function resetFilters() {
    setSearch('')
    setSectorSel(new Set())
    setVerdictSel(new Set())
    setRanges(EMPTY_RANGES)
  }

  // ─── Filter + sort ──────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase()
    return rows.filter((r) => {
      if (q && !r.ticker.toLowerCase().includes(q) && !r.name.toLowerCase().includes(q)) return false
      if (sectorSel.size > 0 && (!r.sector || !sectorSel.has(r.sector))) return false
      if (verdictSel.size > 0) {
        const b = verdictBucket(r.verdict)
        if (!b || !verdictSel.has(b)) return false
      }
      for (const { key } of RANGE_FIELDS) {
        const { min, max } = ranges[key]
        if (min === '' && max === '') continue
        const raw = r[key]
        if (raw === null) return false // bound aktif tapi metrik kosong → keluar
        const val = PCT_KEYS.has(key) ? raw * 100 : raw
        const lo = min === '' ? null : Number(min)
        const hi = max === '' ? null : Number(max)
        if (lo !== null && Number.isFinite(lo) && val < lo) return false
        if (hi !== null && Number.isFinite(hi) && val > hi) return false
      }
      return true
    })
  }, [rows, deferredSearch, sectorSel, verdictSel, ranges])

  const sorted = useMemo(() => {
    const { key, dir } = sort
    const mul = dir === 'asc' ? 1 : -1
    const arr = [...filtered]
    arr.sort((a, b) => {
      const va = a[key]
      const vb = b[key]
      // null selalu di bawah, apapun arah sort
      if (va === null && vb === null) return a.ticker.localeCompare(b.ticker)
      if (va === null) return 1
      if (vb === null) return -1
      if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb) * mul
      return ((va as number) - (vb as number)) * mul
    })
    return arr
  }, [filtered, sort])

  function toggleSort(key: ColKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: COLUMNS.find((c) => c.key === key)?.numeric ? 'desc' : 'asc' },
    )
  }

  // ─── Export CSV — REUSE toCsv (quoting + anti formula-injection, tested) ──
  function exportCsv() {
    const header = ['Ticker', 'Nama', 'Sektor', 'Harga', 'Fair Value', 'MoS %', 'PER', 'PBV', 'ROE %', 'Yield %', 'Market Cap', 'Verdict']
    const csv = toCsv([
      header,
      ...sorted.map((r) => [
        r.ticker,
        r.name,
        r.sector ?? '',
        r.price ?? '',
        r.fairValue != null ? Math.round(r.fairValue) : '',
        r.mos != null ? (r.mos * 100).toFixed(2) : '',
        r.per != null ? r.per.toFixed(2) : '',
        r.pbv != null ? r.pbv.toFixed(2) : '',
        r.roe != null ? (r.roe * 100).toFixed(2) : '',
        r.divYield != null ? (r.divYield * 100).toFixed(2) : '',
        r.mcap != null ? Math.round(r.mcap) : '',
        r.verdict ?? '',
      ]),
    ])
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `screener-idx-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <QuietPageHeader
        title="Screener IDX"
        info="Screening fundamental semua emiten IDX: valuasi konsensus (fair value, margin of safety) + rasio kunci per tahun buku lengkap terakhir. Data snapshot kuartalan, bukan real-time."
        actions={
          <Button size="sm" onClick={exportCsv} disabled={isLoading || sorted.length === 0}>
            <Download data-icon="inline-start" />
            Export CSV
          </Button>
        }
      />
      <p className="text-xs -mt-2" style={{ color: 'var(--ink-muted)' }}>
        {isLoading ? 'Memuat data emiten…' : `${rows.length.toLocaleString('id-ID')} emiten IDX · snapshot kuartalan`}
      </p>

      {/* ─── Filter bar ─── */}
      <div className="s-card s-card-pad space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5" style={{ color: 'var(--ink-soft)' }} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari ticker / nama emiten…"
              className="pl-9 h-8 text-sm"
              aria-label="Cari ticker atau nama emiten"
            />
          </div>
          {/* Min/max per metrik — kosong = tanpa batas */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {RANGE_FIELDS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-1">
                <span className="text-[11px] font-medium whitespace-nowrap" style={{ color: 'var(--ink-soft)' }}>{label}</span>
                <Input
                  value={ranges[key].min}
                  onChange={(e) => setRange(key, 'min', e.target.value)}
                  placeholder="min"
                  inputMode="decimal"
                  className="h-8 w-16 px-2 text-xs num tabular"
                  aria-label={`${label} minimum`}
                />
                <span className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>–</span>
                <Input
                  value={ranges[key].max}
                  onChange={(e) => setRange(key, 'max', e.target.value)}
                  placeholder="max"
                  inputMode="decimal"
                  className="h-8 w-16 px-2 text-xs num tabular"
                  aria-label={`${label} maksimum`}
                />
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={resetFilters} disabled={!hasFilter}>
            <RotateCcw data-icon="inline-start" />
            Reset
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="eyebrow mr-1">Verdict</span>
          {VERDICT_OPTIONS.map(({ key, label }) => (
            <FilterChip
              key={key}
              label={label}
              active={verdictSel.has(key)}
              onToggle={() => setVerdictSel((prev) => toggleIn(prev, key))}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="eyebrow mr-1">Sektor</span>
          {sectors.map((s) => (
            <FilterChip
              key={s}
              label={s}
              active={sectorSel.has(s)}
              onToggle={() => setSectorSel((prev) => toggleIn(prev, s))}
            />
          ))}
        </div>
      </div>

      {!isLoading && !isError && (
        <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
          {sorted.length.toLocaleString('id-ID')} dari {rows.length.toLocaleString('id-ID')} emiten lolos filter
        </p>
      )}

      {/* ─── Loading: skeleton table ─── */}
      {isLoading && (
        <div className="s-card overflow-hidden" aria-busy="true" aria-label="Memuat tabel screener">
          <div className="h-9 border-b animate-pulse" style={{ background: 'var(--surface-2)', borderColor: 'var(--border-soft)' }} />
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 border-b" style={{ height: 38, borderColor: 'var(--border-soft)' }}>
              <div className="h-3 w-12 rounded animate-pulse" style={{ background: 'var(--surface-2)' }} />
              <div className="h-3 flex-1 max-w-[220px] rounded animate-pulse" style={{ background: 'var(--surface-2)' }} />
              <div className="ml-auto h-3 w-40 rounded animate-pulse" style={{ background: 'var(--surface-2)' }} />
            </div>
          ))}
        </div>
      )}

      {/* ─── Error: kartu retry ─── */}
      {isError && (
        <div className="s-card p-10 flex flex-col items-center text-center">
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Gagal memuat data screener</p>
          <p className="text-xs mt-1 max-w-sm" style={{ color: 'var(--ink-muted)' }}>
            Coba ulang — kalau masih gagal, kemungkinan sumber data lagi bermasalah.
          </p>
          <Button size="sm" className="mt-4" onClick={() => void refetch()}>
            Coba lagi
          </Button>
        </div>
      )}

      {/* ─── Tabel dense (≥lg) — sticky header pola .tx-scroll ───
          tableLayout fixed + lebar % (preseden tabel transaksi): truncate di
          kolom teks, jadi gak pernah butuh scroll horizontal (yang matahin
          sticky thead). */}
      {!isLoading && !isError && (
        <>
          <div className="tx-scroll s-card hidden lg:block">
            <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '6.5%' }} />{/* Ticker */}
                <col style={{ width: '16%' }} />{/* Nama */}
                <col style={{ width: '9.5%' }} />{/* Sektor */}
                <col style={{ width: '7%' }} />{/* Harga */}
                <col style={{ width: '7%' }} />{/* Fair Value */}
                <col style={{ width: '7%' }} />{/* MoS% */}
                <col style={{ width: '6.5%' }} />{/* PER */}
                <col style={{ width: '6.5%' }} />{/* PBV */}
                <col style={{ width: '6.5%' }} />{/* ROE% */}
                <col style={{ width: '6.5%' }} />{/* Yield% */}
                <col style={{ width: '10.5%' }} />{/* MCap */}
                <col style={{ width: '10.5%' }} />{/* Verdict */}
              </colgroup>
              <thead>
                <tr>
                  {COLUMNS.map((col) => {
                    const active = sort.key === col.key
                    return (
                      <th
                        key={col.key}
                        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        className="px-2.5 py-2.5 text-[11px] uppercase tracking-[0.08em] font-semibold whitespace-nowrap"
                        style={{ color: 'var(--ink-soft)' }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(col.key)}
                          className={`inline-flex w-full items-center gap-0.5 uppercase tracking-[0.08em] font-semibold transition-colors duration-100 hover:text-[var(--ink)] ${col.numeric ? 'justify-end' : 'justify-start'}`}
                          style={{ color: active ? 'var(--ink)' : 'inherit' }}
                        >
                          {col.label}
                          {active && (sort.dir === 'asc'
                            ? <ArrowUp className="size-3 shrink-0" aria-hidden="true" />
                            : <ArrowDown className="size-3 shrink-0" aria-hidden="true" />)}
                        </button>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const bucket = verdictBucket(r.verdict)
                  return (
                    <tr
                      key={r.ticker}
                      onClick={() => router.push(`${RESEARCH_HREF}/${r.ticker}`)}
                      className="border-t cursor-pointer transition-colors duration-100 hover:bg-[var(--surface-2)]"
                      // content-visibility: baris di luar viewport gak di-render →
                      // ±1.000 baris tetap ringan tanpa dependency virtualization.
                      style={{
                        borderColor: 'var(--border-soft)',
                        contentVisibility: 'auto',
                        containIntrinsicSize: 'auto 38px',
                      }}
                    >
                      <td className="px-2.5 py-2 font-mono font-semibold truncate" style={{ color: 'var(--ink)' }}>
                        <Link
                          href={`${RESEARCH_HREF}/${r.ticker}`}
                          className="hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.ticker}
                        </Link>
                      </td>
                      <td className="px-2.5 py-2 truncate" style={{ color: 'var(--ink-muted)' }}>{r.name}</td>
                      <td className="px-2.5 py-2 truncate" style={{ color: 'var(--ink-soft)' }}>{r.sector ?? '—'}</td>
                      <td className="px-2.5 py-2 text-right num tabular truncate" style={{ color: 'var(--ink)' }}>{formatPrice(r.price)}</td>
                      <td className="px-2.5 py-2 text-right num tabular truncate" style={{ color: 'var(--ink-muted)' }}>{formatPrice(r.fairValue != null ? Math.round(r.fairValue) : null)}</td>
                      <td className="px-2.5 py-2 text-right num tabular font-semibold truncate" style={{ color: signColorVar(r.mos) }}>{formatPercentValue(r.mos)}</td>
                      <td className="px-2.5 py-2 text-right num tabular truncate" style={{ color: 'var(--ink)' }}>{formatRatio(r.per)}</td>
                      <td className="px-2.5 py-2 text-right num tabular truncate" style={{ color: 'var(--ink)' }}>{formatRatio(r.pbv)}</td>
                      <td className="px-2.5 py-2 text-right num tabular truncate" style={{ color: 'var(--ink)' }}>{formatPercentValue(r.roe)}</td>
                      <td className="px-2.5 py-2 text-right num tabular truncate" style={{ color: 'var(--ink)' }}>{formatPercentValue(r.divYield)}</td>
                      <td className="px-2.5 py-2 text-right num tabular text-[11px] truncate" style={{ color: 'var(--ink-muted)' }}>{formatIDRCompact(r.mcap)}</td>
                      <td className="px-2.5 py-2 truncate">
                        {bucket ? (
                          <span
                            className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                            style={verdictChipStyle(bucket)}
                          >
                            {(r.verdict ?? '').toLowerCase()}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--ink-soft)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-6 py-12 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
                      Tidak ada emiten yang cocok dengan filter — coba longgarkan batasnya.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* <lg (mobile + tablet): list compact — kolom lengkap khusus desktop */}
          <div className="s-card overflow-hidden lg:hidden">
            {sorted.map((r, i) => (
              <Link
                key={r.ticker}
                href={`${RESEARCH_HREF}/${r.ticker}`}
                className="flex items-center gap-3 px-3.5 transition-colors active:bg-[var(--surface-2)]"
                style={{
                  minHeight: 52,
                  borderTop: i ? '1px solid var(--border-soft)' : 'none',
                  contentVisibility: 'auto',
                  containIntrinsicSize: 'auto 52px',
                }}
              >
                <span className="font-mono text-[11px] font-bold px-1.5 py-1 rounded shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}>
                  {r.ticker}
                </span>
                <span className="min-w-0 flex-1 py-2">
                  <span className="block truncate text-[13px] font-medium leading-tight" style={{ color: 'var(--ink)' }}>{r.name}</span>
                  <span className="mt-0.5 block truncate text-[11px] leading-tight" style={{ color: 'var(--ink-soft)' }}>
                    {r.sector ?? '—'}{r.per != null ? ` · PER ${formatRatio(r.per)}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="num tabular block text-[13px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>{formatPrice(r.price)}</span>
                  <span className="num tabular mt-0.5 block text-[11px] font-semibold leading-tight" style={{ color: signColorVar(r.mos) }}>{formatPercentValue(r.mos)}</span>
                </span>
                <ArrowUpRight className="size-3.5 shrink-0" style={{ color: 'var(--ink-soft)' }} />
              </Link>
            ))}
            {sorted.length === 0 && (
              <p className="px-6 py-12 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
                Tidak ada emiten yang cocok dengan filter.
              </p>
            )}
          </div>
        </>
      )}

      <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
        Data snapshot kuartalan (bukan real-time). PER/PBV/yield dihitung dari harga snapshot terhadap tahun buku
        lengkap terakhir; fair value = median konsensus multi-metode. Bukan rekomendasi jual/beli.
      </p>
    </div>
  )
}
