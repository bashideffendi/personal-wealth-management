'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import { useT } from '@/lib/i18n/context'

// Range buttons, in display order. Yahoo-form ticker handled server-side.
const RANGES = ['1D', '1W', '1M', '3M', 'YTD', '1Y', '3Y', '5Y'] as const
type RangeKey = (typeof RANGES)[number]

interface ChartPoint {
  t: number // unix seconds
  c: number // close
}
interface ChartMeta {
  currency: string | null
  previousClose: number | null
  regularMarketPrice: number | null
}
interface ChartPayload {
  points: ChartPoint[]
  meta: ChartMeta | null
}

interface StockPriceChartProps {
  /** Yahoo-form ticker (e.g. BBCA.JK / AAPL) for stocks, or coin symbol (BTC / BTC-USD) for crypto. */
  ticker: string
  fallbackPrice?: number | null
  fallbackCurrency?: string
  /** Data source: 'stock' = Yahoo via /api/stock-chart, 'crypto' = Binance via /api/crypto-chart. */
  chartApi?: 'stock' | 'crypto'
  /** Override the footer attribution text. */
  sourceLabel?: string
}

const ID_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

// Price formatter — no decimals for IDR (rupiah is whole-number), up to 2 for
// USD. Keeps tabular alignment with the rest of the app.
function fmtPrice(value: number, currency: 'IDR' | 'USD'): string {
  const digits = currency === 'USD' ? 2 : 0
  return value.toLocaleString('id-ID', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function StockPriceChart({ ticker, fallbackPrice, fallbackCurrency, chartApi = 'stock', sourceLabel }: StockPriceChartProps) {
  const t = useT()
  const [range, setRange] = useState<RangeKey>('1D')
  const [points, setPoints] = useState<ChartPoint[]>([])
  const [meta, setMeta] = useState<ChartMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Per-range cache so re-selecting a tab doesn't refetch. Keyed by range;
  // resets whenever the ticker changes.
  const cacheRef = useRef<Map<RangeKey, ChartPayload>>(new Map())
  const gradientId = useId()

  useEffect(() => {
    cacheRef.current.clear()
  }, [ticker])

  useEffect(() => {
    const cached = cacheRef.current.get(range)
    if (cached) {
      setPoints(cached.points)
      setMeta(cached.meta)
      setLoading(false)
      setError(false)
      return
    }

    const ctrl = new AbortController()
    setLoading(true)
    setError(false)
    fetch(
      chartApi === 'crypto'
        ? `/api/crypto-chart?symbol=${encodeURIComponent(ticker)}&range=${range}`
        : `/api/stock-chart?ticker=${encodeURIComponent(ticker)}&range=${range}`,
      { signal: ctrl.signal },
    )
      .then((r) => (r.ok ? r.json() : { points: [], meta: null }))
      .then((d: ChartPayload) => {
        const payload: ChartPayload = { points: d.points ?? [], meta: d.meta ?? null }
        cacheRef.current.set(range, payload)
        setPoints(payload.points)
        setMeta(payload.meta)
        setLoading(false)
      })
      .catch((e) => {
        // AbortError fires on rapid range switches — not a real error.
        if (e?.name === 'AbortError') return
        setError(true)
        setLoading(false)
      })
    return () => ctrl.abort()
  }, [ticker, range, chartApi])

  const currency: 'IDR' | 'USD' = useMemo(() => {
    const c = (meta?.currency ?? fallbackCurrency ?? '').toUpperCase()
    return c === 'USD' ? 'USD' : 'IDR'
  }, [meta?.currency, fallbackCurrency])
  const sym = currency === 'USD' ? '$' : 'Rp'

  // Last non-null close → fall back to meta.regularMarketPrice → fallbackPrice.
  const lastPrice = useMemo(() => {
    if (points.length > 0) return points[points.length - 1].c
    return meta?.regularMarketPrice ?? fallbackPrice ?? null
  }, [points, meta?.regularMarketPrice, fallbackPrice])

  // Baseline for change + up/down direction. 1D compares against previousClose
  // (the daily reference); other ranges compare against the first point.
  const baseline = useMemo(() => {
    if (range === '1D') return meta?.previousClose ?? (points[0]?.c ?? null)
    return points[0]?.c ?? null
  }, [range, meta?.previousClose, points])

  const change = useMemo(() => {
    if (lastPrice == null || baseline == null || baseline === 0) return null
    const abs = lastPrice - baseline
    const pct = (abs / baseline) * 100
    return { abs, pct, up: abs >= 0 }
  }, [lastPrice, baseline])

  const up = change ? change.up : true
  const lineColor = up ? 'var(--c-mint)' : 'var(--c-coral)'
  const lineHex = up ? '#10B981' : '#F43F5E'

  // recharts data — keep raw `t` for the axis/tooltip formatters.
  const data = useMemo(() => points.map((p) => ({ t: p.t, c: p.c })), [points])

  function fmtAxis(t: number): string {
    const d = new Date(t * 1000)
    if (range === '1D') {
      // Intraday — show WIB clock so it matches the IDX trading session.
      return d.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
        hour12: false,
      })
    }
    if (range === '5Y' || range === '3Y' || range === '1Y') {
      // Long ranges — "MMM 'YY" keeps ticks compact.
      return `${ID_MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`
    }
    return `${d.getDate()} ${ID_MONTHS[d.getMonth()]}`
  }

  function fmtTooltipTime(t: number): string {
    const d = new Date(t * 1000)
    if (range === '1D') {
      return d.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
        hour12: false,
      }) + ' WIB'
    }
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const hasData = data.length >= 2

  return (
    <div className="p-5 sm:p-6">
      {/* Header — last price + change (left), range tabs (right) */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{t('price_chart.price')}</p>
          <p
            className="num tabular text-3xl font-semibold leading-none mt-1.5"
            style={{ color: 'var(--ink)' }}
          >
            {lastPrice != null ? `${sym} ${fmtPrice(lastPrice, currency)}` : '—'}
          </p>
          {change && (
            <p
              className="num tabular text-sm font-semibold mt-2"
              style={{ color: change.up ? 'var(--c-mint)' : 'var(--c-coral)' }}
            >
              {change.up ? '▲' : '▼'} {change.up ? '+' : '−'}
              {fmtPrice(Math.abs(change.abs), currency)} ({change.up ? '+' : '−'}
              {Math.abs(change.pct).toFixed(2)}%)
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-0.5 shrink-0">
          {RANGES.map((r) => {
            const active = range === r
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className="px-2.5 py-1 rounded-md text-[12px] font-semibold transition"
                style={
                  active
                    ? { background: 'var(--c-primary)', color: 'var(--on-black)' }
                    : { background: 'transparent', color: 'var(--ink-soft)' }
                }
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.color = 'var(--ink)'
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.color = 'var(--ink-soft)'
                }}
              >
                {r}
              </button>
            )
          })}
        </div>
      </div>

      {/* Chart */}
      <div className="mt-4" style={{ height: 300 }}>
        {loading ? (
          <div
            className="h-full rounded-xl flex items-center justify-center"
            style={{ background: 'var(--surface-2)' }}
          >
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
              {t('price_chart.loading')}
            </p>
          </div>
        ) : error || !hasData ? (
          <div
            className="h-full rounded-xl flex items-center justify-center text-center px-6"
            style={{ background: 'var(--surface-2)' }}
          >
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
              {t('price_chart.no_data')}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineHex} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={lineHex} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="t"
                tickFormatter={fmtAxis}
                axisLine={false}
                tickLine={false}
                minTickGap={48}
                tick={{ fontSize: 11, fill: 'var(--ink-soft)' }}
              />
              <YAxis
                orientation="right"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(v: number) => fmtPrice(v, currency)}
                axisLine={false}
                tickLine={false}
                width={56}
                tick={{ fontSize: 11, fill: 'var(--ink-soft)' }}
              />
              <Tooltip
                cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0].payload as ChartPoint
                  return (
                    <div
                      className="rounded-lg px-2.5 py-1.5 shadow"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)' }}
                    >
                      <p className="num tabular text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                        {sym} {fmtPrice(p.c, currency)}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                        {fmtTooltipTime(p.t)}
                      </p>
                    </div>
                  )
                }}
              />
              <Area
                type="monotone"
                dataKey="c"
                stroke={lineColor}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className="text-[11px] mt-3" style={{ color: 'var(--ink-soft)' }}>
        {sourceLabel ?? (chartApi === 'crypto' ? t('price_chart.source_crypto') : t('price_chart.source_stock'))}
      </p>
    </div>
  )
}
