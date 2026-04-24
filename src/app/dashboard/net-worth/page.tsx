'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { NetWorthSnapshot } from '@/types'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Loader2, TrendingUp } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

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
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([])
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
      liquidRes,
      nonLiquidRes,
      investmentRes,
      debtRes,
      snapshotRes,
    ] = await Promise.all([
      supabase.from('assets_liquid').select('type, balance').eq('user_id', user.id),
      supabase.from('assets_non_liquid').select('category, current_value').eq('user_id', user.id),
      supabase.from('investments').select('total_value').eq('user_id', user.id),
      supabase.from('debts').select('category, remaining').eq('user_id', user.id).eq('is_active', true),
      supabase.from('net_worth_snapshots').select('*').eq('user_id', user.id).order('snapshot_date'),
    ])
    setSnapshots((snapshotRes.data ?? []) as NetWorthSnapshot[])

    type LiquidRow = { type: string; balance: number }
    type NonLiquidRow = { category: string; current_value: number }
    type InvestmentRow = { total_value: number }
    type DebtRow = { category: string; remaining: number }

    const liquidAssets = (liquidRes.data ?? []) as LiquidRow[]
    const nonLiquidAssets = (nonLiquidRes.data ?? []) as NonLiquidRow[]
    const investments = (investmentRes.data ?? []) as InvestmentRow[]
    const debts = (debtRes.data ?? []) as DebtRow[]

    // Aset Lancar
    const cashAndEquivalent = liquidAssets
      .filter((a) => a.type !== 'receivable')
      .reduce((sum, a) => sum + (a.balance || 0), 0)
    const receivable = liquidAssets
      .filter((a) => a.type === 'receivable')
      .reduce((sum, a) => sum + (a.balance || 0), 0)

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

    setLoading(false)
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
      {snapshots.length > 1 && (
        <div className="s-card p-6">
          <p className="caps">Riwayat</p>
          <h3 className="text-lg font-semibold mt-0.5">Net Worth 12 Bulan</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart
              data={snapshots.map((s) => ({
                month: new Date(s.snapshot_date).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
                net: s.net_worth,
                assets: s.total_assets,
                debts: s.total_debts,
              }))}
            >
              <defs>
                <linearGradient id="g-net" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#A3E635" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#A3E635" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
              <XAxis dataKey="month" fontSize={11} tick={{ fill: 'var(--ink-muted)' }} axisLine={{ stroke: 'var(--border-soft)' }} tickLine={false} />
              <YAxis fontSize={11} tickFormatter={(v: number) => `${(v / 1_000_000_000).toFixed(1)}M`} tick={{ fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: unknown) => formatCurrency(Number(v) || 0)}
                contentStyle={{
                  backgroundColor: 'var(--black)',
                  border: '1px solid var(--black-line)',
                  borderRadius: '8px',
                  fontSize: 12,
                  color: 'var(--on-black)',
                }}
              />
              <Area type="monotone" dataKey="net" name="Net Worth" stroke="#65A30D" fill="url(#g-net)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
          {(() => {
            const first = snapshots[0].net_worth
            const last = snapshots[snapshots.length - 1].net_worth
            const delta = last - first
            const pct = first > 0 ? (delta / first) * 100 : 0
            return (
              <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm" style={{ borderColor: 'var(--border-soft)' }}>
                <span style={{ color: 'var(--ink-muted)' }}>Perubahan 12 bulan</span>
                <span className="num font-semibold tabular" style={{ color: delta >= 0 ? 'var(--lime-700)' : 'var(--danger)' }}>
                  {delta >= 0 ? '+' : ''}{formatCurrency(delta)} ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)
                </span>
              </div>
            )
          })()}
        </div>
      )}

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
