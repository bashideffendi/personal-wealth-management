'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, getMonthName } from '@/lib/utils'
import { MONTHS } from '@/lib/constants'
import { useT } from '@/lib/i18n/context'
import type { Transaction, Investment, CreditCard } from '@/types'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, ArrowRight } from 'lucide-react'
import {
  AreaChart,
  Area,
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

// Campfire chart palette — clean modern SaaS
const CHART_PALETTE = [
  '#0A0A0A', // near-black
  '#14B8A6', // teal-500 (primary accent)
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#737373', // neutral-500
  '#8B5CF6', // violet-500
  '#EF4444', // red-500
]

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

interface MonthlyData {
  month: string
  income: number
  expense: number
  net: number
}

interface Budget {
  id: string; year: number; month: number; category: string
  type: 'income' | 'expense' | 'saving' | 'investment'; amount: number
}

export default function DashboardPage() {
  const supabase = createClient()
  const t = useT()

  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [loading, setLoading] = useState(true)

  const [monthTransactions, setMonthTransactions] = useState<Transaction[]>([])
  const [yearTransactions, setYearTransactions] = useState<Transaction[]>([])
  const [investments, setInvestments] = useState<Investment[]>([])
  const [monthBudgets, setMonthBudgets] = useState<Budget[]>([])
  const [creditCards, setCreditCards] = useState<CreditCard[]>([])
  const [liquidTotal, setLiquidTotal] = useState(0)
  const [debtTotal, setDebtTotal] = useState(0)
  const [emergencyFundCurrent, setEmergencyFundCurrent] = useState(0)
  const [emergencyFundTarget, setEmergencyFundTarget] = useState(0)

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth])

  async function fetchData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
    const endMonth = selectedMonth === 12 ? 1 : selectedMonth + 1
    const endYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

    const [yearRes, invRes, budgetRes, ccRes, liqRes, debtRes, efRes] = await Promise.all([
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
        .from('budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('year', selectedYear)
        .eq('month', selectedMonth),
      supabase
        .from('credit_cards')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true),
      supabase
        .from('assets_liquid')
        .select('balance')
        .eq('user_id', user.id),
      supabase
        .from('debts')
        .select('remaining')
        .eq('user_id', user.id)
        .eq('is_active', true),
      supabase
        .from('emergency_fund')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setLiquidTotal(((liqRes.data ?? []) as any[]).reduce((s, a) => s + (a.balance ?? 0), 0))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setDebtTotal(((debtRes.data ?? []) as any[]).reduce((s, d) => s + (d.remaining ?? 0), 0))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ef = efRes.data as any
    setEmergencyFundCurrent(ef?.current_amount ?? 0)
    setEmergencyFundTarget(ef?.target_amount ?? 0)

    const yearTxs = (yearRes.data ?? []) as Transaction[]
    setYearTransactions(yearTxs)
    setMonthTransactions(yearTxs.filter((tx) => tx.date >= startDate && tx.date < endDate))
    setInvestments((invRes.data ?? []) as Investment[])
    setMonthBudgets((budgetRes.data ?? []) as Budget[])
    setCreditCards((ccRes.data ?? []) as CreditCard[])
    setLoading(false)
  }

  // ---- KPI aggregations ----
  const totals = useMemo(() => {
    const income = monthTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = monthTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const saving = monthTransactions.filter((t) => t.type === 'saving').reduce((s, t) => s + t.amount, 0)
    const investment = monthTransactions.filter((t) => t.type === 'investment').reduce((s, t) => s + t.amount, 0)
    return {
      income, expense, saving, investment,
      net: income - expense - saving - investment,
      savingRate: income > 0 ? ((saving + investment) / income) * 100 : 0,
    }
  }, [monthTransactions])

  // ---- Sparkline data (12 months per metric) ----
  const sparklineData = useMemo(() => {
    const arr: { income: number; expense: number; saving: number; net: number }[] = []
    for (let m = 0; m < 12; m++) {
      const mStart = `${selectedYear}-${String(m + 1).padStart(2, '0')}-01`
      const mEndMonth = m === 11 ? 1 : m + 2
      const mEndYear = m === 11 ? selectedYear + 1 : selectedYear
      const mEnd = `${mEndYear}-${String(mEndMonth).padStart(2, '0')}-01`
      const mTx = yearTransactions.filter((tx) => tx.date >= mStart && tx.date < mEnd)
      const income = mTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const expense = mTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      const saving = mTx.filter((t) => t.type === 'saving' || t.type === 'investment').reduce((s, t) => s + t.amount, 0)
      arr.push({ income, expense, saving, net: income - expense - saving })
    }
    return arr
  }, [yearTransactions, selectedYear])

  // ---- Monthly chart (area with net) ----
  const monthlyData = useMemo<MonthlyData[]>(() => {
    return MONTHS.map((name, idx) => {
      const m = idx + 1
      const mStart = `${selectedYear}-${String(m).padStart(2, '0')}-01`
      const mEndMonth = m === 12 ? 1 : m + 1
      const mEndYear = m === 12 ? selectedYear + 1 : selectedYear
      const mEnd = `${mEndYear}-${String(mEndMonth).padStart(2, '0')}-01`
      const mTx = yearTransactions.filter((tx) => tx.date >= mStart && tx.date < mEnd)
      const income = mTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const expense = mTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      return { month: name.substring(0, 3), income, expense, net: income - expense }
    })
  }, [yearTransactions, selectedYear])

  // ---- Investment pie ----
  const investmentPieData = useMemo(() => {
    const byCategory: Record<string, number> = {}
    investments.forEach((inv) => {
      const label = INVESTMENT_CATEGORY_LABELS[inv.category] || inv.category
      byCategory[label] = (byCategory[label] || 0) + (inv.total_value || 0)
    })
    return Object.entries(byCategory)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))
  }, [investments])

  // ---- Calendar: daily net per day of selected month ----
  const calendarData = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()
    const firstDow = new Date(selectedYear, selectedMonth - 1, 1).getDay() // 0 Sun..6 Sat
    const result: Array<{
      day: number | null; date?: string
      income: number; expense: number; net: number
      count: number
    }> = []
    for (let i = 0; i < firstDow; i++) result.push({ day: null, income: 0, expense: 0, net: 0, count: 0 })
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const dayTx = monthTransactions.filter((t) => t.date === dateStr)
      const income = dayTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const expense = dayTx.filter((t) => t.type === 'expense' || t.type === 'saving' || t.type === 'investment').reduce((s, t) => s + t.amount, 0)
      result.push({ day: d, date: dateStr, income, expense, net: income - expense, count: dayTx.length })
    }
    return result
  }, [monthTransactions, selectedYear, selectedMonth])

  // ---- Budget progress per category ----
  const budgetProgress = useMemo(() => {
    return monthBudgets
      .filter((b) => b.type === 'expense' && b.amount > 0)
      .map((b) => {
        const actual = monthTransactions
          .filter((t) => t.type === 'expense' && t.category === b.category)
          .reduce((s, t) => s + t.amount, 0)
        const pct = b.amount > 0 ? (actual / b.amount) * 100 : 0
        return { category: b.category, budget: b.amount, actual, pct }
      })
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 6)
  }, [monthBudgets, monthTransactions])

  const yearOptions = Array.from({ length: 11 }, (_, i) => now.getFullYear() - 5 + i)
  const currentMonthYear = `${getMonthName(selectedMonth)} ${selectedYear}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatTooltipValue = (value: any) => formatCurrency(Number(value) || 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--indigo-600)' }} />
        <span className="ml-3 text-sm" style={{ color: 'var(--ink-muted)' }}>
          Memuat dashboard...
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Hero — compact */}
      <div className="dark-card px-6 py-4 sm:px-7 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="caps" style={{ fontSize: '0.625rem' }}>{t('dashboard.monthly_report')}</p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-0.5" style={{ color: 'var(--ink)' }}>
              {currentMonthYear}
            </h2>
          </div>
          <div className="flex gap-2">
            <Select value={String(selectedYear)} onValueChange={(v) => { if (v) setSelectedYear(Number(v)) }}>
              <SelectTrigger className="w-[100px] h-8 bg-white/70 border-[rgba(10,10,10,0.15)] text-[var(--ink)] text-xs hover:bg-white/90"><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(selectedMonth)} onValueChange={(v) => { if (v) setSelectedMonth(Number(v)) }}>
              <SelectTrigger className="w-[130px] h-8 bg-white/70 border-[rgba(10,10,10,0.15)] text-[var(--ink)] text-xs hover:bg-white/90"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* KPI Cards with sparklines */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label={t('dashboard.kpi_income')}  value={totals.income}  sparkline={sparklineData.map((d) => d.income)} />
        <KpiCard label={t('dashboard.kpi_expense')} value={totals.expense} sparkline={sparklineData.map((d) => d.expense)} />
        <KpiCard
          label={t('dashboard.kpi_saving_investment')}
          value={totals.saving + totals.investment}
          note={`${t('dashboard.saving_rate')} ${totals.savingRate.toFixed(1)}%`}
          sparkline={sparklineData.map((d) => d.saving)}
        />
        <KpiCard label={t('dashboard.kpi_net_cashflow')} value={totals.net} sparkline={sparklineData.map((d) => d.net)} />
      </div>

      {/* Calendar + Budget Progress (moved up) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Calendar */}
        <div className="s-card p-6 lg:col-span-3">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="caps">{t('dashboard.activity_daily')}</p>
              <h3 className="text-lg font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
                {t('dashboard.calendar_title')}
              </h3>
            </div>
            <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--lime-400)' }} />
                {t('dashboard.surplus')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--ink)' }} />
                {t('dashboard.deficit')}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {['M', 'S', 'S', 'R', 'K', 'J', 'S'].map((dow, i) => (
              <div key={i} className="text-center py-1 text-xs font-semibold" style={{ color: 'var(--ink-soft)' }}>
                {dow}
              </div>
            ))}
            {calendarData.map((cell, i) => {
              if (cell.day === null) return <div key={i} className="min-h-[60px]" />
              const hasActivity = cell.count > 0
              const isSurplus = cell.net > 0
              const isDeficit = cell.net < 0
              const bg = !hasActivity ? 'var(--surface-2)'
                : isSurplus ? 'var(--lime-100)'
                : isDeficit ? 'var(--ink)'
                : 'var(--surface-2)'
              const fg = isDeficit ? '#FFFFFF' : 'var(--ink)'
              const netFg = !hasActivity ? 'var(--ink-soft)'
                : isSurplus ? 'var(--lime-700)'
                : isDeficit ? 'var(--lime-400)'
                : 'var(--ink-muted)'
              return (
                <div
                  key={i}
                  className="min-h-[60px] rounded-md p-2 flex flex-col justify-between cursor-default transition-all hover:ring-2 hover:ring-[var(--ink)]"
                  style={{ backgroundColor: bg, color: fg }}
                  title={hasActivity ? `${cell.day}: ${cell.count} transaksi — Net ${formatCurrency(cell.net)}` : `${cell.day}: tidak ada transaksi`}
                >
                  <span className="text-sm font-semibold leading-none">{cell.day}</span>
                  {hasActivity && (
                    <span className="text-[11px] num tabular font-semibold leading-tight" style={{ color: netFg }}>
                      {isSurplus ? '+' : ''}
                      {Math.abs(cell.net) >= 1_000_000
                        ? `${(cell.net / 1_000_000).toFixed(1)}jt`
                        : `${Math.round(cell.net / 1000)}rb`}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Budget Progress */}
        <div className="s-card p-6 lg:col-span-2">
          <div className="mb-4">
            <p className="caps">{t('dashboard.budget_progress')}</p>
            <h3 className="text-lg font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
              {t('dashboard.expense_categories')}
            </h3>
          </div>
          {budgetProgress.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-center text-sm px-4" style={{ color: 'var(--ink-soft)' }}>
              <span>
                {t('dashboard.no_budget')}.{' '}
                <a href="/dashboard/budgeting" className="inline-flex items-center gap-1 font-medium" style={{ color: 'var(--indigo-600)' }}>
                  {t('dashboard.set_now')} <ArrowRight className="h-3 w-3" />
                </a>
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              {budgetProgress.map((row) => {
                const overBudget = row.pct > 100
                const pctCapped = Math.min(row.pct, 120)
                const barColor = overBudget ? 'var(--danger)' : row.pct > 80 ? 'var(--ink)' : 'var(--lime-400)'
                return (
                  <div key={row.category}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium truncate" style={{ color: 'var(--ink)' }}>{row.category}</span>
                      <span className="num tabular text-[11px] shrink-0 ml-2" style={{ color: overBudget ? 'var(--danger)' : 'var(--ink-muted)' }}>
                        {row.pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-2)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pctCapped}%`, backgroundColor: barColor }} />
                    </div>
                    <div className="text-[10px] mt-0.5 num" style={{ color: 'var(--ink-soft)' }}>
                      {formatCurrency(row.actual)} / {formatCurrency(row.budget)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Charts Row: Top Categories + Day of Week + Saving Ring */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <TopCategoriesBar monthTransactions={monthTransactions} />
        <DayOfWeekChart monthTransactions={monthTransactions} />
        <SavingRateRing savingRate={totals.savingRate} income={totals.income} savings={totals.saving + totals.investment} />
      </div>

      {/* Health Score + Burn Rate + Heatmap */}
      <HealthScorePanel
        monthTransactions={monthTransactions}
        yearTransactions={yearTransactions}
        savingRate={totals.savingRate}
        liquidTotal={liquidTotal}
        debtTotal={debtTotal}
        efCurrent={emergencyFundCurrent}
        efTarget={emergencyFundTarget}
      />

      {/* Spending Heatmap */}
      <SpendingHeatmap yearTransactions={yearTransactions} year={selectedYear} />

      {/* Insights & Alerts */}
      <InsightsPanel
        monthTransactions={monthTransactions}
        yearTransactions={yearTransactions}
        monthBudgets={monthBudgets}
        creditCards={creditCards}
        savingRate={totals.savingRate}
        netCashflow={totals.net}
      />

      {/* Row: Monthly Area Chart + Investment Donut */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="s-card p-6 lg:col-span-3">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="caps">{t('dashboard.cashflow_yearly')}</p>
              <h3 className="text-lg font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
                {t('dashboard.income_vs_expense')}
              </h3>
            </div>
            <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>{selectedYear}</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="g-income" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14B8A6" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#14B8A6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="g-expense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
              <XAxis dataKey="month" fontSize={11} tick={{ fill: 'var(--ink-muted)' }} axisLine={{ stroke: 'var(--border-soft)' }} tickLine={false} />
              <YAxis fontSize={11} tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}jt`} tick={{ fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={formatTooltipValue}
                contentStyle={{
                  backgroundColor: 'var(--black)',
                  border: '1px solid var(--black-line)',
                  borderRadius: '8px',
                  fontSize: 12,
                  color: 'var(--on-black)',
                }}
                labelStyle={{ color: 'var(--on-black-mut)' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="income" name="Pemasukan" stroke="#0D9488" fill="url(#g-income)" strokeWidth={2} />
              <Area type="monotone" dataKey="expense" name="Pengeluaran" stroke="#10B981" fill="url(#g-expense)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="s-card p-6 lg:col-span-2">
          <p className="caps">Portofolio</p>
          <h3 className="text-lg font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
            Alokasi Investasi
          </h3>
          {investmentPieData.length === 0 ? (
            <div className="flex h-[240px] items-center justify-center text-sm" style={{ color: 'var(--ink-soft)' }}>
              Belum ada data investasi.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={investmentPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value" stroke="var(--surface)" strokeWidth={2}>
                    {investmentPieData.map((_, i) => (
                      <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={formatTooltipValue}
                    contentStyle={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border-soft)',
                      borderRadius: '8px',
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {investmentPieData.map((row, i) => {
                  const total = investmentPieData.reduce((s, r) => s + r.value, 0)
                  const pct = total > 0 ? (row.value / total) * 100 : 0
                  return (
                    <div key={row.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2" style={{ color: 'var(--ink-muted)' }}>
                        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length] }} />
                        {row.name}
                      </span>
                      <span className="tabular" style={{ color: 'var(--ink)' }}>{pct.toFixed(1)}%</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  )
}

function KpiCard({
  label, value, note, sparkline,
}: {
  label: string
  value: number
  note?: string
  sparkline?: number[]
}) {
  const t = useT()
  return (
    <div
      className="rounded-xl p-5 relative overflow-hidden"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-soft)',
      }}
    >
      <p className="caps">{label}</p>
      <p
        className="num tabular mt-3 text-2xl leading-tight font-semibold"
        style={{ color: 'var(--ink)' }}
      >
        {formatCurrency(value)}
      </p>
      <p className="text-[11px] mt-1.5" style={{ color: 'var(--ink-soft)' }}>
        {note ?? t('dashboard.current_month')}
      </p>
      {sparkline && sparkline.length > 1 && (
        <div className="mt-3 -mx-1">
          <Sparkline data={sparkline} />
        </div>
      )}
    </div>
  )
}

// Mini sparkline (pure SVG for performance)
function Sparkline({ data }: { data: number[] }) {
  const width = 100
  const height = 24
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const step = width / Math.max(1, data.length - 1)
  const points = data.map((v, i) => {
    const x = i * step
    const y = height - ((v - min) / range) * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const areaPoints = `${points} ${width},${height} 0,${height}`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <polygon points={areaPoints} fill="var(--lime-100)" />
      <polyline points={points} fill="none" stroke="var(--ink)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ─── Top Categories Horizontal Bar ───
function TopCategoriesBar({ monthTransactions }: { monthTransactions: Transaction[] }) {
  const byCat: Record<string, number> = {}
  for (const t of monthTransactions.filter((t) => t.type === 'expense')) {
    byCat[t.category] = (byCat[t.category] || 0) + t.amount
  }
  const sorted = Object.entries(byCat).sort(([, a], [, b]) => b - a).slice(0, 5)
  const max = sorted[0]?.[1] ?? 1

  return (
    <div className="s-card p-5">
      <p className="caps">Paling Boros</p>
      <h3 className="text-base font-semibold mt-0.5">Top 5 Kategori</h3>
      {sorted.length === 0 ? (
        <div className="flex h-[160px] items-center justify-center text-sm" style={{ color: 'var(--ink-soft)' }}>
          Belum ada pengeluaran.
        </div>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {sorted.map(([cat, amt], i) => {
            const pct = (amt / max) * 100
            return (
              <li key={cat}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-2 font-medium">
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold shrink-0"
                      style={{
                        background: i === 0 ? 'var(--ink)' : 'var(--surface-2)',
                        color: i === 0 ? 'var(--lime-400)' : 'var(--ink-muted)',
                      }}
                    >
                      {i + 1}
                    </span>
                    <span className="truncate">{cat}</span>
                  </span>
                  <span className="num tabular text-[11px] shrink-0 ml-2" style={{ color: 'var(--ink)' }}>
                    {formatCurrency(amt)}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: i === 0 ? 'var(--ink)' : 'var(--lime-400)' }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ─── Day-of-Week Spending Pattern ───
function DayOfWeekChart({ monthTransactions }: { monthTransactions: Transaction[] }) {
  const labels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
  const sums = [0, 0, 0, 0, 0, 0, 0]
  const counts = [0, 0, 0, 0, 0, 0, 0]
  for (const t of monthTransactions.filter((t) => t.type === 'expense')) {
    const d = new Date(t.date).getDay()
    sums[d] += t.amount
    counts[d]++
  }
  const averages = sums.map((s, i) => (counts[i] > 0 ? s / counts[i] : 0))
  const max = Math.max(...sums, 1)
  const maxIdx = sums.indexOf(Math.max(...sums))

  return (
    <div className="s-card p-5">
      <p className="caps">Pola Harian</p>
      <h3 className="text-base font-semibold mt-0.5">Pengeluaran per Hari</h3>
      <div className="mt-4 flex items-end justify-between gap-2 h-[140px]">
        {labels.map((lbl, i) => {
          const h = (sums[i] / max) * 100
          const isPeak = i === maxIdx && sums[i] > 0
          return (
            <div key={lbl} className="flex-1 flex flex-col items-center gap-1.5 h-full">
              <div className="flex-1 w-full flex items-end">
                <div
                  className="w-full rounded-t transition-all"
                  style={{
                    height: `${Math.max(h, 2)}%`,
                    background: isPeak ? 'var(--ink)' : 'var(--lime-400)',
                    minHeight: sums[i] > 0 ? 4 : 0,
                  }}
                  title={`${lbl}: ${formatCurrency(sums[i])} total, ${formatCurrency(averages[i])} rata-rata`}
                />
              </div>
              <span className="text-[10px] font-semibold" style={{ color: isPeak ? 'var(--ink)' : 'var(--ink-muted)' }}>
                {lbl}
              </span>
            </div>
          )
        })}
      </div>
      {sums.some((s) => s > 0) && (
        <p className="text-[11px] mt-3 pt-3 border-t" style={{ color: 'var(--ink-soft)', borderColor: 'var(--border-soft)' }}>
          Paling boros: <span className="font-semibold" style={{ color: 'var(--ink)' }}>{labels[maxIdx]}</span> ·{' '}
          <span className="num">{formatCurrency(sums[maxIdx])}</span>
        </p>
      )}
    </div>
  )
}

// ─── Saving Rate Progress Ring ───
function SavingRateRing({
  savingRate, income, savings,
}: {
  savingRate: number
  income: number
  savings: number
}) {
  const rateCapped = Math.min(100, Math.max(0, savingRate))
  const circumference = 2 * Math.PI * 44
  const offset = circumference - (rateCapped / 100) * circumference
  const color = savingRate >= 20 ? 'var(--lime-600)' : savingRate >= 10 ? 'var(--ink)' : 'var(--warning)'
  const verdict = savingRate >= 30 ? 'Excellent'
    : savingRate >= 20 ? 'Sehat'
    : savingRate >= 10 ? 'Cukup'
    : savingRate > 0 ? 'Rendah'
    : 'Negatif'

  return (
    <div className="s-card p-5">
      <p className="caps">Saving Rate</p>
      <h3 className="text-base font-semibold mt-0.5">Tabungan / Pemasukan</h3>
      <div className="mt-4 flex items-center gap-4">
        <div className="relative shrink-0">
          <svg width={110} height={110} viewBox="0 0 110 110">
            <circle
              cx={55} cy={55} r={44}
              fill="none"
              stroke="var(--surface-2)"
              strokeWidth={10}
            />
            <circle
              cx={55} cy={55} r={44}
              fill="none"
              stroke={color}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 55 55)"
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="num text-2xl font-bold tabular" style={{ color }}>
              {savingRate.toFixed(0)}%
            </span>
            <span className="text-[10px] font-semibold" style={{ color: 'var(--ink-muted)' }}>
              {verdict}
            </span>
          </div>
        </div>
        <div className="flex-1 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--ink-muted)' }}>Pemasukan</span>
            <span className="num tabular font-semibold" style={{ color: 'var(--ink)' }}>
              {formatCurrency(income)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--ink-muted)' }}>Ditabung</span>
            <span className="num tabular font-semibold" style={{ color: 'var(--lime-700)' }}>
              {formatCurrency(savings)}
            </span>
          </div>
          <div className="pt-2 border-t text-[10px]" style={{ color: 'var(--ink-soft)', borderColor: 'var(--border-soft)' }}>
            Target sehat: <span className="font-semibold">≥ 20%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Insights & Alerts Panel ───
function InsightsPanel({
  monthTransactions, yearTransactions, monthBudgets, creditCards, savingRate, netCashflow,
}: {
  monthTransactions: Transaction[]
  yearTransactions: Transaction[]
  monthBudgets: Budget[]
  creditCards: CreditCard[]
  savingRate: number
  netCashflow: number
}) {
  const alerts: Array<{ level: 'critical' | 'warn' | 'good'; text: string }> = []
  const today = new Date()

  // Upcoming CC due dates (< 7 days)
  for (const c of creditCards) {
    if (c.current_balance <= 0) continue
    const y = today.getFullYear()
    const m = today.getMonth()
    let due = new Date(y, m, c.due_day)
    if (due < new Date(y, m, today.getDate())) due = new Date(y, m + 1, c.due_day)
    const days = Math.round((due.getTime() - new Date(y, m, today.getDate()).getTime()) / 86_400_000)
    if (days <= 7) {
      alerts.push({
        level: days <= 3 ? 'critical' : 'warn',
        text: `Kartu ${c.name} jatuh tempo ${days} hari lagi · ${formatCurrency(c.current_balance)}`,
      })
    }
  }

  // Budget overrun
  for (const b of monthBudgets) {
    if (b.type !== 'expense' || b.amount <= 0) continue
    const actual = monthTransactions
      .filter((t) => t.type === 'expense' && t.category === b.category)
      .reduce((s, t) => s + t.amount, 0)
    const pct = (actual / b.amount) * 100
    if (pct >= 100) {
      alerts.push({
        level: 'critical',
        text: `Budget ${b.category} over-limit · terpakai ${pct.toFixed(0)}% (${formatCurrency(actual - b.amount)} lewat)`,
      })
    } else if (pct >= 85) {
      alerts.push({
        level: 'warn',
        text: `Budget ${b.category} hampir habis · ${pct.toFixed(0)}% terpakai`,
      })
    }
  }

  // Saving rate reinforcement
  if (savingRate >= 20) {
    alerts.push({
      level: 'good',
      text: `Saving rate kamu ${savingRate.toFixed(1)}% — kategori sehat (>20%). Pertahankan!`,
    })
  } else if (savingRate > 0 && savingRate < 10) {
    alerts.push({
      level: 'warn',
      text: `Saving rate ${savingRate.toFixed(1)}% masih rendah. Target minimum 10%.`,
    })
  }

  // Monthly trend insight
  const prevMonthExp = (() => {
    const y = today.getFullYear()
    const m = today.getMonth() // current
    const prevStart = new Date(y, m - 1, 1).toISOString().split('T')[0]
    const prevEnd   = new Date(y, m, 1).toISOString().split('T')[0]
    return yearTransactions
      .filter((t) => t.type === 'expense' && t.date >= prevStart && t.date < prevEnd)
      .reduce((s, t) => s + t.amount, 0)
  })()
  const currMonthExp = monthTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  if (prevMonthExp > 0 && currMonthExp > 0) {
    const delta = ((currMonthExp - prevMonthExp) / prevMonthExp) * 100
    if (Math.abs(delta) > 15) {
      alerts.push({
        level: delta > 0 ? 'warn' : 'good',
        text: `Pengeluaran bulan ini ${delta > 0 ? 'naik' : 'turun'} ${Math.abs(delta).toFixed(1)}% vs bulan lalu`,
      })
    }
  }

  // Cashflow forecast (very simple: 3-month avg × 3)
  const avg3mo = (() => {
    const y = today.getFullYear()
    const m = today.getMonth()
    let inc = 0, exp = 0, months = 0
    for (let i = 1; i <= 3; i++) {
      const mm = m - i
      const start = new Date(y, mm, 1).toISOString().split('T')[0]
      const end   = new Date(y, mm + 1, 1).toISOString().split('T')[0]
      const txs = yearTransactions.filter((t) => t.date >= start && t.date < end)
      if (txs.length === 0) continue
      inc += txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      exp += txs.filter((t) => t.type !== 'income').reduce((s, t) => s + t.amount, 0)
      months++
    }
    return months > 0 ? { inc: inc / months, exp: exp / months, net: (inc - exp) / months } : null
  })()

  if (alerts.length === 0 && !avg3mo) return null

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Alerts */}
      <div className="s-card p-5 lg:col-span-2">
        <p className="caps">Insights & Alerts</p>
        <h3 className="text-lg font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
          Perlu Perhatian
        </h3>
        {alerts.length === 0 ? (
          <p className="text-sm mt-3" style={{ color: 'var(--ink-muted)' }}>
            Semua terkendali. Keep it up.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {alerts.slice(0, 6).map((a, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-sm rounded-lg p-2.5 border"
                style={{
                  borderColor:
                    a.level === 'critical' ? 'var(--danger)'
                    : a.level === 'warn' ? 'var(--ink)'
                    : 'var(--lime-500)',
                  background:
                    a.level === 'critical' ? 'var(--danger-bg)'
                    : a.level === 'warn' ? 'var(--surface-2)'
                    : 'var(--lime-50)',
                }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full mt-1.5 shrink-0"
                  style={{
                    background:
                      a.level === 'critical' ? 'var(--danger)'
                      : a.level === 'warn' ? 'var(--ink)'
                      : 'var(--lime-500)',
                  }}
                />
                <span style={{ color: 'var(--ink)' }}>{a.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Cashflow forecast 3 bulan */}
      <div className="s-card p-5">
        <p className="caps">Proyeksi 3 Bulan</p>
        <h3 className="text-lg font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
          Forecast Arus Kas
        </h3>
        {avg3mo ? (
          <div className="mt-4 space-y-2 text-sm">
            <Row2 label="Pemasukan /bln" value={avg3mo.inc} />
            <Row2 label="Pengeluaran /bln" value={avg3mo.exp} />
            <div className="pt-2 border-t" style={{ borderColor: 'var(--border-soft)' }}>
              <Row2
                label="Net /bln"
                value={avg3mo.net}
                accent={avg3mo.net >= 0 ? 'var(--lime-700)' : 'var(--danger)'}
                bold
              />
            </div>
            <div className="pt-2 mt-2 border-t text-[11px]" style={{ color: 'var(--ink-soft)', borderColor: 'var(--border-soft)' }}>
              Estimasi saldo bersih 3 bulan ke depan:
              <span className="num font-semibold ml-1" style={{ color: avg3mo.net >= 0 ? 'var(--lime-700)' : 'var(--danger)' }}>
                {formatCurrency(avg3mo.net * 3)}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm mt-3" style={{ color: 'var(--ink-muted)' }}>
            Belum cukup data. Butuh minimal 1 bulan riwayat.
          </p>
        )}
        {/* silence unused variable */}
        <span className="hidden">{netCashflow}</span>
      </div>
    </div>
  )
}

function Row2({ label, value, accent, bold }: { label: string; value: number; accent?: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? 'font-semibold' : ''} style={{ color: 'var(--ink-muted)' }}>{label}</span>
      <span className={`num tabular ${bold ? 'font-semibold' : ''}`} style={{ color: accent ?? 'var(--ink)' }}>
        {formatCurrency(value)}
      </span>
    </div>
  )
}

// ─── Financial Health Score Panel ───
function HealthScorePanel({
  monthTransactions, yearTransactions, savingRate, liquidTotal, debtTotal, efCurrent, efTarget,
}: {
  monthTransactions: Transaction[]
  yearTransactions: Transaction[]
  savingRate: number
  liquidTotal: number
  debtTotal: number
  efCurrent: number
  efTarget: number
}) {
  // Score components
  const monthExpense = monthTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  // 1. Saving rate score (20pts): 0% = 0, 30%+ = 20
  const savingRateScore = Math.min(20, Math.max(0, (savingRate / 30) * 20))

  // 2. Debt ratio score (20pts): debt/liquid — lower is better
  const debtRatio = liquidTotal > 0 ? debtTotal / liquidTotal : 5
  const debtScore = debtRatio <= 0 ? 20 : debtRatio <= 1 ? 20 : debtRatio <= 2 ? 15 : debtRatio <= 4 ? 10 : 5

  // 3. Emergency fund score (20pts): months coverage
  const efMonths = monthExpense > 0 ? efCurrent / monthExpense : 0
  const efScore = efMonths >= 6 ? 20 : efMonths >= 3 ? 15 : efMonths >= 1 ? 10 : 5

  // 4. Net worth growth (20pts): compare this year trend
  const growthScore = (() => {
    // Simple: if more income than expense over year → high
    const inc = yearTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const exp = yearTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    if (inc === 0) return 5
    const ratio = (inc - exp) / inc
    return ratio >= 0.3 ? 20 : ratio >= 0.15 ? 15 : ratio >= 0 ? 10 : 0
  })()

  // 5. Budget adherence (20pts): placeholder based on saving rate positive
  const budgetScore = savingRate > 0 ? 15 : 5

  const total = Math.round(savingRateScore + debtScore + efScore + growthScore + budgetScore)
  const grade = total >= 85 ? 'A' : total >= 70 ? 'B' : total >= 55 ? 'C' : total >= 40 ? 'D' : 'E'
  const gradeColor = total >= 70 ? 'var(--lime-700)' : total >= 55 ? 'var(--warning)' : 'var(--danger)'

  // Burn rate: months of liquid runway at current expense
  const burnMonths = monthExpense > 0 ? liquidTotal / monthExpense : 0

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Score Card */}
      <div className="s-card p-6 lg:col-span-2 relative overflow-hidden">
        <p className="caps">Financial Health</p>
        <div className="mt-2 flex items-end gap-6">
          <div>
            <p className="text-6xl sm:text-7xl font-bold tabular leading-none" style={{ color: gradeColor }}>
              {total}
              <span className="text-2xl align-top" style={{ color: 'var(--ink-soft)' }}>/100</span>
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
              Grade <span className="font-semibold" style={{ color: gradeColor }}>{grade}</span>
              {total >= 85 ? ' — Excellent' : total >= 70 ? ' — Good' : total >= 55 ? ' — Fair' : total >= 40 ? ' — Needs Work' : ' — Critical'}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-5 gap-2">
          {[
            { label: 'Saving Rate', v: savingRateScore, max: 20 },
            { label: 'Debt Ratio', v: debtScore, max: 20 },
            { label: 'Emergency', v: efScore, max: 20 },
            { label: 'Growth', v: growthScore, max: 20 },
            { label: 'Budget', v: budgetScore, max: 20 },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="h-12 rounded-sm flex items-end overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                <div
                  className="w-full"
                  style={{
                    height: `${(s.v / s.max) * 100}%`,
                    background: s.v >= s.max * 0.7 ? 'var(--lime-400)' : s.v >= s.max * 0.4 ? 'var(--ink)' : 'var(--danger)',
                  }}
                />
              </div>
              <p className="text-[10px] mt-1.5 font-semibold" style={{ color: 'var(--ink-muted)' }}>{s.label}</p>
              <p className="num text-[10px]" style={{ color: 'var(--ink-soft)' }}>{Math.round(s.v)}/{s.max}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Burn Rate */}
      <div className="s-card p-6">
        <p className="caps">Burn Rate</p>
        <h3 className="text-lg font-semibold mt-0.5">Runway</h3>
        <div className="mt-3">
          <p className="num tabular text-4xl font-semibold" style={{ color: burnMonths >= 6 ? 'var(--lime-700)' : burnMonths >= 3 ? 'var(--warning)' : 'var(--danger)' }}>
            {burnMonths.toFixed(1)}
            <span className="text-sm ml-1" style={{ color: 'var(--ink-soft)' }}>bulan</span>
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--ink-muted)' }}>
            Tanpa pemasukan baru, liquid cash <span className="num font-semibold">{formatCurrency(liquidTotal)}</span> bisa cover pengeluaran <span className="num font-semibold">{formatCurrency(monthExpense)}</span>/bulan.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Spending Heatmap ───
function SpendingHeatmap({ yearTransactions, year }: { yearTransactions: Transaction[]; year: number }) {
  // Build daily expense map
  const expMap = new Map<string, number>()
  let maxExp = 0
  for (const t of yearTransactions) {
    if (t.type !== 'expense') continue
    const prev = expMap.get(t.date) ?? 0
    const next = prev + t.amount
    expMap.set(t.date, next)
    if (next > maxExp) maxExp = next
  }

  // Generate cells for each day of year
  const isLeap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInYear = isLeap ? 366 : 365
  const firstDayDow = new Date(year, 0, 1).getDay() // 0=Sun, 6=Sat

  // Pre-pad so weeks align (rows=days of week)
  const cells: Array<{ date: string; exp: number } | null> = Array(firstDayDow).fill(null)
  for (let i = 0; i < daysInYear; i++) {
    const d = new Date(year, 0, 1)
    d.setDate(d.getDate() + i)
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    cells.push({ date: ds, exp: expMap.get(ds) ?? 0 })
  }

  function intensity(exp: number): string {
    if (exp === 0) return 'var(--surface-2)'
    const r = exp / maxExp
    if (r < 0.2) return 'var(--lime-100)'
    if (r < 0.4) return 'var(--lime-200)'
    if (r < 0.6) return 'var(--lime-300)'
    if (r < 0.8) return 'var(--lime-400)'
    return 'var(--lime-600)'
  }

  // Group into weeks (columns of 7)
  const weeks: typeof cells[] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  return (
    <div className="s-card p-5">
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="caps">Spending Heatmap</p>
          <h3 className="text-lg font-semibold mt-0.5">Pola Pengeluaran Harian {year}</h3>
        </div>
        <div className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
          <span>Less</span>
          {['var(--surface-2)', 'var(--lime-100)', 'var(--lime-200)', 'var(--lime-300)', 'var(--lime-400)', 'var(--lime-600)'].map((c, i) => (
            <span key={i} className="h-3 w-3 rounded-sm" style={{ background: c }} />
          ))}
          <span>More</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-[3px]" style={{ minWidth: 'max-content' }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {Array.from({ length: 7 }, (_, di) => {
                const cell = week[di]
                if (!cell) return <div key={di} className="h-3 w-3" />
                return (
                  <div
                    key={di}
                    className="h-3 w-3 rounded-sm"
                    style={{ background: intensity(cell.exp) }}
                    title={
                      cell.exp === 0
                        ? `${cell.date}: no spending`
                        : `${cell.date}: ${formatCurrency(cell.exp)}`
                    }
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
