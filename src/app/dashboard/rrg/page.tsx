'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, RefreshCw, Info } from 'lucide-react'
import { computeRRG, type Bar, type RRGSeries } from '@/lib/rrg'
import { RRGChart } from '@/components/rrg/rrg-chart'

interface HistoryResponse {
  series: Array<{ ticker: string; bars: Bar[] }>
  weeks: number
  failures?: Array<{ ticker: string; reason: string }>
}

const BENCHMARK_PRESETS = [
  { value: '^JKSE', label: 'IHSG (^JKSE)', desc: 'Saham Indonesia' },
  { value: '^GSPC', label: 'S&P 500 (^GSPC)', desc: 'Saham US' },
  { value: '^IXIC', label: 'NASDAQ Composite (^IXIC)', desc: 'Saham US tech-heavy' },
  { value: 'BTC-USD', label: 'Bitcoin (BTC-USD)', desc: 'Crypto' },
]

const TAIL_OPTIONS = [4, 6, 8, 10, 12]

type UniverseMode = 'holdings' | 'manual'

export default function RRGPage() {
  const supabase = createClient()
  const [mode, setMode] = useState<UniverseMode>('holdings')
  const [holdings, setHoldings] = useState<string[]>([])
  const [manualInput, setManualInput] = useState('BBCA.JK,BBRI.JK,BMRI.JK,TLKM.JK,ASII.JK,UNVR.JK')
  const [benchmark, setBenchmark] = useState('^JKSE')
  const [tailLength, setTailLength] = useState(8)
  const [ratioWindow, setRatioWindow] = useState(14)
  const [loadingHoldings, setLoadingHoldings] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [failures, setFailures] = useState<Array<{ ticker: string; reason: string }>>([])
  const [series, setSeries] = useState<RRGSeries[]>([])

  // Load user's stock tickers once.
  useEffect(() => {
    void (async () => {
      setLoadingHoldings(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoadingHoldings(false); return }
      const [stR, invR] = await Promise.all([
        supabase
          .from('stock_transactions')
          .select('ticker')
          .eq('user_id', user.id)
          .not('ticker', 'is', null),
        supabase
          .from('investments')
          .select('ticker, category')
          .eq('user_id', user.id)
          .not('ticker', 'is', null),
      ])
      const set = new Set<string>()
      for (const r of (stR.data ?? []) as { ticker: string | null }[]) {
        if (r.ticker) set.add(r.ticker.trim().toUpperCase())
      }
      for (const r of (invR.data ?? []) as { ticker: string | null }[]) {
        if (r.ticker) set.add(r.ticker.trim().toUpperCase())
      }
      setHoldings(Array.from(set).sort())
      setLoadingHoldings(false)
    })()
  }, [supabase])

  const universe = useMemo<string[]>(() => {
    if (mode === 'holdings') return holdings
    return manualInput
      .split(/[,\s]+/)
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean)
  }, [mode, holdings, manualInput])

  const canRun = universe.length > 0 && !!benchmark

  const run = useCallback(async () => {
    if (!canRun) return
    setLoading(true)
    setError(null)
    setFailures([])
    try {
      const tickers = Array.from(new Set([...universe, benchmark])).join(',')
      const res = await fetch(`/api/history?tickers=${encodeURIComponent(tickers)}&weeks=80`)
      if (!res.ok) throw new Error(`API ${res.status}`)
      const json = (await res.json()) as HistoryResponse
      setFailures(json.failures ?? [])

      const byTicker = new Map<string, Bar[]>()
      for (const s of json.series) byTicker.set(s.ticker, s.bars)
      const bench = byTicker.get(benchmark)
      if (!bench || bench.length === 0) {
        const benchFail = json.failures?.find((f) => f.ticker === benchmark)
        const why = benchFail ? ` — ${benchFail.reason}` : ''
        throw new Error(`Benchmark ${benchmark} tidak ditemukan / kosong${why}`)
      }

      const computed: RRGSeries[] = []
      for (const t of universe) {
        if (t === benchmark) continue
        const bars = byTicker.get(t)
        if (!bars || bars.length === 0) continue
        const points = computeRRG(bars, bench, {
          ratioWindow,
          momentumWindow: ratioWindow,
        })
        if (points.length > 0) {
          computed.push({ ticker: t, points })
        }
      }
      setSeries(computed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data')
      setSeries([])
    } finally {
      setLoading(false)
    }
  }, [canRun, universe, benchmark, ratioWindow])

  // Auto-run once holdings are loaded.
  useEffect(() => {
    if (!loadingHoldings && mode === 'holdings' && holdings.length > 0 && series.length === 0 && !loading) {
      void run()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingHoldings, holdings])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="dark-card p-6 sm:p-7">
        <p className="caps">Relative Rotation Graph</p>
        <p className="text-lg sm:text-xl font-semibold mt-2" style={{ color: 'var(--ink)' }}>
          Rotasi kekuatan relatif terhadap benchmark
        </p>
        <p className="text-sm mt-2 max-w-2xl" style={{ color: 'var(--on-black-mut)' }}>
          Bandingkan beberapa saham (atau aset) terhadap satu benchmark dalam 4 kuadran:
          <span className="font-semibold"> Leading, Weakening, Lagging, Improving</span>.
          Arah rotasi normal searah jarum jam.
        </p>
      </div>

      {/* Controls */}
      <div className="s-card p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label>Universe</Label>
            <Select value={mode} onValueChange={(v) => v && setMode(v as UniverseMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="holdings">Dari holdings saya</SelectItem>
                <SelectItem value="manual">Input manual</SelectItem>
              </SelectContent>
            </Select>
            {mode === 'holdings' && (
              <p className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                {loadingHoldings ? 'Memuat…' : `${holdings.length} ticker dari Stock Log & Investasi`}
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>Benchmark</Label>
            <Select value={benchmark} onValueChange={(v) => v && setBenchmark(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BENCHMARK_PRESETS.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={benchmark}
              onChange={(e) => setBenchmark(e.target.value.trim().toUpperCase())}
              placeholder="Atau ketik manual (mis. ^JKSE)"
              className="text-xs"
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Tail Length</Label>
            <Select value={String(tailLength)} onValueChange={(v) => v && setTailLength(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TAIL_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} minggu</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Lookback Window</Label>
            <Select value={String(ratioWindow)} onValueChange={(v) => v && setRatioWindow(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 14, 20, 26, 52].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} minggu</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {mode === 'manual' && (
          <div className="mt-4 grid gap-1.5">
            <Label>Daftar Ticker (dipisah koma/spasi)</Label>
            <Input
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="BBCA.JK, BBRI.JK, BMRI.JK"
            />
            <p className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
              Format Yahoo: saham ID pakai suffix <span className="num">.JK</span>, US tanpa suffix, crypto pakai <span className="num">-USD</span>.
            </p>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <Button onClick={run} disabled={loading || !canRun}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {loading ? 'Memuat…' : 'Hitung RRG'}
          </Button>
          <p className="text-[11px] flex items-center gap-1" style={{ color: 'var(--ink-muted)' }}>
            <Info className="h-3 w-3" />
            Data: Yahoo Finance, weekly close. Cache 12 jam.
          </p>
        </div>
      </div>

      {error && (
        <div
          className="s-card p-4 text-sm"
          style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}
        >
          {error}
        </div>
      )}

      {failures.length > 0 && (
        <div
          className="s-card p-4 text-xs"
          style={{ background: 'var(--surface-2)' }}
        >
          <p className="caps mb-2">Ticker yang gagal diambil</p>
          <ul className="space-y-1 num">
            {failures.map((f) => (
              <li key={f.ticker} style={{ color: 'var(--ink-muted)' }}>
                <span className="font-semibold" style={{ color: 'var(--ink)' }}>{f.ticker}</span>
                {' — '}{f.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Chart */}
      {loading ? (
        <div className="s-card p-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          <p className="text-sm mt-2" style={{ color: 'var(--ink-muted)' }}>
            Mengambil data historis dari Yahoo Finance…
          </p>
        </div>
      ) : series.length === 0 ? (
        <div className="s-card p-12 text-center">
          <p className="font-semibold">Belum ada data RRG</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>
            {mode === 'holdings' && holdings.length === 0
              ? 'Tambahkan ticker di Stock Log atau Investasi dulu.'
              : 'Klik "Hitung RRG" untuk memulai.'}
          </p>
        </div>
      ) : (
        <>
          <RRGChart series={series} tailLength={tailLength} />

          {/* Quadrant legend */}
          <div className="s-card p-4">
            <p className="caps mb-3">Arti Kuadran</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <QLegend color="#86EFAC" name="Leading" desc="Kuat & momentum positif — outperform benchmark" />
              <QLegend color="#FDE68A" name="Weakening" desc="Masih kuat tapi momentum melemah" />
              <QLegend color="#FDA4AF" name="Lagging" desc="Lemah & momentum negatif — underperform" />
              <QLegend color="#BFDBFE" name="Improving" desc="Masih lemah tapi mulai membaik" />
            </div>
            <p className="text-[11px] mt-3" style={{ color: 'var(--ink-muted)' }}>
              Rotasi normal (searah jarum jam): Improving → Leading → Weakening → Lagging → Improving.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

function QLegend({ color, name, desc }: { color: string; name: string; desc: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="inline-block h-3 w-3 rounded-sm mt-0.5" style={{ background: color }} />
      <div>
        <p className="font-semibold" style={{ color: 'var(--ink)' }}>{name}</p>
        <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>{desc}</p>
      </div>
    </div>
  )
}
