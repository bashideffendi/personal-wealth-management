'use client'

/**
 * Compare tab — side-by-side comparison untuk 2-4 saham IDX.
 * Tabular metrics: harga, fair value, MoS, verdict, sektor (semua breakpoint),
 * plus pendalaman desktop (md+): breakdown valuasi per metode, skor Piotroski,
 * sparkline tren 10 tahun, dan dividend yield TTM.
 *
 * Source: /api/idx-research (slim list) untuk 5 baris dasar; detail per-ticker
 * di-fetch paralel dari /api/idx-research/[ticker] via useQueries (staleTime
 * 5 menit), digate media query md biar mobile gak ikut narik data. Baris
 * pendalaman pakai `hidden md:table-row` — perilaku mobile tak berubah.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useQueries } from '@tanstack/react-query'
import { Plus, X, Search, Loader2, ArrowUpRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  formatIDRCompact,
  formatPercentValue,
  formatPrice,
  parseIDXShortDate,
  signColorVar,
  verdictStyle,
} from '@/lib/invest/format'
import { METHOD_ORDER } from '@/lib/invest/valuation-methods'
import { computePiotroski } from '@/lib/invest/piotroski'
import type { Stock } from '@/lib/invest/stocks'
import { useT } from '@/lib/i18n/context'

interface ResearchRow {
  ticker: string
  name: string
  sector: string | null
  price: number
  avgMoS: number | null
  verdict: string | null
  avgFairValue: number | null
  medianFairValue: number | null
}

// ─── Shape response /api/idx-research/[ticker] (subset yang dipakai) ────────

interface MethodDetail {
  fairValue: number | null
  mos: number | null
}

interface CompareDetail {
  ticker: string
  valuation: {
    price: number
    methods: Record<string, number | null>
    avgFairValue: number | null
    medianFairValue: number | null
    methodsValid: number
    undervaluedCount: number
    avgMoS: number | null
    verdict: string | null
  } | null
  detail: { price: number | null; methods: Record<string, MethodDetail> } | null
  dividends?: Array<{ dividend: number; exDate: string | null }>
  /**
   * Field opsional — route hari ini BELUM meng-expose metrik historis maupun
   * Piotroski (cek src/app/api/idx-research/[ticker]/route.ts). Begitu route
   * nambahin salah satu field ini, baris Piotroski + sparkline tren otomatis
   * nyala tanpa perlu menyentuh komponen ini lagi.
   */
  piotroski?: { score: number; maxPossible: number; verdict: string } | null
  stock?: { metrics?: Record<string, Record<string, number>> } | null
  metrics?: Record<string, Record<string, number>> | null
}

interface SeriPoint {
  year: number
  value: number
}

/** Hasil olahan response detail per ticker — bahan baris pendalaman desktop. */
interface DeepData {
  methods: Record<string, MethodDetail>
  konsensusFV: number | null
  konsensusMoS: number | null
  piotroski: { score: number; maxPossible: number; verdict: string } | null
  revenue10: SeriPoint[]
  netProfit10: SeriPoint[]
  divYieldTTM: number | null
}

const MS_SETAHUN = 365 * 24 * 60 * 60 * 1000

/** Ambil maks 10 tahun terakhir sebuah metrik, urut naik, buang nol/NaN. */
function seri10Tahun(
  metrics: Record<string, Record<string, number>> | null,
  nama: string,
): SeriPoint[] {
  const s = metrics?.[nama]
  if (!s) return []
  return Object.entries(s)
    .map(([y, v]) => ({ year: parseInt(y, 10), value: v }))
    .filter((e) => Number.isFinite(e.value) && e.value !== 0)
    .sort((a, b) => a.year - b.year)
    .slice(-10)
}

/** Dividend yield TTM: total dividen ber-ex-date ≤ 12 bulan ke belakang ÷ harga. */
function hitungYieldTTM(
  dividends: CompareDetail['dividends'],
  price: number | null,
): number | null {
  if (!price || price <= 0 || !dividends?.length) return null
  const now = Date.now()
  let total = 0
  let ada = false
  for (const d of dividends) {
    const t = parseIDXShortDate(d.exDate)?.getTime()
    if (t === undefined) continue
    if (t <= now && now - t <= MS_SETAHUN) {
      total += d.dividend
      ada = true
    }
  }
  return ada ? total / price : null
}

