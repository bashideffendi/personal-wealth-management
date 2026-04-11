'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  SAVING_CATEGORIES,
  INVESTMENT_CATEGORIES,
} from '@/lib/constants'
import type { Budget } from '@/types'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

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

export default function BudgetingPage() {
  const supabase = createClient()

  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [budgets, setBudgets] = useState<BudgetMap>({})
  const [loading, setLoading] = useState(true)

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

  function rowTotal(type: string, category: string) {
    let sum = 0
    for (let m = 1; m <= 12; m++) sum += getValue(type, category, m)
    return sum
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

  // Grand totals
  const totalIncomeYear = sectionTotal(INCOME_CATEGORIES, 'income')
  const totalExpenseYear = sectionTotal(EXPENSE_CATEGORIES, 'expense')
  const totalSavingYear = sectionTotal(SAVING_CATEGORIES, 'saving')
  const totalInvestmentYear = sectionTotal(INVESTMENT_CATEGORIES, 'investment')

  const allocated = totalExpenseYear + totalSavingYear + totalInvestmentYear
  const remaining = totalIncomeYear - allocated

  // ---- Render helpers ----

  function renderCategoryRow(
    type: BudgetType,
    category: string,
    bgClass: string,
  ) {
    return (
      <tr key={`${type}-${category}`} className={bgClass}>
        <td className="sticky left-0 z-10 border border-gray-200 px-3 py-1.5 text-sm font-normal bg-inherit whitespace-nowrap">
          {category}
        </td>
        {Array.from({ length: 12 }, (_, i) => {
          const month = i + 1
          const val = getValue(type, category, month)
          return (
            <td key={month} className="border border-gray-200 px-1 py-0.5">
              <Input
                type="number"
                min={0}
                className="h-7 w-full text-right text-xs border-0 bg-transparent focus:bg-white"
                defaultValue={val || ''}
                onBlur={(e) =>
                  handleCellBlur(type, category, month, Number(e.target.value) || 0)
                }
              />
            </td>
          )
        })}
        <td className="border border-gray-200 px-3 py-1.5 text-right text-xs font-semibold bg-inherit whitespace-nowrap">
          {formatCurrency(rowTotal(type, category))}
        </td>
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
        <td className="sticky left-0 z-10 border border-gray-200 px-3 py-1.5 text-sm font-bold bg-inherit whitespace-nowrap">
          {label}
        </td>
        {Array.from({ length: 12 }, (_, i) => (
          <td
            key={i}
            className="border border-gray-200 px-3 py-1.5 text-right text-xs font-bold bg-inherit whitespace-nowrap"
          >
            {formatCurrency(sectionMonthTotal(categories, type, i + 1))}
          </td>
        ))}
        <td className="border border-gray-200 px-3 py-1.5 text-right text-xs font-bold bg-inherit whitespace-nowrap">
          {formatCurrency(sectionTotal(categories, type))}
        </td>
      </tr>
    )
  }

  function renderPercentRow() {
    return (
      <tr className="bg-red-50">
        <td className="sticky left-0 z-10 border border-gray-200 px-3 py-1.5 text-sm font-semibold italic bg-inherit whitespace-nowrap">
          Pengeluaran sbg % Pendapatan
        </td>
        {Array.from({ length: 12 }, (_, i) => {
          const month = i + 1
          const inc = sectionMonthTotal(INCOME_CATEGORIES, 'income', month)
          const exp = sectionMonthTotal(EXPENSE_CATEGORIES, 'expense', month)
          const pct = inc > 0 ? ((exp / inc) * 100).toFixed(1) : '0.0'
          return (
            <td
              key={month}
              className="border border-gray-200 px-3 py-1.5 text-right text-xs font-semibold italic bg-inherit whitespace-nowrap"
            >
              {pct}%
            </td>
          )
        })}
        <td className="border border-gray-200 px-3 py-1.5 text-right text-xs font-semibold italic bg-inherit whitespace-nowrap">
          {totalIncomeYear > 0
            ? ((totalExpenseYear / totalIncomeYear) * 100).toFixed(1)
            : '0.0'}
          %
        </td>
      </tr>
    )
  }

  function renderSectionHeader(label: string, bgClass: string) {
    return (
      <tr className={bgClass}>
        <td
          colSpan={14}
          className="sticky left-0 z-10 border border-gray-200 px-3 py-2 text-sm font-bold text-gray-800 bg-inherit"
        >
          {label}
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Anggaran Tahunan</h1>
        <Select value={year} onValueChange={(v) => setYear(v ?? year)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Tahun" />
          </SelectTrigger>
          <SelectContent>
            {YEAR_OPTIONS.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Bar */}
      <div className="flex flex-wrap gap-4 rounded-lg bg-teal-50 border border-teal-200 p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-teal-800">Dialokasikan:</span>
          <span className="text-sm font-bold text-teal-900">
            {formatCurrency(allocated)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-teal-800">
            Sisa untuk dialokasikan:
          </span>
          <span
            className={`text-sm font-bold ${
              remaining >= 0 ? 'text-teal-900' : 'text-red-600'
            }`}
          >
            {formatCurrency(remaining)}
          </span>
        </div>
      </div>

      {/* Budget Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-teal-600" />
          <span className="ml-2 text-gray-500">Memuat anggaran...</span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="sticky left-0 z-20 border border-gray-200 bg-gray-100 px-3 py-2 text-left text-xs font-bold whitespace-nowrap">
                  Kategori
                </th>
                {SHORT_MONTHS.map((m) => (
                  <th
                    key={m}
                    className="border border-gray-200 px-3 py-2 text-center text-xs font-bold whitespace-nowrap min-w-[100px]"
                  >
                    {m}
                  </th>
                ))}
                <th className="border border-gray-200 px-3 py-2 text-center text-xs font-bold whitespace-nowrap min-w-[120px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {/* INCOME */}
              {renderSectionHeader(
                'Pendapatan yang Diharapkan',
                'bg-emerald-100',
              )}
              {INCOME_CATEGORIES.map((c) =>
                renderCategoryRow('income', c, 'bg-emerald-50/50'),
              )}
              {renderTotalRow(
                'Total Pendapatan',
                INCOME_CATEGORIES,
                'income',
                'bg-emerald-100 font-bold',
              )}

              {/* EXPENSE */}
              {renderSectionHeader('Pengeluaran', 'bg-red-100')}
              {EXPENSE_CATEGORIES.map((c) =>
                renderCategoryRow('expense', c, 'bg-red-50/50'),
              )}
              {renderTotalRow(
                'Total Pengeluaran',
                EXPENSE_CATEGORIES,
                'expense',
                'bg-red-100 font-bold',
              )}
              {renderPercentRow()}

              {/* SAVING */}
              {renderSectionHeader('Tabungan', 'bg-amber-100')}
              {SAVING_CATEGORIES.map((c) =>
                renderCategoryRow('saving', c, 'bg-amber-50/50'),
              )}
              {renderTotalRow(
                'Total Tabungan',
                SAVING_CATEGORIES,
                'saving',
                'bg-amber-100 font-bold',
              )}

              {/* INVESTMENT */}
              {renderSectionHeader('Investasi', 'bg-blue-100')}
              {INVESTMENT_CATEGORIES.map((c) =>
                renderCategoryRow('investment', c, 'bg-blue-50/50'),
              )}
              {renderTotalRow(
                'Total Investasi',
                INVESTMENT_CATEGORIES,
                'investment',
                'bg-blue-100 font-bold',
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
