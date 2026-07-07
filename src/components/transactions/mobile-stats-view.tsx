'use client'

/**
 * MobileStatsView — panel "Statistik" halaman Transaksi (F13c, mobile-only).
 * Muncul saat toggle Catatan|Statistik di posisi Statistik; isi 4 kartu:
 *   1. Tren — line chart harian (pengeluaran coral vs pemasukan mint) sepanjang
 *      bulan aktif + footer Pengeluaran pill soft / Pemasukan (ala Budget).
 *   2. Sankey aliran uang bulan kalender aktif + footer Pengeluaran/Pemasukan.
 *   3. Kategori — donut polos (tanpa angka tengah) + callout slice terbesar
 *      + footer Pengeluaran pill / Pemasukan (ala referensi Budget).
 *   4. Statistik Kategori — bar per kategori: badge persen + nominal penuh
 *      + jumlah trx + progress bar tipis.
 *
 * Terima transaksi yang SUDAH difilter ke bulan aktif; agregasi internal
 * pakai useMemo. Rollup subkategori ke induk via rootCategory (SUB_SEP) —
 * konsisten sama Beranda/Anggaran. Kategori 'Transfer' di-skip (bukan flow).
 */

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/context'
import { rootCategory } from '@/lib/budget-categories'
import { categoryHue } from '@/lib/category-hue'
import type { Transaction } from '@/types'
import type { FlowKind } from '@/components/dashboard/money-flow-sankey'

// Recharts cuma ke-load pas panel Statistik dibuka (pola dashboard/page.tsx).
const MoneyFlowSankey = dynamic(
  () => import('@/components/dashboard/money-flow-sankey').then((m) => m.MoneyFlowSankey),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse rounded-lg" style={{ height: 300, background: 'var(--surface-2)' }} aria-hidden="true" />
    ),
  },
)

interface TrendPoint {
  day: number     // tanggal 1..daysInMonth
  expense: number // total pengeluaran hari itu (bukan kumulatif)
  income: number  // total pemasukan hari itu
}

// Line chart Tren — recharts di-load lazy juga (pola sama Sankey di atas);
// komponen dirakit di dalam factory karena sub-komponen recharts (Line/XAxis)
// gak bisa di-dynamic satu-satu.
const TrendsLineChart = dynamic(
  () =>
    import('recharts').then((m) => {
      const { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } = m
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fmtValue = (value: any) => formatCompactCurrency(Number(value) || 0)
      const pad2 = (d: number) => String(d).padStart(2, '0')
      function Chart({
        data,
        expenseName,
        incomeName,
      }: {
        data: TrendPoint[]
        expenseName: string
        incomeName: string
      }) {
        return (
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
              <XAxis
                dataKey="day"
                interval="preserveStartEnd"
                fontSize={10}
                tick={{ fill: 'var(--ink-muted)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border-soft)' }}
                tickFormatter={pad2}
              />
              <YAxis hide />
              <Tooltip
                formatter={fmtValue}
                labelFormatter={(label) => pad2(Number(label))}
                contentStyle={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border-soft)',
                  borderRadius: '8px',
                  fontSize: 12,
                }}
              />
              <Line type="monotone" dataKey="expense" name={expenseName} stroke="var(--c-coral)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="income" name={incomeName} stroke="var(--c-mint)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )
      }
      return Chart
    }),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse rounded-lg" style={{ height: 170, background: 'var(--surface-2)' }} aria-hidden="true" />
    ),
  },
)

interface CatRow {
  name: string
  amount: number
  share: number // 0..1 dari total expense
  count: number // jumlah transaksi kategori itu
  bar: string   // warna hue terang (dot/bar/donut — bukan teks)
}

const OTHERS_BAR = 'color-mix(in srgb, var(--ink) 22%, transparent)'

