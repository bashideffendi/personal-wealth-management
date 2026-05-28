'use client'

/**
 * Mobile budgeting view — replaces the 12-month spreadsheet table on small screens.
 *
 * The desktop table tries to fit 12 month-columns + a category-column at once. On
 * a phone that's a 800px-wide horizontal scroller — usable but miserable for
 * actually editing values. Here we focus on ONE month at a time:
 *
 *   ◀  Mei 2026  ▶
 *   [Pendapatan total]
 *     Gaji ............. Rp 12.500.000
 *     Bonus ............ Rp     500.000
 *   [Pengeluaran total]
 *     Makanan .......... Rp  2.000.000
 *     ...
 *
 * Tap any value → NumberInput opens, edit, blur saves. No horizontal scroll.
 *
 * Receives the same data + callbacks as the desktop table so logic is shared.
 */

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MONTHS } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import { NumberInput } from '@/components/ui/number-input'

type BudgetType = 'income' | 'expense' | 'saving' | 'investment'

interface MobileBudgetingViewProps {
  year: number
  visibleIncome: string[]
  visibleExpense: string[]
  visibleSaving: string[]
  visibleInvestment: string[]
  getValue: (type: string, category: string, month: number) => number
  onCellChange: (type: BudgetType, category: string, month: number, value: number) => void | Promise<void>
}

const SECTIONS: { key: BudgetType; label: string; tint: string }[] = [
  { key: 'income',     label: 'Pendapatan',  tint: '#10B981' }, // emerald
  { key: 'expense',    label: 'Pengeluaran', tint: '#F43F5E' }, // coral
  { key: 'saving',     label: 'Tabungan',    tint: '#F59E0B' }, // amber
  { key: 'investment', label: 'Investasi',   tint: '#0EA5E9' }, // sky
]

export function MobileBudgetingView({
  year,
  visibleIncome,
  visibleExpense,
  visibleSaving,
  visibleInvestment,
  getValue,
  onCellChange,
}: MobileBudgetingViewProps) {
  const today = new Date()
  const initialMonth =
    today.getFullYear() === year ? today.getMonth() + 1 : 1
  const [month, setMonth] = useState(initialMonth)

  const visibleByType: Record<BudgetType, string[]> = {
    income: visibleIncome,
    expense: visibleExpense,
    saving: visibleSaving,
    investment: visibleInvestment,
  }

  const sectionTotal = (type: BudgetType) =>
    visibleByType[type].reduce((s, c) => s + getValue(type, c, month), 0)

  const totalIncome = sectionTotal('income')
  const totalAllocated =
    sectionTotal('expense') + sectionTotal('saving') + sectionTotal('investment')
  const remaining = totalIncome - totalAllocated

  function prev() {
    setMonth((m) => (m === 1 ? 12 : m - 1))
  }
  function next() {
    setMonth((m) => (m === 12 ? 1 : m + 1))
  }

  return (
    <div className="space-y-3">
      {/* Month switcher */}
      <div
        className="flex items-center justify-between rounded-xl border px-3 py-2.5"
        style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)' }}
      >
        <button
          type="button"
          onClick={prev}
          className="flex size-9 items-center justify-center rounded-lg transition active:scale-95"
          style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}
          aria-label="Bulan sebelumnya"
        >
          <ChevronLeft className="size-4" />
        </button>

        <div className="text-center">
          <p className="text-[11px] uppercase tracking-wide font-medium" style={{ color: 'var(--ink-soft)' }}>
            Bulan
          </p>
          <p className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
            {MONTHS[month - 1]} {year}
          </p>
        </div>

        <button
          type="button"
          onClick={next}
          className="flex size-9 items-center justify-center rounded-lg transition active:scale-95"
          style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}
          aria-label="Bulan berikutnya"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Quick summary */}
      <div className="grid grid-cols-2 gap-2">
        <div
          className="rounded-lg border p-3"
          style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)' }}
        >
          <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
            Dialokasikan
          </p>
          <p className="num tabular text-base font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
            {formatCurrency(totalAllocated)}
          </p>
        </div>
        <div
          className="rounded-lg border p-3"
          style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)' }}
        >
          <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
            Sisa
          </p>
          <p
            className="num tabular text-base font-semibold mt-0.5"
            style={{ color: remaining >= 0 ? 'var(--emerald-600, #059669)' : 'var(--coral-600, #F43F5E)' }}
          >
            {formatCurrency(remaining)}
          </p>
        </div>
      </div>

      {/* Sections */}
      {SECTIONS.map((section) => {
        const cats = visibleByType[section.key]
        if (cats.length === 0) return null
        const total = sectionTotal(section.key)
        return (
          <div
            key={section.key}
            className="rounded-xl border overflow-hidden"
            style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)' }}
          >
            {/* Section header */}
            <div
              className="flex items-center justify-between px-3 py-2 border-b"
              style={{
                background: `color-mix(in srgb, ${section.tint} 8%, var(--surface))`,
                borderColor: 'var(--border-soft)',
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="size-2 rounded-full"
                  style={{ background: section.tint }}
                />
                <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                  {section.label}
                </p>
              </div>
              <p
                className="num tabular text-xs font-semibold"
                style={{ color: 'var(--ink)' }}
              >
                {formatCurrency(total)}
              </p>
            </div>

            {/* Categories */}
            <div className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
              {cats.map((cat) => {
                const value = getValue(section.key, cat, month)
                return (
                  <div
                    key={cat}
                    className="flex items-center gap-3 px-3 py-2"
                  >
                    <p
                      className="flex-1 text-sm truncate"
                      style={{ color: 'var(--ink)' }}
                      title={cat}
                    >
                      {cat}
                    </p>
                    <div className="w-32 sm:w-40">
                      <NumberInput
                        value={value}
                        onChange={(n) => onCellChange(section.key, cat, month, n)}
                        placeholder="0"
                        className="h-8 text-right text-[13px]"
                      />
                    </div>
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
