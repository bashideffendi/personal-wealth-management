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
import { PageHeader } from '@/components/layout/page-header'
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
import { Loader2, SlidersHorizontal, Check, ChevronDown, ArrowDownLeft, ArrowUpRight, PiggyBank, TrendingUp } from 'lucide-react'
import { MobileBudgetingView } from '@/components/budgeting/mobile-budgeting-view'
import { AnggaranMonthDrawer } from '@/components/budgeting/anggaran-drawer'

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
const LS_COLLAPSED_KEY = 'pwm.budget.collapsedSections'

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

type CollapsedMap = Record<BudgetType, boolean>

function noCollapsed(): CollapsedMap {
  return { income: false, expense: false, saving: false, investment: false }
}

function loadCollapsed(): CollapsedMap {
  if (typeof window === 'undefined') return noCollapsed()
  try {
    const raw = window.localStorage.getItem(LS_COLLAPSED_KEY)
    if (!raw) return noCollapsed()
    const parsed = JSON.parse(raw) as Partial<CollapsedMap>
    return {
      income: parsed.income ?? false,
      expense: parsed.expense ?? false,
      saving: parsed.saving ?? false,
      investment: parsed.investment ?? false,
    }
  } catch {
    return noCollapsed()
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
  const [collapsed, setCollapsed] = useState<CollapsedMap>(noCollapsed)

  // Drawer state — klik header bulan buka drawer per design handoff
  const [drawerMonth, setDrawerMonth] = useState<number | null>(null)
  const drawerOpen = drawerMonth !== null

  function openDrawer(m: number) {
    setDrawerMonth(m)
  }
  function closeDrawer() {
    setDrawerMonth(null)
  }
  function prevDrawerMonth() {
    if (drawerMonth === null) return
    const next = drawerMonth === 1 ? 12 : drawerMonth - 1
    setDrawerMonth(next)
  }
  function nextDrawerMonth() {
    if (drawerMonth === null) return
    const next = drawerMonth === 12 ? 1 : drawerMonth + 1
    setDrawerMonth(next)
  }

  useEffect(() => {
    setEnabled(loadEnabled())
    setCustom(loadCustom())
    setCollapsed(loadCollapsed())
  }, [])

  function toggleCollapsed(kind: BudgetType) {
    setCollapsed((prev) => {
      const next = { ...prev, [kind]: !prev[kind] }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LS_COLLAPSED_KEY, JSON.stringify(next))
      }
      return next
    })
  }

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

  // ---- Render helpers ----

  const idFormatter = new Intl.NumberFormat('id-ID')

  function renderCategoryRow(
    type: BudgetType,
    category: string,
    bgClass: string,
  ) {
    return (
      <tr key={`${type}-${category}`} className={bgClass}>
        <td className="sticky left-0 z-10 border-b border-[color:var(--border)] px-2 py-1 text-xs font-normal bg-inherit whitespace-nowrap truncate" title={category}>
          {category}
        </td>
        {Array.from({ length: 12 }, (_, i) => {
          const month = i + 1
          const val = getValue(type, category, month)
          return (
            <td key={month} className="border-b border-[color:var(--border)] px-0.5 py-0">
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
                className="num h-7 w-full text-right text-[11px] border-0 bg-transparent outline-none focus:bg-[var(--surface)] px-1 tabular"
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
        <td className="sticky left-0 z-10 border-b border-[color:var(--border)] px-2 py-1 text-xs font-bold bg-inherit whitespace-nowrap truncate" title={label}>
          {label}
        </td>
        {Array.from({ length: 12 }, (_, i) => {
          const v = sectionMonthTotal(categories, type, i + 1)
          return (
            <td
              key={i}
              className="num border-b border-[color:var(--border)] px-1 py-1 text-right text-[11px] font-bold bg-inherit whitespace-nowrap tabular"
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
        <td className="sticky left-0 z-10 border-b border-[color:var(--border)] px-2 py-1 text-xs font-semibold bg-inherit whitespace-nowrap">
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
              className="num border-b border-[color:var(--border)] px-1 py-1 text-right text-[11px] font-semibold bg-inherit whitespace-nowrap tabular"
            >
              {pct}%
            </td>
          )
        })}
      </tr>
    )
  }

  // Color tokens per kind — editorial semantic per design handoff
  // Pendapatan=mint, Pengeluaran=coral, Tabungan=amber, Investasi=primary
  // investment = violet, sisanya mint/coral/amber
  const KIND_COLOR: Record<BudgetType, { hex: string; bgSoft: string; bgFirm: string; textOnFirm: string }> = {
    income: {
      hex: '#10B981', // mint
      bgSoft: 'rgba(16, 185, 129, 0.05)',
      bgFirm: 'rgba(16, 185, 129, 0.16)',
      textOnFirm: '#064E3B',
    },
    expense: {
      hex: '#F43F5E', // coral
      bgSoft: 'rgba(244, 63, 94, 0.05)',
      bgFirm: 'rgba(244, 63, 94, 0.14)',
      textOnFirm: '#9F1239',
    },
    saving: {
      hex: '#F59E0B', // amber
      bgSoft: 'rgba(245, 158, 11, 0.06)',
      bgFirm: 'rgba(245, 158, 11, 0.18)',
      textOnFirm: '#92400E',
    },
    investment: {
      hex: '#8B5CF6', // violet
      bgSoft: 'rgba(139, 92, 246, 0.05)',
      bgFirm: 'rgba(139, 92, 246, 0.15)',
      textOnFirm: '#4C1D95',
    },
  }

  // Current month index (1-12) for highlighting current column
  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()
  const isCurrentYearActive = Number(year) === currentYear

  function renderSectionHeader(label: string, kind: BudgetType, annualTotal: number) {
    const color = KIND_COLOR[kind]
    const isCollapsed = collapsed[kind]
    return (
      <tr style={{ background: color.bgFirm }}>
        <td
          colSpan={13}
          className="sticky left-0 z-10 border-b border-[color:var(--border)] p-0 bg-inherit"
        >
          <button
            type="button"
            onClick={() => toggleCollapsed(kind)}
            className="group flex w-full items-center gap-2 px-3 py-2 text-left transition-[filter] hover:brightness-[0.97]"
            style={{ color: color.textOnFirm }}
            aria-expanded={!isCollapsed}
            title={isCollapsed ? `Tampilkan ${label}` : `Sembunyikan ${label}`}
          >
            <ChevronDown
              className="size-3.5 shrink-0 transition-transform duration-150"
              style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none', opacity: 0.7 }}
            />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">{label}</span>
            <span
              className="num tabular ml-auto text-[11px] font-bold tabular-nums"
              title={privacyHidden ? '••••••' : formatCurrency(annualTotal)}
            >
              {isCollapsed ? formatCompactCurrency(annualTotal) : ''}
            </span>
          </button>
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Perencanaan · ${year}`}
        title="Anggaran Tahunan"
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            Distribusi pendapatan, pengeluaran, tabungan, &amp; investasi sepanjang tahun.
            <EduTip topic="budget-method" side="bottom" />
          </span>
        }
        actions={
          <>
            <Button onClick={() => setSelectorOpen(true)}>
              <SlidersHorizontal className="h-4 w-4" />
              Pilih Kategori
            </Button>
            <Select value={year} onValueChange={(v) => setYear(v ?? year)}>
              <SelectTrigger className="w-[120px]" style={{ background: 'var(--surface)' }}>
                <SelectValue placeholder="Tahun" />
              </SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        }
      />

      {/* Summary — annual totals (sum of all 12 months) */}
      <div className="space-y-2.5">
        <p className="eyebrow">Total Setahun · {year}</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Pendapatan', value: totalIncomeYear, dot: '#10B981', Icon: ArrowDownLeft, sub: 'Setahun' },
          { label: 'Total Pengeluaran', value: totalExpenseYear, dot: '#F43F5E', Icon: ArrowUpRight, sub: `${totalIncomeYear > 0 ? Math.round((totalExpenseYear / totalIncomeYear) * 100) : 0}% dari pendapatan` },
          { label: 'Total Tabungan', value: totalSavingYear, dot: '#F59E0B', Icon: PiggyBank, sub: `${totalIncomeYear > 0 ? Math.round((totalSavingYear / totalIncomeYear) * 100) : 0}% dari pendapatan` },
          { label: 'Total Investasi', value: totalInvestmentYear, dot: '#8B5CF6', Icon: TrendingUp, sub: `${totalIncomeYear > 0 ? Math.round((totalInvestmentYear / totalIncomeYear) * 100) : 0}% dari pendapatan` },
        ].map((c) => (
          <div key={c.label} className="rounded-xl p-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)', boxShadow: '0 1px 2px -1px rgba(16,24,40,0.06), 0 10px 28px -14px rgba(16,24,40,0.12)' }}>
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--ink-muted)' }}>
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.dot }} />
                {c.label}
              </span>
              <span className="grid place-items-center shrink-0 rounded-[10px]" style={{ width: 32, height: 32, background: `color-mix(in srgb, ${c.dot} 14%, transparent)`, color: c.dot }}>
                <c.Icon className="size-4" />
              </span>
            </div>
            <p className="num tabular font-bold mt-2" style={{ color: 'var(--ink)', fontSize: 'clamp(18px, 2.2vw, 24px)', letterSpacing: '-0.02em' }}>
              {formatCurrency(c.value)}
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--ink-soft)' }}>{c.sub}</p>
          </div>
        ))}
        </div>
      </div>

      {/* Annual allocation summary removed — budgeting is monthly (review 30 Mei); allocation detail lives in the per-month drawer */}

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

        {/* Desktop: title + month-header strip + per-section standalone cards */}
        <div className="hidden md:block space-y-3">
          <div>
            <p className="eyebrow">Grid Anggaran 12 Bulan</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted)' }}>
              Klik nama bulan buat buka rincian harian, kategori &amp; proyeksi.
            </p>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="space-y-3 min-w-[1040px]">
              {/* Month-label header strip */}
              <div className="overflow-hidden rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)', boxShadow: '0 1px 3px rgba(16,24,40,0.07)' }}>
                <table className="w-full border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '160px' }} />
                    {SHORT_MONTHS.map((m) => <col key={m} />)}
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-20 px-3 py-2 text-left text-[11px] font-bold whitespace-nowrap eyebrow" style={{ background: 'var(--surface)' }}>
                        Kategori
                      </th>
                      {SHORT_MONTHS.map((m, i) => {
                        const monthNum = i + 1
                        const isCurrent = isCurrentYearActive && monthNum === currentMonth
                        return (
                          <th
                            key={m}
                            className="px-1 py-2 text-center text-[11px] font-bold whitespace-nowrap cursor-pointer transition-colors hover:bg-[var(--surface-2)]"
                            style={{
                              background: isCurrent ? 'color-mix(in srgb, var(--c-primary) 9%, transparent)' : undefined,
                              color: isCurrent ? 'var(--c-primary)' : undefined,
                              boxShadow: isCurrent ? 'inset 0 -2px 0 var(--c-primary)' : undefined,
                            }}
                            onClick={() => openDrawer(monthNum)}
                            role="button"
                            tabIndex={0}
                            title={`Klik untuk detail ${m}`}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                openDrawer(monthNum)
                              }
                            }}
                          >
                            <span className="inline-flex items-center justify-center gap-0.5">
                              {m}
                              <ChevronDown className="size-3 shrink-0" style={{ opacity: 0.45 }} />
                            </span>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                </table>
              </div>

              {/* Each section = its own standalone rounded card, dipisah krem */}
              {[
                { label: 'Pendapatan', kind: 'income' as BudgetType, visible: visibleIncome, totalLabel: 'Total Pendapatan', oddBg: 'bg-[rgba(16,185,129,0.04)]', totalBg: 'bg-[rgba(16,185,129,0.12)]', percent: false },
                { label: 'Pengeluaran', kind: 'expense' as BudgetType, visible: visibleExpense, totalLabel: 'Total Pengeluaran', oddBg: 'bg-[rgba(251,113,133,0.04)]', totalBg: 'bg-[rgba(251,113,133,0.14)]', percent: true },
                { label: 'Tabungan', kind: 'saving' as BudgetType, visible: visibleSaving, totalLabel: 'Total Tabungan', oddBg: 'bg-[rgba(245,158,11,0.05)]', totalBg: 'bg-[rgba(245,158,11,0.16)]', percent: false },
                { label: 'Investasi', kind: 'investment' as BudgetType, visible: visibleInvestment, totalLabel: 'Total Investasi', oddBg: 'bg-[rgba(139,92,246,0.04)]', totalBg: 'bg-[rgba(139,92,246,0.14)]', percent: false },
              ].map((sec) => (
                <div key={sec.kind} className="overflow-hidden rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)', boxShadow: '0 1px 3px rgba(16,24,40,0.07)' }}>
                  <table className="w-full border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '160px' }} />
                      {SHORT_MONTHS.map((m) => <col key={m} />)}
                    </colgroup>
                    <tbody>
                      {renderSectionHeader(sec.label, sec.kind, sectionTotal(sec.visible, sec.kind))}
                      {!collapsed[sec.kind] && (
                        <>
                          {sec.visible.map((c, i) =>
                            renderCategoryRow(sec.kind, c, i % 2 === 0 ? 'bg-[var(--surface)]' : sec.oddBg),
                          )}
                          {renderTotalRow(sec.totalLabel, sec.visible, sec.kind, sec.totalBg)}
                          {sec.percent && renderPercentRow()}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
      )}

      {/* Category Selector Dialog */}
      <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pilih Kategori yang Dipakai</DialogTitle>
            <DialogDescription>
              Centang hanya kategori yang ingin kamu pakai. Kategori yang tidak dicentang akan disembunyikan dari tabel anggaran.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 max-h-[60vh] overflow-y-auto pr-1">
            <CategoryGroup
              title="Pendapatan"
              accent="var(--c-mint)"
              all={allIncome}
              customList={custom.income}
              selected={enabled.income}
              onToggle={(c) => toggleCategory('income', c)}
              onAdd={(name) => addCustomCategory('income', name)}
              onRemove={(c) => removeCustomCategory('income', c)}
            />
            <CategoryGroup
              title="Pengeluaran"
              accent="var(--c-coral)"
              all={allExpense}
              customList={custom.expense}
              selected={enabled.expense}
              onToggle={(c) => toggleCategory('expense', c)}
              onAdd={(name) => addCustomCategory('expense', name)}
              onRemove={(c) => removeCustomCategory('expense', c)}
            />
            <CategoryGroup
              title="Tabungan"
              accent="var(--c-amber)"
              all={allSaving}
              customList={custom.saving}
              selected={enabled.saving}
              onToggle={(c) => toggleCategory('saving', c)}
              onAdd={(name) => addCustomCategory('saving', name)}
              onRemove={(c) => removeCustomCategory('saving', c)}
            />
            <CategoryGroup
              title="Investasi"
              accent="var(--c-violet)"
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

      {/* ─── Anggaran Month Drawer — klik header bulan trigger ─── */}
      {drawerMonth !== null && (
        <AnggaranMonthDrawer
          open={drawerOpen}
          onOpenChange={(open) => {
            if (!open) closeDrawer()
          }}
          month={drawerMonth}
          year={Number(year)}
          getValue={getValue}
          visibleIncome={visibleIncome}
          visibleExpense={visibleExpense}
          visibleSaving={visibleSaving}
          visibleInvestment={visibleInvestment}
          onPrevMonth={prevDrawerMonth}
          onNextMonth={nextDrawerMonth}
        />
      )}
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
        className="eyebrow mb-2 flex items-center gap-2"
        style={{ color: accent }}
      >
        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
        {title}
        <span className="num tabular ml-auto text-[10.5px] font-medium" style={{ color: 'var(--ink-soft)' }}>
          {selected.length}/{all.length}
        </span>
      </p>
      <div className="flex flex-col gap-1">
        {all.map((c) => {
          const on = selected.includes(c)
          const isCustom = customSet.has(c)
          return (
            <div
              key={c}
              className="group flex items-center rounded-lg transition-colors"
              style={{ background: on ? `color-mix(in srgb, ${accent} 13%, transparent)` : 'transparent' }}
            >
              <button
                type="button"
                onClick={() => onToggle(c)}
                className="flex flex-1 min-w-0 items-center gap-2.5 px-2.5 py-2 text-left"
              >
                <span
                  className="grid shrink-0 place-items-center rounded-md transition-colors"
                  style={{
                    width: 18,
                    height: 18,
                    background: on ? accent : 'var(--surface)',
                    border: on ? 'none' : '1.5px solid var(--border)',
                  }}
                >
                  {on && <Check className="size-3" strokeWidth={3} style={{ color: '#FFF' }} />}
                </span>
                <span
                  className="truncate text-sm"
                  style={{ fontWeight: on ? 600 : 500, color: on ? 'var(--ink)' : 'var(--ink-muted)' }}
                >
                  {c}
                </span>
                {isCustom && (
                  <span
                    className="shrink-0 rounded px-1.5 text-[10px] font-medium"
                    style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}
                  >
                    custom
                  </span>
                )}
              </button>
              {isCustom && (
                <button
                  type="button"
                  onClick={() => onRemove(c)}
                  className="shrink-0 pr-2.5 text-[11px] opacity-0 transition hover:underline group-hover:opacity-100"
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
            className="flex-1 h-8 px-2 text-sm rounded border bg-[var(--surface)] outline-none focus:border-[var(--ink)]"
            style={{ borderColor: 'var(--border-soft)', color: 'var(--ink)' }}
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="h-8 px-3 text-xs font-medium rounded border disabled:opacity-40 disabled:cursor-not-allowed transition"
            style={{
              background: draft.trim() ? accent : 'var(--surface-2)',
              color: draft.trim() ? '#FFF' : 'var(--ink-muted)',
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
