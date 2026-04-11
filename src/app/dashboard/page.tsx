'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, getMonthName } from '@/lib/utils'
import { MONTHS } from '@/lib/constants'
import type { Transaction, Investment } from '@/types'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, TrendingUp, TrendingDown, PiggyBank, BarChart3 } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts'

const CHART_COLORS = ['#0d9488', '#06b6d4', '#6366f1', '#f59e0b', '#ef4444', '#22c55e', '#8b5cf6', '#ec4899']

const TYPE_LABELS: Record<string, string> = {
  income: 'Pemasukan',
  expense: 'Pengeluaran',
  saving: 'Tabungan',
  investment: 'Investasi',
}

const TYPE_BADGE_COLORS: Record<string, string> = {
  income: 'bg-emerald-100 text-emerald-700',
  expense: 'bg-red-100 text-red-700',
  saving: 'bg-amber-100 text-amber-700',
  investment: 'bg-blue-100 text-blue-700',
}

const INVESTMENT_CATEGORY_LABELS: Record<string, string> = {
  stock: 'Saham',
  mutual_fund: 'Reksa Dana',
  crypto: 'Crypto',
  gold: 'Emas',
  bond: 'Obligasi',
  time_deposit: 'Deposito',
  p2p: 'P2P Lending',
  business: 'Bisnis',
}

interface MonthlyChartData {
  month: string
  income: number
  expense: number
}

interface PieChartData {
  name: string
  value: number
}

