'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { MONTHS } from '@/lib/constants'
import type { Transaction } from '@/types'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Loader2, Printer, TrendingUp, TrendingDown, Calendar,
  Trophy, Activity, Wallet, PieChart as PieIcon,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

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

    const incCat: Record<string, number> = {}
    for (const t of txs.filter((t) => t.type === 'income')) {
      incCat[t.category] = (incCat[t.category] || 0) + t.amount
    }
    const income_by_category = Object.entries(incCat)
      .sort(([, a], [, b]) => b - a)
      .map(([name, amount]) => ({ name, amount, pct: income > 0 ? (amount / income) * 100 : 0 }))

    const expCat: Record<string, number> = {}
    for (const t of txs.filter((t) => t.type === 'expense')) {
      expCat[t.category] = (expCat[t.category] || 0) + t.amount
    }
    const expense_by_category = Object.entries(expCat)
      .sort(([, a], [, b]) => b - a)
      .map(([name, amount]) => ({ name, amount, pct: expense > 0 ? (amount / expense) * 100 : 0 }))

    const top_expenses = txs
      .filter((t) => t.type === 'expense')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)

    const biggest_expense = top_expenses[0] ?? null

    const dayMap: Record<string, { count: number; amount: number }> = {}
    for (const t of txs) {
      const d = t.date
      if (!dayMap[d]) dayMap[d] = { count: 0, amount: 0 }
      dayMap[d].count += 1
      dayMap[d].amount += t.amount
    }
    const busiest = Object.entries(dayMap).sort(([, a], [, b]) => b.count - a.count)[0]
    const busiest_day = busiest ? { date: busiest[0], count: busiest[1].count, amount: busiest[1].amount } : null

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

  const yearOpts = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)
  const monthOpts = MONTHS.map((m, i) => ({ value: i + 1, label: m }))
  const periodLabel = `${MONTHS[month - 1]} ${year}`

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
  const generatedDate = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB'

  return (
    <>
      {/* PRINT CSS — applied only when printing/saving as PDF.
          - Hide sidebar/header/quick-add/dialogs (no app chrome in PDF)
          - Reset main scroll area so full content prints
          - Force high-contrast colors (override CSS vars that might use OKLCH)
          - Page break between major sections, A4 portrait friendly
      */}
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 14mm; }
          html, body { background: white !important; }
          /* Hide app chrome */
          aside, header, .quick-add-fab, [role="dialog"] { display: none !important; }
          main { overflow: visible !important; padding: 0 !important; }
          .max-w-\\[1400px\\] { max-width: 100% !important; }
          /* Hide print button itself + selectors */
          .no-print { display: none !important; }
          /* Tighten spacing for print */
          .space-y-6 > * + * { margin-top: 12px !important; }
          /* Force backgrounds + colors to print */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Page breaks */
          .print-page-break { page-break-before: always; }
          .print-avoid-break { page-break-inside: avoid; }
        }
      `}</style>

      <div className="space-y-6">
        {/* Header — dark gradient anchor */}
        <section
          className="relative overflow-hidden rounded-3xl print-avoid-break"
          style={{
            background: 'linear-gradient(135deg, #0A0A0F 0%, #14141A 50%, #0F1F1A 100%)',
            color: '#F5F5F7',
            boxShadow: '0 24px 60px -20px rgba(0,0,0,0.40)',
          }}
        >
          <div
            className="absolute pointer-events-none"
            style={{
              top: -100, right: -60, width: 360, height: 360,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(16, 185, 129, 0.16), transparent 65%)',
            }}
          />
        <div className="relative p-6 sm:p-7">
          <p
            className="text-[11px] font-semibold tracking-[0.18em] uppercase"
            style={{ color: '#6EE7B7' }}
          >
            Laporan Bulanan
          </p>
          <div className="mt-3 flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1
                className="font-bold tracking-tight"
                style={{
                  fontSize: 'clamp(28px, 4vw, 40px)',
                  color: '#FFFFFF',
                  letterSpacing: '-0.035em',
                }}
              >
                {periodLabel}
              </h1>
              <p className="text-sm mt-3" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {recap.tx_count} transaksi · disiapkan untuk {user?.name ?? 'Anda'}
              </p>
              <p className="text-xs mt-1 hidden print:block" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Dibuat: {generatedDate}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-center no-print">
              <Select value={String(month)} onValueChange={(v) => v && setMonth(Number(v))}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Bulan">
                    {(v) => MONTHS[Number(v) - 1] ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {monthOpts.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(year)} onValueChange={(v) => v && setYear(Number(v))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Tahun">
                    {(v) => v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {yearOpts.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                onClick={() => window.open(`/print/monthly-report?year=${year}&month=${month}`, '_blank')}
                disabled={recap.tx_count === 0}
                style={{
                  background: '#10B981',
                  color: '#FFFFFF',
                  border: 0,
                  boxShadow: '0 4px 12px -4px rgba(16, 185, 129, 0.40)',
                }}
              >
                <Printer className="size-4" data-icon="inline-start" />
                Cetak / Simpan PDF
              </Button>
            </div>
          </div>
        </div>
        </section>

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
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 print-avoid-break">
              <KpiCard label="Pemasukan" value={formatCurrency(recap.income)} accent="emerald" icon={<TrendingUp className="size-4" />} />
              <KpiCard label="Pengeluaran" value={formatCurrency(recap.expense)} accent="rose" icon={<TrendingDown className="size-4" />} />
              <KpiCard label="Tabungan + Investasi" value={formatCurrency(recap.saving + recap.investment)} accent="amber" icon={<Wallet className="size-4" />} note={`Saving rate ${recap.savingRate.toFixed(1)}%`} />
              <KpiCard label="Net Cashflow" value={`${netUp ? '+' : ''}${formatCurrency(recap.net)}`} accent={netUp ? 'emerald' : 'rose'} icon={netUp ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />} />
            </div>

            {/* Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print-avoid-break">
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
                  icon={<Activity className="size-4" style={{ color: 'var(--sky-600)' }} />}
                  label="Hari Paling Aktif"
                  main={new Date(recap.busiest_day.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                  value={`${recap.busiest_day.count} transaksi`}
                  sub={`Total: ${formatCurrency(recap.busiest_day.amount)}`}
                  tone="blue"
                />
              )}
              <Highlight
                icon={<PieIcon className="size-4" style={{ color: 'var(--c-violet)' }} />}
                label="Kategori Dominan"
                main={recap.expense_by_category[0]?.name ?? '—'}
                value={recap.expense_by_category[0] ? formatCurrency(recap.expense_by_category[0].amount) : '—'}
                sub={recap.expense_by_category[0] ? `${recap.expense_by_category[0].pct.toFixed(1)}% dari total pengeluaran` : ''}
                tone="purple"
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 print-page-break">
              <div className="s-card p-5 lg:col-span-3 print-avoid-break">
                <p className="eyebrow">Aktivitas Harian</p>
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

              <div className="s-card p-5 lg:col-span-2 print-avoid-break">
                <p className="eyebrow">Komposisi Pengeluaran</p>
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
              <div className="s-card p-5 print-avoid-break">
                <p className="eyebrow">Pengeluaran per Kategori</p>
                <h3 className="font-semibold mt-0.5">Lengkap Diurutkan dari Terbesar</h3>
                <div className="mt-4 space-y-2">
                  {recap.expense_by_category.map((row, i) => (
                    <div key={row.name} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground tabular-nums w-6">{i + 1}.</span>
                      <span className="text-sm flex-1">{row.name}</span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden max-w-[200px]">
                        <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: '#8B1538' }} />
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">{row.pct.toFixed(1)}%</span>
                      <span className="text-sm font-semibold tabular-nums w-32 text-right">{formatCurrency(row.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top transactions table — for PDF reference */}
            {recap.top_expenses.length > 0 && (
              <div className="s-card p-5 print-page-break print-avoid-break">
                <p className="eyebrow">Transaksi Pengeluaran Terbesar</p>
                <h3 className="font-semibold mt-0.5">Top 10 Single Transactions</h3>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wider">
                        <th className="pb-2 font-medium">Tanggal</th>
                        <th className="pb-2 font-medium">Deskripsi</th>
                        <th className="pb-2 font-medium">Kategori</th>
                        <th className="pb-2 font-medium text-right">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recap.top_expenses.map((tx, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 text-muted-foreground text-xs">{new Date(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                          <td className="py-2">{tx.description || '—'}</td>
                          <td className="py-2 text-muted-foreground text-xs">{tx.category}</td>
                          <td className="py-2 text-right font-semibold tabular-nums" style={{ color: '#E11D48' }}>{formatCurrency(tx.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer note (screen only) */}
            <div className="rounded-lg border bg-muted/30 p-4 text-center no-print">
              <p className="text-sm text-muted-foreground">
                Klik <strong>Cetak / Simpan PDF</strong> di atas buat export laporan ini.
                Di dialog browser, pilih <strong>&quot;Save as PDF&quot;</strong> sebagai destination — quality vector, file ringan, text searchable.
              </p>
            </div>

            {/* Print-only footer */}
            <div className="hidden print:block text-center text-xs text-muted-foreground border-t pt-3 mt-6">
              Klunting · Laporan dibuat {generatedDate} · klunting.com
            </div>
          </>
        )}
      </div>
    </>
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
        <p className="eyebrow">{label}</p>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: c.bg, color: c.fg }}>
          {icon}
        </div>
      </div>
      <p className="num text-xl mt-2 tabular font-bold" style={{ color: c.fg }}>{value}</p>
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
        <p className="eyebrow">{label}</p>
      </div>
      <p className="font-semibold mt-2 line-clamp-1">{main}</p>
      <p className="text-lg font-bold mt-0.5 tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  )
}
