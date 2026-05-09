'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatCompactCurrency, formatDate } from '@/lib/utils'
import { fetchLiquidEntries, sumCashEquivalent, sumReceivable } from '@/lib/liquid'
import type { NetWorthSnapshot } from '@/types'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Loader2, TrendingUp, TrendingDown, Camera, Sparkles } from 'lucide-react'
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Button } from '@/components/ui/button'

interface NetWorthData {
  // Aset Lancar
  cashAndEquivalent: number
  receivable: number
  // Aset Tidak Lancar
  property: number
  vehicle: number
  personalItem: number
  longTermInvestment: number
  // Utang
  consumerDebt: number
  cashLoan: number
  longTermDebt: number
}

export default function NetWorthPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [snapshotting, setSnapshotting] = useState(false)
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([])
  const [period, setPeriod] = useState<'3m' | '6m' | '12m' | 'all'>('12m')
  const [data, setData] = useState<NetWorthData>({
    cashAndEquivalent: 0,
    receivable: 0,
    property: 0,
    vehicle: 0,
    personalItem: 0,
    longTermInvestment: 0,
    consumerDebt: 0,
    cashLoan: 0,
    longTermDebt: 0,
  })

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [
      liquidEntries,
      nonLiquidRes,
      investmentRes,
      debtRes,
      snapshotRes,
    ] = await Promise.all([
      fetchLiquidEntries(supabase, user.id),
      supabase.from('assets_non_liquid').select('category, current_value').eq('user_id', user.id),
      supabase.from('investments').select('total_value').eq('user_id', user.id),
      supabase.from('debts').select('category, remaining').eq('user_id', user.id).eq('is_active', true),
      supabase.from('net_worth_snapshots').select('*').eq('user_id', user.id).order('snapshot_date'),
    ])
    setSnapshots((snapshotRes.data ?? []) as NetWorthSnapshot[])

    type NonLiquidRow = { category: string; current_value: number }
    type InvestmentRow = { total_value: number }
    type DebtRow = { category: string; remaining: number }

    const nonLiquidAssets = (nonLiquidRes.data ?? []) as NonLiquidRow[]
    const investments = (investmentRes.data ?? []) as InvestmentRow[]
    const debts = (debtRes.data ?? []) as DebtRow[]

    // Aset Lancar (combined: accounts.current_balance + assets_liquid)
    const cashAndEquivalent = sumCashEquivalent(liquidEntries)
    const receivable = sumReceivable(liquidEntries)

    // Aset Tidak Lancar
    const property = nonLiquidAssets
      .filter((a) => a.category === 'property')
      .reduce((sum, a) => sum + (a.current_value || 0), 0)
    const vehicle = nonLiquidAssets
      .filter((a) => a.category === 'vehicle')
      .reduce((sum, a) => sum + (a.current_value || 0), 0)
    const personalItem = nonLiquidAssets
      .filter((a) => a.category === 'personal_item')
      .reduce((sum, a) => sum + (a.current_value || 0), 0)
    const longTermInvestment = investments
      .reduce((sum, inv) => sum + (inv.total_value || 0), 0)

    // Utang
    const consumerDebt = debts
      .filter((d) => d.category === 'consumer')
      .reduce((sum, d) => sum + (d.remaining || 0), 0)
    const cashLoan = debts
      .filter((d) => d.category === 'cash_loan')
      .reduce((sum, d) => sum + (d.remaining || 0), 0)
    const longTermDebt = debts
      .filter((d) => d.category === 'long_term')
      .reduce((sum, d) => sum + (d.remaining || 0), 0)

    setData({
      cashAndEquivalent,
      receivable,
      property,
      vehicle,
      personalItem,
      longTermInvestment,
      consumerDebt,
      cashLoan,
      longTermDebt,
    })

    // Auto-upsert today's snapshot so the chart always has at least one
    // data point. Uses (user_id, snapshot_date) unique constraint — if
    // there's already a snapshot today, it gets updated to current values.
    const totalAssetsNow =
      cashAndEquivalent + receivable + property + vehicle +
      personalItem + longTermInvestment
    const totalDebtsNow = consumerDebt + cashLoan + longTermDebt
    const todayISO = new Date().toISOString().split('T')[0]
    await supabase.from('net_worth_snapshots').upsert(
      {
        user_id: user.id,
        snapshot_date: todayISO,
        total_assets: totalAssetsNow,
        total_debts: totalDebtsNow,
        net_worth: totalAssetsNow - totalDebtsNow,
      },
      { onConflict: 'user_id,snapshot_date' },
    )

    // Re-read snapshots so the just-upserted today row is included
    const refreshed = await supabase
      .from('net_worth_snapshots')
      .select('*')
      .eq('user_id', user.id)
      .order('snapshot_date')
    setSnapshots((refreshed.data ?? []) as NetWorthSnapshot[])

    setLoading(false)
  }

  // Manual snapshot trigger — useful before/after a big transaction
  // so the user can mark a specific moment in time.
  async function takeManualSnapshot() {
    setSnapshotting(true)
    await fetchData()
    setSnapshotting(false)
  }

  const totalCurrentAssets = data.cashAndEquivalent + data.receivable
  const totalNonCurrentAssets = data.property + data.vehicle + data.personalItem + data.longTermInvestment
  const totalAssets = totalCurrentAssets + totalNonCurrentAssets

  const totalCurrentDebt = data.consumerDebt + data.cashLoan
  const totalLongTermDebt = data.longTermDebt
  const totalDebt = totalCurrentDebt + totalLongTermDebt

  const netWorth = totalAssets - totalDebt
  const isPositive = netWorth >= 0

  const today = formatDate(new Date())

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin" style={{ color: 'var(--burgundy-700)' }} />
        <span className="ml-2" style={{ color: 'var(--ink-muted)' }}>Memuat data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="dark-card p-6 sm:p-10">
        <p className="caps text-center">Kekayaan Bersih · {today}</p>
        <p
          className="num tabular text-center mt-5 text-5xl sm:text-6xl lg:text-7xl font-semibold"
          style={{ color: isPositive ? 'var(--ink)' : 'var(--danger)' }}
        >
          {formatCurrency(netWorth)}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-8">
          <div className="text-center">
            <p className="caps">Aset</p>
            <p className="num mt-1.5 text-lg font-semibold" style={{ color: 'var(--ink)' }}>
              {formatCurrency(totalAssets)}
            </p>
          </div>
          <span
            className="w-px h-12 self-center"
            style={{ background: 'rgba(255,255,255,0.2)' }}
          />
          <div className="text-center">
            <p className="caps">Utang</p>
            <p className="num mt-1.5 text-lg font-semibold" style={{ color: 'var(--ink)' }}>
              {formatCurrency(totalDebt)}
            </p>
          </div>
        </div>
      </div>

      {/* Historical Timeline */}
      <NetWorthHistoryCard
        snapshots={snapshots}
        period={period}
        onPeriodChange={setPeriod}
        onSnapshot={takeManualSnapshot}
        snapshotting={snapshotting}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif" style={{ color: 'var(--burgundy-700)' }}>Rincian Aset</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Aset Lancar */}
            <div>
              <h3 className="caps mb-2" style={{ color: 'var(--ink-muted)' }}>Aset Lancar</h3>
              <div className="space-y-1">
                <Row label="Kas & Setara Kas" value={data.cashAndEquivalent} />
                <Row label="Piutang" value={data.receivable} />
              </div>
              <Separator className="my-2" />
              <Row label="Subtotal Aset Lancar" value={totalCurrentAssets} bold />
            </div>

            {/* Aset Tidak Lancar */}
            <div>
              <h3 className="caps mb-2" style={{ color: 'var(--ink-muted)' }}>Aset Tidak Lancar</h3>
              <div className="space-y-1">
                <Row label="Properti" value={data.property} />
                <Row label="Kendaraan & Peralatan" value={data.vehicle} />
                <Row label="Barang Pribadi" value={data.personalItem} />
                <Row label="Investasi Jangka Panjang" value={data.longTermInvestment} />
              </div>
              <Separator className="my-2" />
              <Row label="Subtotal Aset Tidak Lancar" value={totalNonCurrentAssets} bold />
            </div>

            <Separator />
            <Row label="Total Aset" value={totalAssets} bold className="text-emerald-700" />
          </CardContent>
        </Card>

        {/* Debt Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif" style={{ color: 'var(--burgundy-700)' }}>Rincian Utang</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Utang Lancar */}
            <div>
              <h3 className="caps mb-2" style={{ color: 'var(--ink-muted)' }}>Utang Lancar</h3>
              <div className="space-y-1">
                <Row label="Utang Konsumer" value={data.consumerDebt} />
                <Row label="Utang Pinjaman Tunai" value={data.cashLoan} />
              </div>
              <Separator className="my-2" />
              <Row label="Subtotal Utang Lancar" value={totalCurrentDebt} bold />
            </div>

            {/* Utang Jangka Panjang */}
            <div>
              <h3 className="caps mb-2" style={{ color: 'var(--ink-muted)' }}>Utang Jangka Panjang</h3>
              <div className="space-y-1">
                <Row label="Utang Jangka Panjang" value={data.longTermDebt} />
              </div>
              <Separator className="my-2" />
              <Row label="Subtotal Utang Jangka Panjang" value={totalLongTermDebt} bold />
            </div>

            <Separator />
            <Row label="Total Utang" value={totalDebt} bold className="text-red-600" />
          </CardContent>
        </Card>
      </div>

      {/* Bottom Net Worth */}
      <Card style={{ borderColor: 'var(--gold-300)' }}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <span className="font-serif text-[20px]" style={{ color: 'var(--burgundy-700)' }}>
              Kekayaan Bersih (Aset − Liabilitas)
            </span>
            <span
              className="font-serif text-[28px] tabular"
              style={{ color: isPositive ? 'var(--burgundy-700)' : 'var(--danger)' }}
            >
              {formatCurrency(netWorth)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({
  label,
  value,
  bold = false,
  className = '',
}: {
  label: string
  value: number
  bold?: boolean
  className?: string
}) {
  return (
    <div className={`flex items-center justify-between py-1 ${className}`}>
      <span
        className={`text-sm ${bold ? 'font-semibold' : ''}`}
        style={{ color: bold ? 'var(--ink)' : 'var(--ink-muted)' }}
      >
        {label}
      </span>
      <span
        className={`text-sm tabular ${bold ? 'font-semibold' : ''}`}
        style={{ color: bold ? 'var(--ink)' : 'var(--ink-muted)' }}
      >
        {formatCurrency(value)}
      </span>
    </div>
  )
}

// ─── Net Worth History Card ─────────────────────────────────────────
// Composed chart: Assets bars (positive emerald), Debts bars (negative coral),
// Net Worth line (indigo) overlaid. Period selector + comparison stats.

interface HistoryProps {
  snapshots: NetWorthSnapshot[]
  period: '3m' | '6m' | '12m' | 'all'
  onPeriodChange: (p: '3m' | '6m' | '12m' | 'all') => void
  onSnapshot: () => void
  snapshotting: boolean
}

function NetWorthHistoryCard({ snapshots, period, onPeriodChange, onSnapshot, snapshotting }: HistoryProps) {
  // Filter snapshots by period
  const filtered = useMemo(() => {
    if (period === 'all' || snapshots.length === 0) return snapshots
    const now = new Date()
    const months = period === '3m' ? 3 : period === '6m' ? 6 : 12
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
    return snapshots.filter((s) => new Date(s.snapshot_date) >= cutoff)
  }, [snapshots, period])

  // Comparison stats — first vs last in filtered range, plus vs 1mo / 3mo / YTD
  const stats = useMemo(() => {
    if (snapshots.length === 0) return null
    const last = snapshots[snapshots.length - 1]
    const findClosest = (target: Date) => {
      let best: NetWorthSnapshot | null = null
      let bestDist = Infinity
      for (const s of snapshots) {
        const dist = Math.abs(new Date(s.snapshot_date).getTime() - target.getTime())
        if (dist < bestDist) { bestDist = dist; best = s }
      }
      return best
    }
    const now = new Date()
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
    const startOfYear = new Date(now.getFullYear(), 0, 1)

    function delta(from: NetWorthSnapshot | null) {
      if (!from || from.snapshot_date === last.snapshot_date) return null
      const d = last.net_worth - from.net_worth
      const pct = from.net_worth !== 0 ? (d / Math.abs(from.net_worth)) * 100 : 0
      return { delta: d, pct }
    }

    return {
      vs1mo: delta(findClosest(oneMonthAgo)),
      vs3mo: delta(findClosest(threeMonthsAgo)),
      vsYtd: delta(findClosest(startOfYear)),
    }
  }, [snapshots])

  // Compute Y axis ticks dynamically (show in M / Jt scale)
  const chartData = useMemo(() => {
    return filtered.map((s) => {
      const d = new Date(s.snapshot_date)
      const label = d.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })
      return {
        date: label,
        rawDate: s.snapshot_date,
        assets: s.total_assets,
        debts: -s.total_debts, // negative so they go below the axis
        net: s.net_worth,
      }
    })
  }, [filtered])

  const periodLabels: Record<typeof period, string> = {
    '3m': '3 Bulan',
    '6m': '6 Bulan',
    '12m': '12 Bulan',
    all: 'Semua',
  }

  return (
    <div className="s-card p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="caps">Riwayat</p>
          <h3 className="text-lg font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
            Net Worth dari Waktu ke Waktu
          </h3>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
            Snapshot otomatis tiap kamu buka halaman ini · {snapshots.length} titik data
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['3m', '6m', '12m', 'all'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPeriodChange(p)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-md transition"
              style={{
                background: period === p ? 'var(--ink)' : 'var(--surface-2)',
                color: period === p ? 'var(--surface)' : 'var(--ink-muted)',
              }}
            >
              {periodLabels[p]}
            </button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={onSnapshot}
            disabled={snapshotting}
            className="ml-1"
          >
            {snapshotting ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
            <span className="hidden sm:inline">Snapshot</span>
          </Button>
        </div>
      </div>

      {snapshots.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-12 text-center px-6"
          style={{ color: 'var(--ink-soft)' }}
        >
          <Sparkles className="size-8 mb-3 opacity-40" />
          <p className="text-sm">Belum ada riwayat</p>
        </div>
      ) : snapshots.length === 1 ? (
        <div
          className="rounded-xl border-2 border-dashed p-8 text-center"
          style={{ borderColor: 'var(--border-soft)', color: 'var(--ink-soft)' }}
        >
          <Sparkles className="size-7 mx-auto mb-2 opacity-50" style={{ color: 'var(--emerald-500)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
            Snapshot pertama tercatat hari ini ({new Date(snapshots[0].snapshot_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })})
          </p>
          <p className="text-xs mt-1.5">
            Cek lagi dalam beberapa hari/minggu — grafik akan muncul begitu ada minimal 2 data point.
            Tiap kali kamu buka halaman ini, snapshot baru otomatis dicatat untuk hari tersebut.
          </p>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 8, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="g-assets" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0.55} />
                </linearGradient>
                <linearGradient id="g-debts" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
              <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1} />
              <XAxis
                dataKey="date"
                fontSize={11}
                tick={{ fill: 'var(--ink-muted)' }}
                axisLine={{ stroke: 'var(--border-soft)' }}
                tickLine={false}
              />
              <YAxis
                fontSize={11}
                tickFormatter={(v: number) => formatCompactCurrency(v)}
                tick={{ fill: 'var(--ink-muted)' }}
                axisLine={false}
                tickLine={false}
                width={70}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0].payload as { date: string; rawDate: string; assets: number; debts: number; net: number }
                  return (
                    <div
                      className="rounded-md border px-3 py-2 text-xs shadow-md"
                      style={{
                        background: 'var(--surface)',
                        borderColor: 'var(--border)',
                        color: 'var(--ink)',
                      }}
                    >
                      <p className="font-semibold mb-1.5">
                        {new Date(p.rawDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                      <div className="space-y-0.5">
                        <p className="num tabular flex justify-between gap-3">
                          <span style={{ color: '#10B981' }}>● Aset</span>
                          <span>{formatCurrency(p.assets)}</span>
                        </p>
                        <p className="num tabular flex justify-between gap-3">
                          <span style={{ color: '#EF4444' }}>● Utang</span>
                          <span>{formatCurrency(Math.abs(p.debts))}</span>
                        </p>
                        <p className="num tabular flex justify-between gap-3 font-semibold mt-1 pt-1 border-t" style={{ borderColor: 'var(--border-soft)' }}>
                          <span style={{ color: '#6366F1' }}>● Net Worth</span>
                          <span>{formatCurrency(p.net)}</span>
                        </p>
                      </div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="assets" name="Aset" fill="url(#g-assets)" stackId="a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="debts" name="Utang" fill="url(#g-debts)" stackId="a" radius={[0, 0, 4, 4]} />
              <Line
                type="monotone"
                dataKey="net"
                name="Net Worth"
                stroke="#6366F1"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#6366F1', stroke: 'var(--surface)', strokeWidth: 2 }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Comparison stats */}
          {stats && (
            <div className="mt-5 pt-4 border-t grid grid-cols-3 gap-3" style={{ borderColor: 'var(--border-soft)' }}>
              <ChangeStat label="vs Bulan Lalu" change={stats.vs1mo} />
              <ChangeStat label="vs 3 Bulan Lalu" change={stats.vs3mo} />
              <ChangeStat label="YTD (Awal Tahun)" change={stats.vsYtd} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ChangeStat({ label, change }: { label: string; change: { delta: number; pct: number } | null }) {
  if (!change) {
    return (
      <div>
        <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{label}</p>
        <p className="text-sm mt-1" style={{ color: 'var(--ink-soft)' }}>—</p>
      </div>
    )
  }
  const positive = change.delta >= 0
  const color = positive ? '#059669' : '#DC2626'
  const Icon = positive ? TrendingUp : TrendingDown
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{label}</p>
      <p className="num tabular text-base font-semibold mt-0.5 flex items-center gap-1" style={{ color }}>
        <Icon className="size-3.5" />
        {positive ? '+' : ''}{formatCompactCurrency(change.delta)}
      </p>
      <p className="text-[11px] mt-0.5" style={{ color }}>
        {positive ? '+' : ''}{change.pct.toFixed(1)}%
      </p>
    </div>
  )
}
