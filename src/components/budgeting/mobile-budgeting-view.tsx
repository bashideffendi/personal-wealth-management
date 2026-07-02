'use client'

/**
 * Mobile budgeting view — layar Anggaran versi F9 (redesign mobile).
 *
 * Fokus SATU bulan (switcher ◀ ▶), lalu:
 *   1. Kartu ringkasan: "Terpakai · <bulan>" compact vs total dialokasikan
 *      + bar 6px (mint; coral kalau >100%) + subline sisa anggaran.
 *   2. Strip coral ramping kalau rencana alokasi > rencana pendapatan
 *      (over-alokasi) — pengganti banner gede desktop.
 *   3. List kategori per tipe — header .m-sec nempel kanvas, baris ~48px:
 *      nama kiri 12.5px, "terpakai / anggaran" 11px kanan (terpakai bold,
 *      full digit), bar tipis 5px di bawah baris.
 *
 * Edit nominal TETAP bisa (canonical input = prinsip produk): tap angka di
 * kanan baris → NumberInput compact autofocus, commit saat blur/Enter.
 *
 * Terima data + callback yang sama dgn grid desktop; realisasi via prop
 * `actuals` (key `type::cat::month`) — sudah dihitung halaman, no query baru.
 */

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Info } from 'lucide-react'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import { NumberInput } from '@/components/ui/number-input'
import { usePrivacy } from '@/components/privacy/privacy-provider'
import { useI18n } from '@/lib/i18n/context'
import { monthLong } from '@/lib/i18n/dates'
import { SUB_SEP } from '@/lib/budget-categories'

type BudgetType = 'income' | 'expense' | 'saving' | 'investment'

interface MobileBudgetingViewProps {
  year: number
  visibleIncome: string[]
  visibleExpense: string[]
  visibleSaving: string[]
  visibleInvestment: string[]
  getValue: (type: string, category: string, month: number) => number
  /** Realisasi per `${type}::${category}::${month}` dari loadMonthlyActuals. */
  actuals: Record<string, number>
  onCellChange: (type: BudgetType, category: string, month: number, value: number) => void | Promise<void>
}

// labelKey → i18n (Pendapatan/Pengeluaran/Tabungan/Investasi ikut locale)
const SECTIONS: { key: BudgetType; labelKey: string }[] = [
  { key: 'income',     labelKey: 'budgeting.income' },
  { key: 'expense',    labelKey: 'budgeting.expense' },
  { key: 'saving',     labelKey: 'budgeting.saving' },
  { key: 'investment', labelKey: 'budgeting.investment' },
]

