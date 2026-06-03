'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatCompactCurrency, getMonthName } from '@/lib/utils'
import { MONTHS } from '@/lib/constants'
import { fetchLiquidEntries, sumLiquid } from '@/lib/liquid'
import { useT } from '@/lib/i18n/context'
import { GettingStarted } from '@/components/dashboard/getting-started'
import { DashboardCustomizer } from '@/components/dashboard/dashboard-customizer'
import { AIInsightsCard } from '@/components/dashboard/ai-insights'
import { FinancialHealthCard } from '@/components/dashboard/financial-health-card'
import { CashFlowForecast } from '@/components/dashboard/cashflow-forecast'
import { MonthChangeStrip } from '@/components/dashboard/month-change-strip'
import { TodayStrip } from '@/components/dashboard/today-strip'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { TopCategoriesBar } from '@/components/dashboard/top-categories-bar'
import { DayOfWeekChart } from '@/components/dashboard/day-of-week-chart'
import { SavingRateRing } from '@/components/dashboard/saving-rate-ring'
import { UpcomingBills } from '@/components/dashboard/upcoming-bills'
import { RecentTransactions } from '@/components/dashboard/recent-transactions'
import { GoalsWidget } from '@/components/dashboard/goals-widget'
import { InsightsPanel } from '@/components/dashboard/insights-panel'
import { NetWorthHero } from '@/components/dashboard/net-worth-hero'
import { computeFinancialHealth } from '@/lib/financial-health'
import { MoneyFlowSankey, type FlowKind } from '@/components/dashboard/money-flow-sankey'
import { StockLogo } from '@/components/investment/stock-logo'
import { CryptoLogo } from '@/components/investment/crypto-logo'
import type { Transaction, Investment, CreditCard, Contract } from '@/types'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, ArrowRight, TrendingUp } from 'lucide-react'
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

