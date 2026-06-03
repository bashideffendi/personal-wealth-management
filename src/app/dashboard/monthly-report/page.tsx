'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import { MONTHS } from '@/lib/constants'
import { fetchLiquidEntries, sumLiquid } from '@/lib/liquid'
import type { Transaction } from '@/types'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Loader2, Printer, TrendingUp, TrendingDown, Calendar, ChevronLeft, ChevronRight,
  PiggyBank, LineChart as LineChartIcon, ArrowUpRight, ArrowDownRight,
  Trophy, Sparkles,
} from 'lucide-react'
import {
  ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'
import { MoneyFlowSankey, type FlowKind } from '@/components/dashboard/money-flow-sankey'

interface UserState { id: string; name: string }
interface GoalRow { id: string; name: string; target_amount: number; current_amount: number; deadline: string | null }

export default function MonthlyReportPage() {
  const supabase = createClient()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<UserState | null>(null)

  // 6 bulan transaksi (bulan terpilih + 5 sebelumnya) buat perbandingan & delta.
  const [allTx, setAllTx] = useState<Transaction[]>([])
  // Net worth components (posisi terkini).
  const [liquidTotal, setLiquidTotal] = useState(0)
  const [nonLiquidTotal, setNonLiquidTotal] = useState(0)
  const [investTotal, setInvestTotal] = useState(0)
  const [debtTotal, setDebtTotal] = useState(0)
  const [ccTotal, setCcTotal] = useState(0)
  const [goals, setGoals] = useState<GoalRow[]>([])

  async function load() {
    setLoading(true)
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) { setLoading(false); return }
    const profRes = await supabase.from('profiles').select('full_name').eq('id', u.id).maybeSingle()
    setUser({
      id: u.id,
      name: (profRes.data as { full_name: string } | null)?.full_name?.trim() || u.email?.split('@')[0] || 'Pengguna',
    })

    // 6-month window: first day of (month - 5) .. first day of (month + 1)
    const sixStart = new Date(year, month - 6, 1)
    const startBound = `${sixStart.getFullYear()}-${String(sixStart.getMonth() + 1).padStart(2, '0')}-01`
    const endBound = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`

    const [txRes, liquidEntries, nlqRes, invRes, debtRes, ccRes, goalsRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('user_id', u.id).gte('date', startBound).lt('date', endBound).order('amount', { ascending: false }),
      fetchLiquidEntries(supabase, u.id),
      supabase.from('assets_non_liquid').select('current_value').eq('user_id', u.id),
      supabase.from('investments').select('total_value').eq('user_id', u.id),
      supabase.from('debts').select('remaining').eq('user_id', u.id).eq('is_active', true),
      supabase.from('credit_cards').select('current_balance').eq('user_id', u.id).eq('is_active', true),
      supabase.from('goals').select('id, name, target_amount, current_amount, deadline').eq('user_id', u.id).eq('is_active', true).order('deadline', { ascending: true, nullsFirst: false }),
    ])

    setAllTx((txRes.data ?? []) as Transaction[])
    setLiquidTotal(sumLiquid(liquidEntries))
    setNonLiquidTotal(((nlqRes.data ?? []) as { current_value: number }[]).reduce((s, a) => s + (a.current_value ?? 0), 0))
    setInvestTotal(((invRes.data ?? []) as { total_value: number }[]).reduce((s, a) => s + (a.total_value ?? 0), 0))
    setDebtTotal(((debtRes.data ?? []) as { remaining: number }[]).reduce((s, a) => s + (a.remaining ?? 0), 0))
    setCcTotal(((ccRes.data ?? []) as { current_balance: number }[]).reduce((s, a) => s + (a.current_balance ?? 0), 0))
    setGoals((goalsRes.data ?? []) as GoalRow[])
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [year, month])

  function bounds(y: number, m: number) {
    const start = `${y}-${String(m).padStart(2, '0')}-01`
    const end = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
    return { start, end }
  }

  function sumByType(txs: Transaction[], type: Transaction['type']) {
    return txs.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0)
  }

  const recap = useMemo(() => {
    const { start, end } = bounds(year, month)
    const cur = allTx.filter((t) => t.date >= start && t.date < end)

    // Prior month
    const pm = month === 1 ? 12 : month - 1
    const py = month === 1 ? year - 1 : year
    const pb = bounds(py, pm)
    const prev = allTx.filter((t) => t.date >= pb.start && t.date < pb.end)

    const income = sumByType(cur, 'income')
    const expense = sumByType(cur, 'expense')
    const saving = sumByType(cur, 'saving')
    const investment = sumByType(cur, 'investment')
    const surplus = income - expense
    const savedTotal = saving + investment
    const savingRate = income > 0 ? (savedTotal / income) * 100 : 0

    const pIncome = sumByType(prev, 'income')
    const pExpense = sumByType(prev, 'expense')
    const pSaved = sumByType(prev, 'saving') + sumByType(prev, 'investment')
    const pSavingRate = pIncome > 0 ? (pSaved / pIncome) * 100 : 0

    const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null)

    // 6-month series ending at selected month
    const series: { label: string; income: number; expense: number; saved: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1)
      const my = d.getFullYear(); const mm = d.getMonth() + 1
      const b = bounds(my, mm)
      const mtx = allTx.filter((t) => t.date >= b.start && t.date < b.end)
      series.push({
        label: MONTHS[mm - 1].slice(0, 3),
        income: sumByType(mtx, 'income'),
        expense: sumByType(mtx, 'expense'),
        saved: sumByType(mtx, 'saving') + sumByType(mtx, 'investment'),
      })
    }

    // Surplus streak (consecutive months with income>expense, ending now)
    let surplusStreak = 0
    for (let i = series.length - 1; i >= 0; i--) {
      if (series[i].income - series[i].expense > 0) surplusStreak++
      else break
    }

    // Expense by category (current) + delta vs prior
    function byCat(txs: Transaction[], type: Transaction['type']) {
      const m: Record<string, number> = {}
      for (const t of txs.filter((x) => x.type === type)) m[t.category] = (m[t.category] || 0) + t.amount
      return m
    }
    const curExpCat = byCat(cur, 'expense')
    const prevExpCat = byCat(prev, 'expense')
    const expense_by_category = Object.entries(curExpCat)
      .map(([name, amount]) => ({
        name, amount,
        prev: prevExpCat[name] || 0,
        delta: amount - (prevExpCat[name] || 0),
        share: expense > 0 ? (amount / expense) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)

    // Biggest shifts vs prior (across all categories that exist in either month)
    const allCatNames = new Set([...Object.keys(curExpCat), ...Object.keys(prevExpCat)])
    const shifts = Array.from(allCatNames)
      .map((name) => {
        const c = curExpCat[name] || 0
        const p = prevExpCat[name] || 0
        return { name, cur: c, prev: p, delta: c - p, pct: pct(c, p) }
      })
      .filter((s) => Math.abs(s.delta) > 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 5)

    const top_expenses = cur.filter((t) => t.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 10)
    const maxBarExp = expense_by_category[0]?.amount || 1

    // Sankey buckets (current month)
    function bucketFlow(type: 'income' | 'expense' | 'saving' | 'investment') {
      const m = byCat(cur, type)
      const arr = Object.entries(m).map(([name, amount]) => ({ name, amount, kind: type as FlowKind })).sort((a, b) => b.amount - a.amount)
      const top = arr.slice(0, 8)
      const rest = arr.slice(8)
      if (rest.length) {
        const restSum = rest.reduce((s, c) => s + c.amount, 0)
        if (restSum > 0) top.push({ name: `+${rest.length} lainnya`, amount: restSum, kind: type as FlowKind })
      }
      return top
    }
    const sankeyIncome = bucketFlow('income')
    const sankeyOutflow = [...bucketFlow('expense'), ...bucketFlow('saving'), ...bucketFlow('investment')]

    // Net worth (posisi terkini)
    const totalAssets = liquidTotal + nonLiquidTotal + investTotal
    const netWorth = totalAssets - debtTotal - ccTotal

    return {
      income, expense, saving, investment, surplus, savedTotal, savingRate,
      incomePct: pct(income, pIncome), expensePct: pct(expense, pExpense),
      savingRateDelta: savingRate - pSavingRate,
      prevMonthLabel: MONTHS[pm - 1],
      series, surplusStreak,
      expense_by_category, shifts, maxBarExp,
      top_expenses,
      sankeyIncome, sankeyOutflow,
      netWorth, totalAssets,
      tx_count: cur.length,
      hasPrev: prev.length > 0,
    }
  }, [allTx, year, month, liquidTotal, nonLiquidTotal, investTotal, debtTotal, ccTotal])

  const yearOpts = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)
  const monthOpts = MONTHS.map((m, i) => ({ value: i + 1, label: m }))
  const periodLabel = `${MONTHS[month - 1]} ${year}`

  function shiftMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-mute)' }}>
        <Loader2 className="size-5 animate-spin mr-2" /> Menyiapkan laporan…
      </div>
    )
  }

  // Narrative + chips
  const surplusWord = recap.surplus >= 0 ? 'surplus' : 'defisit'
  const chips: string[] = []
  if (recap.surplusStreak >= 2) chips.push(`Surplus ${recap.surplusStreak} bulan beruntun`)
  if (recap.hasPrev && Math.abs(recap.savingRateDelta) >= 0.5) {
    chips.push(`Saving rate ${recap.savingRateDelta >= 0 ? 'naik' : 'turun'} ${Math.abs(recap.savingRateDelta).toFixed(0)}pp`)
  }
  const topShiftUp = recap.shifts.find((s) => s.delta > 0)
  if (topShiftUp) chips.push(`${topShiftUp.name} naik ${formatCompactCurrency(topShiftUp.delta)}`)
  const topShiftDown = recap.shifts.find((s) => s.delta < 0)
  if (topShiftDown) chips.push(`${topShiftDown.name} turun ${formatCompactCurrency(Math.abs(topShiftDown.delta))}`)

  return (
    <div className="space-y-6">
      {/* Header — clean report document */}
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow">Ringkasan Bulanan · {periodLabel}</p>
          <h1 className="t-display mt-1" style={{ color: 'var(--ink)' }}>
            Laporan {MONTHS[month - 1]}
          </h1>
          <p className="t-body mt-1.5 max-w-xl" style={{ color: 'var(--ink-soft)' }}>
            Catatan keuangan kamu di bulan {MONTHS[month - 1]} {year}. Cocok buat arsip atau dibagikan ke pendamping.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => shiftMonth(-1)} className="btn-outline" style={{ padding: '8px 10px' }} aria-label="Bulan sebelumnya">
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" onClick={() => shiftMonth(1)} className="btn-outline" style={{ padding: '8px 10px' }} aria-label="Bulan berikutnya">
              <ChevronRight className="size-4" />
            </button>
          </div>
          <Select value={String(month)} onValueChange={(v) => v && setMonth(Number(v))}>
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Bulan">{(v) => MONTHS[Number(v) - 1] ?? v}</SelectValue></SelectTrigger>
            <SelectContent>{monthOpts.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => v && setYear(Number(v))}>
            <SelectTrigger className="w-[92px]"><SelectValue placeholder="Tahun">{(v) => v}</SelectValue></SelectTrigger>
            <SelectContent>{yearOpts.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Button
            onClick={() => window.open(`/print/monthly-report?year=${year}&month=${month}`, '_blank')}
            disabled={recap.tx_count === 0}
            style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)', border: 0 }}
          >
            <Printer className="size-4" data-icon="inline-start" />
            Unduh PDF
          </Button>
        </div>
      </header>

      {recap.tx_count === 0 ? (
        <div className="s-card p-10 sm:p-14 text-center">
          <Calendar className="size-12 mx-auto" style={{ color: 'var(--text-mute)' }} />
          <h3 className="t-h2 mt-4" style={{ color: 'var(--ink)' }}>Tidak ada transaksi di {periodLabel}</h3>
          <p className="t-sm max-w-md mx-auto mt-2" style={{ color: 'var(--ink-soft)' }}>
            Belum ada data buat di-recap. Mulai catat transaksi atau pilih bulan lain.
          </p>
        </div>
      ) : (
        <>
          {/* KPI grid with deltas vs prior month */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Pemasukan" value={recap.income} pct={recap.incomePct} icon={<TrendingUp className="size-4" />} kind="income" goodWhenUp />
            <KpiCard label="Pengeluaran" value={recap.expense} pct={recap.expensePct} icon={<TrendingDown className="size-4" />} kind="expense" goodWhenUp={false} />
            <KpiCard label="Ditabung" value={recap.saving} note={`${recap.income > 0 ? ((recap.saving / recap.income) * 100).toFixed(0) : 0}% dari pendapatan`} icon={<PiggyBank className="size-4" />} kind="amber" />
            <KpiCard label="Diinvestasikan" value={recap.investment} note={`${recap.income > 0 ? ((recap.investment / recap.income) * 100).toFixed(0) : 0}% dari pendapatan`} icon={<LineChartIcon className="size-4" />} kind="violet" />
          </div>

          {/* Narrative */}
          <div className="s-card p-5 sm:p-6" style={{ background: 'var(--surface-2)' }}>
            <p className="eyebrow" style={{ color: 'var(--c-primary)' }}>Ringkasan Naratif</p>
            <p className="t-h2 mt-2" style={{ color: 'var(--ink)', fontWeight: 500, lineHeight: 1.5 }}>
              Bulan {MONTHS[month - 1]} {year} berakhir dengan {surplusWord}{' '}
              <span className="num font-bold" style={{ color: recap.surplus >= 0 ? 'var(--c-mint)' : 'var(--c-coral)' }}>
                {formatCurrency(Math.abs(recap.surplus))}
              </span>
              . Kamu menabung &amp; investasi{' '}
              <span className="num font-bold" style={{ color: 'var(--c-mint)' }}>{recap.savingRate.toFixed(0)}%</span>{' '}
              dari pendapatan — {recap.savingRate >= 20 ? 'di atas' : 'di bawah'} standar ideal 20%.
            </p>
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {chips.map((c, i) => (
                  <span key={i} className="rounded-full px-3 py-1 t-cap font-medium" style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink-soft)' }}>
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 6-month comparison + biggest shifts */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="s-card p-5 sm:p-6 lg:col-span-3">
              <p className="eyebrow">Perbandingan 6 Bulan</p>
              <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>Tren pemasukan vs pengeluaran</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={recap.series} barGap={3} barCategoryGap="22%" margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
                  <XAxis dataKey="label" fontSize={11} tick={{ fill: 'var(--ink-muted)' }} axisLine={{ stroke: 'var(--border-soft)' }} tickLine={false} />
                  <YAxis fontSize={11} tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}jt`} tick={{ fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: unknown, n) => [formatCurrency(Number(v) || 0), n === 'income' ? 'Pemasukan' : n === 'expense' ? 'Pengeluaran' : 'Nabung+Investasi']}
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} formatter={(v) => (v === 'income' ? 'Pemasukan' : v === 'expense' ? 'Pengeluaran' : 'Nabung+Investasi')} />
                  <Bar dataKey="income" name="income" fill="#10B981" radius={[3, 3, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="expense" name="expense" fill="#F43F5E" radius={[3, 3, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="saved" name="saved" fill="#8B5CF6" radius={[3, 3, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="s-card p-5 sm:p-6 lg:col-span-2">
              <p className="eyebrow">Pergeseran Terbesar</p>
              <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>vs {recap.prevMonthLabel}</h3>
              {recap.shifts.length === 0 ? (
                <p className="t-sm mt-4" style={{ color: 'var(--text-mute)' }}>Belum cukup data bulan lalu buat dibandingin.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {recap.shifts.map((s) => {
                    const up = s.delta > 0
                    return (
                      <div key={s.name} className="flex items-center justify-between gap-3">
                        <span className="t-sm truncate" style={{ color: 'var(--ink)' }}>{s.name}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="num t-sm font-medium" style={{ color: up ? 'var(--c-coral)' : 'var(--c-mint)' }}>
                            {up ? '+' : '−'}{formatCompactCurrency(Math.abs(s.delta))}
                          </span>
                          {s.pct != null && (
                            <span className="inline-flex items-center gap-0.5 t-cap num" style={{ color: 'var(--text-mute)' }}>
                              {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                              {Math.abs(s.pct).toFixed(0)}%
                            </span>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sankey — aliran uang */}
          <div className="s-card p-4 sm:p-6">
            <div className="mb-3 sm:mb-4">
              <p className="eyebrow">Aliran Uang</p>
              <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>Dari mana & ke mana — {MONTHS[month - 1]}</h3>
            </div>
            <div className="hidden md:block">
              <MoneyFlowSankey
                income={recap.sankeyIncome}
                outflow={recap.sankeyOutflow}
                height={Math.max(340, Math.min(480, 90 + Math.max(recap.sankeyIncome.length, recap.sankeyOutflow.length) * 36))}
                emptyMessage="Belum ada aliran buat divisualisasiin bulan ini."
              />
            </div>
            <div className="md:hidden">
              <MoneyFlowSankey
                income={recap.sankeyIncome}
                outflow={recap.sankeyOutflow}
                compact
                height={Math.max(300, Math.min(420, 60 + Math.max(recap.sankeyIncome.length, recap.sankeyOutflow.length) * 30))}
                emptyMessage="Belum ada aliran buat divisualisasiin bulan ini."
              />
            </div>
          </div>

          {/* Pengeluaran per kategori — bar + delta vs prior */}
          {recap.expense_by_category.length > 0 && (
            <div className="s-card p-5 sm:p-6">
              <p className="eyebrow">Pengeluaran per Kategori</p>
              <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>
                {MONTHS[month - 1]} {recap.hasPrev && <span className="t-sm font-normal" style={{ color: 'var(--text-mute)' }}>· delta vs {recap.prevMonthLabel}</span>}
              </h3>
              <div className="mt-4 space-y-2.5">
                {recap.expense_by_category.map((row) => (
                  <div key={row.name} className="flex items-center gap-3">
                    <span className="t-sm w-32 sm:w-40 shrink-0 truncate" style={{ color: 'var(--ink)' }}>{row.name}</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                      <div className="h-full rounded-full" style={{ width: `${(row.amount / recap.maxBarExp) * 100}%`, background: 'var(--c-violet)' }} />
                    </div>
                    <span className="num t-sm font-semibold w-28 text-right shrink-0" style={{ color: 'var(--ink)' }}>{formatCurrency(row.amount)}</span>
                    {recap.hasPrev && (
                      <span className="num t-cap w-24 text-right shrink-0" style={{ color: row.delta > 0 ? 'var(--c-coral)' : row.delta < 0 ? 'var(--c-mint)' : 'var(--text-mute)' }}>
                        {row.delta === 0 ? '—' : `${row.delta > 0 ? '+' : '−'}${formatCompactCurrency(Math.abs(row.delta))}`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Net worth + Goals */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="s-card p-5 sm:p-6">
              <p className="eyebrow">Net Worth</p>
              <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>Posisi terkini</h3>
              <p className="num font-bold mt-3" style={{ fontSize: 30, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
                {formatCurrency(recap.netWorth)}
              </p>
              <div className="mt-4 space-y-2">
                <NwRow label="Aset Likuid" value={liquidTotal} />
                <NwRow label="Investasi" value={investTotal} />
                <NwRow label="Aset Non-Likuid" value={nonLiquidTotal} />
                <NwRow label="Utang" value={-debtTotal} />
                <NwRow label="Kartu Kredit" value={-ccTotal} />
              </div>
              <p className="t-cap mt-3" style={{ color: 'var(--text-mute)' }}>
                Saldo posisi terkini (Klunting belum nyimpen snapshot bulanan, jadi ini bukan saldo persis akhir {MONTHS[month - 1]}).
              </p>
            </div>

            <div className="s-card p-5 sm:p-6">
              <p className="eyebrow">Tujuan</p>
              <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>Kemajuan tujuan</h3>
              {goals.length === 0 ? (
                <p className="t-sm mt-4" style={{ color: 'var(--text-mute)' }}>Belum ada tujuan aktif.</p>
              ) : (
                <div className="mt-4 space-y-3.5">
                  {goals.slice(0, 5).map((g) => {
                    const pctDone = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0
                    return (
                      <div key={g.id}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="t-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{g.name}</span>
                          <span className="num t-sm shrink-0" style={{ color: 'var(--c-mint)' }}>{pctDone.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                          <div className="h-full rounded-full" style={{ width: `${pctDone}%`, background: 'var(--c-mint)' }} />
                        </div>
                        <p className="num t-cap mt-1" style={{ color: 'var(--text-mute)' }}>
                          {formatCompactCurrency(g.current_amount)} / {formatCompactCurrency(g.target_amount)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sorotan */}
          {chips.length > 0 && (
            <div className="s-card p-5 sm:p-6" style={{ background: 'var(--surface-2)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="size-4" style={{ color: 'var(--c-violet)' }} />
                <p className="eyebrow" style={{ color: 'var(--c-violet)' }}>Sorotan Bulan Ini</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  recap.savingRate > 0 && { icon: <Trophy className="size-4" style={{ color: 'var(--c-amber)' }} />, title: `Saving rate ${recap.savingRate.toFixed(0)}%`, sub: recap.hasPrev ? `${recap.savingRateDelta >= 0 ? 'Naik' : 'Turun'} ${Math.abs(recap.savingRateDelta).toFixed(0)}pp dari ${recap.prevMonthLabel}` : 'Bulan ini' },
                  topShiftDown && { icon: <ArrowDownRight className="size-4" style={{ color: 'var(--c-mint)' }} />, title: `${topShiftDown.name} turun`, sub: `Hemat ${formatCompactCurrency(Math.abs(topShiftDown.delta))} vs ${recap.prevMonthLabel}` },
                  topShiftUp && { icon: <ArrowUpRight className="size-4" style={{ color: 'var(--c-coral)' }} />, title: `${topShiftUp.name} naik`, sub: `+${formatCompactCurrency(topShiftUp.delta)} vs ${recap.prevMonthLabel}` },
                ].filter(Boolean).slice(0, 3).map((h, i) => {
                  const item = h as { icon: React.ReactNode; title: string; sub: string }
                  return (
                    <div key={i} className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
                      <div className="mb-1.5">{item.icon}</div>
                      <p className="t-sm font-semibold" style={{ color: 'var(--ink)' }}>{item.title}</p>
                      <p className="t-cap mt-0.5" style={{ color: 'var(--text-mute)' }}>{item.sub}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Top transactions */}
          {recap.top_expenses.length > 0 && (
            <div className="s-card p-5 sm:p-6">
              <p className="eyebrow">Transaksi Terbesar</p>
              <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>Top 10 pengeluaran</h3>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full t-sm">
                  <thead>
                    <tr className="text-left eyebrow" style={{ color: 'var(--text-mute)' }}>
                      <th className="pb-2 font-medium">Tanggal</th>
                      <th className="pb-2 font-medium">Deskripsi</th>
                      <th className="pb-2 font-medium">Kategori</th>
                      <th className="pb-2 font-medium text-right">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recap.top_expenses.map((tx, i) => (
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
        </>
      )}
    </div>
  )
}

function KpiCard({ label, value, pct, note, icon, kind, goodWhenUp }: {
  label: string; value: number; pct?: number | null; note?: string; icon: React.ReactNode
  kind: 'income' | 'expense' | 'amber' | 'violet'; goodWhenUp?: boolean
}) {
  const tone: Record<string, { bg: string; fg: string }> = {
    income: { bg: 'var(--c-mint-soft)', fg: 'var(--c-mint)' },
    expense: { bg: 'var(--c-coral-soft)', fg: 'var(--c-coral)' },
    amber: { bg: 'var(--c-amber-soft)', fg: 'var(--c-amber)' },
    violet: { bg: 'var(--c-violet-soft)', fg: 'var(--c-violet)' },
  }
  const c = tone[kind]
  const up = (pct ?? 0) >= 0
  const good = goodWhenUp === undefined ? true : (up === goodWhenUp)
  return (
    <div className="stat-tile">
      <div className="flex items-center justify-between">
        <p className="eyebrow">{label}</p>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: c.bg, color: c.fg }}>{icon}</div>
      </div>
      <p className="num tabular font-bold mt-2" style={{ fontSize: 22, letterSpacing: '-0.025em', color: 'var(--ink)' }}>
        <span className="sm:hidden">{formatCompactCurrency(value)}</span>
        <span className="hidden sm:inline">{formatCurrency(value)}</span>
      </p>
      {pct != null ? (
        <p className="num t-cap mt-1" style={{ color: good ? 'var(--c-mint)' : 'var(--c-coral)' }}>
          {up ? '+' : '−'}{Math.abs(pct).toFixed(0)}% vs bln lalu
        </p>
      ) : note ? (
        <p className="t-cap mt-1" style={{ color: 'var(--text-mute)' }}>{note}</p>
      ) : null}
    </div>
  )
}

function NwRow({ label, value }: { label: string; value: number }) {
  const neg = value < 0
  return (
    <div className="flex items-center justify-between">
      <span className="t-sm" style={{ color: 'var(--ink-soft)' }}>{label}</span>
      <span className="num t-sm font-medium" style={{ color: neg ? 'var(--c-coral)' : 'var(--ink)' }}>
        {neg ? '−' : ''}{formatCurrency(Math.abs(value))}
      </span>
    </div>
  )
}