/** Footer total ala Budget: Pengeluaran pill coral (solid, atau soft via prop) + Pemasukan mint. */
function TotalsFooter({
  totalIncome,
  totalExpense,
  incomeLabel,
  expenseLabel,
  softPill = false,
}: {
  totalIncome: number
  totalExpense: number
  incomeLabel: string
  expenseLabel: string
  /** true = pill bg coral-soft + teks coral-ink (kartu Tren). */
  softPill?: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--border-soft)' }}>
      <div>
        <span
          className="inline-block rounded-full px-2 py-[3px] text-[10px] font-semibold"
          style={softPill
            ? { background: 'var(--c-coral-soft)', color: 'var(--c-coral-ink)' }
            : { background: 'var(--c-coral)', color: '#fff' }}
        >
          {expenseLabel}
        </span>
        <p
          className="num tabular text-[15px] font-bold mt-1"
          title={formatCurrency(totalExpense)}
          style={{ color: 'var(--c-coral-ink)', letterSpacing: '-0.02em' }}
        >
          {formatCompactCurrency(totalExpense)}
        </p>
      </div>
      <div className="text-right">
        <span className="inline-block py-[3px] text-[10px] font-semibold" style={{ color: 'var(--ink-soft)' }}>
          {incomeLabel}
        </span>
        <p
          className="num tabular text-[15px] font-bold mt-1"
          title={formatCurrency(totalIncome)}
          style={{ color: 'var(--c-mint-ink)', letterSpacing: '-0.02em' }}
        >
          {formatCompactCurrency(totalIncome)}
        </p>
      </div>
    </div>
  )
}

