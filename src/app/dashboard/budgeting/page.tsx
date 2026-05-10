'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  SAVING_CATEGORIES,
  INVESTMENT_CATEGORIES,
} from '@/lib/constants'
import { usePrivacy } from '@/components/privacy/privacy-provider'
import { EduTip } from '@/components/edu/edu-tip'
import type { Budget } from '@/types'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, SlidersHorizontal, Check } from 'lucide-react'
import { MobileBudgetingView } from '@/components/budgeting/mobile-budgeting-view'

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
]

const YEAR_OPTIONS = ['2024', '2025', '2026']

type BudgetType = 'income' | 'expense' | 'saving' | 'investment'

interface BudgetMap {
  [key: string]: number // key = `${type}|${category}|${month}`
}

function budgetKey(type: string, category: string, month: number) {
  return `${type}|${category}|${month}`
}

const LS_KEY = 'pwm.budget.enabledCategories'
const LS_CUSTOM_KEY = 'pwm.budget.customCategories'

type EnabledCats = Record<BudgetType, string[]>

function defaultEnabled(): EnabledCats {
  return {
    income: [...INCOME_CATEGORIES],
    expense: [...EXPENSE_CATEGORIES],
    saving: [...SAVING_CATEGORIES],
    investment: [...INVESTMENT_CATEGORIES],
  }
}

function emptyCustom(): EnabledCats {
  return { income: [], expense: [], saving: [], investment: [] }
}

function loadEnabled(): EnabledCats {
  if (typeof window === 'undefined') return defaultEnabled()
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return defaultEnabled()
    const parsed = JSON.parse(raw) as Partial<EnabledCats>
    return {
      income: parsed.income ?? [...INCOME_CATEGORIES],
      expense: parsed.expense ?? [...EXPENSE_CATEGORIES],
      saving: parsed.saving ?? [...SAVING_CATEGORIES],
      investment: parsed.investment ?? [...INVESTMENT_CATEGORIES],
    }
  } catch {
    return defaultEnabled()
  }
}

function loadCustom(): EnabledCats {
  if (typeof window === 'undefined') return emptyCustom()
  try {
    const raw = window.localStorage.getItem(LS_CUSTOM_KEY)
    if (!raw) return emptyCustom()
    const parsed = JSON.parse(raw) as Partial<EnabledCats>
    return {
      income: parsed.income ?? [],
      expense: parsed.expense ?? [],
      saving: parsed.saving ?? [],
      investment: parsed.investment ?? [],
    }
  } catch {
    return emptyCustom()
  }
}