/** Olah response detail jadi data siap render. fallbackPrice = harga slim list. */
function olahDetail(data: CompareDetail, fallbackPrice: number | null): DeepData {
  const price = data.valuation?.price ?? data.detail?.price ?? fallbackPrice
  // Breakdown metode: prefer `detail` (fair value + MoS sudah precomputed);
  // fallback hitung MoS sendiri dari fair value `valuation` ÷ harga.
  let methods: Record<string, MethodDetail> = data.detail?.methods ?? {}
  if (Object.keys(methods).length === 0 && data.valuation?.methods) {
    methods = {}
    for (const [k, fv] of Object.entries(data.valuation.methods)) {
      methods[k] = { fairValue: fv, mos: fv != null && price ? fv / price - 1 : null }
    }
  }
  const metrics = data.stock?.metrics ?? data.metrics ?? null
  let piotroski = data.piotroski ?? null
  if (!piotroski && metrics) {
    // Hitung F-Score client-side — computePiotroski cuma baca stock.metrics,
    // field lain boleh kosong (pola sama keystats-grid).
    try {
      const r = computePiotroski({
        ticker: data.ticker,
        name: null,
        type: null,
        listingDate: null,
        board: null,
        sector: null,
        currentPrice: price,
        metrics,
      } as Stock)
      piotroski = { score: r.score, maxPossible: r.maxPossible, verdict: r.verdict }
    } catch {
      // metrik tak lengkap → biarkan null, sel render '—'
    }
  }
  return {
    methods,
    konsensusFV: data.valuation
      ? (data.valuation.medianFairValue ?? data.valuation.avgFairValue)
      : null,
    konsensusMoS: data.valuation?.avgMoS ?? null,
    piotroski,
    revenue10: seri10Tahun(metrics, 'Revenue'),
    netProfit10: seri10Tahun(metrics, 'Net Profit'),
    divYieldTTM: hitungYieldTTM(data.dividends, price),
  }
}

