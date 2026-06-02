'use client'

/**
 * Month Budget View (desktop) — fokus 1 bulan: RENCANA vs REALISASI vs SISA per
 * kategori. Dipakai saat toggle "Bulan" di halaman Anggaran (Tahun = grid 12 bulan).
 *
 * - Rencana: editable (NumberInput) — simpan via onCellChange (sama kayak grid tahun).
 * - Realisasi: dari transaksi (read-only), via prop `actuals` (key `type::cat::month`).
 * - Sisa: Rencana − Realisasi, + bar progress (realisasi/rencana).
 * - Verdict bahasa manusia di atas: sesuai rencana / over anggaran.
 */

import { ChevronLeft, ChevronRight, Sparkles, Copy } from 'lucide-react'
import { MONTHS } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import { NumberInput } from '@/components/ui/number-input'
import { toast } from 'sonner'

type BudgetType = 'income' | 'expense' | 'saving' | 'investment'

interface MonthBudgetViewProps {
  year: number
  month: number
  onMonthChange: (m: number) => void
  visibleIncome: string[]
  visibleExpense: string[]
  visibleSaving: string[]
  visibleInvestment: string[]
  getValue: (type: string, category: string, month: number) => number
  /** Realisasi per `${type}::${category}::${month}` dari loadMonthlyActuals. */
  actuals: Record<string, number>
  onCellChange: (type: BudgetType, category: string, month: number, value: number) => void | Promise<void>
}

const SECTIONS: { key: BudgetType; label: string; tint: string }[] = [
  { key: 'income',     label: 'Pendapatan',  tint: '#10B981' },
  { key: 'expense',    label: 'Pengeluaran', tint: '#F43F5E' },
  { key: 'saving',     label: 'Tabungan',    tint: '#F59E0B' },
  { key: 'investment', label: 'Investasi',   tint: '#0EA5E9' },
]