export default function DashboardPage() {
  const supabase = createClient()

  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [loading, setLoading] = useState(true)

  // Summary data
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalExpense, setTotalExpense] = useState(0)
  const [totalSaving, setTotalSaving] = useState(0)
  const [totalInvestment, setTotalInvestment] = useState(0)

  // Chart data
  const [monthlyData, setMonthlyData] = useState<MonthlyChartData[]>([])
  const [investmentPieData, setInvestmentPieData] = useState<PieChartData[]>([])

  // Recent transactions
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth])

  async function fetchData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Build date range for selected month
    const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
    const endMonth = selectedMonth === 12 ? 1 : selectedMonth + 1
    const endYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

    // Fetch all transactions for the year (for chart) and investments
    const [yearTxRes, investRes, recentRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', `${selectedYear}-01-01`)
        .lt('date', `${selectedYear + 1}-01-01`)
        .order('date', { ascending: false }),
      supabase
        .from('investments')
        .select('category, total_value')
        .eq('user_id', user.id),
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(10),
    ])

    const yearTransactions: Transaction[] = yearTxRes.data ?? []
    const investments: Investment[] = (investRes.data ?? []) as Investment[]

    // Summary for selected month
    const monthTransactions = yearTransactions.filter((tx) => {
      return tx.date >= startDate && tx.date < endDate
    })

    setTotalIncome(
      monthTransactions.filter((tx) => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0)
    )
    setTotalExpense(
      monthTransactions.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0)
    )
    setTotalSaving(
      monthTransactions.filter((tx) => tx.type === 'saving').reduce((s, tx) => s + tx.amount, 0)
    )
    setTotalInvestment(
      monthTransactions.filter((tx) => tx.type === 'investment').reduce((s, tx) => s + tx.amount, 0)
    )

    // Monthly chart data (12 months)
    const monthly: MonthlyChartData[] = MONTHS.map((name, idx) => {
      const m = idx + 1
      const mStart = `${selectedYear}-${String(m).padStart(2, '0')}-01`
      const mEndMonth = m === 12 ? 1 : m + 1
      const mEndYear = m === 12 ? selectedYear + 1 : selectedYear
      const mEnd = `${mEndYear}-${String(mEndMonth).padStart(2, '0')}-01`

      const mTx = yearTransactions.filter((tx) => tx.date >= mStart && tx.date < mEnd)
      return {
        month: name.substring(0, 3),
        income: mTx.filter((tx) => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0),
        expense: mTx.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0),
      }
    })
    setMonthlyData(monthly)

    // Investment pie chart
    const invByCategory: Record<string, number> = {}
    investments.forEach((inv) => {
      const label = INVESTMENT_CATEGORY_LABELS[inv.category] || inv.category
      invByCategory[label] = (invByCategory[label] || 0) + (inv.total_value || 0)
    })
    setInvestmentPieData(
      Object.entries(invByCategory)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value }))
    )

    // Recent transactions
    setRecentTransactions(recentRes.data ?? [])

    setLoading(false)
  }

  // Generate year options (current year +/- 5)
  const yearOptions = Array.from({ length: 11 }, (_, i) => now.getFullYear() - 5 + i)

  const currentMonthYear = `${getMonthName(selectedMonth)} ${selectedYear}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatTooltipValue = (value: any) => formatCurrency(Number(value) || 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-teal-600" />
        <span className="ml-2 text-slate-500">Memuat data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500">{currentMonthYear}</p>
        </div>
        <div className="flex gap-2">
          <Select
            value={String(selectedYear)}
            onValueChange={(v) => { if (v) setSelectedYear(Number(v)) }}
          >
            <SelectTrigger className="w-[100px] rounded-lg border-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(selectedMonth)}
            onValueChange={(v) => { if (v) setSelectedMonth(Number(v)) }}
          >
            <SelectTrigger className="w-[130px] rounded-lg border-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 1: Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Pemasukan"
          value={totalIncome}
          icon={<TrendingUp className="size-5 text-emerald-600" />}
          iconBg="bg-emerald-100"
          valueColor="text-slate-800"
        />
        <SummaryCard
          title="Total Pengeluaran"
          value={totalExpense}
          icon={<TrendingDown className="size-5 text-red-500" />}
          iconBg="bg-red-100"
          valueColor="text-slate-800"
        />
        <SummaryCard
          title="Total Tabungan"
          value={totalSaving}
          icon={<PiggyBank className="size-5 text-amber-500" />}
          iconBg="bg-amber-100"
          valueColor="text-slate-800"
        />
        <SummaryCard
          title="Total Investasi"
          value={totalInvestment}
          icon={<BarChart3 className="size-5 text-blue-600" />}
          iconBg="bg-blue-100"
          valueColor="text-slate-800"
        />
      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Income vs Expense */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Pemasukan vs Pengeluaran Bulanan</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" fontSize={12} tick={{ fill: '#64748b' }} />
              <YAxis fontSize={12} tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}jt`} tick={{ fill: '#64748b' }} />
              <Tooltip formatter={formatTooltipValue} />
              <Legend />
              <Bar dataKey="income" name="Pemasukan" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Pengeluaran" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Investment Allocation */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Alokasi Investasi</h2>
          {investmentPieData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-slate-400">
              Belum ada data investasi.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={investmentPieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: any) =>
                    `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`
                  }
                  outerRadius={100}
                  dataKey="value"
                >
                  {investmentPieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={formatTooltipValue} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 3: Recent Transactions */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Transaksi Terbaru</h2>
        <Table>
          <TableHeader>
            <TableRow className="border-slate-100">
              <TableHead className="text-slate-500">Tanggal</TableHead>
              <TableHead className="text-slate-500">Tipe</TableHead>
              <TableHead className="text-slate-500">Kategori</TableHead>
              <TableHead className="text-slate-500">Deskripsi</TableHead>
              <TableHead className="text-right text-slate-500">Jumlah</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-400 py-10">
                  Belum ada transaksi.
                </TableCell>
              </TableRow>
            ) : (
              recentTransactions.map((tx) => (
                <TableRow key={tx.id} className="hover:bg-slate-50 border-slate-100 transition-colors">
                  <TableCell className="text-slate-600">{formatDate(tx.date)}</TableCell>
                  <TableCell>
                    <Badge className={TYPE_BADGE_COLORS[tx.type] || ''}>
                      {TYPE_LABELS[tx.type] || tx.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-600">{tx.category}</TableCell>
                  <TableCell className="text-slate-600">{tx.description}</TableCell>
                  <TableCell
                    className={`text-right font-semibold ${
                      tx.type === 'income'
                        ? 'text-emerald-600'
                        : tx.type === 'expense'
                          ? 'text-red-500'
                          : 'text-slate-700'
                    }`}
                  >
                    {formatCurrency(tx.amount)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function SummaryCard({
  title,
  value,
  icon,
  iconBg,
  valueColor,
}: {
  title: string
  value: number
  icon: React.ReactNode
  iconBg: string
  valueColor: string
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <div className="flex items-center gap-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${iconBg}`}>
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm text-slate-500">{title}</p>
          <p className={`text-2xl font-bold ${valueColor}`}>{formatCurrency(value)}</p>
          <p className="text-xs text-slate-400">Bulan ini</p>
        </div>
      </div>
    </div>
  )
}
