'use client'

import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
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
import { Loader2, FolderTree, ChevronDown, ArrowDownLeft, ArrowUpRight, PiggyBank, TrendingUp, CalendarDays, Calculator, Copy } from 'lucide-react'
import { MobileBudgetingView } from '@/components/budgeting/mobile-budgeting-view'
import { AnggaranMonthDrawer } from '@/components/budgeting/anggaran-drawer'
import { CategoryManager } from '@/components/budgeting/category-manager'
import {
  type CategoryTree,
  type CatNode,
  type BudgetType,
  loadTree,
  loadLocalTree,
  saveTree,
  saveLocalTree,
  cascadeRenameKeys,
  leafKeys,
  subKey,
  isEnabled,
  emptyTree,
} from '@/lib/budget-categories'

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
]

const YEAR_OPTIONS = ['2024', '2025', '2026']

interface BudgetMap {
  [key: string]: number // key = `${type}|${category}|${month}`
}

function budgetKey(type: string, category: string, month: number) {
  return `${type}|${category}|${month}`
}

// Safe arithmetic eval for spreadsheet-style formula entry (=12+3, =1000-50, =3*250000).
// Regex guard ensures only digits + - * / ( ) . — no identifiers/calls, so no code injection.
function evalFormula(expr: string): number {
  // Buang spasi & titik pemisah ribuan ("12 * 250.000" → "12*250000").
  // Anggaran selalu bilangan bulat Rupiah, jadi titik = ribuan, bukan desimal.
  const clean = expr.replace(/[\s.]/g, '')
  if (!clean || !/^[0-9+\-*/()]+$/.test(clean)) return 0
  try {
    const result = Function('"use strict"; return (' + clean + ')')()
    return Number.isFinite(result) ? Math.round(result) : 0
  } catch {
    return 0
  }
}

// Parse a budget cell: supports =formula and plain (grouped) numbers.
function parseCell(input: string): number {
  const s = input.trim()
  if (!s) return 0
  const body = s.startsWith('=') ? s.slice(1) : s
  // Mini-kalkulator: kalau ada operator (× ÷ + atau − antar angka) atau diawali
  // "=", hitung sebagai rumus. Selain itu, angka biasa (toleran titik ribuan).
  const hasOp = /[+*/]/.test(body) || /\d\s*-\s*\d/.test(body)
  if (s.startsWith('=') || hasOp) return evalFormula(body)
  return Number(body.replace(/[^0-9-]/g, '')) || 0
}

type FillSource = { type: BudgetType; category: string; month: number; value: number }