export function MobileBudgetingView({
  year,
  visibleIncome,
  visibleExpense,
  visibleSaving,
  visibleInvestment,
  getValue,
  actuals,
  onCellChange,
}: MobileBudgetingViewProps) {
  const { t, locale } = useI18n()
  const { hidden: privacyHidden } = usePrivacy()
  const today = new Date()
  const initialMonth =
    today.getFullYear() === year ? today.getMonth() + 1 : 1
  const [month, setMonth] = useState(initialMonth)

  // Edit inline satu baris: tap angka → NumberInput, commit saat blur.
  const [editing, setEditing] = useState<{ key: string; value: number } | null>(null)

  const visibleByType: Record<BudgetType, string[]> = {
    income: visibleIncome,
    expense: visibleExpense,
    saving: visibleSaving,
    investment: visibleInvestment,
  }

  const actualOf = (type: BudgetType, cat: string) => actuals[`${type}::${cat}::${month}`] ?? 0
  const planTotal = (type: BudgetType) =>
    visibleByType[type].reduce((s, c) => s + getValue(type, c, month), 0)
  const actualTotal = (type: BudgetType) =>
    visibleByType[type].reduce((s, c) => s + actualOf(type, c), 0)

  // Ringkasan bulan: terpakai (realisasi E+T+I) vs dialokasikan (rencana E+T+I)
  // — definisi "Dialokasikan" sama dgn Ringkasan Alokasi desktop.
  const allocated = planTotal('expense') + planTotal('saving') + planTotal('investment')
  const spent = actualTotal('expense') + actualTotal('saving') + actualTotal('investment')
  const spentPct = allocated > 0 ? (spent / allocated) * 100 : 0
  const overBudget = allocated > 0 && spent > allocated

  // Over-alokasi RENCANA (zero-based): alokasi melebihi rencana pendapatan.
  const incomePlan = planTotal('income')
  const overAlloc = incomePlan > 0 && allocated > incomePlan

  const compact = (n: number) => (privacyHidden ? 'Rp ••••' : formatCompactCurrency(n))
  const full = (n: number) => (privacyHidden ? undefined : formatCurrency(n))
  // Baris list: full digit tanpa "Rp" (Rp implisit, jaga density 11px).
  const digitsOf = (n: number) => (privacyHidden ? '••••' : Math.round(n).toLocaleString('id-ID'))

  function prev() {
    setMonth((m) => (m === 1 ? 12 : m - 1))
  }
  function next() {
    setMonth((m) => (m === 12 ? 1 : m + 1))
  }

  function commitEdit(type: BudgetType, cat: string) {
    if (!editing) return
    const v = editing.value
    setEditing(null)
    if (v !== getValue(type, cat, month)) void onCellChange(type, cat, month, v)
  }

  return (
    <div>
      {/* Month switcher */}
      <div
        className="flex items-center justify-between rounded-xl border px-3 py-2.5"
        style={{ background: 'var(--surface)', borderColor: 'var(--outline)' }}
      >
        <button
          type="button"
          onClick={prev}
          className="flex size-9 items-center justify-center rounded-lg transition active:scale-95"
          style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}
          aria-label={t('mobile_budget.prev_month')}
        >
          <ChevronLeft className="size-4" />
        </button>

        <div className="text-center">
          <p className="text-[11px] uppercase tracking-wide font-medium" style={{ color: 'var(--ink-soft)' }}>
            {t('mobile_budget.month')}
          </p>
          <p className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
            {monthLong(month - 1, locale)} {year}
          </p>
        </div>

        <button
          type="button"
          onClick={next}
          className="flex size-9 items-center justify-center rounded-lg transition active:scale-95"
          style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}
          aria-label={t('mobile_budget.next_month')}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Kartu ringkasan — terpakai vs dialokasikan bulan terpilih */}
      <section className="s-card px-3.5 py-3 mt-3">
        <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
          {t('safe_card.spent')} · {monthLong(month - 1, locale)}
        </p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
          <span
            className="num tabular font-semibold"
            style={{ fontSize: 20, letterSpacing: '-0.02em', color: 'var(--ink)' }}
            title={full(spent)}
          >
            {compact(spent)}
          </span>
          <span className="text-[11.5px]" style={{ color: 'var(--ink-soft)' }} title={full(allocated)}>
            / <span className="num">{compact(allocated)}</span> {t('mobile_budget.allocated').toLowerCase()}
          </span>
        </p>
        <div className="mt-2 h-[6px] rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }} aria-hidden>
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(spentPct, 100)}%`, background: overBudget ? 'var(--c-coral)' : 'var(--c-mint)' }}
          />
        </div>
        <p
          className="num tabular text-[11px] mt-1.5"
          style={{ color: overBudget ? 'var(--c-coral-ink)' : 'var(--ink-soft)' }}
        >
          {overBudget
            ? `${privacyHidden ? 'Rp ••••' : formatCurrency(spent - allocated)} ${t('month_budget.stat_remaining_over')}`
            : `${t('month_budget.stat_remaining')} ${privacyHidden ? 'Rp ••••' : formatCurrency(allocated - spent)}`}
        </p>
      </section>

      {/* Strip over-alokasi (rencana > pendapatan) — ramping, bukan banner */}
      {overAlloc && (
        <div className="mt-2 flex items-center gap-2 rounded-[12px] px-3 py-2" style={{ background: 'var(--c-coral-soft)' }}>
          <Info className="size-3.5 shrink-0" style={{ color: 'var(--c-coral-ink)' }} />
          <p className="text-[11.5px] font-medium leading-tight" style={{ color: 'var(--c-coral-ink)' }}>
            <span className="num tabular font-semibold" title={full(allocated - incomePlan)}>
              {compact(allocated - incomePlan)}
            </span>{' '}
            {t('budgeting.alloc_banner_over')}
          </p>
        </div>
      )}

      {/* List kategori per tipe — section header nempel kanvas (.m-sec) */}
      {SECTIONS.map((section) => {
        const cats = visibleByType[section.key]
        if (cats.length === 0) return null
        const secPlan = planTotal(section.key)
        const secActual = actualTotal(section.key)
        return (
          <div key={section.key}>
            <div className="m-sec">
              <span>{t(section.labelKey)}</span>
              <span
                className="num tabular text-[11.5px] font-medium"
                style={{ color: 'var(--ink-soft)' }}
                title={privacyHidden ? undefined : `${formatCurrency(secActual)} / ${formatCurrency(secPlan)}`}
              >
                {compact(secActual)} / {compact(secPlan)}
              </span>
            </div>
            <section className="s-card px-3.5 py-1">
              {cats.map((cat, i) => {
                const plan = getValue(section.key, cat, month)
                const act = actualOf(section.key, cat)
                const pct = plan > 0 ? (act / plan) * 100 : 0
                const overRow = section.key === 'expense' && plan > 0 && act > plan
                const sepIdx = cat.indexOf(SUB_SEP)
                const isSub = sepIdx !== -1
                const label = isSub ? cat.slice(sepIdx + SUB_SEP.length) : cat
                const rowKey = `${section.key}|${cat}`
                const isEditing = editing?.key === rowKey
                return (
                  <div key={cat} className="py-2" style={{ borderTop: i ? '1px solid var(--border-soft)' : 'none' }}>
                    <div className="flex items-center justify-between gap-2 min-h-[24px]">
                      <p
                        className="text-[12.5px] font-medium truncate"
                        style={{ color: isSub ? 'var(--ink-muted)' : 'var(--ink)' }}
                        title={cat}
                      >
                        {isSub && <span className="mr-1 opacity-40">└</span>}
                        {label}
                      </p>
                      {isEditing ? (
                        <NumberInput
                          autoFocus
                          value={editing.value}
                          onChange={(n) => setEditing({ key: rowKey, value: n })}
                          onBlur={() => commitEdit(section.key, cat)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur()
                          }}
                          placeholder="0"
                          className="h-8 w-[110px] shrink-0 text-right text-[13px]"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditing({ key: rowKey, value: plan })}
                          className="num tabular text-[11px] shrink-0 active:opacity-60 transition-opacity"
                          style={{ color: 'var(--ink-soft)' }}
                          title={privacyHidden ? undefined : `${formatCurrency(act)} / ${formatCurrency(plan)}`}
                        >
                          <b className="font-semibold" style={{ color: overRow ? 'var(--c-coral-ink)' : 'var(--ink)' }}>
                            {digitsOf(act)}
                          </b>
                          {' / '}
                          {digitsOf(plan)}
                        </button>
                      )}
                    </div>
                    <div className="mt-1.5 h-[5px] rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }} aria-hidden>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(pct, 100)}%`, background: overRow ? 'var(--c-coral)' : 'var(--c-mint)' }}
                      />
                    </div>
                  </div>
                )
              })}
            </section>
          </div>
        )
      })}
    </div>
  )
}