/** True kalau viewport ≥ md (768px) — gate fetch detail biar mobile hemat data. */
function useDesktopMd(): boolean {
  const [md, setMd] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const update = () => setMd(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return md
}

const MAX_COMPARE = 4

export function StockCompareTab() {
  const t = useT()
  const [allRows, setAllRows] = useState<ResearchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTickers, setSelectedTickers] = useState<string[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/idx-research')
      .then((r) => r.json())
      .then((data: { rows?: ResearchRow[] }) => {
        if (!cancelled) {
          setAllRows(data.rows ?? [])
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

  const byTicker = useMemo(() => {
    const map = new Map<string, ResearchRow>()
    for (const r of allRows) map.set(r.ticker, r)
    return map
  }, [allRows])

  const selected = useMemo(
    () => selectedTickers.map((t) => byTicker.get(t)).filter((x): x is ResearchRow => !!x),
    [selectedTickers, byTicker],
  )

  // Detail per-ticker (paralel, cache 5 menit) — sumber baris pendalaman
  // desktop. enabled digate md+ karena barisnya hidden di mobile.
  const isDesktopMd = useDesktopMd()
  const detailQueries = useQueries({
    queries: selectedTickers.map((tk) => ({
      queryKey: ['compare-detail', tk],
      staleTime: 5 * 60 * 1000,
      enabled: isDesktopMd,
      queryFn: async (): Promise<CompareDetail | null> => {
        const r = await fetch(`/api/idx-research/${tk}`)
        if (!r.ok) return null // 404 = ticker tak ter-cover; render '—' tanpa retry
        return (await r.json()) as CompareDetail
      },
    })),
  })

  function add(ticker: string) {
    if (selectedTickers.length >= MAX_COMPARE) return
    if (selectedTickers.includes(ticker)) return
    setSelectedTickers([...selectedTickers, ticker])
    setPickerOpen(false)
  }

  function remove(ticker: string) {
    setSelectedTickers(selectedTickers.filter((t) => t !== ticker))
  }

  if (loading) {
    return (
      <div className="py-16 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
        <Loader2 className="size-5 mx-auto animate-spin mb-2" />
        {t('stock_compare.loading')}
      </div>
    )
  }

  // Compute winners per metric (highlight emerald)
  const winners = (() => {
    if (selected.length < 2) return {} as Record<string, string>
    const w: Record<string, string> = {}
    // Cheapest price
    const minPrice = [...selected].sort((a, b) => a.price - b.price)[0]
    w.price = minPrice.ticker
    // Highest MoS
    const maxMoS = [...selected].sort((a, b) => (b.avgMoS ?? -Infinity) - (a.avgMoS ?? -Infinity))[0]
    if (maxMoS.avgMoS != null) w.mos = maxMoS.ticker
    return w
  })()

  // ── Olah data pendalaman per ticker (desktop md+) ──
  const deepBy = new Map<string, { loading: boolean; deep: DeepData | null }>()
  selectedTickers.forEach((tk, i) => {
    const q = detailQueries[i]
    deepBy.set(tk, {
      loading: q?.isLoading ?? false,
      deep: q?.data ? olahDetail(q.data, byTicker.get(tk)?.price ?? null) : null,
    })
  })
  const deeps = selectedTickers.map((tk) => deepBy.get(tk)?.deep ?? null)
  const masihLoading = selectedTickers.some((tk) => deepBy.get(tk)?.loading)

  // Union metode yang tersedia di response, urut konsisten METHOD_ORDER
  // (sama dengan halaman research); key di luar daftar itu nempel di ekor.
  const methodKeys = (() => {
    const avail = new Set<string>()
    for (const d of deeps) if (d) for (const k of Object.keys(d.methods)) avail.add(k)
    const urut = METHOD_ORDER.filter((k) => avail.has(k))
    const sisa = [...avail].filter((k) => !METHOD_ORDER.includes(k)).sort()
    return [...urut, ...sisa]
  })()

  // Baris pendalaman cuma dirender kalau minimal satu emiten punya datanya
  // (atau masih loading) — degradasi rapi tanpa mecahin layout.
  const adaValuasi = methodKeys.length > 0 || deeps.some((d) => d?.konsensusFV != null)
  const adaPiotroski = deeps.some((d) => d?.piotroski)
  const adaTrenRevenue = deeps.some((d) => (d?.revenue10.length ?? 0) >= 2)
  const adaTrenLaba = deeps.some((d) => (d?.netProfit10.length ?? 0) >= 2)
  const adaYield = deeps.some((d) => d?.divYieldTTM != null)
  const adaKualitas = adaPiotroski || adaTrenRevenue || adaTrenLaba || adaYield

  // Catatan kecil: ada gap '—' setelah loading rampung (emiten tak ter-cover
  // sepenuhnya oleh snapshot data).
  const adaGap =
    !masihLoading &&
    selected.length > 0 &&
    (deeps.some((d) => !d) ||
      deeps.some((d) => d && methodKeys.some((k) => d.methods[k]?.fairValue == null)) ||
      (adaPiotroski && deeps.some((d) => d && !d.piotroski)) ||
      (adaYield && deeps.some((d) => d && d.divYieldTTM == null)))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {t('stock_compare.intro_prefix')} {MAX_COMPARE} {t('stock_compare.intro_suffix')}
        </p>
        <Button
          onClick={() => setPickerOpen(true)}
          disabled={selected.length >= MAX_COMPARE}
          size="sm"
        >
          <Plus className="size-3.5" /> {t('stock_compare.add_stock')}
        </Button>
      </div>

      {selected.length === 0 ? (
        <div
          className="rounded-2xl border p-10 text-center"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            {t('stock_compare.empty_title')}
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--ink-muted)' }}>
            {t('stock_compare.empty_hint')}
          </p>
        </div>
      ) : (
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
                  <th className="px-3 py-3 sticky left-0 bg-[var(--surface)] z-10">{t('stock_compare.col_metric')}</th>
                  {selected.map((s) => (
                    <th key={s.ticker} className="px-3 py-3 min-w-[160px]">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/dashboard/assets/investment/stock/research/${s.ticker}`}
                          className="font-mono font-bold text-sm hover:underline inline-flex items-center gap-1"
                          style={{ color: 'var(--ink)' }}
                        >
                          {s.ticker}
                          <ArrowUpRight className="size-3" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => remove(s.ticker)}
                          className="text-[var(--ink-soft)] hover:text-[var(--danger)]"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                      <p className="text-[10px] mt-1 truncate normal-case font-normal" style={{ color: 'var(--ink-muted)' }}>
                        {s.name}
                      </p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <CompareRow
                  label={t('stock_compare.row_sector')}
                  values={selected.map((s) => ({ ticker: s.ticker, raw: s.sector ?? '—' }))}
                />
                <CompareRow
                  label={t('stock_compare.row_price')}
                  values={selected.map((s) => ({
                    ticker: s.ticker,
                    raw: formatPrice(s.price),
                    isWinner: winners.price === s.ticker,
                  }))}
                />
                <CompareRow
                  label={t('stock_compare.row_fair_value')}
                  values={selected.map((s) => ({
                    ticker: s.ticker,
                    raw: formatIDRCompact(s.medianFairValue ?? s.avgFairValue),
                  }))}
                />
                <CompareRow
                  label={t('stock_compare.row_mos')}
                  values={selected.map((s) => ({
                    ticker: s.ticker,
                    raw: formatPercentValue(s.avgMoS),
                    color: signColorVar(s.avgMoS),
                    isWinner: winners.mos === s.ticker,
                  }))}
                />
                <CompareRow
                  label={t('stock_compare.row_verdict')}
                  values={selected.map((s) => {
                    const verdict = verdictStyle(s.verdict)
                    return {
                      ticker: s.ticker,
                      jsx: s.verdict ? (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
                          style={{ background: verdict.bg, color: verdict.fg }}
                        >
                          {s.verdict.toLowerCase()}
                        </span>
                      ) : <span style={{ color: 'var(--ink-soft)' }}>—</span>,
                    }
                  })}
                />

                {/* ── Pendalaman desktop (md+): breakdown valuasi per metode ── */}
                {(masihLoading || adaValuasi) && (
                  <>
                    <SectionRow label="Valuasi per metode" span={selected.length} />
                    {methodKeys.map((k) => (
                      <DeepRow
                        key={k}
                        label={k}
                        cells={selected.map((s) => {
                          const st = deepBy.get(s.ticker)
                          return {
                            ticker: s.ticker,
                            loading: !!st?.loading,
                            node: <MethodCell m={st?.deep?.methods[k]} />,
                          }
                        })}
                      />
                    ))}
                    <DeepRow
                      label="Fair value konsensus"
                      bold
                      cells={selected.map((s) => {
                        const st = deepBy.get(s.ticker)
                        return {
                          ticker: s.ticker,
                          loading: !!st?.loading,
                          node: (
                            <MethodCell
                              m={st?.deep
                                ? { fairValue: st.deep.konsensusFV, mos: st.deep.konsensusMoS }
                                : undefined}
                            />
                          ),
                        }
                      })}
                    />
                  </>
                )}

                {/* ── Pendalaman desktop (md+): kualitas, tren 10 thn, dividen ── */}
                {(masihLoading || adaKualitas) && (
                  <>
                    <SectionRow label="Kualitas & tren" span={selected.length} />
                    {(masihLoading || adaPiotroski) && (
                      <DeepRow
                        label="Skor Piotroski"
                        cells={selected.map((s) => {
                          const st = deepBy.get(s.ticker)
                          return {
                            ticker: s.ticker,
                            loading: !!st?.loading,
                            node: <PiotroskiCell p={st?.deep?.piotroski ?? null} />,
                          }
                        })}
                      />
                    )}
                    {(masihLoading || adaTrenRevenue) && (
                      <DeepRow
                        label="Revenue 10 thn"
                        cells={selected.map((s) => {
                          const st = deepBy.get(s.ticker)
                          return {
                            ticker: s.ticker,
                            loading: !!st?.loading,
                            node: (
                              <Sparkline
                                points={st?.deep?.revenue10 ?? []}
                                label={`Revenue ${s.ticker}`}
                              />
                            ),
                          }
                        })}
                      />
                    )}
                    {(masihLoading || adaTrenLaba) && (
                      <DeepRow
                        label="Laba bersih 10 thn"
                        cells={selected.map((s) => {
                          const st = deepBy.get(s.ticker)
                          return {
                            ticker: s.ticker,
                            loading: !!st?.loading,
                            node: (
                              <Sparkline
                                points={st?.deep?.netProfit10 ?? []}
                                label={`Laba bersih ${s.ticker}`}
                              />
                            ),
                          }
                        })}
                      />
                    )}
                    {(masihLoading || adaYield) && (
                      <DeepRow
                        label="Dividend yield (TTM)"
                        cells={selected.map((s) => {
                          const st = deepBy.get(s.ticker)
                          const val = st?.deep?.divYieldTTM
                          return {
                            ticker: s.ticker,
                            loading: !!st?.loading,
                            node: val != null
                              ? <span className="num tabular">{formatPercentValue(val)}</span>
                              : <Dash />,
                          }
                        })}
                      />
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Catatan kecil — desktop only, muncul kalau ada gap data '—' */}
      {selected.length > 0 && adaGap && (
        <p className="hidden md:block text-[11px]" style={{ color: 'var(--ink-soft)' }}>
          — = data belum ter-cover snapshot untuk emiten tersebut.
        </p>
      )}
      {selected.length > 0 && !masihLoading && deeps.some((d) => d) &&
        !adaPiotroski && !adaTrenRevenue && !adaTrenLaba && (
        <p className="hidden md:block text-[11px]" style={{ color: 'var(--ink-soft)' }}>
          Skor Piotroski &amp; tren 10 tahun butuh metrik historis per emiten — belum
          tersedia dari sumber data compare.
        </p>
      )}

      {selected.length >= 2 && (
        <p className="text-[11px] inline-flex items-center gap-1" style={{ color: 'var(--ink-soft)' }}>
          <CheckCircle2 className="size-3 shrink-0" style={{ color: 'var(--c-mint-ink)' }} /> {t('stock_compare.legend')}
        </p>
      )}

      <PickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        rows={allRows}
        selected={new Set(selectedTickers)}
        onPick={add}
      />
    </div>
  )
}

function CompareRow({
  label,
  values,
}: {
  label: string
  values: Array<{ ticker: string; raw?: string; jsx?: React.ReactNode; color?: string; isWinner?: boolean }>
}) {
  return (
    <tr className="border-t" style={{ borderColor: 'var(--border-soft)' }}>
      <td
        className="px-3 py-2.5 text-xs sticky left-0 bg-[var(--surface)] z-10 font-medium"
        style={{ color: 'var(--ink-muted)' }}
      >
        {label}
      </td>
      {values.map((v) => (
        <td
          key={v.ticker}
          className="px-3 py-2.5 text-sm num tabular"
          style={{
            color: v.color ?? 'var(--ink)',
            background: v.isWinner ? 'rgba(16,185,129,0.08)' : undefined,
            fontWeight: v.isWinner ? 600 : 400,
          }}
        >
          {v.jsx ?? v.raw}
          {v.isWinner && <CheckCircle2 className="inline size-3 ml-1 align-text-bottom" style={{ color: 'var(--c-mint-ink)' }} />}
        </td>
      ))}
    </tr>
  )
}

// ─── Baris & sel pendalaman (desktop md+ only) ───────────────────────────────

/** Header section di dalam tabel compare — sticky label di kolom pertama. */
function SectionRow({ label, span }: { label: string; span: number }) {
  return (
    <tr className="hidden md:table-row border-t" style={{ borderColor: 'var(--border-soft)' }}>
      <td
        className="px-3 py-2 text-[10px] uppercase tracking-[0.08em] font-semibold sticky left-0 z-10"
        style={{ color: 'var(--ink-soft)', background: 'var(--surface-2)' }}
      >
        {label}
      </td>
      <td colSpan={span} style={{ background: 'var(--surface-2)' }} />
    </tr>
  )
}

/** Baris data pendalaman — skeleton per kolom selama detail ticker dimuat. */
function DeepRow({
  label,
  cells,
  bold,
}: {
  label: string
  bold?: boolean
  cells: Array<{ ticker: string; loading: boolean; node: React.ReactNode }>
}) {
  return (
    <tr className="hidden md:table-row border-t" style={{ borderColor: 'var(--border-soft)' }}>
      <td
        className="px-3 py-2 text-xs sticky left-0 bg-[var(--surface)] z-10"
        style={{ color: 'var(--ink-muted)', fontWeight: bold ? 600 : 500 }}
      >
        {label}
      </td>
      {cells.map((c) => (
        <td
          key={c.ticker}
          className="px-3 py-2 text-sm"
          style={{ color: 'var(--ink)', fontWeight: bold ? 600 : 400 }}
        >
          {c.loading ? <CellSkeleton /> : c.node}
        </td>
      ))}
    </tr>
  )
}

/** Shimmer placeholder saat detail per-ticker masih loading. */
function CellSkeleton() {
  return <div className="h-3 w-16 rounded animate-pulse" style={{ background: 'var(--surface-2)' }} />
}

function Dash() {
  return <span style={{ color: 'var(--ink-soft)' }}>—</span>
}

/** Nilai wajar satu metode + selisih % vs harga (mint = undervalued, coral = overvalued). */
function MethodCell({ m }: { m: MethodDetail | undefined }) {
  if (!m || m.fairValue == null || isNaN(m.fairValue)) return <Dash />
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="num tabular">{formatPrice(m.fairValue)}</span>
      {m.mos != null && !isNaN(m.mos) && (
        <span
          className="num tabular text-[11px]"
          style={{ color: m.mos >= 0 ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}
        >
          {m.mos >= 0 ? '+' : ''}
          {formatPercentValue(m.mos)}
        </span>
      )}
    </div>
  )
}

/** Skor Piotroski x/9 + bar mini 9 segmen (biru = poin lolos). */
function PiotroskiCell({ p }: { p: DeepData['piotroski'] }) {
  if (!p) return <Dash />
  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span className="num tabular font-semibold">{p.score}/9</span>
        <span className="text-[10px]" style={{ color: 'var(--ink-muted)' }}>{p.verdict}</span>
      </div>
      <div className="mt-1 flex gap-0.5" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <span
            key={i}
            className="h-1 w-3 rounded-full transition-colors duration-150"
            style={{ background: i < p.score ? 'var(--c-blue)' : 'var(--surface-2)' }}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Sparkline mini SVG (polyline + dot endpoint) — util lokal, tanpa recharts.
 * Skala min-max per emiten: fokus ke BENTUK tren; magnitude dibaca dari angka
 * compact di sebelah kanan (nilai tahun terakhir).
 */
function Sparkline({ points, label }: { points: SeriPoint[]; label: string }) {
  const W = 120
  const H = 36
  const PAD = 3
  if (points.length < 2) return <Dash />
  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2)
  const y = (v: number) =>
    max === min ? H / 2 : PAD + (1 - (v - min) / (max - min)) * (H - PAD * 2)
  const path = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const last = points[points.length - 1]
  return (
    <div className="flex items-center gap-2">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="shrink-0"
        role="img"
        aria-label={`${label} ${points[0].year}–${last.year}`}
      >
        <polyline
          points={path}
          fill="none"
          stroke="var(--c-blue)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={x(points.length - 1)} cy={y(last.value)} r="2" fill="var(--c-blue)" />
      </svg>
      <span className="num tabular text-[10px] whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>
        {formatIDRCompact(last.value)}
      </span>
    </div>
  )
}

function PickerDialog({
  open,
  onClose,
  rows,
  selected,
  onPick,
}: {
  open: boolean
  onClose: () => void
  rows: ResearchRow[]
  selected: Set<string>
  onPick: (ticker: string) => void
}) {
  const t = useT()
  const [query, setQuery] = useState('')

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = rows.filter((r) => !selected.has(r.ticker))
    if (!q) return filtered.slice(0, 30)
    return filtered
      .filter(
        (r) =>
          r.ticker.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q),
      )
      .slice(0, 30)
  }, [rows, selected, query])

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setQuery('')
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-2">
          <DialogTitle>{t('stock_compare.picker_title')}</DialogTitle>
          <DialogDescription>
            {t('stock_compare.picker_desc')}
          </DialogDescription>
        </DialogHeader>
        <div className="px-5 pb-2">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4"
              style={{ color: 'var(--ink-soft)' }}
            />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('stock_compare.search_placeholder')}
              className="pl-9"
            />
          </div>
        </div>
        <div className="max-h-[50vh] overflow-y-auto px-2 pb-3">
          {matches.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
              {t('stock_compare.no_results')}
            </p>
          ) : (
            <ul>
              {matches.map((r) => (
                <li key={r.ticker}>
                  <button
                    type="button"
                    onClick={() => onPick(r.ticker)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-[var(--surface-2)]"
                  >
                    <span className="font-mono font-semibold text-sm shrink-0" style={{ color: 'var(--ink)' }}>
                      {r.ticker}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs truncate" style={{ color: 'var(--ink-muted)' }}>
                        {r.name}
                      </span>
                      {r.sector && (
                        <span className="block text-[10px] truncate" style={{ color: 'var(--ink-soft)' }}>
                          {r.sector}
                        </span>
                      )}
                    </span>
                    <Plus className="size-4 shrink-0" style={{ color: 'var(--c-mint-ink)' }} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