export function MonthBudgetView({
  year,
  month,
  onMonthChange,
  visibleIncome,
  visibleExpense,
  visibleSaving,
  visibleInvestment,
  getValue,
  actuals,
  onCellChange,
}: MonthBudgetViewProps) {
  const visibleByType: Record<BudgetType, string[]> = {
    income: visibleIncome,
    expense: visibleExpense,
    saving: visibleSaving,
    investment: visibleInvestment,
  }
  const actual = (type: BudgetType, cat: string) => actuals[`${type}::${cat}::${month}`] ?? 0
  const planTotal = (t: BudgetType) => visibleByType[t].reduce((s, c) => s + getValue(t, c, month), 0)
  const actualTotal = (t: BudgetType) => visibleByType[t].reduce((s, c) => s + actual(t, c), 0)

  const planOut = planTotal('expense') + planTotal('saving') + planTotal('investment')
  const actualOut = actualTotal('expense') + actualTotal('saving') + actualTotal('investment')
  const incomePlan = planTotal('income')
  const incomeActual = actualTotal('income')
  const over = planOut > 0 && actualOut > planOut

  const verdict =
    planOut === 0
      ? null
      : over
        ? { text: `Over anggaran ${formatCurrency(actualOut - planOut)}`, tone: 'over' as const }
        : { text: `Sesuai rencana — sisa ${formatCurrency(planOut - actualOut)}`, tone: 'ok' as const }

  const prev = () => onMonthChange(month === 1 ? 12 : month - 1)
  const next = () => onMonthChange(month === 12 ? 1 : month + 1)

  // Auto-budget: isi rencana yang KOSONG dari rata-rata realisasi 3 bulan
  // sebelumnya (di tahun ini). Non-destruktif — gak nimpa rencana yang sudah diisi.
  function autoFillFromAverage() {
    const months: number[] = []
    for (let m = Math.max(1, month - 3); m < month; m++) months.push(m)
    if (!months.length) {
      toast.error('Belum ada bulan sebelumnya di tahun ini buat dirata-rata')
      return
    }
    let filled = 0
    for (const sec of SECTIONS) {
      for (const cat of visibleByType[sec.key]) {
        if (getValue(sec.key, cat, month) > 0) continue
        const sum = months.reduce((s, m) => s + (actuals[`${sec.key}::${cat}::${m}`] ?? 0), 0)
        const avg = Math.round(sum / months.length)
        if (avg > 0) {
          void onCellChange(sec.key, cat, month, avg)
          filled++
        }
      }
    }
    toast.success(
      filled > 0
        ? `Mengisi ${filled} kategori dari rata-rata ${months.length} bulan terakhir`
        : 'Belum ada realisasi yang bisa dirata-rata',
    )
  }

  // Salin rencana bulan sebelumnya (tahun yang sama) ke sel yang masih kosong.
  function copyFromPrevMonth() {
    if (month <= 1) {
      toast.error('Bulan lalu ada di tahun sebelumnya — belum didukung')
      return
    }
    const prevM = month - 1
    let filled = 0
    for (const sec of SECTIONS) {
      for (const cat of visibleByType[sec.key]) {
        if (getValue(sec.key, cat, month) > 0) continue
        const prevVal = getValue(sec.key, cat, prevM)
        if (prevVal > 0) {
          void onCellChange(sec.key, cat, month, prevVal)
          filled++
        }
      }
    }
    toast.success(
      filled > 0
        ? `Menyalin ${filled} kategori dari ${MONTHS[prevM - 1]}`
        : `Belum ada rencana di ${MONTHS[prevM - 1]} buat disalin`,
    )
  }

  const stats = [
    { label: 'Pemasukan (real.)', value: incomeActual, sub: `rencana ${formatCurrency(incomePlan)}`, color: 'var(--c-mint)' },
    { label: 'Rencana keluar', value: planOut, sub: 'keluar + nabung + investasi', color: 'var(--ink)' },
    { label: 'Realisasi keluar', value: actualOut, sub: planOut > 0 ? `${Math.round((actualOut / planOut) * 100)}% dari rencana` : '—', color: over ? 'var(--c-coral)' : 'var(--ink)' },
    { label: 'Sisa anggaran', value: planOut - actualOut, sub: over ? 'kelebihan' : 'tersisa', color: planOut - actualOut >= 0 ? 'var(--c-mint)' : 'var(--c-coral)' },
  ]

  return (
    <div className="space-y-3">
      {/* Header: month switcher + verdict */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5"
        style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)', boxShadow: '0 1px 3px rgba(16,24,40,0.07)' }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prev}
            className="grid size-8 place-items-center rounded-lg transition active:scale-95"
            style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}
            aria-label="Bulan sebelumnya"
          >
            <ChevronLeft className="size-4" />
          </button>
          <p className="t-title min-w-[130px] text-center" style={{ color: 'var(--ink)' }}>
            {MONTHS[month - 1]} {year}
          </p>
          <button
            type="button"
            onClick={next}
            className="grid size-8 place-items-center rounded-lg transition active:scale-95"
            style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}
            aria-label="Bulan berikutnya"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={autoFillFromAverage}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-[var(--surface-2)]"
            style={{ borderColor: 'var(--border-soft)', color: 'var(--ink-muted)' }}
            title="Isi rencana yang masih kosong dari rata-rata realisasi 3 bulan terakhir"
          >
            <Sparkles className="size-3.5" style={{ color: 'var(--c-mint)' }} />
            Isi dari rata-rata
          </button>
          <button
            type="button"
            onClick={copyFromPrevMonth}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-[var(--surface-2)]"
            style={{ borderColor: 'var(--border-soft)', color: 'var(--ink-muted)' }}
            title="Salin rencana bulan sebelumnya ke sel yang masih kosong"
          >
            <Copy className="size-3.5" style={{ color: 'var(--ink-soft)' }} />
            Salin bulan lalu
          </button>
          {verdict && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold"
              style={{
                background: verdict.tone === 'over' ? 'var(--c-coral-soft)' : 'var(--c-mint-soft)',
                color: verdict.tone === 'over' ? 'var(--c-coral)' : 'var(--c-mint)',
              }}
            >
              {verdict.text}
            </span>
          )}
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((c) => (
          <div key={c.label} className="rounded-xl border p-3.5" style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)' }}>
            <p className="eyebrow">{c.label}</p>
            <p className="num tabular t-h2 mt-1" style={{ color: c.color }}>
              {formatCurrency(c.value)}
            </p>
            <p className="t-cap mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Section tables */}
      {SECTIONS.map((sec) => {
        const cats = visibleByType[sec.key]
        if (!cats.length) return null
        return (
          <div
            key={sec.key}
            className="overflow-hidden rounded-xl border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)', boxShadow: '0 1px 3px rgba(16,24,40,0.07)' }}
          >
            {/* Section header */}
            <div
              className="flex items-center justify-between px-3.5 py-2 border-b"
              style={{ background: `color-mix(in srgb, ${sec.tint} 8%, var(--surface))`, borderColor: 'var(--border-soft)' }}
            >
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: sec.tint }} />
                <p className="t-title">{sec.label}</p>
              </div>
              <div className="flex items-center gap-5 text-[12px]" style={{ color: 'var(--ink-soft)' }}>
                <span>Rencana <strong className="num tabular" style={{ color: 'var(--ink)' }}>{formatCurrency(planTotal(sec.key))}</strong></span>
                <span>Realisasi <strong className="num tabular" style={{ color: 'var(--ink)' }}>{formatCurrency(actualTotal(sec.key))}</strong></span>
              </div>
            </div>

            {/* Column header */}
            <div
              className="grid grid-cols-[1fr_148px_148px_148px] gap-3 px-3.5 py-1.5 border-b eyebrow"
              style={{ borderColor: 'var(--border-soft)' }}
            >
              <span>Kategori</span>
              <span className="text-right">Rencana</span>
              <span className="text-right">Realisasi</span>
              <span className="text-right">Sisa</span>
            </div>

            {/* Rows */}
            <div className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
              {cats.map((cat) => {
                const plan = getValue(sec.key, cat, month)
                const act = actual(sec.key, cat)
                const sisa = plan - act
                const pct = plan > 0 ? Math.min(100, Math.round((act / plan) * 100)) : 0
                const overRow = sec.key !== 'income' && plan > 0 && act > plan
                const isSub = cat.includes(' › ')
                const label = isSub ? cat.split(' › ')[1] : cat
                return (
                  <div key={cat} className="grid grid-cols-[1fr_148px_148px_148px] items-center gap-3 px-3.5 py-2">
                    <div className="min-w-0">
                      <p className="text-sm truncate" style={{ color: isSub ? 'var(--ink-muted)' : 'var(--ink)' }} title={cat}>
                        {isSub && <span className="mr-1 opacity-40">└</span>}
                        {label}
                      </p>
                      {plan > 0 && (
                        <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: overRow ? 'var(--c-coral)' : sec.tint }} />
                        </div>
                      )}
                    </div>
                    <NumberInput
                      value={plan}
                      onChange={(n) => onCellChange(sec.key, cat, month, n)}
                      placeholder="0"
                      className="h-8 text-right text-[13px]"
                    />
                    <p className="num tabular text-[13px] text-right" style={{ color: 'var(--ink-muted)' }}>
                      {act ? formatCurrency(act) : '—'}
                    </p>
                    <p
                      className="num tabular text-[13px] text-right"
                      style={{ color: overRow ? 'var(--c-coral)' : 'var(--ink-soft)' }}
                    >
                      {formatCurrency(sisa)}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
