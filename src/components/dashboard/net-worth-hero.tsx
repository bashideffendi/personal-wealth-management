'use client'

/**
 * Net Worth Hero — fintech dark gradient anchor (Mercury/Wise-style).
 *
 * Dark hero block = visual anchor "lihat ini dulu" untuk dashboard.
 * Layout:
 *   LEFT  → greeting + net worth display (mono big) + ± delta chip + forecast
 *   RIGHT → period chips + area sparkline + asset/debt mini split
 *
 * Per redesign 2026-05-28 — drop editorial italic, restore fintech vibe.
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUp, ArrowDown, ArrowUpRight } from 'lucide-react'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'

interface MonthlyData {
  month: string
  income: number
  expense: number
  net: number
}

interface NetWorthHeroProps {
  liquidTotal: number
  nonLiquidTotal: number
  investmentsTotal: number
  debtTotal: number
  monthlyTrend?: MonthlyData[]
}

const PERIODS = ['1B', '3B', '6B', '1T', 'ALL'] as const
type Period = (typeof PERIODS)[number]
const PERIOD_TO_MONTHS: Record<Period, number> = {
  '1B': 1, '3B': 3, '6B': 6, '1T': 12, ALL: 24,
}

export function NetWorthHero({
  liquidTotal,
  nonLiquidTotal,
  investmentsTotal,
  debtTotal,
  monthlyTrend = [],
}: NetWorthHeroProps) {
  const totalAssets = liquidTotal + nonLiquidTotal + investmentsTotal
  const netWorth = totalAssets - debtTotal

  const now = new Date()

  const [chartPeriod, setChartPeriod] = useState<Period>('1T')
  const filteredTrend = useMemo(() => {
    const months = PERIOD_TO_MONTHS[chartPeriod]
    if (months >= monthlyTrend.length) return monthlyTrend
    return monthlyTrend.slice(-months)
  }, [chartPeriod, monthlyTrend])

  // Synthesized cumulative growth from monthly cashflow
  const sparkline = useMemo(() => {
    if (filteredTrend.length === 0) return null
    const cumulative: number[] = []
    let running = netWorth
    for (let i = filteredTrend.length - 1; i >= 0; i--) {
      cumulative.unshift(running)
      running -= filteredTrend[i].net
    }
    const max = Math.max(...cumulative)
    const min = Math.min(...cumulative)
    const range = max - min || 1
    const W = 600
    const H = 140
    const points = cumulative.map((v, i) => {
      const x = (i / Math.max(1, cumulative.length - 1)) * W
      const y = H - ((v - min) / range) * (H - 24) - 12
      return { x, y, v }
    })
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    const areaPath = `${linePath} L${W},${H} L0,${H} Z`
    const startVal = cumulative[0]
    const endVal = cumulative[cumulative.length - 1]
    const change = endVal - startVal
    const changePct = startVal !== 0 ? (change / Math.abs(startVal)) * 100 : 0
    return { points, linePath, areaPath, W, H, change, changePct }
  }, [filteredTrend, netWorth])

  const monthDelta = monthlyTrend.length > 0 ? monthlyTrend[monthlyTrend.length - 1].net : 0

  // YTD %
  const ytdPct = (() => {
    if (monthlyTrend.length < 2) return 0
    const ytdMonths = Math.min(now.getMonth() + 1, monthlyTrend.length)
    const ytdSum = monthlyTrend.slice(-ytdMonths).reduce((s, m) => s + m.net, 0)
    const yearStart = netWorth - ytdSum
    if (yearStart === 0) return 0
    return (ytdSum / Math.abs(yearStart)) * 100
  })()

  // Forecast: when reach Rp 1B at current pace?
  const forecastMonths = (() => {
    if (monthlyTrend.length < 3) return null
    const recentAvg = monthlyTrend.slice(-3).reduce((s, m) => s + m.net, 0) / 3
    if (recentAvg <= 0) return null
    const target = 1_000_000_000
    if (netWorth >= target) return null
    const months = Math.ceil((target - netWorth) / recentAvg)
    if (months > 60 || months < 1) return null
    return months
  })()

  return (
    <section
      className="relative overflow-hidden rounded-3xl"
      style={{
        background: 'linear-gradient(135deg, #0A0A0F 0%, #14141A 50%, #1C1C24 100%)',
        color: '#F5F5F7',
        boxShadow: '0 24px 60px -20px rgba(0,0,0,0.40), 0 2px 4px rgba(0,0,0,0.06)',
      }}
    >
      {/* Emerald ambient glow top-right */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: -120,
          right: -80,
          width: 380,
          height: 380,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 255, 255, 0.05), transparent 65%)',
        }}
      />

      <div className="relative grid grid-cols-1 lg:grid-cols-[1.05fr_1.15fr] gap-6 lg:gap-8 p-5 sm:p-6 lg:p-7">
        {/* ───── LEFT: numeric block ───── */}
        <div className="min-w-0">
          {/* Label net worth (greeting "Hi, Nama" pindah ke atas hero) */}
          <p
            className="text-[11px] font-semibold tracking-[0.18em] uppercase"
            style={{ color: 'rgba(255,255,255,0.72)' }}
          >
            Kekayaan Bersih
          </p>

          {/* Hero net worth — MONO bold large */}
          <p
            className="num tabular font-bold leading-none mt-2 whitespace-nowrap"
            style={{
              fontSize: 'clamp(30px, 4.2vw, 42px)',
              letterSpacing: '-0.035em',
              color: '#FFFFFF',
            }}
          >
            {formatCurrency(netWorth)}
          </p>

          {/* Delta chips row */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {monthDelta !== 0 && (
              <span
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold"
                style={{
                  background: monthDelta > 0 ? 'rgba(16,185,129,0.18)' : 'rgba(251,113,133,0.18)',
                  color: monthDelta > 0 ? '#6EE7B7' : '#FDA4AF',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {monthDelta > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                {monthDelta > 0 ? '+' : '−'}
                {formatCompactCurrency(Math.abs(monthDelta))} bulan ini
              </span>
            )}
            {ytdPct !== 0 && (
              <span
                className="text-xs font-medium"
                style={{ color: 'rgba(255,255,255,0.72)' }}
              >
                YTD{' '}
                <strong
                  className="num tabular"
                  style={{ color: ytdPct >= 0 ? '#6EE7B7' : '#FDA4AF' }}
                >
                  {ytdPct >= 0 ? '+' : ''}
                  {ytdPct.toFixed(1)}%
                </strong>
              </span>
            )}
          </div>

          {/* Forecast hint */}
          {forecastMonths && (
            <p
              className="text-[13px] mt-5 leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.72)' }}
            >
              Kalau ritme ini lanjut, kamu capai{' '}
              <span className="font-semibold" style={{ color: '#6EE7B7' }}>
                Rp 1 miliar
              </span>{' '}
              dalam {forecastMonths} bulan.
            </p>
          )}

          {/* Asset/Debt split */}
          <div
            className="mt-5 pt-4 grid grid-cols-2 gap-6"
            style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}
          >
            <div>
              <p
                className="text-[11px] font-bold tracking-[0.12em] uppercase"
                style={{ color: 'rgba(255,255,255,0.62)' }}
              >
                Total Aset
              </p>
              <p
                className="num tabular font-semibold mt-1.5 whitespace-nowrap"
                style={{ fontSize: 16, color: '#FFFFFF' }}
              >
                {formatCurrency(totalAssets)}
              </p>
            </div>
            <div>
              <p
                className="text-[11px] font-bold tracking-[0.12em] uppercase"
                style={{ color: 'rgba(255,255,255,0.62)' }}
              >
                Total Utang
              </p>
              <p
                className="num tabular font-semibold mt-1.5 whitespace-nowrap"
                style={{
                  fontSize: 16,
                  color: debtTotal > 0 ? '#FDA4AF' : '#FFFFFF',
                }}
              >
                {debtTotal > 0 ? `−${formatCurrency(debtTotal)}` : formatCurrency(0)}
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="flex gap-2 mt-5 flex-wrap">
            <Link
              href="/dashboard/net-worth"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition hover:opacity-90"
              style={{
                background: '#FFFFFF',
                color: '#0A0A0F',
              }}
            >
              Rincian kekayaan
              <ArrowUpRight className="size-3.5" />
            </Link>
            <Link
              href="/dashboard/transactions/import"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition hover:bg-white/10"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: '#F5F5F7',
                border: '1px solid rgba(255,255,255,0.10)',
              }}
            >
              Import mutasi
            </Link>
          </div>
        </div>

        {/* ───── RIGHT: chart block ───── */}
        <div className="min-w-0 flex flex-col">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p
                className="text-[11px] font-semibold tracking-[0.14em] uppercase"
                style={{ color: 'rgba(255,255,255,0.66)' }}
              >
                Pertumbuhan
              </p>
              {sparkline && (
                <p
                  className="num tabular font-semibold mt-1.5"
                  style={{
                    fontSize: 14,
                    color: sparkline.change >= 0 ? '#6EE7B7' : '#FDA4AF',
                  }}
                >
                  {sparkline.change >= 0 ? '+' : '−'}
                  {formatCompactCurrency(Math.abs(sparkline.change))}{' '}
                  <span style={{ color: 'rgba(255,255,255,0.72)', fontWeight: 500 }}>
                    ({sparkline.changePct >= 0 ? '+' : ''}
                    {sparkline.changePct.toFixed(1)}%)
                  </span>
                </p>
              )}
            </div>
            {/* Period chips */}
            <div
              className="flex gap-0.5 p-0.5 rounded-lg shrink-0"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              {PERIODS.map((p) => {
                const active = chartPeriod === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setChartPeriod(p)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors"
                    style={{
                      background: active ? 'rgba(255,255,255,0.14)' : 'transparent',
                      color: active ? '#FFFFFF' : 'rgba(255,255,255,0.72)',
                      cursor: 'pointer',
                      border: 0,
                    }}
                  >
                    {p}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Sparkline */}
          <div className="flex-1 min-h-[120px]">
            {sparkline ? (
              <svg
                viewBox={`0 0 ${sparkline.W} ${sparkline.H}`}
                preserveAspectRatio="none"
                className="w-full h-full"
                style={{ minHeight: 120 }}
              >
                <defs>
                  <linearGradient id="nwspark" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={sparkline.areaPath} fill="url(#nwspark)" />
                <path
                  d={sparkline.linePath}
                  fill="none"
                  stroke="#34D399"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {sparkline.points.length > 0 && (
                  <>
                    <circle
                      cx={sparkline.points[sparkline.points.length - 1].x}
                      cy={sparkline.points[sparkline.points.length - 1].y}
                      r="5"
                      fill="#34D399"
                    />
                    <circle
                      cx={sparkline.points[sparkline.points.length - 1].x}
                      cy={sparkline.points[sparkline.points.length - 1].y}
                      r="10"
                      fill="#34D399"
                      opacity="0.25"
                    />
                  </>
                )}
              </svg>
            ) : (
              <div
                className="h-full flex items-center justify-center text-sm"
                style={{ color: 'rgba(255,255,255,0.60)' }}
              >
                Catat transaksi untuk lihat trend
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