// Chart palette per design handoff tokens.css — emerald led, then sky,
// amber, coral, violet for categorical variety. Replaces the older
// "lime + orange + black" palette which clashed with the new design tokens.
const CHART_PALETTE = [
  '#10B981', // emerald-500 — main / income
  '#0EA5E9', // sky-500 — investment / info
  '#F59E0B', // amber-500 — savings
  '#F43F5E', // coral-500 — debt / expense
  '#8B5CF6', // violet-500 — other
  '#34D399', // emerald-400 — secondary green
  '#7DD3FC', // sky-300 — secondary blue
  '#FCD34D', // amber-300 — secondary yellow
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
  const [contracts, setContracts] = useState<Contract[]>([])
  const [liquidTotal, setLiquidTotal] = useState(0)
  const [nonLiquidTotal, setNonLiquidTotal] = useState(0)
  const [debtTotal, setDebtTotal] = useState(0)
  const [activeGoals, setActiveGoals] = useState<Array<{
    id: string; name: string; target_amount: number; current_amount: number; deadline: string | null
  }>>([])
  const [activeDebts, setActiveDebts] = useState<Array<{
    id: string; name: string; remaining: number; due_date: string | null; monthly_payment: number
  }>>([])
  const [recurringItems, setRecurringItems] = useState<Array<{
    id: string; name: string; type: string; amount: number; frequency: string; day_of_period: number
  }>>([])
  const [userFirstName, setUserFirstName] = useState<string>('')

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth])

  async function fetchData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // Capture first name for greeting per mockup ("Pagi, Bashid 👋")
    const fullName = (user.user_metadata?.full_name as string | undefined)
      || user.email?.split('@')[0]
      || ''
    setUserFirstName(fullName.split(' ')[0])

    const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
    const endMonth = selectedMonth === 12 ? 1 : selectedMonth + 1
    const endYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

    const [yearRes, invRes, budgetRes, ccRes, liquidEntries, debtRes, ctrRes, nlqRes, goalsRes, recurRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', `${selectedYear}-01-01`)
        .lt('date', `${selectedYear + 1}-01-01`)
        .order('date', { ascending: false }),
      supabase
        .from('investments')
        .select('category, total_value, name, platform, ticker, quantity, avg_cost, current_price')
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
      fetchLiquidEntries(supabase, user.id),
      supabase
        .from('debts')
        .select('id, name, remaining, due_date, monthly_payment')
        .eq('user_id', user.id)
        .eq('is_active', true),
      supabase
        .from('contracts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .order('end_date', { ascending: true }),
      supabase
        .from('assets_non_liquid')
        .select('current_value')
        .eq('user_id', user.id),
      supabase
        .from('goals')
        .select('id, name, target_amount, current_amount, deadline')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('deadline', { ascending: true, nullsFirst: false })
        .limit(3),
      supabase
        .from('recurring_transactions')
        .select('id, name, type, amount, frequency, day_of_period')
        .eq('user_id', user.id)
        .eq('is_active', true),
    ])
    setLiquidTotal(sumLiquid(liquidEntries))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setNonLiquidTotal(((nlqRes.data ?? []) as any[]).reduce((s, a) => s + (a.current_value ?? 0), 0))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setActiveGoals((goalsRes.data ?? []) as any[])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const debtRows = (debtRes.data ?? []) as any[]
    setDebtTotal(debtRows.reduce((s, d) => s + (d.remaining ?? 0), 0))
    setActiveDebts(debtRows)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setRecurringItems((recurRes.data ?? []) as any[])

    const yearTxs = (yearRes.data ?? []) as Transaction[]
    setYearTransactions(yearTxs)
    setMonthTransactions(yearTxs.filter((tx) => tx.date >= startDate && tx.date < endDate))
    setInvestments((invRes.data ?? []) as Investment[])
    setMonthBudgets((budgetRes.data ?? []) as Budget[])
    setCreditCards((ccRes.data ?? []) as CreditCard[])
    setContracts((ctrRes.data ?? []) as Contract[])
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

  // ---- Financial Health Score ----
  // Uses 90-day rolling avg from yearTransactions (more stable than current
  // month — the latter can be partial / atypical). Falls back to current
  // month if year data is sparse.
  const fhsResult = useMemo(() => {
    // Compute 90-day window avg from yearTransactions
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const cutoff = ninetyDaysAgo.toISOString().slice(0, 10)
    const recent = yearTransactions.filter((t) => t.date >= cutoff)
    const recentIncome = recent.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const recentExpense = recent.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const recentSaved = recent
      .filter((t) => t.type === 'saving' || t.type === 'investment')
      .reduce((s, t) => s + t.amount, 0)

    // If we don't have ≥30 days of data, use current month directly to avoid
    // dividing by 3 on a single month and getting fake-low monthly averages.
    const hasEnoughHistory = recent.length >= 5
    const monthlyIncome = hasEnoughHistory ? recentIncome / 3 : totals.income
    const monthlyExpense = hasEnoughHistory ? recentExpense / 3 : totals.expense
    const monthlySaved = hasEnoughHistory ? recentSaved / 3 : (totals.saving + totals.investment)

    // Debt aggregates — credit cards + active debts
    const ccBalance = creditCards.reduce((s, c) => s + (c.current_balance || 0), 0)
    const ccMinPayments = creditCards.reduce(
      (s, c) => s + Math.max(((c.current_balance || 0) * 0.05), 0),  // assume ~5% min payment
      0,
    )
    const debtRemaining = activeDebts.reduce((s, d) => s + (d.remaining || 0), 0)
    const debtMonthly = activeDebts.reduce((s, d) => s + (d.monthly_payment || 0), 0)
    // Overdue heuristic: any credit card > 90% utilization
    const hasOverdueDebt = creditCards.some((c) => {
      if (!c.credit_limit || c.credit_limit <= 0) return false
      return (c.current_balance || 0) / c.credit_limit > 0.9
    })

    // Insurance count from contracts (active = not archived)
    const insuranceCount = contracts.filter((c) => c.category === 'insurance').length

    // Investment value
    const investmentValue = investments.reduce((s, i) => s + (i.total_value || 0), 0)

    const fhs = computeFinancialHealth({
      monthlyIncome,
      monthlyExpense,
      monthlySaved,
      liquidBalance: liquidTotal,
      investmentValue,
      totalDebt: ccBalance + debtRemaining,
      monthlyDebtPayments: ccMinPayments + debtMonthly,
      hasOverdueDebt,
      insuranceCount,
      activeGoals: activeGoals.map((g) => ({
        current: g.current_amount,
        target: g.target_amount,
        deadline: g.deadline,
      })),
      // userAge: not tracked yet — calculator falls back to mid-career default
    })
    // Expose pengeluaran 90-hari (avg) ke kartu — Cash Coverage konsisten sama
    // skor FHS, gak reset ke 0 pas bulan berjalan masih kosong.
    return { ...fhs, _monthlyExpense: monthlyExpense }
  }, [yearTransactions, totals, creditCards, activeDebts, contracts, investments, liquidTotal, activeGoals])

  // ---- Money Flow Sankey data ----
  // Aggregate by category for each kind. We cap to top 8 per side so the
  // diagram stays legible — anything beyond gets bucketed into "Lainnya".
  const sankeyData = useMemo(() => {
    function bucket(kind: 'income' | 'expense' | 'saving' | 'investment') {
      const byCat: Record<string, number> = {}
      for (const t of monthTransactions) {
        if (t.type !== kind) continue
        const cat = (t.category || 'Lainnya').trim() || 'Lainnya'
        byCat[cat] = (byCat[cat] || 0) + t.amount
      }
      const sorted = Object.entries(byCat)
        .map(([name, amount]) => ({ name, amount, kind: kind as FlowKind }))
        .sort((a, b) => b.amount - a.amount)
      const top = sorted.slice(0, 8)
      const rest = sorted.slice(8)
      if (rest.length > 0) {
        const restSum = rest.reduce((s, c) => s + c.amount, 0)
        if (restSum > 0) top.push({ name: `+${rest.length} lainnya`, amount: restSum, kind })
      }
      return top
    }

    const income = bucket('income')
    const expense = bucket('expense')
    const saving = bucket('saving')
    const investment = bucket('investment')
    return { income, outflow: [...expense, ...saving, ...investment] }
  }, [monthTransactions])

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

  // ---- Investment portfolio metrics: total value, top holdings, P/L,
  //      and concentration risk. Used by the upgraded composition card.
  const investmentSummary = useMemo(() => {
    const totalValue = investments.reduce((s, i) => s + (i.total_value || 0), 0)
    const totalCost = investments.reduce(
      (s, i) => s + (i.quantity || 0) * (i.avg_cost || 0),
      0,
    )
    const unrealizedPL = totalValue - totalCost
    const unrealizedPct = totalCost > 0 ? (unrealizedPL / totalCost) * 100 : 0

    const enriched = investments
      .filter((i) => (i.total_value || 0) > 0)
      .map((i) => ({
        id: i.id,
        name: i.name || INVESTMENT_CATEGORY_LABELS[i.category] || i.category,
        platform: i.platform || '',
        ticker: i.ticker ?? null,
        category: i.category,
        value: i.total_value || 0,
        cost: (i.quantity || 0) * (i.avg_cost || 0),
        pl: (i.total_value || 0) - (i.quantity || 0) * (i.avg_cost || 0),
      }))
      .sort((a, b) => b.value - a.value)

    const topHoldings = enriched.slice(0, 4)
    const topPct = totalValue > 0 ? (topHoldings[0]?.value ?? 0) / totalValue * 100 : 0
    // Concentration risk threshold: top holding > 40% is "tinggi"
    const risk: 'rendah' | 'sedang' | 'tinggi' =
      topPct > 40 ? 'tinggi' : topPct > 25 ? 'sedang' : 'rendah'

    return { totalValue, totalCost, unrealizedPL, unrealizedPct, topHoldings, topPct, risk, count: enriched.length }
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

  // Prior-3-months transactions for the "Apa yang berubah" strip. Slices
  // yearTransactions to months [selectedMonth-3, selectedMonth-1] within
  // selectedYear. If the window dips below January, we lose those months
  // (the strip itself hides when there's too little prior data).
  const priorMonthsTx = useMemo(() => {
    const out: Transaction[] = []
    for (const t of yearTransactions) {
      const d = new Date(t.date)
      const m = d.getMonth() + 1
      const y = d.getFullYear()
      if (y !== selectedYear) continue
      if (m < selectedMonth - 3 || m > selectedMonth - 1) continue
      out.push(t)
    }
    return out
  }, [yearTransactions, selectedYear, selectedMonth])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--c-mint)' }} />
        <span className="ml-3 text-sm" style={{ color: 'var(--ink-muted)' }}>
          Memuat dashboard...
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Greeting + tombol Atur Dashboard (custom show/hide section) */}
      <div className="flex items-center justify-between gap-3">
        {userFirstName ? (
          <h1 className="t-h1" style={{ color: 'var(--ink)' }}>Hi, {userFirstName}</h1>
        ) : (
          <span />
        )}
        <DashboardCustomizer />
      </div>

      {/* Hero — Net Worth + period-filtered growth chart */}
      <NetWorthHero
        liquidTotal={liquidTotal}
        nonLiquidTotal={nonLiquidTotal}
        investmentsTotal={investments.reduce((s, i) => s + (i.total_value || 0), 0)}
        debtTotal={debtTotal}
        monthlyTrend={monthlyData}
      />

      {/* "Hari ini" — today's quick stats + budget warning. Self-hides
          if no transactions yet today. Sits above month-change strip because
          it's higher salience: actionable about NOW, not retrospective. */}
      <TodayStrip
        monthTransactions={monthTransactions}
        monthBudgets={monthBudgets}
      />

      {/* "Apa yang berubah" — month vs 3-month-avg change strip. Self-hides
          if there's no meaningful diff or not enough prior data. */}
      <MonthChangeStrip
        currentMonthTx={monthTransactions}
        priorMonthsTx={priorMonthsTx}
        priorMonthCount={3}
      />

      {/* Financial Health Score — 3-column inline layout: score + bars + burn
          rate. All visible without click. Burn rate (cash coverage in months)
          sits next to score because it's the most actionable safety metric. */}
      <FinancialHealthCard
        result={fhsResult}
        liquidBalance={liquidTotal}
        monthlyExpense={fhsResult._monthlyExpense}
      />

      {/* Cash-flow forecast — compact reminder of upcoming events.
          Less of a hero, more of a "heads-up" bar. */}
      <CashFlowForecast
        liquidBalance={liquidTotal}
        recurringItems={recurringItems}
        contracts={contracts}
      />

      {/* Onboarding mission card — auto-hides when user completes setup */}
      <GettingStarted />

      {/* Period selector for the monthly widgets below (KPI cards, AI insights,
          cashflow chart, sankey, recent tx, etc all read selectedMonth/Year).
          Removed from the hero per mockup; lives here as a compact pill row. */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="eyebrow">Periode</p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
            {currentMonthYear}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={String(selectedMonth)} onValueChange={(v) => { if (v) setSelectedMonth(Number(v)) }}>
            <SelectTrigger className="w-[130px] h-9 text-sm">
              <SelectValue placeholder="Bulan">{(v) => MONTHS[Number(v) - 1] ?? v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => { if (v) setSelectedYear(Number(v)) }}>
            <SelectTrigger className="w-[100px] h-9 text-sm">
              <SelectValue placeholder="Tahun">{(v) => v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards — color-tinted by kind for visual variety */}
      <div data-block="kpi" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label={t('dashboard.kpi_income')}  value={totals.income}  direction="up"   kind="income" />
        <KpiCard label={t('dashboard.kpi_expense')} value={totals.expense} direction="down" kind="expense" />
        <KpiCard
          label={t('dashboard.kpi_saving_investment')}
          value={totals.saving + totals.investment}
          note={`${t('dashboard.saving_rate')} ${totals.savingRate.toFixed(1)}%`}
          direction="up"
          kind="saving"
        />
        <KpiCard label={t('dashboard.kpi_net_cashflow')} value={totals.net} direction={totals.net >= 0 ? 'up' : 'down'} kind="net" />
      </div>

      {/* Phase 2.3 — AI-generated personalized insights */}
      <div data-block="ai-insights">
        <AIInsightsCard
          monthTransactions={monthTransactions}
          yearTransactions={yearTransactions}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          goals={activeGoals}
        />
      </div>

      {/* Phase 9 — Money Flow Sankey: Pemasukan ↔ Penggunaan (bipartite) */}
      <div data-block="aliran" className="s-card p-4 sm:p-6">
        <div className="mb-3 sm:mb-4 flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="eyebrow">Aliran Uang</p>
            <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--ink-soft)' }}>
              Dari mana datangnya, ke mana perginya — bulan ini
            </p>
          </div>
          {/* Legend — wraps on narrow screens */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-[11px]" style={{ color: 'var(--ink-soft)' }}>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: '#10B981' }} />
              Pemasukan
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: '#F43F5E' }} />
              Pengeluaran
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: '#F59E0B' }} />
              Tabungan
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: '#0EA5E9' }} />
              Investasi
            </span>
          </div>
        </div>

        {/* Two renders so we can tune layout per breakpoint without media queries
            inside the chart itself. Tailwind hides the inactive one. */}
        <div className="hidden md:block">
          <MoneyFlowSankey
            income={sankeyData.income}
            outflow={sankeyData.outflow}
            height={Math.max(360, Math.min(480, 90 + Math.max(sankeyData.income.length, sankeyData.outflow.length) * 36))}
            emptyMessage="Belum ada transaksi bulan ini — input dulu transaksi pertamamu."
          />
        </div>
        <div className="md:hidden">
          <MoneyFlowSankey
            income={sankeyData.income}
            outflow={sankeyData.outflow}
            compact
            height={Math.max(300, Math.min(420, 60 + Math.max(sankeyData.income.length, sankeyData.outflow.length) * 30))}
            emptyMessage="Belum ada transaksi bulan ini — input dulu transaksi pertamamu."
          />
        </div>
      </div>

      {/* Phase 2.1 + 3.1 — Recent Transactions + Upcoming Bills + Goals row */}
      <div data-block="aktivitas" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RecentTransactions transactions={monthTransactions} />
        <UpcomingBills
          contracts={contracts}
          debts={activeDebts}
          creditCards={creditCards}
          recurring={recurringItems}
        />
        <GoalsWidget goals={activeGoals} />
      </div>

      {/* Calendar + Budget Progress */}
      <div data-block="kalender" className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Transactions calendar — 7-col month grid, colored by net activity */}
        <div className="s-card p-5 sm:p-6 lg:col-span-3">
          <div className="mb-4 flex items-end justify-between flex-wrap gap-3">
            <div>
              <p className="eyebrow">Aktivitas Bulan Ini</p>
              <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>
                {MONTHS[selectedMonth - 1]} {selectedYear}
              </h3>
            </div>
            <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--ink-soft)' }}>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded" style={{ background: '#10B981' }} />
                Pemasukan
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded" style={{ background: '#F43F5E' }} />
                Pengeluaran
              </span>
            </div>
          </div>

          {(() => {
            const today = new Date()
            const isCurrentMonth =
              today.getFullYear() === selectedYear &&
              today.getMonth() + 1 === selectedMonth
            const todayDay = today.getDate()
            const days = calendarData
            // Determine intensity scaling — pick largest absolute movement
            const allAmounts = days
              .filter((c) => c.day !== null)
              .map((c) => Math.max(c.income, c.expense))
            const maxAmt = Math.max(...allAmounts, 1)
            const dayLabels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

            return (
              <>
                {/* Day-of-week header */}
                <div className="grid grid-cols-7 gap-1 mb-1.5">
                  {dayLabels.map((d) => (
                    <div
                      key={d}
                      className="text-center text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--ink-soft)' }}
                    >
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar grid — each cell shows day number + net amount.
                    On mobile, cells are ~45px wide so we use a TIGHT format
                    (no "Rp" prefix, e.g. "+12,5jt" / "−500rb") and a tiny
                    font so amounts fit inside. */}
                <div className="grid grid-cols-7 gap-1">
                  {days.map((d, i) => {
                    if (d.day === null) return <div key={`pad-${i}`} className="aspect-square min-h-[56px]" />
                    const isToday = isCurrentMonth && d.day === todayDay
                    const hasIncome = d.income > 0
                    const hasExpense = d.expense > 0
                    const net = d.income - d.expense
                    const intensity = Math.max(hasIncome ? d.income / maxAmt : 0, hasExpense ? d.expense / maxAmt : 0)
                    const isPositive = net > 0
                    const isNegative = net < 0
                    const bg =
                      isPositive
                        ? `rgba(16, 185, 129, ${Math.max(0.10, intensity * 0.45)})`
                        : isNegative
                          ? `rgba(239, 68, 68, ${Math.max(0.10, intensity * 0.45)})`
                          : 'transparent'

                    const tooltipParts: string[] = [`Tgl ${d.day}`]
                    if (hasIncome) tooltipParts.push(`+${formatCurrency(d.income)}`)
                    if (hasExpense) tooltipParts.push(`-${formatCurrency(d.expense)}`)
                    if (d.count > 0) tooltipParts.push(`${d.count} transaksi`)

                    // Tiny "Rp"-less format optimized for narrow cells:
                    //   12,500,000 → "12,5jt"  ·  500,000 → "500rb"
                    function tight(n: number) {
                      const abs = Math.abs(n)
                      if (abs >= 1_000_000_000) return `${(abs / 1_000_000_000).toFixed(1)}M`
                      if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace('.', ',')}jt`
                      if (abs >= 1_000) return `${Math.round(abs / 1_000)}rb`
                      return `${abs}`
                    }

                    return (
                      <div
                        key={d.day}
                        className="aspect-square min-h-[56px] rounded-md relative flex flex-col items-start justify-between p-1 sm:p-1.5 transition hover:scale-[1.04] hover:z-10 cursor-default overflow-hidden"
                        style={{
                          background: bg || 'var(--surface-2)',
                          border: isToday ? '2px solid var(--c-mint)' : '1px solid var(--border-soft)',
                        }}
                        title={tooltipParts.join(' · ')}
                      >
                        <span
                          className="text-[10px] font-semibold leading-none"
                          style={{ color: 'var(--ink)' }}
                        >
                          {d.day}
                        </span>

                        {(hasIncome || hasExpense) && (
                          <div className="w-full text-right leading-none">
                            {hasIncome && hasExpense ? (
                              <>
                                <p className="num tabular text-[8px] sm:text-[9px] font-semibold" style={{ color: '#10B981' }}>
                                  +{tight(d.income)}
                                </p>
                                <p className="num tabular text-[8px] sm:text-[9px] font-semibold mt-0.5" style={{ color: '#F43F5E' }}>
                                  −{tight(d.expense)}
                                </p>
                              </>
                            ) : (
                              <p
                                className="num tabular text-[9px] sm:text-[11px] font-semibold"
                                style={{ color: hasIncome ? '#10B981' : '#F43F5E' }}
                              >
                                {hasIncome ? '+' : '−'}
                                {tight(hasIncome ? d.income : d.expense)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )
          })()}
        </div>

        {/* Budget Progress */}
        <div className="s-card p-6 lg:col-span-2">
          <div className="mb-4">
            <p className="eyebrow">{t('dashboard.budget_progress')}</p>
            <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>
              {t('dashboard.expense_categories')}
            </h3>
          </div>
          {budgetProgress.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-center text-sm px-4" style={{ color: 'var(--ink-soft)' }}>
              <span>
                {t('dashboard.no_budget')}.{' '}
                <a href="/dashboard/budgeting" className="inline-flex items-center gap-1 font-medium" style={{ color: 'var(--c-mint)' }}>
                  {t('dashboard.set_now')} <ArrowRight className="h-3 w-3" />
                </a>
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              {budgetProgress.map((row) => {
                const overBudget = row.pct > 100
                const pctCapped = Math.min(row.pct, 120)
                const barColor = overBudget ? 'var(--danger)' : row.pct > 80 ? 'var(--ink)' : 'var(--c-mint)'
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
      <div data-block="grafik" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <TopCategoriesBar monthTransactions={monthTransactions} />
        <DayOfWeekChart monthTransactions={monthTransactions} />
        <SavingRateRing savingRate={totals.savingRate} income={totals.income} savings={totals.saving + totals.investment} />
      </div>

      {/* Insights & Alerts */}
      <div data-block="insights">
        <InsightsPanel
          monthTransactions={monthTransactions}
          yearTransactions={yearTransactions}
          monthBudgets={monthBudgets}
          creditCards={creditCards}
          contracts={contracts}
          savingRate={totals.savingRate}
          netCashflow={totals.net}
        />
      </div>

      {/* Row: Monthly Bar Chart (income vs expense) + Investment Donut.
          Per dashboard-refine.jsx — twin bars per month (emerald + coral)
          show clearer comparison than overlapping area chart. */}
      <div data-block="investasi" className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="s-card p-6 lg:col-span-3">
          <div className="mb-4 flex items-end justify-between flex-wrap gap-3">
            <div>
              <p className="eyebrow">{t('dashboard.cashflow_yearly')}</p>
              <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>
                {t('dashboard.income_vs_expense')}
              </h3>
            </div>
            {/* Surplus/Deficit chip per mockup line 168 */}
            {(() => {
              const yearIncome = monthlyData.reduce((s, m) => s + m.income, 0)
              const yearExpense = monthlyData.reduce((s, m) => s + m.expense, 0)
              const yearNet = yearIncome - yearExpense
              const isSurplus = yearNet >= 0
              return (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    background: isSurplus ? 'var(--c-mint-soft)' : 'var(--coral-50)',
                    color: isSurplus ? 'var(--c-mint)' : 'var(--c-coral)',
                  }}
                >
                  {isSurplus ? 'Surplus' : 'Defisit'} {formatCompactCurrency(Math.abs(yearNet))}
                </span>
              )
            })()}
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyData} barGap={4} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
              <XAxis
                dataKey="month"
                fontSize={11}
                tick={{ fill: 'var(--ink-muted)' }}
                axisLine={{ stroke: 'var(--border-soft)' }}
                tickLine={false}
              />
              <YAxis
                fontSize={11}
                tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}jt`}
                tick={{ fill: 'var(--ink-muted)' }}
                axisLine={false}
                tickLine={false}
              />
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
                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
              {/* Emerald + coral matching mockup palette (line 181-182) */}
              <Bar dataKey="income" name="Pemasukan" fill="#10B981" radius={[3, 3, 0, 0]} maxBarSize={24} />
              <Bar dataKey="expense" name="Pengeluaran" fill="#F43F5E" radius={[3, 3, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="s-card p-5 sm:p-6 lg:col-span-2 flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Portofolio</p>
              <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>
                Alokasi Investasi
              </h3>
            </div>
            <Link
              href="/dashboard/assets/investment"
              className="text-[11px] font-medium inline-flex items-center gap-0.5 hover:underline"
              style={{ color: 'var(--c-mint)' }}
            >
              Detail <ArrowRight className="size-3" />
            </Link>
          </div>

          {investmentPieData.length === 0 ? (
            <div className="flex flex-1 min-h-[240px] flex-col items-center justify-center text-center px-6">
              <div className="size-14 rounded-2xl flex items-center justify-center mb-3"
                style={{ background: 'rgba(14, 165, 233, 0.12)' }}>
                <TrendingUp className="size-7" style={{ color: '#0EA5E9' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                Belum ada investasi
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>
                Mulai catat saham, reksa dana, crypto, atau emas yang kamu pegang.
              </p>
              <Link
                href="/dashboard/assets/investment"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition"
                style={{
                  background: 'var(--c-primary)',
                  color: 'var(--c-primary-foreground)',
                }}
              >
                Tambah investasi <ArrowRight className="size-3" />
              </Link>
            </div>
          ) : (
            <>
              {/* Total + P/L hero */}
              <div className="mt-3 flex items-end gap-3 flex-wrap">
                <div>
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                    Total Nilai
                  </p>
                  <p className="num tabular text-2xl font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
                    {formatCurrency(investmentSummary.totalValue)}
                  </p>
                </div>
                {investmentSummary.totalCost > 0 && (
                  <div className="ml-auto text-right">
                    <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                      Untung / Rugi
                    </p>
                    <p
                      className="num tabular text-sm font-semibold mt-0.5"
                      style={{
                        color: investmentSummary.unrealizedPL >= 0
                          ? '#10B981'
                          : '#F43F5E',
                      }}
                    >
                      {investmentSummary.unrealizedPL >= 0 ? '+' : ''}
                      {formatCurrency(investmentSummary.unrealizedPL)}
                      <span className="text-[10px] ml-1 opacity-70">
                        ({investmentSummary.unrealizedPct >= 0 ? '+' : ''}
                        {investmentSummary.unrealizedPct.toFixed(2)}%)
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {/* Compact donut + category legend side-by-side */}
              <div className="mt-3 flex items-center gap-3">
                <div className="shrink-0">
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie data={investmentPieData} cx="50%" cy="50%" innerRadius={36} outerRadius={56} paddingAngle={2} dataKey="value" stroke="var(--surface)" strokeWidth={2}>
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
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  {investmentPieData.slice(0, 5).map((row, i) => {
                    const total = investmentPieData.reduce((s, r) => s + r.value, 0)
                    const pct = total > 0 ? (row.value / total) * 100 : 0
                    return (
                      <div key={row.name} className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1.5 truncate" style={{ color: 'var(--ink-muted)' }}>
                          <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length] }} />
                          <span className="truncate">{row.name}</span>
                        </span>
                        <span className="tabular shrink-0 ml-2" style={{ color: 'var(--ink)' }}>{pct.toFixed(1)}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Top holdings list */}
              {investmentSummary.topHoldings.length > 0 && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-soft)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--ink-soft)' }}>
                      Top Holding
                    </p>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background:
                          investmentSummary.risk === 'tinggi' ? 'rgba(239,68,68,0.12)'
                          : investmentSummary.risk === 'sedang' ? 'rgba(245,158,11,0.14)'
                          : 'rgba(16,185,129,0.12)',
                        color:
                          investmentSummary.risk === 'tinggi' ? '#991B1B'
                          : investmentSummary.risk === 'sedang' ? '#92400E'
                          : '#065F46',
                      }}
                      title={`Top holding = ${investmentSummary.topPct.toFixed(0)}% dari total. >40% = risiko konsentrasi tinggi.`}
                    >
                      Konsentrasi {investmentSummary.risk}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {investmentSummary.topHoldings.map((h, i) => {
                      const pct = investmentSummary.totalValue > 0 ? (h.value / investmentSummary.totalValue) * 100 : 0
                      const plPct = h.cost > 0 ? (h.pl / h.cost) * 100 : 0
                      const isStock = h.category === 'stock'
                      return (
                        <div key={h.id}>
                          <div className="flex items-center justify-between gap-2 text-[12px]">
                            <span className="truncate flex items-center gap-1.5 min-w-0">
                              {isStock ? (
                                <StockLogo ticker={h.ticker} size={28} />
                              ) : h.category === 'crypto' ? (
                                <CryptoLogo symbol={h.ticker} size={28} />
                              ) : (
                                <span className="text-[10px] tabular shrink-0" style={{ color: 'var(--ink-soft)' }}>
                                  #{i + 1}
                                </span>
                              )}
                              <span className="font-medium truncate" style={{ color: 'var(--ink)' }} title={h.name}>
                                {h.name}
                              </span>
                            </span>
                            <span className="num tabular shrink-0" style={{ color: 'var(--ink)' }}>
                              {formatCurrency(h.value)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  background: CHART_PALETTE[i % CHART_PALETTE.length],
                                }}
                              />
                            </div>
                            <span className="text-[10px] tabular shrink-0" style={{ color: 'var(--ink-soft)' }}>
                              {pct.toFixed(0)}%
                            </span>
                            {h.cost > 0 && (
                              <span
                                className="text-[10px] tabular shrink-0 font-medium"
                                style={{ color: h.pl >= 0 ? '#10B981' : '#F43F5E' }}
                              >
                                {h.pl >= 0 ? '+' : ''}{plPct.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {investmentSummary.count > 4 && (
                    <p className="text-[10px] mt-2.5 text-center" style={{ color: 'var(--ink-soft)' }}>
                      +{investmentSummary.count - 4} holding lainnya
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  )
}

// NetWorthHero, InsightsPanel, Row2, UpcomingBills, RecentTransactions,
// GoalsWidget — all extracted to components/dashboard/*.tsx