const LS_COLLAPSED_KEY = 'pwm.budget.collapsedSections'

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
  const [collapsed, setCollapsed] = useState<CollapsedMap>(noCollapsed)

  // Category tree (kategori → subkategori) — DB-synced w/ localStorage fallback
  const [tree, setTree] = useState<CategoryTree>(emptyTree)
  const [treeLoaded, setTreeLoaded] = useState(false)
  const [dbSynced, setDbSynced] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)
  const userIdRef = useRef<string | null>(null)

  // Drag-fill (tarik ala Excel) — horizontal across months within one category row
  const [fillSource, setFillSource] = useState<FillSource | null>(null)
  const [fillOverMonth, setFillOverMonth] = useState<number | null>(null)
  const fillSourceRef = useRef<FillSource | null>(null)
  const fillOverRef = useRef<number | null>(null)

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
    setCollapsed(loadCollapsed())
  }, [])

  // Load category tree (DB-first, localStorage fallback)
  useEffect(() => {
    let active = true
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!active) return
      if (!user) {
        setTree(loadLocalTree())
        setTreeLoaded(true)
        return
      }
      userIdRef.current = user.id
      const { tree: t, dbAvailable } = await loadTree(supabase, user.id)
      if (!active) return
      setTree(t)
      setDbSynced(dbAvailable)
      setTreeLoaded(true)
    })()
    return () => {
      active = false
    }
  }, [supabase])

  function toggleCollapsed(kind: BudgetType) {
    setCollapsed((prev) => {
      const next = { ...prev, [kind]: !prev[kind] }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LS_COLLAPSED_KEY, JSON.stringify(next))
      }
      return next
    })
  }

  async function handleTreeCommit(
    next: CategoryTree,
    renames?: { type: BudgetType; pairs: [string, string][] },
  ) {
    setTree(next)
    const uid = userIdRef.current
    if (!uid) {
      saveLocalTree(next)
      return
    }
    await saveTree(supabase, uid, dbSynced, next)
    if (renames && renames.pairs.length) {
      await cascadeRenameKeys(supabase, uid, renames.type, renames.pairs)
      fetchBudgets(year) // resync the budget map after key remap
    }
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

  // ---- Drag-fill (tarik) ----
  function startFill(type: BudgetType, category: string, month: number) {
    const src: FillSource = { type, category, month, value: getValue(type, category, month) }
    fillSourceRef.current = src
    fillOverRef.current = month
    setFillSource(src)
    setFillOverMonth(month)
    if (typeof document !== 'undefined') document.body.style.userSelect = 'none'
    const onUp = () => {
      document.removeEventListener('mouseup', onUp)
      document.body.style.userSelect = ''
      const s = fillSourceRef.current
      const over = fillOverRef.current
      fillSourceRef.current = null
      fillOverRef.current = null
      setFillSource(null)
      setFillOverMonth(null)
      if (s && over != null && over !== s.month) {
        void fillRange(s, Math.min(s.month, over), Math.max(s.month, over))
      }
    }
    document.addEventListener('mouseup', onUp)
  }

  function onFillEnter(type: BudgetType, category: string, month: number) {
    const s = fillSourceRef.current
    if (!s || s.type !== type || s.category !== category) return
    fillOverRef.current = month
    setFillOverMonth(month)
  }

  async function fillRange(s: FillSource, lo: number, hi: number) {
    setBudgets((prev) => {
      const next = { ...prev }
      for (let m = lo; m <= hi; m++) next[budgetKey(s.type, s.category, m)] = s.value
      return next
    })
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const rows = []
    for (let m = lo; m <= hi; m++) {
      rows.push({ user_id: user.id, year: Number(year), month: m, type: s.type, category: s.category, amount: s.value })
    }
    await supabase.from('budgets').upsert(rows, { onConflict: 'user_id,year,month,type,category' })
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

  // Leaf budget keys per type, derived from the tree (a category with subs
  // contributes its subcategory composite keys; otherwise the category itself).
  const leafIncome = leafKeys(tree.income)
  const leafExpense = leafKeys(tree.expense)
  const leafSaving = leafKeys(tree.saving)
  const leafInvestment = leafKeys(tree.investment)

  // Grand totals
  const totalIncomeYear = sectionTotal(leafIncome, 'income')
  const totalExpenseYear = sectionTotal(leafExpense, 'expense')
  const totalSavingYear = sectionTotal(leafSaving, 'saving')
  const totalInvestmentYear = sectionTotal(leafInvestment, 'investment')

  // ---- Render helpers ----

  const idFormatter = new Intl.NumberFormat('id-ID')

  function renderCategoryRow(
    type: BudgetType,
    categoryKey: string,
    label: string,
    bgClass: string,
    level: 'category' | 'sub',
  ) {
    const isSub = level === 'sub'
    const fs = fillSource
    let fillLo = -1, fillHi = -1, fillSrcMonth = -1
    if (fs && fs.type === type && fs.category === categoryKey && fillOverMonth != null) {
      fillSrcMonth = fs.month
      fillLo = Math.min(fs.month, fillOverMonth)
      fillHi = Math.max(fs.month, fillOverMonth)
    }
    const accent = KIND_COLOR[type].hex
    return (
      <tr key={`${type}-${categoryKey}`} className={bgClass}>
        <td
          className={`sticky left-0 z-10 border-b border-[color:var(--border)] py-1 text-xs bg-inherit whitespace-nowrap truncate ${isSub ? 'pl-6 pr-2 font-normal' : 'px-2 font-semibold'}`}
          style={{ color: isSub ? 'var(--ink-muted)' : 'var(--ink)' }}
          title={label}
        >
          {isSub && <span className="mr-1 opacity-40">└</span>}
          {label}
        </td>
        {Array.from({ length: 12 }, (_, i) => {
          const month = i + 1
          const val = getValue(type, categoryKey, month)
          const inRange = fillSrcMonth !== -1 && month >= fillLo && month <= fillHi
          const isSource = month === fillSrcMonth
          return (
            <td
              key={month}
              className="group relative border-b border-[color:var(--border)] px-0.5 py-0"
              style={{ background: inRange && !isSource ? `color-mix(in srgb, ${accent} 13%, transparent)` : undefined }}
              onMouseEnter={() => onFillEnter(type, categoryKey, month)}
            >
              <input
                key={`${type}|${categoryKey}|${month}|${val}`}
                type="text"
                inputMode="numeric"
                defaultValue={val ? idFormatter.format(val) : ''}
                onFocus={(e) => {
                  const raw = Number(e.target.value.replace(/[^0-9-]/g, '')) || 0
                  e.target.value = raw ? String(raw) : ''
                  e.target.select()
                }}
                onBlur={(e) => {
                  const parsed = parseCell(e.target.value)
                  handleCellBlur(type, categoryKey, month, parsed)
                  e.target.value = parsed ? idFormatter.format(parsed) : ''
                }}
                className="num h-7 w-full text-right text-[11px] border-0 bg-transparent outline-none focus:bg-[var(--surface)] px-1 tabular"
                style={{ color: 'var(--ink)' }}
              />
              <span
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startFill(type, categoryKey, month) }}
                className={`absolute bottom-0.5 right-0.5 cursor-crosshair rounded-[2px] transition-opacity duration-150 ${isSource ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'}`}
                style={{ width: 6, height: 6, background: accent, boxShadow: '0 0 0 1.5px var(--surface)' }}
                title="Tarik buat isi nilai ini ke bulan lain"
                aria-hidden="true"
              />
            </td>
          )
        })}
      </tr>
    )
  }

  // Category-with-subs becomes a read-only rollup row (sum of its subcategories).
  function renderRollupRow(type: BudgetType, node: CatNode) {
    const keys = node.subs.map((s) => subKey(node.name, s.name))
    return (
      <tr key={`${type}-rollup-${node.id}`} className="bg-[color:var(--surface-2)]">
        <td className="sticky left-0 z-10 border-b border-[color:var(--border)] px-2 py-1 text-xs font-semibold bg-inherit whitespace-nowrap truncate" title={node.name} style={{ color: 'var(--ink)' }}>
          {node.name}
        </td>
        {Array.from({ length: 12 }, (_, i) => {
          const v = sectionMonthTotal(keys, type, i + 1)
          return (
            <td
              key={i}
              className="num border-b border-[color:var(--border)] px-1 py-1 text-right text-[11px] font-semibold bg-inherit whitespace-nowrap tabular"
              style={{ color: 'var(--ink-muted)' }}
              title={privacyHidden ? '••••••' : formatCurrency(v)}
            >
              {v ? formatCompactCurrency(v) : '—'}
            </td>
          )
        })}
      </tr>
    )
  }

  // Render a section body from the tree. SEMUA kategori induk (punya sub atau
  // nggak) pakai band abu + label bold biar seragam; subkategori indent + zebra.
  function renderSectionBody(kind: BudgetType, oddBg: string) {
    const rows: ReactNode[] = []
    let zebra = 0
    for (const node of tree[kind]) {
      if (!isEnabled(node)) continue // kategori nonaktif: gak ditampilkan di tabel
      if (node.subs.length) {
        rows.push(renderRollupRow(kind, node))
        for (const sub of node.subs) {
          rows.push(
            renderCategoryRow(kind, subKey(node.name, sub.name), sub.name, zebra % 2 === 0 ? 'bg-[var(--surface)]' : oddBg, 'sub'),
          )
          zebra++
        }
      } else {
        // Kategori induk tanpa sub: band abu + bold, sama kayak rollup — biar
        // semua kategori induk seragam, bukan keliatan kayak subkategori.
        rows.push(
          renderCategoryRow(kind, node.name, node.name, 'bg-[color:var(--surface-2)]', 'category'),
        )
      }
    }
    return rows
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
          const inc = sectionMonthTotal(leafIncome, 'income', month)
          const exp = sectionMonthTotal(leafExpense, 'expense', month)
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
  // Pendapatan=mint, Pengeluaran=coral, Tabungan=amber, Investasi=violet
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

  // Ringkasan alokasi (zero-based budgeting): per bulan, berapa pemasukan yang
  // udah "dikasih tugas" (Pengeluaran+Tabungan+Investasi) & berapa yang nganggur.
  function renderAllocationSummary() {
    const allocatedOf = (m: number) =>
      sectionMonthTotal(leafExpense, 'expense', m) +
      sectionMonthTotal(leafSaving, 'saving', m) +
      sectionMonthTotal(leafInvestment, 'investment', m)
    const incomeOf = (m: number) => sectionMonthTotal(leafIncome, 'income', m)
    return (
      <div className="overflow-hidden rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)', boxShadow: '0 1px 3px rgba(16,24,40,0.07)' }}>
        <table className="w-full border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '160px' }} />
            {SHORT_MONTHS.map((m) => <col key={m} />)}
          </colgroup>
          <tbody>
            <tr style={{ background: 'var(--surface-2)' }}>
              <td colSpan={13} className="sticky left-0 z-10 border-b border-[color:var(--border)] px-3 py-2 bg-inherit">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--ink)' }}>Ringkasan Alokasi</span>
                <span className="ml-2 text-[10px] normal-case tracking-normal" style={{ color: 'var(--ink-soft)' }}>Sisa = pemasukan − (pengeluaran + tabungan + investasi)</span>
              </td>
            </tr>
            <tr className="bg-[var(--surface)]">
              <td className="sticky left-0 z-10 border-b border-[color:var(--border)] px-2 py-1 text-xs font-semibold bg-inherit whitespace-nowrap truncate" title="Pengeluaran + Tabungan + Investasi bulan ini">Dialokasikan</td>
              {Array.from({ length: 12 }, (_, i) => {
                const v = allocatedOf(i + 1)
                return (
                  <td key={i} className="num border-b border-[color:var(--border)] px-1 py-1 text-right text-[11px] font-semibold bg-inherit whitespace-nowrap tabular" style={{ color: 'var(--ink-muted)' }} title={privacyHidden ? '••••••' : formatCurrency(v)}>
                    {v ? formatCompactCurrency(v) : '—'}
                  </td>
                )
              })}
            </tr>
            <tr className="bg-[color:var(--surface-2)]">
              <td className="sticky left-0 z-10 border-b border-[color:var(--border)] px-2 py-1 text-xs font-bold bg-inherit whitespace-nowrap truncate" title="Pemasukan − Dialokasikan (0 = pas, + = masih ada sisa, − = over)">Sisa Dialokasikan</td>
              {Array.from({ length: 12 }, (_, i) => {
                const m = i + 1
                const left = incomeOf(m) - allocatedOf(m)
                const color = Math.abs(left) < 1 ? '#059669' : left > 0 ? '#B45309' : '#E11D48'
                return (
                  <td key={i} className="num border-b border-[color:var(--border)] px-1 py-1 text-right text-[11px] font-bold bg-inherit whitespace-nowrap tabular" style={{ color }} title={privacyHidden ? '••••••' : formatCurrency(left)}>
                    {formatCompactCurrency(left)}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  const sections = [
    { label: 'Pendapatan', kind: 'income' as BudgetType, leaf: leafIncome, totalLabel: 'Total Pendapatan', oddBg: 'bg-[rgba(16,185,129,0.04)]', totalBg: 'bg-[rgba(16,185,129,0.12)]', percent: false },
    { label: 'Pengeluaran', kind: 'expense' as BudgetType, leaf: leafExpense, totalLabel: 'Total Pengeluaran', oddBg: 'bg-[rgba(251,113,133,0.04)]', totalBg: 'bg-[rgba(251,113,133,0.14)]', percent: true },
    { label: 'Tabungan', kind: 'saving' as BudgetType, leaf: leafSaving, totalLabel: 'Total Tabungan', oddBg: 'bg-[rgba(245,158,11,0.05)]', totalBg: 'bg-[rgba(245,158,11,0.16)]', percent: false },
    { label: 'Investasi', kind: 'investment' as BudgetType, leaf: leafInvestment, totalLabel: 'Total Investasi', oddBg: 'bg-[rgba(139,92,246,0.04)]', totalBg: 'bg-[rgba(139,92,246,0.14)]', percent: false },
  ]

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
            <Button onClick={() => setManagerOpen(true)}>
              <FolderTree className="h-4 w-4" />
              Kelola Kategori
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

      {/* Budget Grid */}
      {loading || !treeLoaded ? (
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
            visibleIncome={leafIncome}
            visibleExpense={leafExpense}
            visibleSaving={leafSaving}
            visibleInvestment={leafInvestment}
            getValue={getValue}
            onCellChange={handleCellBlur}
          />
        </div>

        {/* Desktop: title + month-header strip + per-section standalone cards */}
        <div className="hidden md:block space-y-3">
          <div className="rounded-xl border px-3.5 py-3" style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)', boxShadow: '0 1px 3px rgba(16,24,40,0.07)' }}>
            <p className="eyebrow">Grid Anggaran 12 Bulan</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
              Rencana anggaran per bulan — setiap nilai tersimpan otomatis.
            </p>
            <div
              className="mt-2.5 pt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t text-[11px]"
              style={{ color: 'var(--ink-muted)', borderColor: 'var(--border-soft)' }}
            >
              {[
                { Icon: CalendarDays, label: <>Klik bulan untuk rincian harian</> },
                { Icon: Calculator, label: <>Hitung langsung di sel, mis. <code className="num" style={{ color: 'var(--ink)' }}>12*250000</code> (×&nbsp;÷&nbsp;+&nbsp;−)</> },
                { Icon: Copy, label: <>Tarik sudut sel untuk menyalin antar-bulan</> },
              ].map((t, i) => (
                <span key={i} className="inline-flex items-center gap-1.5">
                  <t.Icon className="size-3.5 shrink-0" style={{ color: 'var(--ink-soft)' }} />
                  {t.label}
                </span>
              ))}
            </div>
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

              {/* Ringkasan alokasi (zero-based) — headline di pucuk, gaya "Ready to Assign" */}
              {renderAllocationSummary()}

              {/* Each section = its own standalone rounded card, dipisah krem */}
              {sections.map((sec) => (
                <div key={sec.kind} className="overflow-hidden rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)', boxShadow: '0 1px 3px rgba(16,24,40,0.07)' }}>
                  <table className="w-full border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '160px' }} />
                      {SHORT_MONTHS.map((m) => <col key={m} />)}
                    </colgroup>
                    <tbody>
                      {renderSectionHeader(sec.label, sec.kind, sectionTotal(sec.leaf, sec.kind))}
                      {!collapsed[sec.kind] && (
                        <>
                          {renderSectionBody(sec.kind, sec.oddBg)}
                          {renderTotalRow(sec.totalLabel, sec.leaf, sec.kind, sec.totalBg)}
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

      {/* Category Manager — kategori → subkategori, edit/hapus/drag */}
      <CategoryManager
        open={managerOpen}
        onOpenChange={setManagerOpen}
        tree={tree}
        dbSynced={dbSynced}
        onCommit={handleTreeCommit}
      />

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
          visibleIncome={leafIncome}
          visibleExpense={leafExpense}
          visibleSaving={leafSaving}
          visibleInvestment={leafInvestment}
          onPrevMonth={prevDrawerMonth}
          onNextMonth={nextDrawerMonth}
        />
      )}
    </div>
  )
}
