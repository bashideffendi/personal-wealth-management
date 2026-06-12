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

import { ChevronLeft, ChevronRight, Sparkles, Copy, Target } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { NumberInput } from '@/components/ui/number-input'
import { computeTargetAmount, type CatTarget } from '@/lib/budget-categories'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'
import { monthLong } from '@/lib/i18n/dates'

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
  /** Target per `${type}::${leafKey}` (opsional, dari tree). */
  targets: Record<string, CatTarget>
  onCellChange: (type: BudgetType, category: string, month: number, value: number) => void | Promise<void>
}

const SECTIONS: { key: BudgetType; label: string; tint: string }[] = [
  { key: 'income',     label: 'Pendapatan',  tint: 'var(--c-mint)' },
  { key: 'expense',    label: 'Pengeluaran', tint: 'var(--c-coral)' },
  { key: 'saving',     label: 'Tabungan',    tint: 'var(--c-amber)' },
  { key: 'investment', label: 'Investasi',   tint: 'var(--c-violet)' },
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
  targets,
  onCellChange,
}: MonthBudgetViewProps) {
  const { t, locale } = useI18n()
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

  // Jumlah target tersarankan buat sebuah leaf (null kalau gak ada target).
  function targetAmountFor(type: BudgetType, cat: string): number | null {
    const t = targets[`${type}::${cat}`]
    if (!t) return null
    let avgActual = 0
    if (t.mode === 'average') {
      const ms: number[] = []
      for (let m = Math.max(1, month - 3); m < month; m++) ms.push(m)
      if (ms.length) avgActual = ms.reduce((s, m) => s + (actuals[`${type}::${cat}::${m}`] ?? 0), 0) / ms.length
    }
    return computeTargetAmount(t, { year, month, incomeThisMonth: incomePlan, avgActual })
  }

  const verdict =
    planOut === 0
      ? null
      : over
        ? { text: `${t('month_budget.verdict_over')} ${formatCurrency(actualOut - planOut)}`, tone: 'over' as const }
        : { text: `${t('month_budget.verdict_ok')} ${formatCurrency(planOut - actualOut)}`, tone: 'ok' as const }

  const prev = () => onMonthChange(month === 1 ? 12 : month - 1)
  const next = () => onMonthChange(month === 12 ? 1 : month + 1)

  // Auto-budget: isi rencana yang KOSONG dari rata-rata realisasi 3 bulan
  // sebelumnya (di tahun ini). Non-destruktif — gak nimpa rencana yang sudah diisi.
  function autoFillFromAverage() {
    const months: number[] = []
    for (let m = Math.max(1, month - 3); m < month; m++) months.push(m)
    if (!months.length) {
      toast.error(t('month_budget.toast_no_prev_months'))
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
        ? `${t('month_budget.toast_filled_pre')} ${filled} ${t('month_budget.toast_filled_mid')} ${months.length} ${t('month_budget.toast_filled_post')}`
        : t('month_budget.toast_no_actuals_to_average'),
    )
  }

  // Salin rencana bulan sebelumnya (tahun yang sama) ke sel yang masih kosong.
  function copyFromPrevMonth() {
    if (month <= 1) {
      toast.error(t('month_budget.toast_prev_year_unsupported'))
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
        ? `${t('month_budget.toast_copied_pre')} ${filled} ${t('month_budget.toast_copied_mid')} ${monthLong(prevM - 1, locale)}`
        : `${t('month_budget.toast_no_copy_pre')} ${monthLong(prevM - 1, locale)} ${t('month_budget.toast_no_copy_post')}`,
    )
  }

  // Terapkan target persisten tiap kategori → isi rencana yang masih kosong.
  function applyTargets() {
    const incomeThisMonth = planTotal('income')
    const avgMonths: number[] = []
    for (let m = Math.max(1, month - 3); m < month; m++) avgMonths.push(m)
    let filled = 0
    for (const sec of SECTIONS) {
      for (const cat of visibleByType[sec.key]) {
        const t = targets[`${sec.key}::${cat}`]
        if (!t || getValue(sec.key, cat, month) > 0) continue
        const sum = avgMonths.reduce((s, mm) => s + (actuals[`${sec.key}::${cat}::${mm}`] ?? 0), 0)
        const avgActual = avgMonths.length ? sum / avgMonths.length : 0
        const amt = computeTargetAmount(t, { year, month, incomeThisMonth, avgActual })
        if (amt > 0) {
          void onCellChange(sec.key, cat, month, amt)
          filled++
        }
      }
    }
    toast.success(
      filled > 0
        ? `${t('month_budget.toast_applied_pre')} ${filled} ${t('month_budget.toast_applied_post')}`
        : t('month_budget.toast_no_targets'),
    )
  }

  const stats = [
    { label: t('month_budget.stat_income_actual'), value: incomeActual, sub: `${t('month_budget.stat_income_plan_pre')} ${formatCurrency(incomePlan)}`, color: 'var(--c-mint)' },
    { label: t('month_budget.stat_plan_out'), value: planOut, sub: t('month_budget.stat_plan_out_sub'), color: 'var(--ink)' },
    { label: t('month_budget.stat_actual_out'), value: actualOut, sub: planOut > 0 ? `${Math.round((actualOut / planOut) * 100)}${t('month_budget.stat_actual_out_pct_post')}` : '—', color: over ? 'var(--c-coral)' : 'var(--ink)' },
    { label: t('month_budget.stat_remaining'), value: planOut - actualOut, sub: over ? t('month_budget.stat_remaining_over') : t('month_budget.stat_remaining_left'), color: planOut - actualOut >= 0 ? 'var(--c-mint)' : 'var(--c-coral)' },
  ]

  return (
    <div className="space-y-3">
      {/* Header: month switcher + verdict */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5"
        style={{ background: 'var(--surface)', borderColor: 'var(--outline)', boxShadow: 'var(--card-shadow)' }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prev}
            className="grid size-8 place-items-center rounded-lg transition active:scale-95"
            style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}
            aria-label={t('month_budget.aria_prev_month')}
          >
            <ChevronLeft className="size-4" />
          </button>
          <p className="t-title min-w-[130px] text-center" style={{ color: 'var(--ink)' }}>
            {monthLong(month - 1, locale)} {year}
          </p>
          <button
            type="button"
            onClick={next}
            className="grid size-8 place-items-center rounded-lg transition active:scale-95"
            style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}
            aria-label={t('month_budget.aria_next_month')}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={autoFillFromAverage}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-[var(--surface-2)]"
            style={{ borderColor: 'var(--outline)', color: 'var(--ink-muted)' }}
            title={t('month_budget.btn_fill_average_title')}
          >
            <Sparkles className="size-3.5" style={{ color: 'var(--c-mint)' }} />
            {t('month_budget.btn_fill_average')}
          </button>
          <button
            type="button"
            onClick={copyFromPrevMonth}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-[var(--surface-2)]"
            style={{ borderColor: 'var(--outline)', color: 'var(--ink-muted)' }}
            title={t('month_budget.btn_copy_prev_title')}
          >
            <Copy className="size-3.5" style={{ color: 'var(--ink-soft)' }} />
            {t('month_budget.btn_copy_prev')}
          </button>
          {Object.keys(targets).length > 0 && (
            <button
              type="button"
              onClick={applyTargets}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-[var(--surface-2)]"
              style={{ borderColor: 'var(--outline)', color: 'var(--ink-muted)' }}
              title={t('month_budget.btn_apply_targets_title')}
            >
              <Target className="size-3.5" style={{ color: 'var(--c-violet)' }} />
              {t('month_budget.btn_apply_targets')}
            </button>
          )}
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
          <div key={c.label} className="rounded-xl border p-3.5" style={{ background: 'var(--surface)', borderColor: 'var(--outline)' }}>
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
            style={{ background: 'var(--surface)', borderColor: 'var(--outline)', boxShadow: 'var(--card-shadow)' }}
          >
            {/* Section header */}
            <div
              className="flex items-center justify-between px-3.5 py-2 border-b"
              style={{ background: `color-mix(in srgb, ${sec.tint} 8%, var(--surface))`, borderColor: 'var(--outline)' }}
            >
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: sec.tint }} />
                <p className="t-title">{sec.label}</p>
              </div>
              <div className="flex items-center gap-5 text-[12px]" style={{ color: 'var(--ink-soft)' }}>
                <span>{t('month_budget.col_plan')} <strong className="num tabular" style={{ color: 'var(--ink)' }}>{formatCurrency(planTotal(sec.key))}</strong></span>
                <span>{t('month_budget.col_actual')} <strong className="num tabular" style={{ color: 'var(--ink)' }}>{formatCurrency(actualTotal(sec.key))}</strong></span>
              </div>
            </div>

            {/* Column header */}
            <div
              className="grid grid-cols-[1fr_148px_148px_148px] gap-3 px-3.5 py-1.5 border-b eyebrow"
              style={{ borderColor: 'var(--outline)' }}
            >
              <span>{t('month_budget.col_category')}</span>
              <span className="text-right">{t('month_budget.col_plan')}</span>
              <span className="text-right">{t('month_budget.col_actual')}</span>
              <span className="text-right">{t('month_budget.col_remaining')}</span>
            </div>

            {/* Rows */}
            <div className="divide-y" style={{ borderColor: 'var(--outline)' }}>
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
                      {(() => {
                        const tgt = targetAmountFor(sec.key, cat)
                        if (tgt == null) return null
                        const met = plan >= tgt
                        return (
                          <p className="num text-[10px] mt-0.5" style={{ color: met ? 'var(--c-mint)' : 'var(--c-violet)' }}>
                            {t('month_budget.row_target')} {formatCurrency(tgt)}{met ? ' ✓' : ''}
                          </p>
                        )
                      })()}
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
