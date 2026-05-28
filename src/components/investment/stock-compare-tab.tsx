'use client'

/**
 * Compare tab — side-by-side comparison untuk 2-4 saham IDX.
 * Tabular metrics: harga, fair value, MoS, verdict, sektor.
 *
 * Source: /api/idx-research (slim list), kalau user butuh detail
 * dia bisa klik ke /research/[ticker] dari sini.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, X, Search, Loader2, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
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
  avgFairValue: number | null
  medianFairValue: number | null
}

const MAX_COMPARE = 4

export function StockCompareTab() {
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
        Memuat data…
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          Bandingin sampai {MAX_COMPARE} saham IDX — metrics: harga, fair value, MoS, sektor, verdict.
        </p>
        <Button
          onClick={() => setPickerOpen(true)}
          disabled={selected.length >= MAX_COMPARE}
          style={{ background: 'var(--c-mint)', color: '#FFFFFF' }}
          size="sm"
        >
          <Plus className="size-3.5" /> Tambah saham
        </Button>
      </div>

      {selected.length === 0 ? (
        <div
          className="rounded-2xl border p-10 text-center"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            Pilih saham buat dibandingin.
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--ink-muted)' }}>
            Mulai dengan tap &ldquo;Tambah saham&rdquo; di atas.
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
                  <th className="px-3 py-3 sticky left-0 bg-[var(--surface)] z-10">Metrik</th>
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
                  label="Sektor"
                  values={selected.map((s) => ({ ticker: s.ticker, raw: s.sector ?? '—' }))}
                />
                <CompareRow
                  label="Harga"
                  values={selected.map((s) => ({
                    ticker: s.ticker,
                    raw: formatPrice(s.price),
                    isWinner: winners.price === s.ticker,
                  }))}
                />
                <CompareRow
                  label="Fair Value (median)"
                  values={selected.map((s) => ({
                    ticker: s.ticker,
                    raw: formatIDRCompact(s.medianFairValue ?? s.avgFairValue),
                  }))}
                />
                <CompareRow
                  label="MoS"
                  values={selected.map((s) => ({
                    ticker: s.ticker,
                    raw: formatPercentValue(s.avgMoS),
                    color: signColorVar(s.avgMoS),
                    isWinner: winners.mos === s.ticker,
                  }))}
                />
                <CompareRow
                  label="Verdict"
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
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected.length >= 2 && (
        <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
          🟢 = unggul untuk metrik tersebut. Harga termurah & MoS terbesar dihighlight emerald.
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
          {v.isWinner && ' 🟢'}
        </td>
      ))}
    </tr>
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
          <DialogTitle>Tambah saham buat dibandingin</DialogTitle>
          <DialogDescription>
            Cuma emiten yang punya data valuasi di sini.
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
              placeholder="BBCA / Bank Central Asia"
              className="pl-9"
            />
          </div>
        </div>
        <div className="max-h-[50vh] overflow-y-auto px-2 pb-3">
          {matches.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
              Gak ada hasil.
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
                    <Plus className="size-4 shrink-0" style={{ color: 'var(--c-mint)' }} />
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
