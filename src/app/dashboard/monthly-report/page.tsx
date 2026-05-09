'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { MONTHS } from '@/lib/constants'
import type { Transaction } from '@/types'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Loader2, FileDown, TrendingUp, TrendingDown, Calendar,
  Trophy, Activity, Wallet, PieChart as PieIcon,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import type { ReportData } from '@/components/monthly-report/report-pdf'

// PDF components are SSR-incompatible — load only on client
const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((m) => m.PDFDownloadLink),
  { ssr: false, loading: () => <span className="text-sm text-muted-foreground">Menyiapkan PDF...</span> },
)
const MonthlyReportPDF = dynamic(
  () => import('@/components/monthly-report/report-pdf').then((m) => ({ default: m.MonthlyReportPDF })),
  { ssr: false },
)

interface UserState { id: string; name: string }

export default function MonthlyReportPage() {
  const supabase = createClient()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<UserState | null>(null)
  const [txs, setTxs] = useState<Transaction[]>([])

  async function load() {
    setLoading(true)
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) { setLoading(false); return }
    // Get profile for name
    const profRes = await supabase.from('profiles').select('full_name').eq('id', u.id).maybeSingle()
    setUser({
      id: u.id,
      name: (profRes.data as { full_name: string } | null)?.full_name?.trim() || u.email?.split('@')[0] || 'Pengguna',
    })

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endMonth = month === 12 ? 1 : month + 1
    const endYear = month === 12 ? year + 1 : year
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', u.id)
      .gte('date', startDate)
      .lt('date', endDate)
      .order('amount', { ascending: false })
    setTxs((data ?? []) as Transaction[])
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [year, month])

  const recap = useMemo(() => {
    const income = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const saving = txs.filter((t) => t.type === 'saving').reduce((s, t) => s + t.amount, 0)
    const investment = txs.filter((t) => t.type === 'investment').reduce((s, t) => s + t.amount, 0)
    const net = income - expense - saving - investment
    const savingRate = income > 0 ? ((saving + investment) / income) * 100 : 0

    // Income by category
    const incCat: Record<string, number> = {}
    for (const t of txs.filter((t) => t.type === 'income')) {
      incCat[t.category] = (incCat[t.category] || 0) + t.amount
    }
    const income_by_category = Object.entries(incCat)
      .sort(([, a], [, b]) => b - a)
      .map(([name, amount]) => ({ name, amount, pct: income > 0 ? (amount / income) * 100 : 0 }))

    // Expense by category
    const expCat: Record<string, number> = {}
    for (const t of txs.filter((t) => t.type === 'expense')) {
      expCat[t.category] = (expCat[t.category] || 0) + t.amount
    }
    const expense_by_category = Object.entries(expCat)
      .sort(([, a], [, b]) => b - a)
      .map(([name, amount]) => ({ name, amount, pct: expense > 0 ? (amount / expense) * 100 : 0 }))

    // Top expense transactions
    const top_expenses = txs
      .filter((t) => t.type === 'expense')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)

    const biggest_expense = top_expenses[0] ?? null

    // Busiest day
    const dayMap: Record<string, { count: number; amount: number }> = {}
    for (const t of txs) {
      const d = t.date
      if (!dayMap[d]) dayMap[d] = { count: 0, amount: 0 }
      dayMap[d].count += 1
      dayMap[d].amount += t.amount
    }
    const busiest = Object.entries(dayMap).sort(([, a], [, b]) => b.count - a.count)[0]
    const busiest_day = busiest ? { date: busiest[0], count: busiest[1].count, amount: busiest[1].amount } : null

    // Daily expense bar (28-31 days)
    const daysInMonth = new Date(year, month, 0).getDate()
    const dailyExp: { day: string; expense: number; income: number }[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const dayTxs = txs.filter((t) => t.date === key)
      dailyExp.push({
        day: String(d),
        expense: dayTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
        income: dayTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      })
    }

    return {
      income, expense, saving, investment, net, savingRate,
      income_by_category, expense_by_category,
      top_expenses, biggest_expense, busiest_day,
      dailyExp,
      tx_count: txs.length,
    }
  }, [txs, year, month])

  const reportData: ReportData | null = user ? {
    user_name: user.name,
    period_label: `${MONTHS[month - 1]} ${year}`,
    generated_at: now.toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }) + ' WIB',
    income: recap.income,
    expense: recap.expense,
    saving: recap.saving,
    investment: recap.investment,
    net: recap.net,
    saving_rate: recap.savingRate,
    tx_count: recap.tx_count,
    income_by_category: recap.income_by_category,
    expense_by_category: recap.expense_by_category,
    top_expenses: recap.top_expenses.map((t) => ({
      date: t.date, type: t.type, category: t.category,
      description: t.description, amount: t.amount,
    })),
    biggest_expense: recap.biggest_expense ? {
      date: recap.biggest_expense.date, type: 'expense',
      category: recap.biggest_expense.category,
      description: recap.biggest_expense.description,
      amount: recap.biggest_expense.amount,
    } : null,
    busiest_day: recap.busiest_day,
  } : null

  const yearOpts = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)
  const monthOpts = MONTHS.map((m, i) => ({ value: i + 1, label: m }))
  const periodLabel = `${MONTHS[month - 1]} ${year}`

  // Donut data
  const expenseDonut = recap.expense_by_category.slice(0, 6).map((c) => ({ name: c.name, value: c.amount }))
  const PIE_COLORS = ['#8B1538', '#D97706', '#059669', '#4F46E5', '#E11D48', '#737373']

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" /> Menyiapkan laporan...
      </div>
    )
  }

  const netUp = recap.net >= 0

  return (
    <div className="space-y-6">
      {/* Title + period selector + download */}
      <div className="dark-card p-6 sm:p-7">
        <p className="caps">Laporan Bulanan</p>
        <div className="mt-2 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-white text-3xl sm:text-4xl font-semibold tracking-tight">
              {periodLabel}
            </h2>
            <p className="text-sm mt-2" style={{ color: 'var(--on-black-mut)' }}>
              {recap.tx_count} transaksi · disiapkan untuk {user?.name ?? 'Anda'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={String(month)} onValueChange={(v) => v && setMonth(Number(v))}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthOpts.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => v && setYear(Number(v))}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOpts.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            {reportData && recap.tx_count > 0 && (
              <PDFDownloadLink
                document={<MonthlyReportPDF data={reportData} />}
                fileName={`Laporan-Bulanan-${periodLabel.replace(' ', '-')}.pdf`}
              >
                {({ loading: pdfLoading }) => (
                  <Button disabled={pdfLoading}>
                    {pdfLoading ? <Loader2 className="size-4 animate-spin" data-icon="inline-start" /> : <FileDown className="size-4" data-icon="inline-start" />}
                    {pdfLoading ? 'Generating...' : 'Download PDF'}
                  </Button>
                )}
              </PDFDownloadLink>
            )}
          </div>
        </div>
      </div>

      {recap.tx_count === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-muted bg-muted/20 p-10 sm:p-14 text-center">
          <Calendar className="size-12 mx-auto text-muted-foreground/60" />
          <h3 className="mt-4 text-lg font-semibold">Tidak ada transaksi di {periodLabel}</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mt-2">
            Belum ada data buat di-recap. Mulai catat transaksi atau pilih bulan lain.
          </p>
        </div>
      ) : (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Pemasukan" value={formatCurrency(recap.income)} accent="emerald" icon={<TrendingUp className="size-4" />} />
            <KpiCard label="Pengeluaran" value={formatCurrency(recap.expense)} accent="rose" icon={<TrendingDown className="size-4" />} />
            <KpiCard label="Tabungan + Investasi" value={formatCurrency(recap.saving + recap.investment)} accent="amber" icon={<Wallet className="size-4" />} note={`Saving rate ${recap.savingRate.toFixed(1)}%`} />
            <KpiCard label="Net Cashflow" value={`${netUp ? '+' : ''}${formatCurrency(recap.net)}`} accent={netUp ? 'emerald' : 'rose'} icon={netUp ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />} />
          </div>

          {/* Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recap.biggest_expense && (
              <Highlight
                icon={<Trophy className="size-4 text-amber-700" />}
                label="Pengeluaran Terbesar"
                main={recap.biggest_expense.description || recap.biggest_expense.category}
                value={formatCurrency(recap.biggest_expense.amount)}
                sub={`${recap.biggest_expense.category} · ${new Date(recap.biggest_expense.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}`}
                tone="amber"
              />
            )}
            {recap.busiest_day && (
              <Highlight
                icon={<Activity className="size-4 text-blue-700" />}
                label="Hari Paling Aktif"
                main={new Date(recap.busiest_day.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                value={`${recap.busiest_day.count} transaksi`}
                sub={`Total: ${formatCurrency(recap.busiest_day.amount)}`}
                tone="blue"
              />
            )}
            <Highlight
              icon={<PieIcon className="size-4 text-purple-700" />}
              label="Kategori Dominan"
              main={recap.expense_by_category[0]?.name ?? '—'}
              value={recap.expense_by_category[0] ? formatCurrency(recap.expense_by_category[0].amount) : '—'}
              sub={recap.expense_by_category[0] ? `${recap.expense_by_category[0].pct.toFixed(1)}% dari total pengeluaran` : ''}
              tone="purple"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Daily bar */}
            <div className="s-card p-5 lg:col-span-3">
              <p className="caps">Aktivitas Harian</p>
              <h3 className="font-semibold mt-0.5">Pemasukan vs Pengeluaran per Hari</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={recap.dailyExp} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
                  <XAxis dataKey="day" fontSize={10} tick={{ fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}jt`} tick={{ fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: unknown, name) => [formatCurrency(Number(v) || 0), String(name) === 'income' ? 'Pemasukan' : 'Pengeluaran']}
                    labelFormatter={(d) => `Tgl ${d}`}
                    contentStyle={{ background: 'white', border: '1px solid var(--border-soft)', borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="income" fill="#059669" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expense" fill="#E11D48" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Donut by category */}
            <div className="s-card p-5 lg:col-span-2">
              <p className="caps">Komposisi Pengeluaran</p>
              <h3 className="font-semibold mt-0.5">Top Kategori</h3>
              {expenseDonut.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                  Belum ada pengeluaran.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={expenseDonut} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} dataKey="value">
                      {expenseDonut.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v: unknown) => formatCurrency(Number(v) || 0)}
                      contentStyle={{ background: 'white', border: '1px solid var(--border-soft)', borderRadius: 8, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="mt-3 space-y-1.5">
                {expenseDonut.map((c, i) => (
                  <div key={c.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {c.name}
                    </span>
                    <span className="font-medium tabular-nums">{formatCurrency(c.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top categories table */}
          {recap.expense_by_category.length > 0 && (
            <div className="s-card p-5">
              <p className="caps">Pengeluaran per Kategori</p>
              <h3 className="font-semibold mt-0.5">Lengkap Diurutkan dari Terbesar</h3>
              <div className="mt-4 space-y-2">
                {recap.expense_by_category.map((row, i) => (
                  <div key={row.name} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground tabular-nums w-6">{i + 1}.</span>
                    <span className="text-sm flex-1">{row.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden max-w-[200px]">
                      <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: 'var(--burgundy-700, #8B1538)' }} />
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">{row.pct.toFixed(1)}%</span>
                    <span className="text-sm font-semibold tabular-nums w-32 text-right">{formatCurrency(row.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer note */}
          <div className="rounded-lg border bg-muted/30 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              💡 Klik <strong>Download PDF</strong> di atas untuk export laporan ini ke file PDF berformat A4 — siap di-share atau di-print.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

function KpiCard({ label, value, accent, icon, note }: { label: string; value: string; accent: 'emerald' | 'rose' | 'amber' | 'indigo'; icon: React.ReactNode; note?: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    emerald: { bg: '#D1FAE5', fg: '#059669' },
    rose:    { bg: '#FFE4E6', fg: '#E11D48' },
    amber:   { bg: '#FEF3C7', fg: '#D97706' },
    indigo:  { bg: '#E0E7FF', fg: '#4F46E5' },
  }
  const c = colors[accent]
  return (
    <div className="s-card p-5">
      <div className="flex items-center justify-between">
        <p className="caps">{label}</p>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: c.bg, color: c.fg }}>
          {icon}
        </div>
      </div>
      <p className="font-display text-xl mt-2 tabular font-bold" style={{ color: c.fg }}>{value}</p>
      {note && <p className="text-[11px] text-muted-foreground mt-1">{note}</p>}
    </div>
  )
}

function Highlight({ icon, label, main, value, sub, tone }: {
  icon: React.ReactNode; label: string; main: string; value: string; sub: string; tone: 'amber' | 'blue' | 'purple'
}) {
  const tones: Record<string, { bg: string; border: string }> = {
    amber:  { bg: '#FFFBEB', border: '#FCD34D' },
    blue:   { bg: '#EFF6FF', border: '#93C5FD' },
    purple: { bg: '#FAF5FF', border: '#C4B5FD' },
  }
  const t = tones[tone]
  return (
    <div className="rounded-xl border p-4" style={{ background: t.bg, borderColor: t.border }}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="caps">{label}</p>
      </div>
      <p className="font-semibold mt-2 line-clamp-1">{main}</p>
      <p className="text-lg font-bold mt-0.5 tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  )
}