export default function BudgetingPage() {
  const supabase = createClient()
  const { hidden: privacyHidden } = usePrivacy()

  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [budgets, setBudgets] = useState<BudgetMap>({})
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState<EnabledCats>(defaultEnabled)
  const [custom, setCustom] = useState<EnabledCats>(emptyCustom)
  const [selectorOpen, setSelectorOpen] = useState(false)

  useEffect(() => {
    setEnabled(loadEnabled())
    setCustom(loadCustom())
  }, [])

  function saveEnabled(next: EnabledCats) {
    setEnabled(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LS_KEY, JSON.stringify(next))
    }
  }

  function saveCustom(next: EnabledCats) {
    setCustom(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LS_CUSTOM_KEY, JSON.stringify(next))
    }
  }

  function toggleCategory(type: BudgetType, category: string) {
    const current = enabled[type]
    const next = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category]
    saveEnabled({ ...enabled, [type]: next })
  }

  function addCustomCategory(type: BudgetType, name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    const allKnown = [
      ...custom[type],
      ...(type === 'income' ? INCOME_CATEGORIES
        : type === 'expense' ? EXPENSE_CATEGORIES
        : type === 'saving' ? SAVING_CATEGORIES
        : INVESTMENT_CATEGORIES),
    ]
    if (allKnown.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return
    saveCustom({ ...custom, [type]: [...custom[type], trimmed] })
    saveEnabled({ ...enabled, [type]: [...enabled[type], trimmed] })
  }

  function removeCustomCategory(type: BudgetType, name: string) {
    saveCustom({ ...custom, [type]: custom[type].filter((c) => c !== name) })
    saveEnabled({ ...enabled, [type]: enabled[type].filter((c) => c !== name) })
  }

  const fetchBudgets = useCallback(
    async (selectedYear: string) => {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('year', Number(selectedYear))

      const map: BudgetMap = {}
      if (data) {
        for (const b of data as Budget[]) {
          map[budgetKey(b.type, b.category, b.month)] = b.amount
        }
      }
      setBudgets(map)
      setLoading(false)
    },
    [supabase],
  )

  useEffect(() => {
    fetchBudgets(year)
  }, [year, fetchBudgets])

  async function handleCellBlur(
    type: BudgetType,
    category: string,
    month: number,
    value: number,
  ) {
    const key = budgetKey(type, category, month)
    if ((budgets[key] ?? 0) === value) return

    setBudgets((prev) => ({ ...prev, [key]: value }))

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('budgets').upsert(
      {
        user_id: user.id,
        year: Number(year),
        month,
        type,
        category,
        amount: value,
      },
      { onConflict: 'user_id,year,month,type,category' },
    )
  }

  // ---- Calculation helpers ----

  function getValue(type: string, category: string, month: number) {
    return budgets[budgetKey(type, category, month)] ?? 0
  }

  function sectionMonthTotal(
    categories: readonly string[],
    type: string,
    month: number,
  ) {
    let sum = 0
    for (const c of categories) sum += getValue(type, c, month)
    return sum
  }

  function sectionTotal(categories: readonly string[], type: string) {
    let sum = 0
    for (let m = 1; m <= 12; m++)
      sum += sectionMonthTotal(categories, type, m)
    return sum
  }

  // Visible categories (opt-in subset, already includes any custom entries)
  const visibleIncome = enabled.income.length ? enabled.income : [...INCOME_CATEGORIES]
  const visibleExpense = enabled.expense.length ? enabled.expense : [...EXPENSE_CATEGORIES]
  const visibleSaving = enabled.saving.length ? enabled.saving : [...SAVING_CATEGORIES]
  const visibleInvestment = enabled.investment.length ? enabled.investment : [...INVESTMENT_CATEGORIES]

  // Predefined + custom — shown in selector dialog
  const allIncome = [...INCOME_CATEGORIES, ...custom.income]
  const allExpense = [...EXPENSE_CATEGORIES, ...custom.expense]
  const allSaving = [...SAVING_CATEGORIES, ...custom.saving]
  const allInvestment = [...INVESTMENT_CATEGORIES, ...custom.investment]

  // Grand totals
  const totalIncomeYear = sectionTotal(visibleIncome, 'income')
  const totalExpenseYear = sectionTotal(visibleExpense, 'expense')
  const totalSavingYear = sectionTotal(visibleSaving, 'saving')
  const totalInvestmentYear = sectionTotal(visibleInvestment, 'investment')

  const allocated = totalExpenseYear + totalSavingYear + totalInvestmentYear
  const remaining = totalIncomeYear - allocated

  // ---- Render helpers ----

  const idFormatter = new Intl.NumberFormat('id-ID')

  function renderCategoryRow(
    type: BudgetType,
    category: string,
    bgClass: string,
  ) {
    return (
      <tr key={`${type}-${category}`} className={bgClass}>
        <td className="sticky left-0 z-10 border border-[color:var(--border-soft)] px-2 py-1 text-xs font-normal bg-inherit whitespace-nowrap truncate" title={category}>
          {category}
        </td>
        {Array.from({ length: 12 }, (_, i) => {
          const month = i + 1
          const val = getValue(type, category, month)
          return (
            <td key={month} className="border border-[color:var(--border-soft)] px-0.5 py-0">
              <input
                type="text"
                inputMode="numeric"
                defaultValue={val ? idFormatter.format(val) : ''}
                onFocus={(e) => {
                  const raw = Number(e.target.value.replace(/[^0-9-]/g, '')) || 0
                  e.target.value = raw ? String(raw) : ''
                  e.target.select()
                }}
                onBlur={(e) => {
                  const raw = Number(e.target.value.replace(/[^0-9-]/g, '')) || 0
                  handleCellBlur(type, category, month, raw)
                  e.target.value = raw ? idFormatter.format(raw) : ''
                }}
                className="num h-7 w-full text-right text-[11px] border-0 bg-transparent outline-none focus:bg-white px-1 tabular"
                style={{ color: 'var(--ink)' }}
              />
            </td>
          )
        })}
      </tr>
    )
  }

  function renderTotalRow(
    label: string,
    categories: readonly string[],
    type: string,
    bgClass: string,
  ) {
    return (
      <tr className={bgClass}>
        <td className="sticky left-0 z-10 border border-[color:var(--border-soft)] px-2 py-1 text-xs font-bold bg-inherit whitespace-nowrap truncate" title={label}>
          {label}
        </td>
        {Array.from({ length: 12 }, (_, i) => {
          const v = sectionMonthTotal(categories, type, i + 1)
          return (
            <td
              key={i}
              className="num border border-[color:var(--border-soft)] px-1 py-1 text-right text-[11px] font-bold bg-inherit whitespace-nowrap tabular"
              title={privacyHidden ? '••••••' : formatCurrency(v)}
            >
              {formatCompactCurrency(v)}
            </td>
          )
        })}
      </tr>
    )
  }

  function renderPercentRow() {
    return (
      <tr className="bg-[color:var(--surface-2)]">
        <td className="sticky left-0 z-10 border border-[color:var(--border-soft)] px-2 py-1 text-xs font-semibold italic bg-inherit whitespace-nowrap">
          % dari Pendapatan
        </td>
        {Array.from({ length: 12 }, (_, i) => {
          const month = i + 1
          const inc = sectionMonthTotal(INCOME_CATEGORIES, 'income', month)
          const exp = sectionMonthTotal(EXPENSE_CATEGORIES, 'expense', month)
          const pct = inc > 0 ? ((exp / inc) * 100).toFixed(1) : '0.0'
          return (
            <td
              key={month}
              className="num border border-[color:var(--border-soft)] px-1 py-1 text-right text-[11px] font-semibold italic bg-inherit whitespace-nowrap tabular"
            >
              {pct}%
            </td>
          )
        })}
      </tr>
    )
  }

  // Color tokens per kind — used by section header + total row tinting.
  // Matches the dashboard Sankey palette for cross-page consistency.
  const KIND_COLOR: Record<BudgetType, { hex: string; bgSoft: string; bgFirm: string; textOnFirm: string }> = {
    income: {
      hex: '#10B981', // emerald
      bgSoft: 'rgba(16, 185, 129, 0.06)',
      bgFirm: 'rgba(16, 185, 129, 0.14)',
      textOnFirm: '#065F46',
    },
    expense: {
      hex: '#EF4444', // coral / red
      bgSoft: 'rgba(239, 68, 68, 0.05)',
      bgFirm: 'rgba(239, 68, 68, 0.13)',
      textOnFirm: '#991B1B',
    },
    saving: {
      hex: '#F59E0B', // amber
      bgSoft: 'rgba(245, 158, 11, 0.06)',
      bgFirm: 'rgba(245, 158, 11, 0.16)',
      textOnFirm: '#92400E',
    },
    investment: {
      hex: '#0EA5E9', // sky
      bgSoft: 'rgba(14, 165, 233, 0.05)',
      bgFirm: 'rgba(14, 165, 233, 0.14)',
      textOnFirm: '#075985',
    },
  }

  function renderSectionHeader(label: string, kind: BudgetType) {
    const color = KIND_COLOR[kind]
    return (
      <tr style={{ background: color.hex }}>
        <td
          colSpan={13}
          className="sticky left-0 z-10 border border-[color:var(--border-soft)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] bg-inherit"
          style={{ color: '#FFFFFF' }}
        >
          {label}
        </td>
      </tr>
    )
  }

  // Tall spacer row that separates sections visually inside one table.
  function renderSpacer() {
    return (
      <tr aria-hidden="true">
        <td colSpan={13} style={{ height: 18, background: 'var(--bg)', border: 'none' }} />
      </tr>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="dark-card p-6 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="caps" style={{ color: 'var(--emerald-300)' }}>Perencanaan · {year}</p>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mt-2 text-white">
              Anggaran Tahunan
            </h2>
            <p className="text-sm mt-3 flex items-center gap-1.5" style={{ color: 'var(--on-black-mut)' }}>
              Distribusi pendapatan, pengeluaran, tabungan, & investasi sepanjang tahun.
              <EduTip topic="budget-method" side="bottom" />
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setSelectorOpen(true)}
              className="bg-[var(--black-2)] border-[var(--black-line)] text-white hover:bg-[var(--black-soft)] hover:text-white"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Pilih Kategori
            </Button>
            <Select value={year} onValueChange={(v) => setYear(v ?? year)}>
              <SelectTrigger className="w-[120px] bg-[var(--black-2)] border-[var(--black-line)] text-white hover:bg-[var(--black-soft)]">
                <SelectValue placeholder="Tahun" />
              </SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 gap-3 sm:max-w-lg">
        <div className="rounded-lg p-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)' }}>
          <span className="caps">Dialokasikan</span>
          <p className="num text-xl tabular font-semibold mt-1.5" style={{ color: 'var(--ink)' }}>
            {formatCurrency(allocated)}
          </p>
        </div>
        <div className="rounded-lg p-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)' }}>
          <span className="caps">Sisa Alokasi</span>
          <p
            className="num text-xl tabular font-semibold mt-1.5"
            style={{ color: remaining >= 0 ? 'var(--ink)' : 'var(--danger)' }}
          >
            {formatCurrency(remaining)}
          </p>
        </div>
      </div>

      {/* Budget Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin" style={{ color: 'var(--ink)' }} />
          <span className="ml-2" style={{ color: 'var(--ink-muted)' }}>Memuat anggaran...</span>
        </div>
      ) : (
      <>
        {/* Mobile: focused single-month view (one column, vertical) */}
        <div className="md:hidden">
          <MobileBudgetingView
            year={Number(year)}
            visibleIncome={visibleIncome}
            visibleExpense={visibleExpense}
            visibleSaving={visibleSaving}
            visibleInvestment={visibleInvestment}
            getValue={getValue}
            onCellChange={handleCellBlur}
          />
        </div>

        {/* Desktop: 12-month spreadsheet grid */}
        <div className="hidden md:block overflow-x-auto rounded-lg border border-[color:var(--border-soft)]">
          <table className="w-full border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '160px' }} />
              {SHORT_MONTHS.map((m) => <col key={m} style={{ width: 'auto', minWidth: '64px' }} />)}
            </colgroup>
            <thead>
              <tr className="bg-[color:var(--surface-alt)]">
                <th className="sticky left-0 z-20 border border-[color:var(--border-soft)] bg-[color:var(--surface-alt)] px-2 py-1.5 text-left text-[11px] font-bold whitespace-nowrap">
                  Kategori
                </th>
                {SHORT_MONTHS.map((m) => (
                  <th
                    key={m}
                    className="border border-[color:var(--border-soft)] px-1 py-1.5 text-center text-[11px] font-bold whitespace-nowrap"
                  >
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* INCOME — emerald */}
              {renderSectionHeader('Pendapatan', 'income')}
              {visibleIncome.map((c, i) =>
                renderCategoryRow('income', c, i % 2 === 0 ? 'bg-white' : 'bg-[rgba(16,185,129,0.04)]'),
              )}
              {renderTotalRow(
                'Total Pendapatan',
                visibleIncome,
                'income',
                'bg-[rgba(16,185,129,0.12)]',
              )}
              {renderSpacer()}

              {/* EXPENSE — coral */}
              {renderSectionHeader('Pengeluaran', 'expense')}
              {visibleExpense.map((c, i) =>
                renderCategoryRow('expense', c, i % 2 === 0 ? 'bg-white' : 'bg-[rgba(239,68,68,0.04)]'),
              )}
              {renderTotalRow(
                'Total Pengeluaran',
                visibleExpense,
                'expense',
                'bg-[rgba(239,68,68,0.12)]',
              )}
              {renderPercentRow()}
              {renderSpacer()}

              {/* SAVING — amber */}
              {renderSectionHeader('Tabungan', 'saving')}
              {visibleSaving.map((c, i) =>
                renderCategoryRow('saving', c, i % 2 === 0 ? 'bg-white' : 'bg-[rgba(245,158,11,0.05)]'),
              )}
              {renderTotalRow(
                'Total Tabungan',
                visibleSaving,
                'saving',
                'bg-[rgba(245,158,11,0.14)]',
              )}
              {renderSpacer()}

              {/* INVESTMENT — sky */}
              {renderSectionHeader('Investasi', 'investment')}
              {visibleInvestment.map((c, i) =>
                renderCategoryRow('investment', c, i % 2 === 0 ? 'bg-white' : 'bg-[rgba(14,165,233,0.04)]'),
              )}
              {renderTotalRow(
                'Total Investasi',
                visibleInvestment,
                'investment',
                'bg-[rgba(14,165,233,0.12)]',
              )}
            </tbody>
          </table>
        </div>
      </>
      )}

      {/* Category Selector Dialog */}
      <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pilih Kategori yang Dipakai</DialogTitle>
            <DialogDescription>
              Centang hanya kategori yang ingin Anda gunakan. Kategori yang tidak dicentang akan disembunyikan dari tabel anggaran.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 max-h-[60vh] overflow-y-auto pr-1">
            <CategoryGroup
              title="Pendapatan"
              accent="var(--lime-500)"
              all={allIncome}
              customList={custom.income}
              selected={enabled.income}
              onToggle={(c) => toggleCategory('income', c)}
              onAdd={(name) => addCustomCategory('income', name)}
              onRemove={(c) => removeCustomCategory('income', c)}
            />
            <CategoryGroup
              title="Pengeluaran"
              accent="var(--ink)"
              all={allExpense}
              customList={custom.expense}
              selected={enabled.expense}
              onToggle={(c) => toggleCategory('expense', c)}
              onAdd={(name) => addCustomCategory('expense', name)}
              onRemove={(c) => removeCustomCategory('expense', c)}
            />
            <CategoryGroup
              title="Tabungan"
              accent="var(--warning)"
              all={allSaving}
              customList={custom.saving}
              selected={enabled.saving}
              onToggle={(c) => toggleCategory('saving', c)}
              onAdd={(name) => addCustomCategory('saving', name)}
              onRemove={(c) => removeCustomCategory('saving', c)}
            />
            <CategoryGroup
              title="Investasi"
              accent="var(--info)"
              all={allInvestment}
              customList={custom.investment}
              selected={enabled.investment}
              onToggle={(c) => toggleCategory('investment', c)}
              onAdd={(name) => addCustomCategory('investment', name)}
              onRemove={(c) => removeCustomCategory('investment', c)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => saveEnabled(defaultEnabled())}>
              Pakai Semua
            </Button>
            <Button onClick={() => setSelectorOpen(false)}>
              <Check className="h-4 w-4" /> Selesai
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CategoryGroup({
  title,
  accent,
  all,
  customList,
  selected,
  onToggle,
  onAdd,
  onRemove,
}: {
  title: string
  accent: string
  all: string[]
  customList: string[]
  selected: string[]
  onToggle: (category: string) => void
  onAdd: (name: string) => void
  onRemove: (name: string) => void
}) {
  const [draft, setDraft] = useState('')
  const customSet = new Set(customList)
  return (
    <div>
      <p
        className="caps mb-2 flex items-center gap-2"
        style={{ color: 'var(--ink-muted)' }}
      >
        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
        {title}
      </p>
      <div className="flex flex-col gap-1.5">
        {all.map((c) => {
          const on = selected.includes(c)
          const isCustom = customSet.has(c)
          return (
            <div
              key={c}
              className="group flex items-center gap-2 text-sm"
              style={{ color: 'var(--ink)' }}
            >
              <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onToggle(c)}
                  className="h-4 w-4 rounded border"
                  style={{ accentColor: accent }}
                />
                <span className="truncate">{c}</span>
                {isCustom && (
                  <span
                    className="text-[10px] font-medium px-1.5 rounded"
                    style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}
                  >
                    custom
                  </span>
                )}
              </label>
              {isCustom && (
                <button
                  type="button"
                  onClick={() => onRemove(c)}
                  className="text-[11px] opacity-0 group-hover:opacity-100 transition hover:underline"
                  style={{ color: 'var(--danger)' }}
                  aria-label={`Hapus ${c}`}
                >
                  Hapus
                </button>
              )}
            </div>
          )
        })}

        {/* Add custom */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onAdd(draft)
            setDraft('')
          }}
          className="mt-2 flex items-center gap-1.5"
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="+ Tambah kategori..."
            className="flex-1 h-8 px-2 text-sm rounded border bg-white outline-none focus:border-[var(--ink)]"
            style={{ borderColor: 'var(--border-soft)', color: 'var(--ink)' }}
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="h-8 px-3 text-xs font-medium rounded border disabled:opacity-40 disabled:cursor-not-allowed transition"
            style={{
              background: draft.trim() ? accent : 'var(--surface-2)',
              color: draft.trim() && accent !== 'var(--ink)' ? 'var(--ink)' : draft.trim() ? '#FFF' : 'var(--ink-muted)',
              borderColor: 'transparent',
            }}
          >
            Tambah
          </button>
        </form>
      </div>
    </div>
  )
}
