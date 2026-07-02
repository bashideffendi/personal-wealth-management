'use client'

/**
 * PortfolioHero — total value + equity curve (demoted until history exists)
 * + sub-stats. Extracted from the investment hub monolith; chart-range state
 * lives HERE so toggling a range never re-renders the rest of the page.
 */

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { formatCompactCurrency, formatCurrency } from '@/lib/utils'
import { useT } from '@/lib/i18n/context'

const EquityArea = dynamic(() => import('./investment-charts').then((m) => m.EquityArea), { ssr: false, loading: () => <div className="h-full animate-pulse rounded-lg" style={{ background: 'var(--surface-2)' }} aria-hidden="true" /> })

const CHART_RANGES = [
  { key: '1B', label: '1B', days: 30 },
  { key: '3B', label: '3B', days: 90 },
  { key: '1T', label: '1T', days: 365 },
  { key: 'all', label: 'Sejak', days: Infinity },
] as const
type ChartRangeKey = (typeof CHART_RANGES)[number]['key']

export interface PortfolioHeroProps {
  totals: { invested: number; market: number; pl: number; plPct: number }
  todayPL: number | null
  dividenYtd: number
  institutionCount: number
  snapshots: { snapshot_date: string; market_value: number }[]
}

export function PortfolioHero({ totals, todayPL, dividenYtd, institutionCount, snapshots }: PortfolioHeroProps) {
  const t = useT()
  const [chartRange, setChartRange] = useState<ChartRangeKey>('all')
  const up = totals.pl >= 0

  // Equity curve: stored daily snapshots + always-included live "today" point.
  // 'sv' locale = YYYY-MM-DD in LOCAL time (UTC overwrote yesterday's point
  // for 00:00–07:00 WIB visits back when the client recorded snapshots).
  const chartData = useMemo(() => {
    const today = new Date().toLocaleDateString('sv')
    const map = new Map<string, number>()
    for (const s of snapshots) map.set(s.snapshot_date, Number(s.market_value) || 0)
    map.set(today, totals.market)
    const range = CHART_RANGES.find((r) => r.key === chartRange) ?? CHART_RANGES[3]
    let pts = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    if (range.days !== Infinity) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - range.days)
      const cutStr = cutoff.toISOString().slice(0, 10)
      pts = pts.filter(([d]) => d >= cutStr)
    }
    return pts.map(([date, value]) => ({
      label: new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      value,
    }))
  }, [snapshots, totals.market, chartRange])

  // Equity curve only earns its slot once there's real history to draw.
  const hasHistory = snapshots.length >= 8

  return (
    <section className="s-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">
            {t('investment.total_value')}
            {institutionCount > 0 ? ` · ${institutionCount} ${t('investment.institutions')}` : ''}
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <p
              className="num tabular font-bold leading-none whitespace-nowrap"
              style={{ color: 'var(--ink)', fontSize: 'clamp(26px, 5vw, 34px)', letterSpacing: '-0.035em' }}
              title={formatCurrency(totals.market)}
            >
              {formatCompactCurrency(totals.market)}
            </p>
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold mb-1"
              data-loss={up ? undefined : 'true'}
              style={{
                background: up ? 'var(--c-mint-soft)' : 'var(--c-coral-soft)',
                color: up ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {up ? '+' : ''}{totals.plPct.toFixed(2)}%
            </span>
          </div>
          <p className="text-sm mt-2" style={{ color: 'var(--ink-muted)' }}>
            {up ? t('investment.total_gain') : t('investment.total_loss')}{' '}
            <span className="num tabular font-semibold" data-loss={up ? undefined : 'true'} style={{ color: up ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}>
              {up ? '+' : ''}{formatCurrency(totals.pl)}
            </span>{' '}
            {t('investment.since_inception')}
          </p>
        </div>
        {hasHistory && (
          <div className="flex gap-0.5 shrink-0 rounded-lg p-0.5" style={{ background: 'var(--surface-2)' }}>
            {CHART_RANGES.map((r) => {
              const active = chartRange === r.key
              return (
                <button
                  key={r.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setChartRange(r.key)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition"
                  style={active ? { background: 'var(--surface)', color: 'var(--ink)', boxShadow: 'var(--card-shadow)' } : { color: 'var(--ink-soft)' }}
                >
                  {r.key === 'all' ? t('investment.range_all') : r.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Equity curve — demoted until ≥8 stored snapshots exist (a 2-point
          "curve" reads worse than no curve). Until then the slot earns its
          keep with Modal vs Nilai Sekarang, computable from day one.
          data-loss saat turun: Calm Mode ikut menyamarkan kurva merah. */}
      <div className="mt-4" data-loss={up ? undefined : 'true'} style={{ height: 150 }}>
        {!hasHistory ? (
          <div className="h-full rounded-xl px-5 flex flex-col justify-center gap-3" style={{ background: 'var(--surface-2)' }}>
            {(() => {
              const maxV = Math.max(totals.invested, totals.market, 1)
              return (
                <>
                  <div className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-[10px] uppercase tracking-wide truncate" style={{ color: 'var(--ink-soft)' }}>
                      {t('investment.stat_invested')}
                    </span>
                    <div className="flex-1 h-6 rounded-md overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                      <div className="h-full rounded-md" style={{ width: `${(totals.invested / maxV) * 100}%`, background: 'var(--border)' }} />
                    </div>
                    <span className="num tabular text-xs font-semibold w-32 text-right shrink-0" style={{ color: 'var(--ink-muted)' }}>
                      {formatCurrency(totals.invested)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-[10px] uppercase tracking-wide truncate" style={{ color: 'var(--ink-soft)' }}>
                      {t('investment.chart_interim_now')}
                    </span>
                    <div className="flex-1 h-6 rounded-md overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                      <div className="h-full rounded-md" data-loss={up ? undefined : 'true'} style={{ width: `${(totals.market / maxV) * 100}%`, background: up ? 'var(--c-mint)' : 'var(--c-coral)' }} />
                    </div>
                    <span className="num tabular text-xs font-semibold w-32 text-right shrink-0" data-loss={up ? undefined : 'true'} style={{ color: up ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}>
                      {formatCurrency(totals.market)}
                    </span>
                  </div>
                  <p className="text-[11px] text-center" style={{ color: 'var(--ink-soft)' }}>
                    {t('investment.chart_collecting_desc')}
                  </p>
                </>
              )
            })()}
          </div>
        ) : chartData.length < 2 ? (
          <div className="h-full rounded-xl flex items-center justify-center" style={{ background: 'var(--surface-2)' }}>
            <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>{t('investment.chart_range_empty')}</p>
          </div>
        ) : (
          <EquityArea data={chartData} up={up} />
        )}
      </div>

      {/* Sub-stats — modal & P/L primary, dividen supporting */}
      <div
        className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-px rounded-xl overflow-hidden border"
        style={{ background: 'var(--border-soft)', borderColor: 'var(--border-soft)' }}
      >
        <HeroStat label={t('investment.stat_invested')} value={formatCurrency(totals.invested)} />
        <HeroStat
          label={t('investment.stat_pl')}
          value={`${up ? '+' : ''}${formatCurrency(totals.pl)}`}
          accent={up ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)'}
          loss={!up}
        />
        <HeroStat
          label={t('investment.stat_today')}
          value={todayPL == null ? '—' : `${todayPL >= 0 ? '+' : '−'}${formatCurrency(Math.abs(todayPL))}`}
          accent={todayPL == null ? 'var(--ink-soft)' : todayPL >= 0 ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)'}
          loss={todayPL != null && todayPL < 0}
        />
        <HeroStat label={t('investment.stat_dividend_ytd')} value={formatCurrency(dividenYtd)} />
      </div>
    </section>
  )
}

function HeroStat({ label, value, accent, loss }: { label: string; value: string; accent?: string; loss?: boolean }) {
  return (
    <div className="p-3.5" style={{ background: 'var(--surface)' }}>
      <p className="eyebrow">{label}</p>
      <p className="num tabular text-lg font-bold mt-1" data-loss={loss ? 'true' : undefined} style={{ color: accent ?? 'var(--ink)' }}>
        {value}
      </p>
    </div>
  )
}