export function MobileStatsView({
  transactions,
  monthLabel,
}: {
  /** Transaksi bulan kalender aktif (sudah difilter di caller). */
  transactions: Transaction[]
  monthLabel: string
}) {
  const { t, locale } = useI18n()
  const [catMode, setCatMode] = useState<'pct' | 'rp'>('pct')

  const stats = useMemo(() => {
    // Agregasi per kategori INDUK per tipe — 'Transfer' bukan aliran nyata.
    function bucket(kind: 'income' | 'expense' | 'saving' | 'investment') {
      const byCat: Record<string, number> = {}
      const countByCat: Record<string, number> = {}
      for (const tx of transactions) {
        if (tx.type !== kind || tx.category === 'Transfer') continue
        const root = rootCategory((tx.category || 'Lainnya').trim() || 'Lainnya')
        byCat[root] = (byCat[root] || 0) + tx.amount
        countByCat[root] = (countByCat[root] || 0) + 1
      }
      return Object.entries(byCat)
        .map(([name, amount]) => ({ name, amount, count: countByCat[name] || 0, kind: kind as FlowKind }))
        .sort((a, b) => b.amount - a.amount)
    }

    const income = bucket('income')
    const expense = bucket('expense')
    const saving = bucket('saving')
    const investment = bucket('investment')

    const totalIncome = income.reduce((s, c) => s + c.amount, 0)
    const totalExpense = expense.reduce((s, c) => s + c.amount, 0)

    // Donut + list: top-6 expense, sisanya digabung jadi baris abu "lainnya".
    const top = expense.slice(0, 6)
    const rest = expense.slice(6)
    const restSum = rest.reduce((s, c) => s + c.amount, 0)
    const catRows: CatRow[] = top.map((c) => ({
      name: c.name,
      amount: c.amount,
      share: totalExpense > 0 ? c.amount / totalExpense : 0,
      count: c.count,
      bar: categoryHue(c.name).bar,
    }))
    if (restSum > 0) {
      catRows.push({
        name: `+${rest.length} ${t('dashboard.others')}`,
        amount: restSum,
        share: totalExpense > 0 ? restSum / totalExpense : 0,
        count: rest.reduce((s, c) => s + c.count, 0),
        bar: OTHERS_BAR,
      })
    }

    return {
      income,
      outflow: [...expense, ...saving, ...investment],
      totalIncome,
      totalExpense,
      catRows,
    }
  }, [transactions, t])

  // Data line chart Tren: nilai HARIAN (bukan kumulatif) per tanggal 1..akhir
  // bulan aktif. Bulan diambil dari tanggal transaksi (props sudah difilter
  // ke bulan kalender aktif); 'Transfer' di-skip konsisten sama agregasi lain.
  const trend = useMemo<TrendPoint[]>(() => {
    if (transactions.length === 0) return []
    const ref = transactions[0].date // 'YYYY-MM-DD'
    const y = Number(ref.slice(0, 4))
    const mo = Number(ref.slice(5, 7))
    const daysInMonth = new Date(y, mo, 0).getDate()
    const rows: TrendPoint[] = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      expense: 0,
      income: 0,
    }))
    for (const tx of transactions) {
      if (tx.category === 'Transfer') continue
      const d = Number(tx.date.slice(8, 10))
      if (!Number.isFinite(d) || d < 1 || d > daysInMonth) continue
      if (tx.type === 'expense') rows[d - 1].expense += tx.amount
      else if (tx.type === 'income') rows[d - 1].income += tx.amount
    }
    return rows
  }, [transactions])

  // Geometri donut — stroke circle + dasharray per slice, mulai jam 12.
  const CX = 90
  const CY = 65
  const R = 40
  const SW = 13
  const C = 2 * Math.PI * R
  // Offset kumulatif per slice tanpa mutasi closure saat render (React
  // Compiler immutability) — start = jumlah share slice-slice sebelumnya.
  const slices = stats.catRows.map((row, i) => ({
    ...row,
    start: stats.catRows.slice(0, i).reduce((s, r) => s + r.share, 0),
  }))

  // Callout slice terbesar (index 0, sudah sorted desc): garis kecil keluar
  // dari tengah slice + dot warna + label %/Rp (ikut toggle).
  const biggest = slices[0]
  const midAngle = biggest ? (biggest.start + biggest.share / 2) * 2 * Math.PI - Math.PI / 2 : 0
  const calloutP1 = { x: CX + Math.cos(midAngle) * (R + SW / 2 + 1), y: CY + Math.sin(midAngle) * (R + SW / 2 + 1) }
  const calloutP2 = { x: CX + Math.cos(midAngle) * (R + SW / 2 + 10), y: CY + Math.sin(midAngle) * (R + SW / 2 + 10) }
  const calloutLeft = Math.cos(midAngle) < 0
  const calloutLabel = biggest
    ? catMode === 'pct'
      ? `${(biggest.share * 100).toFixed(biggest.share * 100 >= 10 ? 0 : 1)}%`
      : formatCompactCurrency(biggest.amount)
    : ''

  const pctBadge = (share: number) =>
    `${(share * 100).toFixed(share * 100 >= 10 ? 0 : 1)}%`

  const emptyMsg = (
    <p className="text-[13px] text-center py-8" style={{ color: 'var(--ink-soft)' }}>
      {t('dashboard.sankey_empty')}
    </p>
  )

  return (
    <div className="space-y-4">
      {/* ── Kartu 1: Tren — line harian pengeluaran vs pemasukan ── */}
      <div className="s-card s-card-pad">
        <h3 className="t-h2" style={{ color: 'var(--ink)' }}>
          {locale === 'id' ? 'Tren' : 'Trends'}
        </h3>
        {trend.length === 0 ? emptyMsg : (
          <>
            <div className="mt-2">
              <TrendsLineChart
                data={trend}
                expenseName={t('transactions.summary_expense')}
                incomeName={t('transactions.summary_income')}
              />
            </div>
            <TotalsFooter
              totalIncome={stats.totalIncome}
              totalExpense={stats.totalExpense}
              incomeLabel={t('transactions.summary_income')}
              expenseLabel={t('transactions.summary_expense')}
              softPill
            />
          </>
        )}
      </div>

      {/* ── Kartu 2: Sankey aliran uang + footer total ───────────── */}
      <div className="s-card s-card-pad">
        <p className="eyebrow">{monthLabel}</p>
        <h3 className="t-h2 mt-0.5" style={{ color: 'var(--ink)' }}>{t('dashboard.money_flow')}</h3>
        <div className="mt-2">
          <MoneyFlowSankey
            income={stats.income}
            outflow={stats.outflow}
            compact
            height={300}
            emptyMessage={t('dashboard.sankey_empty')}
          />
        </div>
        <TotalsFooter
          totalIncome={stats.totalIncome}
          totalExpense={stats.totalExpense}
          incomeLabel={t('transactions.summary_income')}
          expenseLabel={t('transactions.summary_expense')}
        />
      </div>

      {/* ── Kartu 3: Kategori (donut polos + callout + footer) ───── */}
      <div className="s-card s-card-pad">
        <div className="flex items-center justify-between gap-3">
          <h3 className="t-h2" style={{ color: 'var(--ink)' }}>{t('transactions.col_category')}</h3>
          {/* Toggle % | Rp — ganti label callout slice terbesar */}
          <div className="flex items-center rounded-full p-0.5 shrink-0" style={{ background: 'var(--surface-2)' }}>
            {(['pct', 'rp'] as const).map((mo) => (
              <button
                key={mo}
                type="button"
                onClick={() => setCatMode(mo)}
                aria-pressed={catMode === mo}
                className="num rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors"
                style={catMode === mo
                  ? { background: 'var(--ink)', color: 'var(--surface)' }
                  : { color: 'var(--ink-soft)' }}
              >
                {mo === 'pct' ? '%' : 'Rp'}
              </button>
            ))}
          </div>
        </div>

        {stats.catRows.length === 0 ? emptyMsg : (
          <>
            {/* Donut polos — tanpa angka di tengah, callout slice terbesar */}
            <div className="flex justify-center mt-3">
              <svg viewBox="0 0 180 130" width="216" height="156" role="img" aria-label={t('transactions.col_category')}>
                <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--surface-2)" strokeWidth={SW} />
                {slices.map((s) => (
                  <circle
                    key={s.name}
                    cx={CX}
                    cy={CY}
                    r={R}
                    fill="none"
                    stroke={s.bar}
                    strokeWidth={SW}
                    strokeDasharray={`${Math.max(s.share * C - 1, 0)} ${C}`}
                    strokeDashoffset={-s.start * C}
                    transform={`rotate(-90 ${CX} ${CY})`}
                  />
                ))}
                {biggest && (
                  <g>
                    <line
                      x1={calloutP1.x}
                      y1={calloutP1.y}
                      x2={calloutP2.x}
                      y2={calloutP2.y}
                      stroke="var(--ink-soft)"
                      strokeWidth={1}
                    />
                    <circle cx={calloutP2.x} cy={calloutP2.y} r={2.5} fill={biggest.bar} />
                    <text
                      x={calloutP2.x + (calloutLeft ? -6 : 6)}
                      y={calloutP2.y}
                      dominantBaseline="middle"
                      textAnchor={calloutLeft ? 'end' : 'start'}
                      className="num"
                      style={{ fill: 'var(--ink)', fontSize: 10, fontWeight: 600 }}
                    >
                      {calloutLabel}
                    </text>
                  </g>
                )}
              </svg>
            </div>

            <TotalsFooter
              totalIncome={stats.totalIncome}
              totalExpense={stats.totalExpense}
              incomeLabel={t('transactions.summary_income')}
              expenseLabel={t('transactions.summary_expense')}
            />
          </>
        )}
      </div>

      {/* ── Kartu 4: Statistik Kategori (bar per kategori) ───────── */}
      <div className="s-card s-card-pad">
        <h3 className="t-h2" style={{ color: 'var(--ink)' }}>
          {locale === 'id' ? 'Statistik Kategori' : 'Category Stats'}
        </h3>
        {stats.catRows.length === 0 ? emptyMsg : (
          <div className="mt-3 space-y-3">
            {stats.catRows.map((row) => (
              <div key={row.name}>
                <div className="flex items-start gap-2">
                  <span className="size-2 rounded-full shrink-0 mt-[5px]" style={{ background: row.bar }} />
                  <span className="text-[12.5px] font-medium truncate" style={{ color: 'var(--ink)' }}>
                    {row.name}
                  </span>
                  <span
                    className="num rounded px-1.5 py-[1px] text-[10px] font-semibold shrink-0"
                    style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}
                  >
                    {pctBadge(row.share)}
                  </span>
                  <span className="flex-1" />
                  <span className="text-right shrink-0">
                    <span className="num tabular block text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>
                      {formatCurrency(row.amount)}
                    </span>
                    <span className="num block text-[10px]" style={{ color: 'var(--ink-soft)' }}>
                      {row.count} trx
                    </span>
                  </span>
                </div>
                <div className="mt-1.5 rounded-full overflow-hidden" style={{ height: 3, background: 'var(--surface-2)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(row.share * 100, 100)}%`, background: row.bar }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
