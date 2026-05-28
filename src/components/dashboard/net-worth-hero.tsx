'use client'

/**
 * Net Worth Hero — editorial redesign (2026-05-28).
 *
 * Per design handoff Dashboard A. Drop dark-card hero, ganti ke
 * warm white kl-card dengan 2-col grid: numeric kiri (Instrument
 * Serif 64px hero number + mint delta chip + Total Aset/Utang split)
 * dan chart kanan (period chips + area chart).
 *
 * Net worth growth chart = synthesized dari monthly cashflow (proxy
 * sampai net_worth_snapshots table wired). 12 bulan default.
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUp, ArrowDown, ArrowUpRight, Send } from 'lucide-react'
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
  userName?: string
  monthlyTrend?: MonthlyData[]
}

const PERIODS = ['1B', '3B', '6B', '1T', 'Semua'] as const
type Period = (typeof PERIODS)[number]
const PERIOD_TO_MONTHS: Record<Period, number> = {
  '1B': 1, '3B': 3, '6B': 6, '1T': 12, Semua: 12,
}

export function NetWorthHero({
  liquidTotal,
  nonLiquidTotal,
  investmentsTotal,
  debtTotal,
  userName,
  monthlyTrend = [],
}: NetWorthHeroProps) {
  const totalAssets = liquidTotal + nonLiquidTotal + investmentsTotal
  const netWorth = totalAssets - debtTotal

  // Time-aware greeting — editorial tone tetap casual hangat.
  const now = new Date()
  const hour = now.getHours()
  const dateSeed = now.getDate() + now.getMonth() * 31
  const greetingMain = hour >= 4 && hour < 11 ? 'Pagi'
    : hour >= 11 && hour < 15 ? 'Siang'
    : hour >= 15 && hour < 18 ? 'Sore'
    : hour >= 18 && hour < 23 ? 'Malam'
    : 'Wah masih bangun?'
  const subOptions = (() => {
    if (hour >= 4 && hour < 11) return ['uangmu lagi sehat-sehat aja', 'siap nabung hari ini', 'udah sarapan? jangan lupa catat']
    if (hour >= 11 && hour < 15) return ['udah makan? jangan lupa catat', 'review pengeluaran sebentar yuk']
    if (hour >= 15 && hour < 18) return ['review pengeluaran hari ini yuk', 'udah hampir gajian, sabar']
    if (hour >= 18 && hour < 23) return ['santai dulu, uangmu udah dijaga', 'selamat istirahat']
    return ['jangan lupa tidur ya', 'begadang sambil cek finansial']
  })()
  const subGreeting = subOptions[dateSeed % subOptions.length]

  const [chartPeriod, setChartPeriod] = useState<Period>('1T')
  const filteredTrend = useMemo(() => {
    const months = PERIOD_TO_MONTHS[chartPeriod]
    if (months >= monthlyTrend.length) return monthlyTrend
    return monthlyTrend.slice(-months)
  }, [chartPeriod, monthlyTrend])

  // Synthesize cumulative growth from monthly cashflow.
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
    const W = 640
    const H = 220
    const points = cumulative.map((v, i) => {
      const x = (i / Math.max(1, cumulative.length - 1)) * W
      const y = H - ((v - min) / range) * (H - 32) - 16
      return { x, y, v }
    })
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
    const areaPath = `${linePath} L${W},${H} L0,${H} Z`
    const startVal = cumulative[0]
    const endVal = cumulative[cumulative.length - 1]
    const change = endVal - startVal
    const changePct = startVal !== 0 ? (change / Math.abs(startVal)) * 100 : 0
    return { points, linePath, areaPath, W, H, change, changePct }
  }, [filteredTrend, netWorth])

  // Bulan-ini delta (selalu pakai bulan terakhir di trend, terlepas dari period filter)
  const monthDelta = monthlyTrend.length > 0 ? monthlyTrend[monthlyTrend.length - 1].net : 0

  // YTD percent — compare net worth now vs net worth start of year
  const ytdPct = (() => {
    if (monthlyTrend.length < 2) return 0
    const ytdMonths = Math.min(now.getMonth() + 1, monthlyTrend.length)
    const ytdSum = monthlyTrend.slice(-ytdMonths).reduce((s, m) => s + m.net, 0)
    const yearStart = netWorth - ytdSum
    if (yearStart === 0) return 0
    return (ytdSum / Math.abs(yearStart)) * 100
  })()

  return (
    <div className="space-y-5">
      {/* ─── Greeting bar (editorial) ─── */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p
            style={{
              fontSize: 11,
              color: 'var(--text-mute)',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            {new Date().toLocaleDateString('id-ID', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
          <h1
            className="mt-1"
            style={{
              fontFamily: 'var(--font-sans)', fontWeight: 700,
              fontSize: 32,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              color: 'var(--ink)',
            }}
          >
            {greetingMain}{userName ? `, ${userName}` : ''}
            <span
              className="ml-1"
              style={{
                /* italic dropped per fintech revert */
                color: 'var(--text-mute)',
                fontSize: 22,
              }}
            >
              — {subGreeting}.
            </span>
          </h1>
        </div>
      </div>

      {/* ─── Net Worth hero card (2-col editorial) ─── */}
      <section
        className="kl-card overflow-hidden"
        style={{ padding: 0 }}
      >
        <div
          className="grid lg:grid-cols-[1fr_1.2fr]"
          style={{ minHeight: 320 }}
        >
          {/* ───── LEFT: Numeric block ───── */}
          <div
            className="px-7 py-8 sm:px-9 sm:py-10"
            style={{ borderRight: '1px solid var(--line)' }}
          >
            <p className="kl-eyebrow">Kekayaan Bersih</p>
            <p
              className="kl-display kl-num"
              style={{
                fontSize: 'clamp(40px, 6vw, 64px)',
                marginTop: 12,
                lineHeight: 1,
                color: 'var(--text)',
              }}
            >
              {formatCurrency(netWorth)}
            </p>

            <div className="flex items-center flex-wrap gap-3 mt-4">
              {monthDelta !== 0 && (
                <span
                  className="kl-chip kl-num"
                  style={{
                    background: monthDelta > 0 ? 'var(--c-mint-soft)' : 'var(--c-coral-soft)',
                    color: monthDelta > 0 ? 'var(--c-mint)' : 'var(--c-coral)',
                  }}
                >
                  {monthDelta > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                  {monthDelta > 0 ? '+' : '−'}{formatCompactCurrency(Math.abs(monthDelta))} bulan ini
                </span>
              )}
              {ytdPct !== 0 && (
                <span style={{ fontSize: 12, color: 'var(--text-mute)' }}>
                  YTD{' '}
                  <strong
                    className="kl-num"
                    style={{ color: ytdPct >= 0 ? 'var(--c-mint)' : 'var(--c-coral)' }}
                  >
                    {ytdPct >= 0 ? '+' : ''}{ytdPct.toFixed(1)}%
                  </strong>
                </span>
              )}
            </div>

            {/* Aset/Utang split */}
            <div
              className="grid grid-cols-2 gap-0 mt-7 pt-5"
              style={{ borderTop: '1px solid var(--line)' }}
            >
              <div>
                <p
                  style={{
                    fontSize: 11,
                    color: 'var(--text-mute)',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Total Aset
                </p>
                <p
                  className="kl-num mt-1.5"
                  style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}
                >
                  {formatCurrency(totalAssets)}
                </p>
              </div>
              <div>
                <p
                  style={{
                    fontSize: 11,
                    color: 'var(--text-mute)',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Total Utang
                </p>
                <p
                  className="kl-num mt-1.5"
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: debtTotal > 0 ? 'var(--c-coral)' : 'var(--ink)',
                  }}
                >
                  {debtTotal > 0 ? `−${formatCurrency(debtTotal)}` : formatCurrency(0)}
                </p>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex gap-2 mt-6 flex-wrap">
              <Link href="/dashboard/net-worth" className="kl-btn kl-btn-primary">
                <ArrowUpRight className="size-3.5" />
                Rincian kekayaan
              </Link>
              <Link href="/dashboard/transactions/import" className="kl-btn">
                <Send className="size-3.5" />
                Import mutasi
              </Link>
            </div>
          </div>

          {/* ───── RIGHT: Chart block ───── */}
          <div className="px-7 py-8 sm:px-9 sm:py-10 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="kl-eyebrow">12 Bulan Terakhir</p>
              <div
                className="flex gap-0.5 p-1 rounded-full"
                style={{ background: 'var(--surface-2)' }}
              >
                {PERIODS.map((p) => {
                  const active = chartPeriod === p
                  return (
                    <button
                      key={p}
                      onClick={() => setChartPeriod(p)}
                      className="text-[11px] font-semibold px-3 py-1 rounded-full transition-colors"
                      style={{
                        background: active ? 'var(--surface)' : 'transparent',
                        color: active ? 'var(--ink)' : 'var(--text-mute)',
                        boxShadow: active ? 'var(--shadow-sm)' : 'none',
                        border: 0,
                        cursor: 'pointer',
                      }}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>
            </div>

            {sparkline ? (
              <svg
                viewBox={`0 0 ${sparkline.W} ${sparkline.H}`}
                preserveAspectRatio="none"
                className="w-full"
                style={{ height: 220 }}
              >
                <defs>
                  <linearGradient id="nw-spark-grad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--c-primary)" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="var(--c-primary)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={sparkline.areaPath} fill="url(#nw-spark-grad)" />
                <path
                  d={sparkline.linePath}
                  fill="none"
                  stroke="var(--c-primary)"
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
                      fill="var(--c-primary)"
                    />
                    <circle
                      cx={sparkline.points[sparkline.points.length - 1].x}
                      cy={sparkline.points[sparkline.points.length - 1].y}
                      r="10"
                      fill="var(--c-primary)"
                      opacity="0.25"
                    />
                  </>
                )}
              </svg>
            ) : (
              <div
                className="flex-1 flex items-center justify-center"
                style={{ minHeight: 220, color: 'var(--text-mute)', fontSize: 13 }}
              >
                Catat transaksi untuk lihat trend
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
