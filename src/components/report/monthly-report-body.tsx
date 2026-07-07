'use client'

/**
 * MonthlyReportBody — isi laporan bulanan yang DIPAKAI BARENG layar & PDF.
 * Satu sumber kebenaran biar tampilan di /dashboard/monthly-report dan hasil
 * download (/print/monthly-report) gak pernah beda lagi.
 *
 * Props: { year, month, variant }. Komponen ini load datanya sendiri dari
 * year/month (getUser internal). 'screen' = dalam app; 'print' = dokumen A4
 * (tampilin identitas + tanggal dibuat, tanpa kontrol interaktif).
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useI18n, useT } from '@/lib/i18n/context'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import { MONTHS } from '@/lib/constants'
import { fetchLiquidEntries, sumLiquid } from '@/lib/liquid'
import type { Transaction } from '@/types'
import {
  Loader2, TrendingUp, TrendingDown, Calendar,
  PiggyBank, LineChart as LineChartIcon, ArrowUpRight, ArrowDownRight,
  Trophy, Sparkles, CalendarClock,
} from 'lucide-react'
import {
  ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'
import { MoneyFlowSankey, type FlowKind } from '@/components/dashboard/money-flow-sankey'
import { ReportHiddenStyle } from '@/components/report/report-customizer'
import { rootCategory, loadTree, leafKeys } from '@/lib/budget-categories'
import { Button } from '@/components/ui/button'

interface GoalRow { id: string; name: string; target_amount: number; current_amount: number; deadline: string | null }
interface BudgetRow { category: string; type: string; amount: number }
interface RecurringRow { name: string; type: string; amount: number; frequency: string; is_active: boolean }
interface DebtRow { name: string; monthly_payment: number; remaining: number; is_active: boolean }
interface ContractRow { name: string; cost: number | null; frequency: string | null; is_archived: boolean }

export function MonthlyReportBody({
  year,
  month,
  variant = 'screen',
}: {
  year: number
  month: number
  variant?: 'screen' | 'print'
}) {
  const { t, locale } = useI18n()
  const supabase = createClient()
  const now = new Date()
  const pageQuery = useQuery({
    queryKey: ['monthly-report', year, month],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('unauthenticated')
      const profRes = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
      const fullName = (profRes.data as { full_name: string } | null)?.full_name?.trim() || user.email?.split('@')[0] || t('report.default_user')

      const sixStart = new Date(year, month - 6, 1)
      const startBound = `${sixStart.getFullYear()}-${String(sixStart.getMonth() + 1).padStart(2, '0')}-01`
      const endBound = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`

      const [txRes, budRes, liquidEntries, nlqRes, invRes, debtRes, ccRes, goalsRes, recRes, ctrRes, treeRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('user_id', user.id).gte('date', startBound).lt('date', endBound).order('amount', { ascending: false }),
        supabase.from('budgets').select('category, type, amount').eq('user_id', user.id).eq('year', year).eq('month', month),
        fetchLiquidEntries(supabase, user.id, { strict: true }),
        supabase.from('assets_non_liquid').select('current_value').eq('user_id', user.id),
        supabase.from('investments').select('total_value').eq('user_id', user.id),
        supabase.from('debts').select('name, monthly_payment, remaining, is_active').eq('user_id', user.id).eq('is_active', true),
        supabase.from('credit_cards').select('current_balance').eq('user_id', user.id).eq('is_active', true),
        supabase.from('goals').select('id, name, target_amount, current_amount, deadline').eq('user_id', user.id).eq('is_active', true).order('deadline', { ascending: true, nullsFirst: false }),
        supabase.from('recurring_transactions').select('name, type, amount, frequency, is_active').eq('user_id', user.id).eq('is_active', true),
        supabase.from('contracts').select('name, cost, frequency, is_archived').eq('user_id', user.id).eq('is_archived', false),
        loadTree(supabase, user.id),
      ])
      if (txRes.error) throw txRes.error
      if (budRes.error) throw budRes.error

      // Filter ke leaf key tree saat ini (sama kayak dashboard & halaman Anggaran):
      // buang baris parent basi (double-count) + kategori stale yg udah dihapus/rename.
      const allBud = (budRes.data ?? []) as BudgetRow[]
      let budgetRows: BudgetRow[]
      if (treeRes.dbAvailable) {
        const leafByType: Record<string, Set<string>> = {
          income: new Set(leafKeys(treeRes.tree.income)),
          expense: new Set(leafKeys(treeRes.tree.expense)),
          saving: new Set(leafKeys(treeRes.tree.saving)),
          investment: new Set(leafKeys(treeRes.tree.investment)),
        }
        budgetRows = allBud.filter((b) => leafByType[b.type]?.has(b.category))
      } else {
        budgetRows = allBud
      }

      const debtRows = (debtRes.data ?? []) as DebtRow[]
      return {
        userName: fullName,
        allTx: (txRes.data ?? []) as Transaction[],
        budgets: budgetRows,
        liquidTotal: sumLiquid(liquidEntries),
        nonLiquidTotal: ((nlqRes.data ?? []) as { current_value: number }[]).reduce((s, a) => s + (a.current_value ?? 0), 0),
        investTotal: ((invRes.data ?? []) as { total_value: number }[]).reduce((s, a) => s + (a.total_value ?? 0), 0),
        debts: debtRows,
        debtTotal: debtRows.reduce((s, a) => s + (a.remaining ?? 0), 0),
        ccTotal: ((ccRes.data ?? []) as { current_balance: number }[]).reduce((s, a) => s + (a.current_balance ?? 0), 0),
        goals: (goalsRes.data ?? []) as GoalRow[],
        recurring: (recRes.data ?? []) as RecurringRow[],
        contracts: (ctrRes.data ?? []) as ContractRow[],
      }
    },
  })
  const loading = pageQuery.isLoading
  const userName = pageQuery.data?.userName ?? ''
  const allTx = useMemo(() => pageQuery.data?.allTx ?? [], [pageQuery.data])
  const budgets = useMemo(() => pageQuery.data?.budgets ?? [], [pageQuery.data])
  const liquidTotal = pageQuery.data?.liquidTotal ?? 0
  const nonLiquidTotal = pageQuery.data?.nonLiquidTotal ?? 0
  const investTotal = pageQuery.data?.investTotal ?? 0
  const debtTotal = pageQuery.data?.debtTotal ?? 0
  const ccTotal = pageQuery.data?.ccTotal ?? 0
  const goals = useMemo(() => pageQuery.data?.goals ?? [], [pageQuery.data])
  const recurring = useMemo(() => pageQuery.data?.recurring ?? [], [pageQuery.data])
  const debts = useMemo(() => pageQuery.data?.debts ?? [], [pageQuery.data])
  const contracts = useMemo(() => pageQuery.data?.contracts ?? [], [pageQuery.data])

  function bounds(y: number, m: number) {
    const start = `${y}-${String(m).padStart(2, '0')}-01`
    const end = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
    return { start, end }
  }
  // Exclude kategori 'Transfer' (pindah antar-akun = 2 leg income+expense) dari
  // semua agregasi — konsisten sama dashboard, biar gross income/expense gak double.
  const sumType = (txs: Transaction[], t: Transaction['type']) => txs.filter((x) => x.type === t && x.category !== 'Transfer').reduce((s, x) => s + x.amount, 0)
  function byCat(txs: Transaction[], t: Transaction['type']) {
    const m: Record<string, number> = {}
    for (const x of txs.filter((y) => y.type === t && y.category !== 'Transfer')) m[x.category] = (m[x.category] || 0) + x.amount
    return m
  }

  const r = useMemo(() => {
    const { start, end } = bounds(year, month)
    const cur = allTx.filter((t) => t.date >= start && t.date < end)
    const pm = month === 1 ? 12 : month - 1
    const py = month === 1 ? year - 1 : year
    const pb = bounds(py, pm)
    const prev = allTx.filter((t) => t.date >= pb.start && t.date < pb.end)

    const income = sumType(cur, 'income')
    const expense = sumType(cur, 'expense')
    const saving = sumType(cur, 'saving')
    const investment = sumType(cur, 'investment')
    const surplus = income - expense
    const savingRate = income > 0 ? ((saving + investment) / income) * 100 : 0

    const pIncome = sumType(prev, 'income')
    const pExpense = sumType(prev, 'expense')
    const pSaved = sumType(prev, 'saving') + sumType(prev, 'investment')
    const pSavingRate = pIncome > 0 ? (pSaved / pIncome) * 100 : 0
    const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null)

    const series: { label: string; income: number; expense: number; saved: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1)
      const b = bounds(d.getFullYear(), d.getMonth() + 1)
      const mtx = allTx.filter((t) => t.date >= b.start && t.date < b.end)
      series.push({ label: MONTHS[d.getMonth()].slice(0, 3), income: sumType(mtx, 'income'), expense: sumType(mtx, 'expense'), saved: sumType(mtx, 'saving') + sumType(mtx, 'investment') })
    }
    let surplusStreak = 0
    for (let i = series.length - 1; i >= 0; i--) { if (series[i].income - series[i].expense > 0) surplusStreak++; else break }

    const curExp = byCat(cur, 'expense'); const prevExp = byCat(prev, 'expense')
    const expense_by_category = Object.entries(curExp).map(([name, amount]) => ({ name, amount, delta: amount - (prevExp[name] || 0) })).sort((a, b) => b.amount - a.amount)
    const maxExp = expense_by_category[0]?.amount || 1
    const income_by_source = Object.entries(byCat(cur, 'income')).map(([name, amount]) => ({ name, amount, share: income > 0 ? (amount / income) * 100 : 0 })).sort((a, b) => b.amount - a.amount)

    const allCat = new Set([...Object.keys(curExp), ...Object.keys(prevExp)])
    const shifts = Array.from(allCat).map((name) => ({ name, delta: (curExp[name] || 0) - (prevExp[name] || 0), pct: pct(curExp[name] || 0, prevExp[name] || 0) }))
      .filter((s) => Math.abs(s.delta) > 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 5)

    // Budget vs actual (expense)
    // Roll-up budget vs aktual ke kategori INDUK (konsisten sama dashboard).
    const actualByRoot: Record<string, number> = {}
    for (const [name, amt] of Object.entries(curExp)) {
      const root = rootCategory(name)
      actualByRoot[root] = (actualByRoot[root] || 0) + amt
    }
    const budgetByRoot: Record<string, number> = {}
    for (const b of budgets) {
      if (b.type !== 'expense' || b.amount <= 0) continue
      const root = rootCategory(b.category)
      budgetByRoot[root] = (budgetByRoot[root] || 0) + b.amount
    }
    const budgetVsActual = Object.entries(budgetByRoot).map(([category, budget]) => {
      const actual = actualByRoot[category] || 0
      return { category, budget, actual, ratio: budget > 0 ? (actual / budget) * 100 : 0 }
    }).sort((a, b) => b.ratio - a.ratio)
    const totalBudget = Object.values(budgetByRoot).reduce((s, b) => s + b, 0)

    function bucketFlow(type: 'income' | 'expense' | 'saving' | 'investment') {
      const arr = Object.entries(byCat(cur, type)).map(([name, amount]) => ({ name, amount, kind: type as FlowKind })).sort((a, b) => b.amount - a.amount)
      const top = arr.slice(0, 8); const rest = arr.slice(8)
      if (rest.length) { const s = rest.reduce((x, c) => x + c.amount, 0); if (s > 0) top.push({ name: `+${rest.length} ${t('report.flow_others')}`, amount: s, kind: type as FlowKind }) }
      return top
    }
    const sankeyIncome = bucketFlow('income')
    const sankeyOutflow = [...bucketFlow('expense'), ...bucketFlow('saving'), ...bucketFlow('investment')]

    const top_expenses = cur.filter((t) => t.type === 'expense' && t.category !== 'Transfer').sort((a, b) => b.amount - a.amount).slice(0, 10)
    const netWorth = liquidTotal + nonLiquidTotal + investTotal - debtTotal - ccTotal

    // Forward-looking next month: recurring (active) + debt monthly payments + monthly contracts
    const upcoming: { name: string; amount: number; kind: string }[] = []
    for (const x of recurring.filter((y) => y.type === 'expense' || y.type === 'saving' || y.type === 'investment')) {
      // Normalisasi ke ekuivalen bulanan — weekly/yearly/daily jangan dipakai mentah.
      const m = x.frequency === 'monthly' ? x.amount
        : x.frequency === 'weekly' ? (x.amount * 52) / 12
        : x.frequency === 'yearly' ? x.amount / 12
        : x.frequency === 'daily' ? (x.amount * 365) / 12
        : x.amount
      if (m > 0) upcoming.push({ name: x.name, amount: Math.round(m), kind: t('report.kind_recurring') })
    }
    for (const d of debts) if ((d.monthly_payment ?? 0) > 0) upcoming.push({ name: d.name, amount: d.monthly_payment, kind: t('report.kind_installment') })
    for (const c of contracts) if ((c.frequency === 'monthly') && (c.cost ?? 0) > 0) upcoming.push({ name: c.name, amount: c.cost ?? 0, kind: t('report.kind_subscription') })
    upcoming.sort((a, b) => b.amount - a.amount)
    const upcomingTotal = upcoming.reduce((s, u) => s + u.amount, 0)

    return {
      income, expense, saving, investment, surplus, savingRate,
      incomePct: pct(income, pIncome), expensePct: pct(expense, pExpense),
      savingRateDelta: savingRate - pSavingRate, prevMonthLabel: MONTHS[pm - 1],
      series, surplusStreak, expense_by_category, maxExp, income_by_source, shifts,
      budgetVsActual, totalBudget,
      sankeyIncome, sankeyOutflow, top_expenses, netWorth,
      upcoming: upcoming.slice(0, 8), upcomingTotal,
      tx_count: cur.length, hasPrev: prev.length > 0,
    }
  }, [allTx, budgets, year, month, liquidTotal, nonLiquidTotal, investTotal, debtTotal, ccTotal, recurring, debts, contracts, t])

  if (loading) {
    return <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-mute)' }}><Loader2 className="size-5 animate-spin mr-2" /> {t('report.preparing')}</div>
  }

  if (pageQuery.isError) {
    return (
      <div className="s-card flex flex-col items-center text-center py-14 px-8 gap-3">
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>{t('common.load_failed')}</p>
        <Button variant="outline" onClick={() => pageQuery.refetch()}>{t('common.retry')}</Button>
      </div>
    )
  }

  const surplusWord = r.surplus >= 0 ? t('report.word_surplus') : t('report.word_deficit')
  const generatedAt = now.toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  const nextMonthLabel = MONTHS[month % 12]
  const topUp = r.shifts.find((s) => s.delta > 0)
  const topDown = r.shifts.find((s) => s.delta < 0)
  const topCat = r.expense_by_category[0] ?? null
  const topCatBudget = topCat ? (r.budgetVsActual.find((b) => b.category === topCat.name) ?? null) : null
  // Print = angka presisi penuh (dokumen rekonsiliasi); layar = ringkas.
  const money = formatCurrency
  const lastDay = new Date(year, month, 0).getDate()
  // Langkah berikutnya — rule-based (ambang + angka riil), bukan generatif.
  const steps: string[] = []
  if (r.income > 0 && r.savingRate < 20) {
    const kurang = Math.round(r.income * 0.2 - (r.saving + r.investment))
    if (kurang > 0) steps.push(`${t('report.step_increase_savings_pre')} ${money(kurang)}${t('report.step_increase_savings_post')}`)
  }
  const overB = r.budgetVsActual.filter((b) => b.ratio > 100)
  if (overB.length) steps.push(`${overB.length} ${t('report.step_over_budget_mid')} (${t('report.step_over_budget_eg')} ${overB[0].category} ${overB[0].ratio.toFixed(0)}%) — ${t('report.step_over_budget_review')} ${nextMonthLabel}.`)
  if (r.upcomingTotal > 0 && r.upcomingTotal > r.surplus) steps.push(`${t('report.step_obligations_pre')} ${nextMonthLabel} (${money(r.upcomingTotal)}) ${t('report.step_obligations_post')}`)
  if (r.surplus > 0 && r.savingRate >= 20) steps.push(`${t('report.step_surplus_pre')} ${money(r.surplus)} ${t('report.step_surplus_post')}`)

  if (r.tx_count === 0) {
    return (
      <div className="s-card p-10 sm:p-14 text-center">
        <Calendar className="size-12 mx-auto" style={{ color: 'var(--text-mute)' }} />
        <h3 className="t-h2 mt-4" style={{ color: 'var(--ink)' }}>{t('report.empty_title')} {MONTHS[month - 1]} {year}</h3>
        <p className="t-sm max-w-md mx-auto mt-2" style={{ color: 'var(--ink-soft)' }}>{t('report.empty_desc')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 report-flow">
      <ReportHiddenStyle />
      {/* Document header / letterhead */}
      <header className="print-avoid-break">
        {variant === 'print' && (
          <div className="flex items-center justify-between pb-2.5 mb-4" style={{ borderBottom: '1px solid var(--line-strong)' }}>
            <span className="t-title font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>Klunting</span>
            <span className="eyebrow" style={{ color: 'var(--text-mute)' }}>{t('report.letterhead')}</span>
          </div>
        )}
        <p className="eyebrow">{t('report.eyebrow_summary')} · {MONTHS[month - 1]} {year}</p>
        <h1 className="t-display mt-1" style={{ color: 'var(--ink)' }}>{t('report.title')} {MONTHS[month - 1]}</h1>
        {variant === 'print' ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4" style={{ borderTop: '1px solid var(--line)' }}>
            <Meta label={t('report.meta_prepared_for')} value={userName} />
            <Meta label={t('report.meta_period')} value={`1–${lastDay} ${MONTHS[month - 1]} ${year}`} />
            <Meta label={t('report.meta_transactions')} value={`${r.tx_count}`} />
            <Meta label={t('report.meta_issued_date')} value={generatedAt} />
          </div>
        ) : (
          <p className="t-body mt-1.5" style={{ color: 'var(--ink-soft)' }}>
            {t('report.prepared_for')} <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{userName}</span> · {t('report.created')} {generatedAt}
          </p>
        )}
      </header>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t('report.kpi_income')} value={r.income} pct={r.incomePct} icon={<TrendingUp className="size-4" />} kind="income" goodUp />
        <Kpi label={t('report.kpi_expense')} value={r.expense} pct={r.expensePct} icon={<TrendingDown className="size-4" />} kind="expense" goodUp={false} />
        <Kpi label={t('report.kpi_saved')} value={r.saving} note={`${r.income > 0 ? ((r.saving / r.income) * 100).toFixed(0) : 0}% ${t('report.pct_of_income')}`} icon={<PiggyBank className="size-4" />} kind="amber" />
        <Kpi label={t('report.kpi_invested')} value={r.investment} note={`${r.income > 0 ? ((r.investment / r.income) * 100).toFixed(0) : 0}% ${t('report.pct_of_income')}`} icon={<LineChartIcon className="size-4" />} kind="violet" />
      </div>

      {/* Ringkasan eksekutif — narasi prosa 3 sub-paragraf + strip arus kas */}
      <div className="s-card p-5 sm:p-6 print-avoid-break" style={{ borderLeft: '3px solid var(--c-mint)' }}>
        <p className="eyebrow" style={{ color: 'var(--c-mint-ink)' }}>{t('report.exec_summary')}</p>
        <div className="mt-2.5 space-y-2.5" style={{ maxWidth: variant === 'print' ? '64ch' : undefined }}>
          <p className="t-body" style={{ color: 'var(--ink)', lineHeight: 1.7 }}>
            <strong>{t('report.cashflow_label')}</strong> {t('report.cashflow_during')} {MONTHS[month - 1]} {year}, {t('report.cashflow_income')} {money(r.income)} {t('report.cashflow_and_expense')} {money(r.expense)} {t('report.cashflow_result')} {surplusWord}{' '}
            <span className="num font-semibold" style={{ color: r.surplus >= 0 ? 'var(--c-mint)' : 'var(--c-coral)' }}>{money(Math.abs(r.surplus))}</span>{r.surplusStreak >= 2 ? ` — ${t('report.surplus_streak_pre')} ${r.surplusStreak} ${t('report.surplus_streak_post')}` : ''}.
          </p>
          <p className="t-body" style={{ color: 'var(--ink)', lineHeight: 1.7 }}>
            <strong>{t('report.allocation_label')}</strong> <span className="num font-semibold">{r.savingRate.toFixed(0)}%</span> {t('report.allocation_set_aside')} {r.savingRate >= 20 ? t('report.above') : t('report.below')} {t('report.allocation_threshold')}{topCat ? ` ${t('report.top_expense_at')} ${topCat.name} (${money(topCat.amount)})${topCatBudget ? (topCatBudget.ratio > 100 ? `, ${t('report.over_budget_suffix')} ${topCatBudget.ratio.toFixed(0)}%` : `, ${topCatBudget.ratio.toFixed(0)}% ${t('report.of_budget_suffix')}`) : ''}.` : ''}
          </p>
          <p className="t-body" style={{ color: 'var(--ink)', lineHeight: 1.7 }}>
            <strong>{t('report.position_label')}</strong> {t('report.net_worth_now')} {money(r.netWorth)}.{r.upcomingTotal > 0 ? ` ${t('report.prepare_obligations_pre')} ${nextMonthLabel}, ${t('report.prepare_obligations_mid')} ${money(r.upcomingTotal)} ${t('report.prepare_obligations_post')}` : ''}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4" style={{ borderTop: '1px solid var(--line)' }}>
          <Mini label={t('report.mini_money_in')} value={r.income} color="var(--c-mint)" />
          <Mini label={t('report.mini_spending')} value={r.expense} color="var(--c-coral)" />
          <Mini label={t('report.mini_save_invest')} value={r.saving + r.investment} color="var(--c-violet)" />
          <Mini label={t('report.mini_difference')} value={r.surplus} color={r.surplus >= 0 ? 'var(--c-mint)' : 'var(--c-coral)'} signed />
        </div>
      </div>

      {/* Sankey */}
      <div data-report-block="aliran" className="s-card p-4 sm:p-6">
        <p className="eyebrow">{t('report.flow_eyebrow')}</p>
        <h3 className="t-h2 mt-0.5 mb-3" style={{ color: 'var(--ink)' }}>{t('report.flow_title')} — {MONTHS[month - 1]}</h3>
        {/* Dual render per breakpoint (pola sama dgn dashboard): tanpa `compact`,
            margin label desktop 130px×2 ngabisin lebar 375px → label numpuk. */}
        <div className="hidden md:block">
          <MoneyFlowSankey income={r.sankeyIncome} outflow={r.sankeyOutflow} height={Math.max(340, Math.min(480, 90 + Math.max(r.sankeyIncome.length, r.sankeyOutflow.length) * 36))} emptyMessage={t('report.flow_empty')} />
        </div>
        <div className="md:hidden">
          <MoneyFlowSankey income={r.sankeyIncome} outflow={r.sankeyOutflow} compact height={Math.max(300, Math.min(420, 60 + Math.max(r.sankeyIncome.length, r.sankeyOutflow.length) * 30))} emptyMessage={t('report.flow_empty')} />
        </div>
      </div>

      {/* 6 month + shifts */}
      <div data-report-block="perbandingan" className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="s-card p-5 sm:p-6 lg:col-span-3">
          <p className="eyebrow">{t('report.compare_eyebrow')}</p>
          <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>{t('report.compare_title')}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={r.series} barGap={3} barCategoryGap="22%" margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
              <XAxis dataKey="label" fontSize={11} tick={{ fill: 'var(--ink-muted)' }} axisLine={{ stroke: 'var(--border-soft)' }} tickLine={false} />
              <YAxis fontSize={11} tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}jt`} tick={{ fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: unknown, n) => [formatCurrency(Number(v) || 0), n === 'income' ? t('report.kpi_income') : n === 'expense' ? t('report.kpi_expense') : t('report.legend_save_invest')]} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} formatter={(v) => (v === 'income' ? t('report.kpi_income') : v === 'expense' ? t('report.kpi_expense') : t('report.legend_save_invest'))} />
              <Bar dataKey="income" name="income" fill="var(--c-mint)" radius={[3, 3, 0, 0]} maxBarSize={20} />
              <Bar dataKey="expense" name="expense" fill="var(--c-coral)" radius={[3, 3, 0, 0]} maxBarSize={20} />
              <Bar dataKey="saved" name="saved" fill="var(--c-violet)" radius={[3, 3, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="s-card p-5 sm:p-6 lg:col-span-2">
          <p className="eyebrow">{t('report.shifts_eyebrow')}</p>
          <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>{t('report.vs_prefix')} {r.prevMonthLabel}</h3>
          {(!r.hasPrev || r.shifts.length === 0) ? <p className="t-sm mt-4" style={{ color: 'var(--text-mute)' }}>{t('report.shifts_empty')}</p> : (
            <div className="mt-4 space-y-3">
              {r.shifts.map((s) => {
                const up = s.delta > 0
                return (
                  <div key={s.name} className="flex items-center justify-between gap-3">
                    <span className="t-sm truncate" style={{ color: 'var(--ink)' }}>{s.name}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="num t-sm font-medium" style={{ color: up ? 'var(--c-coral)' : 'var(--c-mint)' }}>{up ? '+' : '−'}{formatCurrency(Math.abs(s.delta))}</span>
                      {s.pct != null && <span className="inline-flex items-center gap-0.5 t-cap num" style={{ color: 'var(--text-mute)' }}>{up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{Math.abs(s.pct).toFixed(0)}%</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Budget vs actual */}
      {r.budgetVsActual.length > 0 && (
        <div data-report-block="anggaran" className="s-card p-5 sm:p-6">
          <p className="eyebrow">{t('report.budget_eyebrow')}</p>
          <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>{t('report.budget_title')} {MONTHS[month - 1]}</h3>
          <div className="mt-4 space-y-3">
            {r.budgetVsActual.map((b) => {
              const over = b.ratio > 100
              const warn = b.ratio > 85 && !over
              const color = over ? 'var(--c-coral)' : warn ? 'var(--c-amber)' : 'var(--c-mint)'
              return (
                <div key={b.category}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="t-sm truncate" style={{ color: 'var(--ink)' }}>{b.category}</span>
                    <span className="num t-cap shrink-0" style={{ color }}>{b.ratio.toFixed(0)}% · {money(b.actual)}/{money(b.budget)}</span>
                  </div>
                  <span className="quest-bar" style={{ ['--bar-fill' as string]: color, ['--bar-h' as string]: '9px' }}>
                    <i style={{ width: `${Math.min(100, b.ratio)}%` }} />
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Expense by category + Income by source */}
      <div data-report-block="kategori" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {r.expense_by_category.length > 0 && (
          <div className="s-card p-5 sm:p-6">
            <p className="eyebrow">{t('report.expense_cat_eyebrow')}</p>
            <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>{MONTHS[month - 1]}{r.hasPrev && <span className="t-sm font-normal" style={{ color: 'var(--text-mute)' }}> · {t('report.delta_vs')} {r.prevMonthLabel}</span>}</h3>
            <div className="mt-4 space-y-2.5">
              {r.expense_by_category.map((row) => (
                <div key={row.name} className="flex items-center gap-2.5">
                  <span className="t-sm w-24 sm:w-28 shrink-0 truncate" style={{ color: 'var(--ink)' }}>{row.name}</span>
                  <span className="quest-bar flex-1" style={{ ['--bar-fill' as string]: 'var(--c-violet)', ['--bar-h' as string]: '9px' }}>
                    <i style={{ width: `${(row.amount / r.maxExp) * 100}%` }} />
                  </span>
                  <span className="num t-sm font-semibold w-24 text-right shrink-0" style={{ color: 'var(--ink)' }}>{money(row.amount)}</span>
                  {r.hasPrev && <span className="num t-cap w-16 text-right shrink-0" style={{ color: row.delta > 0 ? 'var(--c-coral)' : row.delta < 0 ? 'var(--c-mint)' : 'var(--text-mute)' }}>{row.delta === 0 ? '—' : `${row.delta > 0 ? '+' : '−'}${formatCurrency(Math.abs(row.delta))}`}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        {r.income_by_source.length > 0 && (
          <div className="s-card p-5 sm:p-6">
            <p className="eyebrow">{t('report.income_src_eyebrow')}</p>
            <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>{t('report.income_src_title')}</h3>
            <div className="mt-4 space-y-2.5">
              {r.income_by_source.map((row) => (
                <div key={row.name} className="flex items-center gap-2.5">
                  <span className="t-sm w-24 sm:w-28 shrink-0 truncate" style={{ color: 'var(--ink)' }}>{row.name}</span>
                  <span className="quest-bar flex-1" style={{ ['--bar-fill' as string]: 'var(--c-mint)', ['--bar-h' as string]: '9px' }}>
                    <i style={{ width: `${row.share}%` }} />
                  </span>
                  <span className="num t-sm font-semibold w-24 text-right shrink-0" style={{ color: 'var(--ink)' }}>{money(row.amount)}</span>
                  <span className="num t-cap w-10 text-right shrink-0" style={{ color: 'var(--text-mute)' }}>{row.share.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Net worth + Goals */}
      <div data-report-block="networth" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="s-card p-5 sm:p-6">
          <p className="eyebrow">{t('report.networth_eyebrow')}</p>
          <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>{t('report.networth_title')}</h3>
          <p className="num font-bold mt-3" style={{ fontSize: 24, letterSpacing: '-0.03em', color: 'var(--ink)' }} title={formatCurrency(r.netWorth)}>{formatCompactCurrency(r.netWorth)}</p>
          <div className="mt-4 space-y-2">
            <Nw label={t('report.nw_liquid')} value={liquidTotal} />
            <Nw label={t('report.nw_investment')} value={investTotal} />
            <Nw label={t('report.nw_non_liquid')} value={nonLiquidTotal} />
            <Nw label={t('report.nw_debt')} value={-debtTotal} />
            <Nw label={t('report.nw_credit_card')} value={-ccTotal} />
          </div>
          <p className="t-cap mt-3" style={{ color: 'var(--text-mute)' }}>{t('report.networth_note')}</p>
        </div>
        <div className="s-card p-5 sm:p-6">
          <p className="eyebrow">{t('report.goals_eyebrow')}</p>
          <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>{t('report.goals_title')}</h3>
          {goals.length === 0 ? <p className="t-sm mt-4" style={{ color: 'var(--text-mute)' }}>{t('report.goals_empty')}</p> : (
            <div className="mt-4 space-y-3.5">
              {goals.slice(0, 5).map((g) => {
                const p = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0
                return (
                  <div key={g.id}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="t-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{g.name}</span>
                      <span className="num t-sm shrink-0" style={{ color: 'var(--c-mint-ink)' }}>{p.toFixed(0)}%</span>
                    </div>
                    <span className="quest-bar" style={{ ['--bar-fill' as string]: 'var(--c-mint)', ['--bar-h' as string]: '8px' }}><i style={{ width: `${p}%` }} /></span>
                    <p className="num t-cap mt-1" style={{ color: 'var(--text-mute)' }}>{money(g.current_amount)} / {money(g.target_amount)}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Forward-looking */}
      {r.upcoming.length > 0 && (
        <div data-report-block="kewajiban" className="s-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-4" style={{ color: 'var(--c-violet)' }} />
            <p className="eyebrow">{t('report.obligations_eyebrow')} · {nextMonthLabel}</p>
          </div>
          <p className="t-sm mt-1" style={{ color: 'var(--ink-soft)' }}>{t('report.obligations_desc')} <span className="num font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(r.upcomingTotal)}</span></p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {r.upcoming.map((u, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--surface-2)' }}>
                <span className="t-sm truncate" style={{ color: 'var(--ink)' }}>{u.name} <span className="t-cap" style={{ color: 'var(--text-mute)' }}>· {u.kind}</span></span>
                <span className="num t-sm font-medium shrink-0" style={{ color: 'var(--ink)' }}>{money(u.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sorotan */}
      <div data-report-block="sorotan" className="s-card p-5 sm:p-6 print-avoid-break" style={{ borderLeft: '3px solid var(--c-mint)' }}>
        <div className="flex items-center gap-2 mb-3"><Sparkles className="size-4" style={{ color: 'var(--c-mint-ink)' }} /><p className="eyebrow" style={{ color: 'var(--c-mint-ink)' }}>{t('report.highlights_eyebrow')}</p></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: <Trophy className="size-4" style={{ color: 'var(--c-amber)' }} />, title: `${t('report.highlight_saving_rate')} ${r.savingRate.toFixed(0)}%`, sub: r.hasPrev ? `${r.savingRateDelta >= 0 ? t('report.dir_up') : t('report.dir_down')} ${Math.abs(r.savingRateDelta).toFixed(0)}pp ${t('report.from_prefix')} ${r.prevMonthLabel}` : t('report.this_month') },
            r.hasPrev && topDown && { icon: <ArrowDownRight className="size-4" style={{ color: 'var(--c-mint-ink)' }} />, title: `${topDown.name} ${t('report.dir_down_word')}`, sub: `${t('report.highlight_saved')} ${formatCurrency(Math.abs(topDown.delta))} ${t('report.vs_prefix')} ${r.prevMonthLabel}` },
            r.hasPrev && topUp && { icon: <ArrowUpRight className="size-4" style={{ color: 'var(--c-coral-ink)' }} />, title: `${topUp.name} ${t('report.dir_up_word')}`, sub: `+${formatCurrency(topUp.delta)} ${t('report.vs_prefix')} ${r.prevMonthLabel}` },
          ].filter(Boolean).slice(0, 3).map((h, i) => {
            const item = h as { icon: React.ReactNode; title: string; sub: string }
            return <div key={i} className="rounded-xl p-3.5" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}><div className="mb-1.5">{item.icon}</div><p className="t-sm font-semibold" style={{ color: 'var(--ink)' }}>{item.title}</p><p className="t-cap mt-0.5" style={{ color: 'var(--text-mute)' }}>{item.sub}</p></div>
          })}
        </div>
      </div>

      {/* Langkah Berikutnya — rule-based, bukan generatif */}
      {steps.length > 0 && (
        <div data-report-block="langkah" className="s-card p-5 sm:p-6 print-avoid-break">
          <p className="eyebrow">{t('report.steps_eyebrow')}</p>
          <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>{t('report.steps_title')} {nextMonthLabel}</h3>
          <ul className="mt-3 space-y-2">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="shrink-0 num t-sm font-semibold" style={{ color: 'var(--c-mint-ink)' }}>{i + 1}.</span>
                <span className="t-sm" style={{ color: 'var(--ink)' }}>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Top 10 */}
      {r.top_expenses.length > 0 && (
        <div data-report-block="top10" className="s-card p-5 sm:p-6">
          <p className="eyebrow">{t('report.top_eyebrow')}</p>
          <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>{t('report.top_title')}</h3>
          <div className="mt-3 flex flex-col">
            {r.top_expenses.map((tx, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5" style={{ borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <span className="num shrink-0 w-11 text-[11px]" style={{ color: 'var(--text-mute)' }}>{new Date(tx.date).toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID', { day: 'numeric', month: 'short' })}</span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-[13.5px]" style={{ color: 'var(--ink)' }}>{tx.description || '—'}</span>
                  <span className="block truncate text-[11px]" style={{ color: 'var(--text-mute)' }}>{tx.category}</span>
                </span>
                <span className="num font-semibold shrink-0 text-[13.5px]" style={{ color: 'var(--c-coral-ink)' }}>{money(tx.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {variant === 'print' && (
        <p className="t-cap text-center pt-2" style={{ color: 'var(--text-mute)' }}>Klunting · klunting.com · {t('report.created')} {generatedAt}</p>
      )}
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="eyebrow" style={{ color: 'var(--text-mute)' }}>{label}</p>
      <p className="t-sm font-medium mt-0.5" style={{ color: 'var(--ink)' }}>{value}</p>
    </div>
  )
}

function Kpi({ label, value, pct, note, icon, kind, goodUp }: { label: string; value: number; pct?: number | null; note?: string; icon: React.ReactNode; kind: 'income' | 'expense' | 'amber' | 'violet'; goodUp?: boolean }) {
  const t = useT()
  const tone: Record<string, { bg: string; fg: string }> = {
    income: { bg: 'var(--c-mint-soft)', fg: 'var(--c-mint)' }, expense: { bg: 'var(--c-coral-soft)', fg: 'var(--c-coral)' },
    amber: { bg: 'var(--c-amber-soft)', fg: 'var(--c-amber)' }, violet: { bg: 'var(--c-violet-soft)', fg: 'var(--c-violet)' },
  }
  const c = tone[kind]; const up = (pct ?? 0) >= 0; const good = goodUp === undefined ? true : up === goodUp
  return (
    <div className="stat-tile">
      <div className="flex items-center justify-between"><p className="eyebrow">{label}</p><div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: c.bg, color: c.fg }}>{icon}</div></div>
      <p className="num tabular font-bold mt-2" style={{ fontSize: 19, letterSpacing: '-0.025em', color: 'var(--ink)' }} title={formatCurrency(value)}>{formatCompactCurrency(value)}</p>
      {pct != null ? <p className="num t-cap mt-1" style={{ color: good ? 'var(--c-mint)' : 'var(--c-coral)' }}>{up ? '+' : '−'}{Math.abs(pct).toFixed(0)}% {t('report.vs_last_month')}</p> : note ? <p className="t-cap mt-1" style={{ color: 'var(--text-mute)' }}>{note}</p> : null}
    </div>
  )
}

function Mini({ label, value, text, color, signed }: { label: string; value?: number; text?: string; color: string; signed?: boolean }) {
  const sign = signed && (value ?? 0) >= 0 ? '+' : signed && (value ?? 0) < 0 ? '−' : ''
  return (
    <div>
      <p className="t-cap" style={{ color: 'var(--text-mute)' }}>{label}</p>
      <p className="num tabular font-bold mt-0.5" style={{ fontSize: 17, color }} title={text != null ? undefined : `${sign}${formatCurrency(Math.abs(value ?? 0))}`}>
        {text != null ? text : `${sign}${formatCompactCurrency(Math.abs(value ?? 0))}`}
      </p>
    </div>
  )
}

function Nw({ label, value }: { label: string; value: number }) {
  const neg = value < 0
  return <div className="flex items-center justify-between"><span className="t-sm" style={{ color: 'var(--ink-soft)' }}>{label}</span><span className="num t-sm font-medium" style={{ color: neg ? 'var(--c-coral)' : 'var(--ink)' }}>{neg ? '−' : ''}{formatCurrency(Math.abs(value))}</span></div>
}
