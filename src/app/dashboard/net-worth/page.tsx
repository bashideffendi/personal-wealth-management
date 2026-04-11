'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Loader2, TrendingUp } from 'lucide-react'

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
    ] = await Promise.all([
      supabase.from('assets_liquid').select('type, balance').eq('user_id', user.id),
      supabase.from('assets_non_liquid').select('category, current_value').eq('user_id', user.id),
      supabase.from('investments').select('total_value').eq('user_id', user.id),
      supabase.from('debts').select('category, remaining').eq('user_id', user.id).eq('is_active', true),
    ])

    const liquidAssets = liquidRes.data ?? []
    const nonLiquidAssets = nonLiquidRes.data ?? []
    const investments = investmentRes.data ?? []
    const debts = debtRes.data ?? []

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
        <Loader2 className="size-6 animate-spin text-teal-600" />
        <span className="ml-2 text-gray-500">Memuat data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="size-6 text-teal-600" />
          Kekayaan Bersih
        </h1>
        <p className="text-sm text-gray-500">{today}</p>
      </div>

      {/* Hero Card */}
      <Card className="border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50">
        <CardContent className="pt-6 text-center">
          <p className="text-sm font-medium text-gray-500 mb-1">Kekayaan Bersih</p>
          <p className={`text-4xl font-bold ${isPositive ? 'text-teal-700' : 'text-red-600'}`}>
            {formatCurrency(netWorth)}
          </p>
          <div className="flex justify-center gap-8 mt-4">
            <div>
              <p className="text-xs text-gray-500">Total Aset</p>
              <p className="text-lg font-semibold text-emerald-600">{formatCurrency(totalAssets)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Utang</p>
              <p className="text-lg font-semibold text-red-600">{formatCurrency(totalDebt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-teal-700">Rincian Aset</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Aset Lancar */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Aset Lancar</h3>
              <div className="space-y-1">
                <Row label="Kas & Setara Kas" value={data.cashAndEquivalent} />
                <Row label="Piutang" value={data.receivable} />
              </div>
              <Separator className="my-2" />
              <Row label="Subtotal Aset Lancar" value={totalCurrentAssets} bold />
            </div>

            {/* Aset Tidak Lancar */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Aset Tidak Lancar</h3>
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
            <CardTitle className="text-teal-700">Rincian Utang</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Utang Lancar */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Utang Lancar</h3>
              <div className="space-y-1">
                <Row label="Utang Konsumer" value={data.consumerDebt} />
                <Row label="Utang Pinjaman Tunai" value={data.cashLoan} />
              </div>
              <Separator className="my-2" />
              <Row label="Subtotal Utang Lancar" value={totalCurrentDebt} bold />
            </div>

            {/* Utang Jangka Panjang */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Utang Jangka Panjang</h3>
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
      <Card className="border-teal-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-gray-800">
              Kekayaan Bersih (Aset - Liabilitas)
            </span>
            <span className={`text-2xl font-bold ${isPositive ? 'text-teal-700' : 'text-red-600'}`}>
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
      <span className={`text-sm ${bold ? 'font-semibold' : 'text-gray-600'}`}>{label}</span>
      <span className={`text-sm tabular-nums ${bold ? 'font-semibold' : 'text-gray-700'}`}>
        {formatCurrency(value)}
      </span>
    </div>
  )
}
