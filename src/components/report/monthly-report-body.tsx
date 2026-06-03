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

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  const supabase = createClient()
  const now = new Date()
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')

  const [allTx, setAllTx] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<BudgetRow[]>([])
  const [liquidTotal, setLiquidTotal] = useState(0)
  const [nonLiquidTotal, setNonLiquidTotal] = useState(0)
  const [investTotal, setInvestTotal] = useState(0)
  const [debtTotal, setDebtTotal] = useState(0)
  const [ccTotal, setCcTotal] = useState(0)
  const [goals, setGoals] = useState<GoalRow[]>([])
  const [recurring, setRecurring] = useState<RecurringRow[]>([])
  const [debts, setDebts] = useState<DebtRow[]>([])
  const [contracts, setContracts] = useState<ContractRow[]>([])

  useEffect(() => {
    let alive = true
    void (async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !alive) { setLoading(false); return }
      const profRes = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
      const fullName = (profRes.data as { full_name: string } | null)?.full_name?.trim() || user.email?.split('@')[0] || 'Pengguna'

      const sixStart = new Date(year, month - 6, 1)
      const startBound = `${sixStart.getFullYear()}-${String(sixStart.getMonth() + 1).padStart(2, '0')}-01`
      const endBound = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`

      const [txRes, budRes, liquidEntries, nlqRes, invRes, debtRes, ccRes, goalsRes, recRes, ctrRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('user_id', user.id).gte('date', startBound).lt('date', endBound).order('amount', { ascending: false }),
        supabase.from('budgets').select('category, type, amount').eq('user_id', user.id).eq('year', year).eq('month', month),
        fetchLiquidEntries(supabase, user.id),
        supabase.from('assets_non_liquid').select('current_value').eq('user_id', user.id),
        supabase.from('investments').select('total_value').eq('user_id', user.id),
        supabase.from('debts').select('name, monthly_payment, remaining, is_active').eq('user_id', user.id).eq('is_active', true),
        supabase.from('credit_cards').select('current_balance').eq('user_id', user.id).eq('is_active', true),
        supabase.from('goals').select('id, name, target_amount, current_amount, deadline').eq('user_id', user.id).eq('is_active', true).order('deadline', { ascending: true, nullsFirst: false }),
        supabase.from('recurring_transactions').select('name, type, amount, frequency, is_active').eq('user_id', user.id).eq('is_active', true),
        supabase.from('contracts').select('name, cost, frequency, is_archived').eq('user_id', user.id).eq('is_archived', false),
      ])
      if (!alive) return
      setUserName(fullName)
      setAllTx((txRes.data ?? []) as Transaction[])
      setBudgets((budRes.data ?? []) as BudgetRow[])
      setLiquidTotal(sumLiquid(liquidEntries))
      setNonLiquidTotal(((nlqRes.data ?? []) as { current_value: number }[]).reduce((s, a) => s + (a.current_value ?? 0), 0))
      setInvestTotal(((invRes.data ?? []) as { total_value: number }[]).reduce((s, a) => s + (a.total_value ?? 0), 0))
      setDebts((debtRes.data ?? []) as DebtRow[])
      setDebtTotal(((debtRes.data ?? []) as DebtRow[]).reduce((s, a) => s + (a.remaining ?? 0), 0))
      setCcTotal(((ccRes.data ?? []) as { current_balance: number }[]).reduce((s, a) => s + (a.current_balance ?? 0), 0))
      setGoals((goalsRes.data ?? []) as GoalRow[])
      setRecurring((recRes.data ?? []) as RecurringRow[])
      setContracts((ctrRes.data ?? []) as ContractRow[])
      if (alive) setLoading(false)
    })()
    return () => { alive = false }
  }, [year, month]) // eslint-disable-line react-hooks/exhaustive-deps

  function bounds(y: number, m: number) {
    const start = `${y}-${String(m).padStart(2, '0')}-01`
    const end = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
    return { start, end }
  }
  const sumType = (txs: Transaction[], t: Transaction['type']) => txs.filter((x) => x.type === t).reduce((s, x) => s + x.amount, 0)
  function byCat(txs: Transaction[], t: Transaction['type']) {
    const m: Record<string, number> = {}
    for (const x of txs.filter((y) => y.type === t)) m[x.category] = (m[x.category] || 0) + x.amount
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
    const budgetExp = budgets.filter((b) => b.type === 'expense' && b.amount > 0)
    const budgetVsActual = budgetExp.map((b) => {
      const actual = curExp[b.category] || 0
      const ratio = b.amount > 0 ? (actual / b.amount) * 100 : 0
      return { category: b.category, budget: b.amount, actual, ratio }
    }).sort((a, b) => b.ratio - a.ratio)
    const totalBudget = budgetExp.reduce((s, b) => s + b.amount, 0)

    function bucketFlow(type: 'income' | 'expense' | 'saving' | 'investment') {
      const arr = Object.entries(byCat(cur, type)).map(([name, amount]) => ({ name, amount, kind: type as FlowKind })).sort((a, b) => b.amount - a.amount)
      const top = arr.slice(0, 8); const rest = arr.slice(8)
      if (rest.length) { const s = rest.reduce((x, c) => x + c.amount, 0); if (s > 0) top.push({ name: `+${rest.length} lainnya`, amount: s, kind: type as FlowKind }) }
      return top
    }
    const sankeyIncome = bucketFlow('income')
    const sankeyOutflow = [...bucketFlow('expense'), ...bucketFlow('saving'), ...bucketFlow('investment')]

    const top_expenses = cur.filter((t) => t.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 10)
    const netWorth = liquidTotal + nonLiquidTotal + investTotal - debtTotal - ccTotal

    // Forward-looking next month: recurring (active) + debt monthly payments + monthly contracts
    const upcoming: { name: string; amount: number; kind: string }[] = []
    for (const x of recurring.filter((y) => y.type === 'expense' || y.type === 'saving' || y.type === 'investment')) upcoming.push({ name: x.name, amount: x.amount, kind: 'Rutin' })
    for (const d of debts) if ((d.monthly_payment ?? 0) > 0) upcoming.push({ name: d.name, amount: d.monthly_payment, kind: 'Cicilan' })
    for (const c of contracts) if ((c.frequency === 'monthly') && (c.cost ?? 0) > 0) upcoming.push({ name: c.name, amount: c.cost ?? 0, kind: 'Langganan' })
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
  }, [allTx, budgets, year, month, liquidTotal, nonLiquidTotal, investTotal, debtTotal, ccTotal, recurring, debts, contracts])

  if (loading) {
    return <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-mute)' }}><Loader2 className="size-5 animate-spin mr-2" /> Menyiapkan laporan…</div>
  }

  const surplusWord = r.surplus >= 0 ? 'surplus' : 'defisit'
  const generatedAt = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  const nextMonthLabel = MONTHS[month % 12]
  const topUp = r.shifts.find((s) => s.delta > 0)
  const topDown = r.shifts.find((s) => s.delta < 0)

  if (r.tx_count === 0) {
    return (
      <div className="s-card p-10 sm:p-14 text-center">
        <Calendar className="size-12 mx-auto" style={{ color: 'var(--text-mute)' }} />
        <h3 className="t-h2 mt-4" style={{ color: 'var(--ink)' }}>Tidak ada transaksi di {MONTHS[month - 1]} {year}</h3>
        <p className="t-sm max-w-md mx-auto mt-2" style={{ color: 'var(--ink-soft)' }}>Belum ada data buat di-recap. Pilih bulan lain.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Document header / identity */}
      <header>
        <p className="eyebrow">Ringkasan Bulanan · {MONTHS[month - 1]} {year}</p>
        <h1 className="t-display mt-1" style={{ color: 'var(--ink)' }}>Laporan {MONTHS[month - 1]}</h1>
        <p className="t-body mt-1.5" style={{ color: 'var(--ink-soft)' }}>
          Disiapkan untuk <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{userName}</span> · dibuat {generatedAt}
        </p>
      </header>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Pemasukan" value={r.income} pct={r.incomePct} icon={<TrendingUp className="size-4" />} kind="income" goodUp />
        <Kpi label="Pengeluaran" value={r.expense} pct={r.expensePct} icon={<TrendingDown className="size-4" />} kind="expense" goodUp={false} />
        <Kpi label="Ditabung" value={r.saving} note={`${r.income > 0 ? ((r.saving / r.income) * 100).toFixed(0) : 0}% dari pendapatan`} icon={<PiggyBank className="size-4" />} kind="amber" />
        <Kpi label="Diinvestasikan" value={r.investment} note={`${r.income > 0 ? ((r.investment / r.income) * 100).toFixed(0) : 0}% dari pendapatan`} icon={<LineChartIcon className="size-4" />} kind="violet" />
      </div>

      {/* Cashflow summary + narrative */}
      <div className="s-card p-5 sm:p-6" style={{ background: 'var(--surface-2)' }}>
        <p className="eyebrow" style={{ color: 'var(--c-primary)' }}>Ringkasan Arus Kas</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          <Mini label="Uang Masuk" value={r.income} color="var(--c-mint)" />
          <Mini label="Uang Keluar" value={r.expense + r.saving + r.investment} color="var(--c-coral)" />
          <Mini label="Selisih (Surplus)" value={r.surplus} color={r.surplus >= 0 ? 'var(--c-mint)' : 'var(--c-coral)'} signed />
          <Mini label="Saving Rate" text={`${r.savingRate.toFixed(0)}%`} color="var(--c-violet)" />
        </div>
        <p className="t-body mt-4" style={{ color: 'var(--ink)', lineHeight: 1.5 }}>
          Bulan {MONTHS[month - 1]} {year} berakhir dengan {surplusWord}{' '}
          <span className="num font-bold" style={{ color: r.surplus >= 0 ? 'var(--c-mint)' : 'var(--c-coral)' }}>{formatCurrency(Math.abs(r.surplus))}</span>.
          Kamu menabung &amp; investasi <span className="num font-bold" style={{ color: 'var(--c-mint)' }}>{r.savingRate.toFixed(0)}%</span> dari pendapatan — {r.savingRate >= 20 ? 'di atas' : 'di bawah'} standar ideal 20%.
          {r.surplusStreak >= 2 && ` Ini surplus ${r.surplusStreak} bulan beruntun.`}
        </p>
      </div>

      {/* Sankey */}
      <div className="s-card p-4 sm:p-6">
        <p className="eyebrow">Aliran Uang</p>
        <h3 className="t-h2 mt-0.5 mb-3" style={{ color: 'var(--ink)' }}>Dari mana &amp; ke mana — {MONTHS[month - 1]}</h3>
        <MoneyFlowSankey income={r.sankeyIncome} outflow={r.sankeyOutflow} height={Math.max(340, Math.min(480, 90 + Math.max(r.sankeyIncome.length, r.sankeyOutflow.length) * 36))} emptyMessage="Belum ada aliran bulan ini." />
      </div>

      {/* 6 month + shifts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="s-card p-5 sm:p-6 lg:col-span-3">
          <p className="eyebrow">Perbandingan 6 Bulan</p>
          <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>Tren pemasukan vs pengeluaran</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={r.series} barGap={3} barCategoryGap="22%" margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
              <XAxis dataKey="label" fontSize={11} tick={{ fill: 'var(--ink-muted)' }} axisLine={{ stroke: 'var(--border-soft)' }} tickLine={false} />
              <YAxis fontSize={11} tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}jt`} tick={{ fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: unknown, n) => [formatCurrency(Number(v) || 0), n === 'income' ? 'Pemasukan' : n === 'expense' ? 'Pengeluaran' : 'Nabung+Investasi']} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} formatter={(v) => (v === 'income' ? 'Pemasukan' : v === 'expense' ? 'Pengeluaran' : 'Nabung+Investasi')} />
              <Bar dataKey="income" name="income" fill="#10B981" radius={[3, 3, 0, 0]} maxBarSize={20} />
              <Bar dataKey="expense" name="expense" fill="#F43F5E" radius={[3, 3, 0, 0]} maxBarSize={20} />
              <Bar dataKey="saved" name="saved" fill="#8B5CF6" radius={[3, 3, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="s-card p-5 sm:p-6 lg:col-span-2">
          <p className="eyebrow">Pergeseran Terbesar</p>
          <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>vs {r.prevMonthLabel}</h3>
          {r.shifts.length === 0 ? <p className="t-sm mt-4" style={{ color: 'var(--text-mute)' }}>Belum cukup data bulan lalu.</p> : (
            <div className="mt-4 space-y-3">
              {r.shifts.map((s) => {
                const up = s.delta > 0
                return (
                  <div key={s.name} className="flex items-center justify-between gap-3">
                    <span className="t-sm truncate" style={{ color: 'var(--ink)' }}>{s.name}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="num t-sm font-medium" style={{ color: up ? 'var(--c-coral)' : 'var(--c-mint)' }}>{up ? '+' : '−'}{formatCompactCurrency(Math.abs(s.delta))}</span>
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
        <div className="s-card p-5 sm:p-6">
          <p className="eyebrow">Anggaran vs Realisasi</p>
          <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>Disiplin anggaran {MONTHS[month - 1]}</h3>
          <div className="mt-4 space-y-3">
            {r.budgetVsActual.map((b) => {
              const over = b.ratio > 100
              const warn = b.ratio > 85 && !over
              const color = over ? 'var(--c-coral)' : warn ? 'var(--c-amber)' : 'var(--c-mint)'
              return (
                <div key={b.category}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="t-sm truncate" style={{ color: 'var(--ink)' }}>{b.category}</span>
                    <span className="num t-cap shrink-0" style={{ color }}>{b.ratio.toFixed(0)}% · {formatCompactCurrency(b.actual)}/{formatCompactCurrency(b.budget)}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, b.ratio)}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Expense by category + Income by source */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {r.expense_by_category.length > 0 && (
          <div className="s-card p-5 sm:p-6">
            <p className="eyebrow">Pengeluaran per Kategori</p>
            <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>{MONTHS[month - 1]}{r.hasPrev && <span className="t-sm font-normal" style={{ color: 'var(--text-mute)' }}> · delta vs {r.prevMonthLabel}</span>}</h3>
            <div className="mt-4 space-y-2.5">
              {r.expense_by_category.map((row) => (
                <div key={row.name} className="flex items-center gap-2.5">
                  <span className="t-sm w-24 sm:w-28 shrink-0 truncate" style={{ color: 'var(--ink)' }}>{row.name}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(row.amount / r.maxExp) * 100}%`, background: 'var(--c-violet)' }} />
                  </div>
                  <span className="num t-sm font-semibold w-24 text-right shrink-0" style={{ color: 'var(--ink)' }}>{formatCompactCurrency(row.amount)}</span>
                  {r.hasPrev && <span className="num t-cap w-16 text-right shrink-0" style={{ color: row.delta > 0 ? 'var(--c-coral)' : row.delta < 0 ? 'var(--c-mint)' : 'var(--text-mute)' }}>{row.delta === 0 ? '—' : `${row.delta > 0 ? '+' : '−'}${formatCompactCurrency(Math.abs(row.delta))}`}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        {r.income_by_source.length > 0 && (
          <div className="s-card p-5 sm:p-6">
            <p className="eyebrow">Pemasukan per Sumber</p>
            <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>Dari mana uang masuk</h3>
            <div className="mt-4 space-y-2.5">
              {r.income_by_source.map((row) => (
                <div key={row.name} className="flex items-center gap-2.5">
                  <span className="t-sm w-24 sm:w-28 shrink-0 truncate" style={{ color: 'var(--ink)' }}>{row.name}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                    <div className="h-full rounded-full" style={{ width: `${row.share}%`, background: 'var(--c-mint)' }} />
                  </div>
                  <span className="num t-sm font-semibold w-24 text-right shrink-0" style={{ color: 'var(--ink)' }}>{formatCompactCurrency(row.amount)}</span>
                  <span className="num t-cap w-10 text-right shrink-0" style={{ color: 'var(--text-mute)' }}>{row.share.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Net worth + Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="s-card p-5 sm:p-6">
          <p className="eyebrow">Net Worth</p>
          <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>Posisi terkini</h3>
          <p className="num font-bold mt-3" style={{ fontSize: 30, letterSpacing: '-0.03em', color: 'var(--ink)' }}>{formatCurrency(r.netWorth)}</p>
          <div className="mt-4 space-y-2">
            <Nw label="Aset Likuid" value={liquidTotal} />
            <Nw label="Investasi" value={investTotal} />
            <Nw label="Aset Non-Likuid" value={nonLiquidTotal} />
            <Nw label="Utang" value={-debtTotal} />
            <Nw label="Kartu Kredit" value={-ccTotal} />
          </div>
          <p className="t-cap mt-3" style={{ color: 'var(--text-mute)' }}>Saldo posisi terkini (snapshot bulanan menyusul).</p>
        </div>
        <div className="s-card p-5 sm:p-6">
          <p className="eyebrow">Tujuan</p>
          <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>Kemajuan tujuan</h3>
          {goals.length === 0 ? <p className="t-sm mt-4" style={{ color: 'var(--text-mute)' }}>Belum ada tujuan aktif.</p> : (
            <div className="mt-4 space-y-3.5">
              {goals.slice(0, 5).map((g) => {
                const p = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0
                return (
                  <div key={g.id}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="t-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{g.name}</span>
                      <span className="num t-sm shrink-0" style={{ color: 'var(--c-mint)' }}>{p.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}><div className="h-full rounded-full" style={{ width: `${p}%`, background: 'var(--c-mint)' }} /></div>
                    <p className="num t-cap mt-1" style={{ color: 'var(--text-mute)' }}>{formatCompactCurrency(g.current_amount)} / {formatCompactCurrency(g.target_amount)}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Forward-looking */}
      {r.upcoming.length > 0 && (
        <div className="s-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-4" style={{ color: 'var(--c-violet)' }} />
            <p className="eyebrow">Kewajiban Bulan Depan · {nextMonthLabel}</p>
          </div>
          <p className="t-sm mt-1" style={{ color: 'var(--ink-soft)' }}>Perkiraan rutin/cicilan/langganan yang bakal jalan — total <span className="num font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(r.upcomingTotal)}</span></p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {r.upcoming.map((u, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--surface-2)' }}>
                <span className="t-sm truncate" style={{ color: 'var(--ink)' }}>{u.name} <span className="t-cap" style={{ color: 'var(--text-mute)' }}>· {u.kind}</span></span>
                <span className="num t-sm font-medium shrink-0" style={{ color: 'var(--ink)' }}>{formatCompactCurrency(u.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sorotan */}
      <div className="s-card p-5 sm:p-6" style={{ background: 'var(--surface-2)' }}>
        <div className="flex items-center gap-2 mb-3"><Sparkles className="size-4" style={{ color: 'var(--c-violet)' }} /><p className="eyebrow" style={{ color: 'var(--c-violet)' }}>Sorotan Bulan Ini</p></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: <Trophy className="size-4" style={{ color: 'var(--c-amber)' }} />, title: `Saving rate ${r.savingRate.toFixed(0)}%`, sub: r.hasPrev ? `${r.savingRateDelta >= 0 ? 'Naik' : 'Turun'} ${Math.abs(r.savingRateDelta).toFixed(0)}pp dari ${r.prevMonthLabel}` : 'Bulan ini' },
            topDown && { icon: <ArrowDownRight className="size-4" style={{ color: 'var(--c-mint)' }} />, title: `${topDown.name} turun`, sub: `Hemat ${formatCompactCurrency(Math.abs(topDown.delta))} vs ${r.prevMonthLabel}` },
            topUp && { icon: <ArrowUpRight className="size-4" style={{ color: 'var(--c-coral)' }} />, title: `${topUp.name} naik`, sub: `+${formatCompactCurrency(topUp.delta)} vs ${r.prevMonthLabel}` },
          ].filter(Boolean).slice(0, 3).map((h, i) => {
            const item = h as { icon: React.ReactNode; title: string; sub: string }
            return <div key={i} className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}><div className="mb-1.5">{item.icon}</div><p className="t-sm font-semibold" style={{ color: 'var(--ink)' }}>{item.title}</p><p className="t-cap mt-0.5" style={{ color: 'var(--text-mute)' }}>{item.sub}</p></div>
          })}
        </div>
      </div>

      {/* Top 10 */}
      {r.top_expenses.length > 0 && (
        <div className="s-card p-5 sm:p-6">
          <p className="eyebrow">Transaksi Terbesar</p>
          <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>Top 10 pengeluaran</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full t-sm">
              <thead><tr className="text-left eyebrow" style={{ color: 'var(--text-mute)' }}><th className="pb-2 font-medium">Tanggal</th><th className="pb-2 font-medium">Deskripsi</th><th className="pb-2 font-medium">Kategori</th><th className="pb-2 font-medium text-right">Jumlah</th></tr></thead>
              <tbody>
                {r.top_expenses.map((tx, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                    <td className="py-2 t-cap num" style={{ color: 'var(--text-mute)' }}>{new Date(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</td>
                    <td className="py-2" style={{ color: 'var(--ink)' }}>{tx.description || '—'}</td>
                    <td className="py-2 t-cap" style={{ color: 'var(--text-mute)' }}>{tx.category}</td>
                    <td className="py-2 text-right num font-semibold" style={{ color: 'var(--c-coral)' }}>{formatCurrency(tx.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {variant === 'print' && (
        <p className="t-cap text-center pt-2" style={{ color: 'var(--text-mute)' }}>Klunting · klunting.com · dibuat {generatedAt}</p>
      )}
    </div>
  )
}

function Kpi({ label, value, pct, note, icon, kind, goodUp }: { label: string; value: number; pct?: number | null; note?: string; icon: React.ReactNode; kind: 'income' | 'expense' | 'amber' | 'violet'; goodUp?: boolean }) {
  const tone: Record<string, { bg: string; fg: string }> = {
    income: { bg: 'var(--c-mint-soft)', fg: 'var(--c-mint)' }, expense: { bg: 'var(--c-coral-soft)', fg: 'var(--c-coral)' },
    amber: { bg: 'var(--c-amber-soft)', fg: 'var(--c-amber)' }, violet: { bg: 'var(--c-violet-soft)', fg: 'var(--c-violet)' },
  }
  const c = tone[kind]; const up = (pct ?? 0) >= 0; const good = goodUp === undefined ? true : up === goodUp
  return (
    <div className="stat-tile">
      <div className="flex items-center justify-between"><p className="eyebrow">{label}</p><div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: c.bg, color: c.fg }}>{icon}</div></div>
      <p className="num tabular font-bold mt-2" style={{ fontSize: 22, letterSpacing: '-0.025em', color: 'var(--ink)' }}><span className="sm:hidden">{formatCompactCurrency(value)}</span><span className="hidden sm:inline">{formatCurrency(value)}</span></p>
      {pct != null ? <p className="num t-cap mt-1" style={{ color: good ? 'var(--c-mint)' : 'var(--c-coral)' }}>{up ? '+' : '−'}{Math.abs(pct).toFixed(0)}% vs bln lalu</p> : note ? <p className="t-cap mt-1" style={{ color: 'var(--text-mute)' }}>{note}</p> : null}
    </div>
  )
}

function Mini({ label, value, text, color, signed }: { label: string; value?: number; text?: string; color: string; signed?: boolean }) {
  return (
    <div>
      <p className="t-cap" style={{ color: 'var(--text-mute)' }}>{label}</p>
      <p className="num tabular font-bold mt-0.5" style={{ fontSize: 17, color }}>
        {text != null ? text : `${signed && (value ?? 0) >= 0 ? '+' : signed && (value ?? 0) < 0 ? '−' : ''}${formatCompactCurrency(Math.abs(value ?? 0))}`}
      </p>
    </div>
  )
}

function Nw({ label, value }: { label: string; value: number }) {
  const neg = value < 0
  return <div className="flex items-center justify-between"><span className="t-sm" style={{ color: 'var(--ink-soft)' }}>{label}</span><span className="num t-sm font-medium" style={{ color: neg ? 'var(--c-coral)' : 'var(--ink)' }}>{neg ? '−' : ''}{formatCurrency(Math.abs(value))}</span></div>
}
