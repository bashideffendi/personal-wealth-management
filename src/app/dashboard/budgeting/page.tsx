'use client'

import { useEffect, useState, useCallback, useMemo, useRef, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { usePrivacy } from '@/components/privacy/privacy-provider'
import { useT, useI18n } from '@/lib/i18n/context'
import { monthsShort } from '@/lib/i18n/dates'
import type { Budget } from '@/types'

import { Button } from '@/components/ui/button'
import { QuietPageHeader } from '@/components/layout/quiet-page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, FolderTree, ChevronDown, Plus, Info, CalendarDays, Calculator, Copy, Check } from 'lucide-react'
import { MobileBudgetingView } from '@/components/budgeting/mobile-budgeting-view'
import { MonthBudgetView } from '@/components/budgeting/month-budget-view'
import { AnggaranMonthDrawer } from '@/components/budgeting/anggaran-drawer'
import { CategoryManager } from '@/components/budgeting/category-manager'
import {
  type CategoryTree,
  type CatNode,
  type CatTarget,
  type BudgetType,
  loadTree,
  loadLocalTree,
  saveTree,
  saveLocalTree,
  cascadeRenameKeys,
  loadCategoryUsage,
  loadMonthlyActuals,
  leafKeys,
  subKey,
  rootCategory,
  isEnabled,
  emptyTree,
  newId,
  BUDGET_TYPES,
} from '@/lib/budget-categories'
import { CategoryIcon } from '@/components/transactions/category-icon'
import { toast } from 'sonner'

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
  // Anggaran nggak boleh negatif → clamp ke 0.
  if (s.startsWith('=') || hasOp) return Math.max(0, evalFormula(body))
  return Math.max(0, Number(body.replace(/[^0-9-]/g, '')) || 0)
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
  const t = useT()
  const { locale } = useI18n()
  const shortMonths = monthsShort(locale)

  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [budgets, setBudgets] = useState<BudgetMap>({})
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<CollapsedMap>(noCollapsed)

  // Category tree (kategori → subkategori) — DB-synced w/ localStorage fallback
  const [tree, setTree] = useState<CategoryTree>(emptyTree)
  const [treeLoaded, setTreeLoaded] = useState(false)
  const [dbSynced, setDbSynced] = useState(false)
  const [catUsage, setCatUsage] = useState<Record<string, number>>({})
  const [viewMode, setViewMode] = useState<'year' | 'month'>('year')
  const [focusMonth, setFocusMonth] = useState(() => new Date().getMonth() + 1)
  const [actuals, setActuals] = useState<Record<string, number>>({})
  const [addingTo, setAddingTo] = useState<BudgetType | null>(null)
  const [newCatInline, setNewCatInline] = useState('')
  const [addingSubTo, setAddingSubTo] = useState<{ kind: BudgetType; parent: string } | null>(null)
  const [newSubInline, setNewSubInline] = useState('')
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
      loadCategoryUsage(supabase, user.id).then((u) => active && setCatUsage(u))
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
      loadCategoryUsage(supabase, uid).then(setCatUsage) // transaksi ikut pindah → refresh hitungan
      loadMonthlyActuals(supabase, uid, year).then(setActuals) // realisasi ikut berubah
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
      loadMonthlyActuals(supabase, user.id, selectedYear).then(setActuals)
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
  function startFill(type: BudgetType, category: string, month: number, liveValue?: number) {
    const src: FillSource = { type, category, month, value: liveValue ?? getValue(type, category, month) }
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

  // Peta target per leaf (`${type}::${leafKey}` → CatTarget) buat view Bulan.
  const leafTargets = useMemo(() => {
    const m: Record<string, CatTarget> = {}
    for (const type of BUDGET_TYPES) {
      for (const node of tree[type]) {
        if (node.subs.length) {
          for (const sub of node.subs) {
            if (sub.target) m[`${type}::${subKey(node.name, sub.name)}`] = sub.target
          }
        } else if (node.target) {
          m[`${type}::${node.name}`] = node.target
        }
      }
    }
    return m
  }, [tree])

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
    bg: string,
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
    const ownerNode = tree[type].find((c) => c.name === (isSub ? rootCategory(categoryKey) : categoryKey))
    const dotColor = ownerNode?.color ?? accent
    return (
      <tr key={`${type}-${categoryKey}`} className="group" style={{ background: bg }}>
        <td
          className={`sticky left-0 z-10 border-b border-[color:var(--border)] py-1 text-xs bg-inherit whitespace-nowrap truncate ${isSub ? 'pl-6 pr-2 font-normal' : 'px-2 font-semibold'}`}
          style={{ color: isSub ? 'var(--ink-muted)' : 'var(--ink)' }}
          title={label}
        >
          {isSub ? (
            <span className="mr-1" style={{ color: dotColor, opacity: 0.5 }}>└</span>
          ) : (
            <span
              className="mr-1.5 inline-grid size-4 place-items-center align-middle"
              style={{ color: dotColor }}
            >
              {ownerNode?.icon ? (
                <CategoryIcon category={categoryKey} iconKey={ownerNode.icon} className="size-3.5" />
              ) : (
                <span className="inline-block size-2 rounded-full" style={{ background: dotColor }} />
              )}
            </span>
          )}
          {label}
          {!isSub && (
            <button
              type="button"
              onClick={() => { setNewSubInline(''); setAddingSubTo({ kind: type, parent: categoryKey }) }}
              className="ml-1.5 inline-grid size-4 place-items-center rounded align-middle opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--surface-3)]"
              style={{ color: 'var(--ink-soft)' }}
              title={t('budgeting.add_subcategory')}
            >
              <Plus className="size-3" />
            </button>
          )}
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
                className="num h-7 w-full text-right text-[11px] border-0 bg-transparent outline-none focus:bg-[var(--surface)] focus:ring-1 focus:ring-inset focus:ring-[var(--c-primary)] px-1 tabular"
                style={{ color: 'var(--ink)' }}
              />
              <span
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); const inp = (e.currentTarget.parentElement as HTMLElement | null)?.querySelector('input'); startFill(type, categoryKey, month, inp ? parseCell(inp.value) : undefined) }}
                className={`absolute bottom-0.5 right-0.5 cursor-crosshair rounded-[2px] transition-opacity duration-150 ${isSource ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'}`}
                style={{ width: 6, height: 6, background: accent, boxShadow: '0 0 0 1.5px var(--surface)' }}
                title={t('budgeting.fill_handle_title')}
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
      <tr key={`${type}-rollup-${node.id}`} className="group" style={{ background: tint(type, 8) }}>
        <td className="sticky left-0 z-10 border-b border-[color:var(--border)] px-2 py-1 text-xs font-semibold bg-inherit whitespace-nowrap truncate" title={node.name} style={{ color: 'var(--ink)' }}>
          <span className="mr-1.5 inline-grid size-4 place-items-center align-middle" style={{ color: node.color ?? KIND_COLOR[type].hex }}>
            {node.icon ? (
              <CategoryIcon category={node.name} iconKey={node.icon} className="size-3.5" />
            ) : (
              <span className="inline-block size-2 rounded-full" style={{ background: node.color ?? KIND_COLOR[type].hex }} />
            )}
          </span>
          {node.name}
          <button
            type="button"
            onClick={() => { setNewSubInline(''); setAddingSubTo({ kind: type, parent: node.name }) }}
            className="ml-1.5 inline-grid size-4 place-items-center rounded align-middle opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--surface-3)]"
            style={{ color: 'var(--ink-soft)' }}
            title={t('budgeting.add_subcategory')}
          >
            <Plus className="size-3" />
          </button>
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
              {privacyHidden ? '••••••' : v ? formatCurrency(v) : '—'}
            </td>
          )
        })}
      </tr>
    )
  }

  // Tambah kategori induk langsung dari tabel (opsi tambahan; modal Kelola
  // Kategori tetap ada). Update tree → handleTreeCommit (persist DB + cascade).
  function addCategoryInline(kind: BudgetType) {
    const name = newCatInline.trim()
    setAddingTo(null)
    setNewCatInline('')
    if (!name) return
    if (tree[kind].some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`${t('budgeting.category_prefix')} "${name}" ${t('budgeting.category_exists_suffix')}`)
      return
    }
    handleTreeCommit({ ...tree, [kind]: [...tree[kind], { id: newId(), name, subs: [] }] })
  }

  // Tambah subkategori langsung dari tabel (hover baris → tombol +). Kalau induk
  // tadinya "polos" (tanpa sub), nilai anggaran lamanya OTOMATIS dipindah ke sub
  // pertama (semua tahun) biar nggak ke-orphan dari total.
  async function addSubInline(kind: BudgetType, parentName: string) {
    const subName = newSubInline.trim()
    setAddingSubTo(null)
    setNewSubInline('')
    if (!subName) return
    const parent = tree[kind].find((c) => c.name === parentName)
    if (!parent) return
    if (parent.subs.some((s) => s.name.toLowerCase() === subName.toLowerCase())) {
      toast.error(`${t('budgeting.category_prefix')} "${subName}" ${t('budgeting.category_exists_suffix')}`)
      return
    }
    const wasLeaf = parent.subs.length === 0
    const nextTree = {
      ...tree,
      [kind]: tree[kind].map((c) =>
        c.name === parentName ? { ...c, subs: [...c.subs, { id: newId(), name: subName }] } : c,
      ),
    }
    await handleTreeCommit(nextTree)

    // Migrasi nilai: induk-yg-tadinya-leaf → sub pertama (preserve total).
    if (wasLeaf) {
      const newSubK = subKey(parentName, subName)
      let hadValues = false
      for (let m = 1; m <= 12; m++) {
        if ((budgets[budgetKey(kind, parentName, m)] ?? 0) !== 0) hadValues = true
      }
      // Re-key the in-memory map (current year) ALWAYS — also covers offline,
      // so the new rollup keeps summing the migrated values instead of orphaning them.
      setBudgets((prev) => {
        const next = { ...prev }
        for (let m = 1; m <= 12; m++) {
          const oldK = budgetKey(kind, parentName, m)
          if (next[oldK] != null) {
            next[budgetKey(kind, newSubK, m)] = next[oldK]
            delete next[oldK]
          }
        }
        return next
      })
      // Persist across ALL years when logged in.
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: oldRows } = await supabase
          .from('budgets')
          .select('*')
          .eq('user_id', user.id)
          .eq('type', kind)
          .eq('category', parentName)
        const rows = (oldRows ?? []) as Budget[]
        if (rows.length) {
          await supabase.from('budgets').upsert(
            rows.map((r) => ({ user_id: user.id, year: r.year, month: r.month, type: kind, category: newSubK, amount: r.amount })),
            { onConflict: 'user_id,year,month,type,category' },
          )
          await supabase.from('budgets').delete().eq('user_id', user.id).eq('type', kind).eq('category', parentName)
        }
      }
      if (hadValues) toast.success(t('budgeting.sub_added_migrated'))
    }
  }

  // Render a section body from the tree. SEMUA kategori induk (punya sub atau
  // nggak) pakai band abu + label bold biar seragam; subkategori indent + zebra.
  function renderSectionBody(kind: BudgetType) {
    const rows: ReactNode[] = []
    for (const node of tree[kind]) {
      if (!isEnabled(node)) continue // kategori nonaktif: gak ditampilkan di tabel
      if (node.subs.length) {
        rows.push(renderRollupRow(kind, node))
        for (const sub of node.subs) {
          rows.push(
            renderCategoryRow(kind, subKey(node.name, sub.name), sub.name, tint(kind, 3), 'sub'),
          )
        }
      } else {
        // Kategori induk tanpa sub: band abu + bold, sama kayak rollup — biar
        // semua kategori induk seragam, bukan keliatan kayak subkategori.
        rows.push(
          renderCategoryRow(kind, node.name, node.name, tint(kind, 8), 'category'),
        )
      }
      if (addingSubTo && addingSubTo.kind === kind && addingSubTo.parent === node.name) {
        rows.push(
          <tr key={`${kind}-addsub-${node.id}`} className="bg-[var(--surface)]">
            <td colSpan={13} className="sticky left-0 z-10 border-b border-[color:var(--border)] pl-7 pr-2 py-1.5 bg-inherit">
              <input
                autoFocus
                value={newSubInline}
                onChange={(e) => setNewSubInline(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); void addSubInline(kind, node.name) }
                  else if (e.key === 'Escape') { setAddingSubTo(null); setNewSubInline('') }
                }}
                onBlur={() => void addSubInline(kind, node.name)}
                placeholder={t('budgeting.new_subcategory_placeholder')}
                className="h-7 w-56 max-w-full rounded-md border px-2 text-xs outline-none focus:border-[var(--ink)]"
                style={{ borderColor: 'var(--border-soft)', background: 'var(--surface)', color: 'var(--ink)' }}
              />
            </td>
          </tr>,
        )
      }
    }
    // Baris "+ Tambah kategori" di akhir section (inline add, opsi tambahan)
    rows.push(
      <tr key={`${kind}-add`} className="bg-[var(--surface)]">
        <td colSpan={13} className="sticky left-0 z-10 border-b border-[color:var(--border)] px-2 py-1.5 bg-inherit">
          {addingTo === kind ? (
            <input
              autoFocus
              value={newCatInline}
              onChange={(e) => setNewCatInline(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCategoryInline(kind)
                } else if (e.key === 'Escape') {
                  setAddingTo(null)
                  setNewCatInline('')
                }
              }}
              onBlur={() => addCategoryInline(kind)}
              placeholder={t('budgeting.new_category_placeholder')}
              className="h-7 w-56 max-w-full rounded-md border px-2 text-xs outline-none focus:border-[var(--ink)]"
              style={{ borderColor: 'var(--border-soft)', background: 'var(--surface)', color: 'var(--ink)' }}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setNewCatInline('')
                setAddingTo(kind)
              }}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--surface-2)]"
              style={{ color: 'var(--ink-soft)' }}
            >
              <Plus className="size-3" /> {t('budgeting.add_category')}
            </button>
          )}
        </td>
      </tr>,
    )
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
              {privacyHidden ? '••••••' : formatCurrency(v)}
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
          {t('budgeting.pct_of_income')}
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

  // Semantic row tint — each section carries its hue at varying intensity
  // (header strong → parent medium → sub faint), so green=income, coral=expense, etc.
  const tint = (kind: BudgetType, pct: number) =>
    `color-mix(in srgb, ${KIND_COLOR[kind].hex} ${pct}%, var(--surface))`

  // Current month index (1-12) for highlighting current column
  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()
  const isCurrentYearActive = Number(year) === currentYear

  function renderSectionHeader(label: string, kind: BudgetType, annualTotal: number) {
    const color = KIND_COLOR[kind]
    const isCollapsed = collapsed[kind]
    return (
      <tr style={{ background: tint(kind, 14) }}>
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
            title={isCollapsed ? `${t('budgeting.show')} ${label}` : `${t('budgeting.hide')} ${label}`}
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
              {isCollapsed ? formatCurrency(annualTotal) : ''}
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
        <table className="budget-grid w-full border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '160px' }} />
            {shortMonths.map((m) => <col key={m} />)}
          </colgroup>
          <tbody>
            <tr style={{ background: 'var(--surface-2)' }}>
              <td colSpan={13} className="sticky left-0 z-10 border-b border-[color:var(--border)] px-3 py-2 bg-inherit">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--ink)' }}>{t('budgeting.allocation_summary')}</span>
                <span className="ml-1.5 inline-flex cursor-help align-middle" title={t('budgeting.allocation_formula')}>
                  <Info className="inline size-3" style={{ color: 'var(--ink-soft)' }} />
                </span>
              </td>
            </tr>
            <tr className="bg-[var(--surface)]">
              <td className="sticky left-0 z-10 border-b border-[color:var(--border)] px-2 py-1 text-xs font-semibold bg-inherit whitespace-nowrap truncate" title={t('budgeting.allocated_tooltip')}>{t('budgeting.allocated')}</td>
              {Array.from({ length: 12 }, (_, i) => {
                const v = allocatedOf(i + 1)
                return (
                  <td key={i} className="num border-b border-[color:var(--border)] px-1 py-1 text-right text-[11px] font-semibold bg-inherit whitespace-nowrap tabular" style={{ color: 'var(--ink-muted)' }} title={privacyHidden ? '••••••' : formatCurrency(v)}>
                    {privacyHidden ? '••••••' : v ? formatCurrency(v) : '—'}
                  </td>
                )
              })}
            </tr>
            <tr className="bg-[color:var(--surface-2)]">
              <td className="sticky left-0 z-10 border-b border-[color:var(--border)] px-2 py-1 text-xs font-bold bg-inherit whitespace-nowrap truncate" title={t('budgeting.remaining_to_allocate_tooltip')}>{t('budgeting.remaining_to_allocate')}</td>
              {Array.from({ length: 12 }, (_, i) => {
                const m = i + 1
                const left = incomeOf(m) - allocatedOf(m)
                const color = Math.abs(left) < 1 ? '#059669' : left > 0 ? '#B45309' : '#E11D48'
                return (
                  <td key={i} className="num border-b border-[color:var(--border)] px-1 py-1 text-right text-[11px] font-bold bg-inherit whitespace-nowrap tabular" style={{ color }} title={privacyHidden ? '••••••' : formatCurrency(left)}>
                    {privacyHidden ? '••••••' : formatCurrency(left)}
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
    { label: t('budgeting.income'), kind: 'income' as BudgetType, leaf: leafIncome, totalLabel: t('budgeting.total_income'), oddBg: 'bg-[rgba(16,185,129,0.04)]', totalBg: 'bg-[rgba(16,185,129,0.12)]', percent: false },
    { label: t('budgeting.expense'), kind: 'expense' as BudgetType, leaf: leafExpense, totalLabel: t('budgeting.total_expense'), oddBg: 'bg-[rgba(251,113,133,0.04)]', totalBg: 'bg-[rgba(251,113,133,0.14)]', percent: true },
    { label: t('budgeting.saving'), kind: 'saving' as BudgetType, leaf: leafSaving, totalLabel: t('budgeting.total_saving'), oddBg: 'bg-[rgba(245,158,11,0.05)]', totalBg: 'bg-[rgba(245,158,11,0.16)]', percent: false },
    { label: t('budgeting.investment'), kind: 'investment' as BudgetType, leaf: leafInvestment, totalLabel: t('budgeting.total_investment'), oddBg: 'bg-[rgba(139,92,246,0.04)]', totalBg: 'bg-[rgba(139,92,246,0.14)]', percent: false },
  ]

  return (
    <div className="space-y-6">
      <QuietPageHeader
        title={t('budgeting.title')}
        info={t('budgeting.subtitle')}
        actions={
          <>
            <Button onClick={() => setManagerOpen(true)}>
              <FolderTree className="h-4 w-4" data-icon="inline-start" />
              {t('budgeting.manage_categories')}
            </Button>
            <Select value={year} onValueChange={(v) => setYear(v ?? year)}>
              <SelectTrigger className="w-[120px]" style={{ background: 'var(--surface)' }}>
                <SelectValue placeholder={t('budgeting.year')} />
              </SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        }
      />

      {/* Summary — annual totals (sum of all 12 months), minimalist cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[
          { label: t('budgeting.total_income'), value: totalIncomeYear, dot: '#10B981', sub: t('budgeting.annual') },
          { label: t('budgeting.total_expense'), value: totalExpenseYear, dot: '#F43F5E', sub: `${totalIncomeYear > 0 ? Math.round((totalExpenseYear / totalIncomeYear) * 100) : 0}% ${t('budgeting.of_income')}` },
          { label: t('budgeting.total_saving'), value: totalSavingYear, dot: '#F59E0B', sub: `${totalIncomeYear > 0 ? Math.round((totalSavingYear / totalIncomeYear) * 100) : 0}% ${t('budgeting.of_income')}` },
          { label: t('budgeting.total_investment'), value: totalInvestmentYear, dot: '#8B5CF6', sub: `${totalIncomeYear > 0 ? Math.round((totalInvestmentYear / totalIncomeYear) * 100) : 0}% ${t('budgeting.of_income')}` },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border px-4 py-3" style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)' }}>
            <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: 'var(--ink-muted)' }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />
              {c.label}
            </span>
            <p className="num tabular font-semibold mt-1.5" style={{ color: 'var(--ink)', fontSize: 20, letterSpacing: '-0.02em' }}>
              {formatCurrency(c.value)}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Budget Grid */}
      {loading || !treeLoaded ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin" style={{ color: 'var(--ink)' }} />
          <span className="ml-2" style={{ color: 'var(--ink-muted)' }}>{t('budgeting.loading')}</span>
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
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3.5 py-3" style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)', boxShadow: '0 1px 3px rgba(16,24,40,0.07)' }}>
            <div className="min-w-0">
              <p className="eyebrow">{viewMode === 'year' ? t('budgeting.grid_eyebrow_year') : t('budgeting.grid_eyebrow_month')}</p>
              {viewMode === 'year' && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                  <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5 shrink-0" /> {t('budgeting.tip_click_month')}</span>
                  <span className="inline-flex items-center gap-1"><Calculator className="size-3.5 shrink-0" /> {t('budgeting.tip_calc_prefix')} (× ÷ + −)</span>
                  <span className="inline-flex items-center gap-1"><Copy className="size-3.5 shrink-0" /> {t('budgeting.tip_drag')}</span>
                  <span className="inline-flex items-center gap-1"><Check className="size-3.5 shrink-0" /> {t('budgeting.tip_saved')}</span>
                </div>
              )}
            </div>
            {/* Toggle Bulan / Tahun */}
            <div className="flex gap-0.5 rounded-lg p-0.5 shrink-0" style={{ background: 'var(--surface-2)' }}>
              {([['month', t('budgeting.tab_month')], ['year', t('budgeting.tab_year')]] as const).map(([mode, label]) => {
                const active = viewMode === mode
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className="rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition-colors"
                    style={{
                      background: active ? 'var(--surface)' : 'transparent',
                      color: active ? 'var(--ink)' : 'var(--ink-soft)',
                      boxShadow: active ? '0 1px 2px rgba(16,24,40,0.10)' : undefined,
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
          {viewMode === 'month' ? (
            <MonthBudgetView
              year={Number(year)}
              month={focusMonth}
              onMonthChange={setFocusMonth}
              visibleIncome={leafIncome}
              visibleExpense={leafExpense}
              visibleSaving={leafSaving}
              visibleInvestment={leafInvestment}
              getValue={getValue}
              actuals={actuals}
              targets={leafTargets}
              onCellChange={handleCellBlur}
            />
          ) : (
          <>
          {isCurrentYearActive && (
            <style dangerouslySetInnerHTML={{ __html: `.budget-grid td:nth-child(${currentMonth + 1}){background-color:color-mix(in srgb, var(--c-primary) 5%, transparent)!important}` }} />
          )}
          <div className="overflow-x-auto pb-2">
            <div className="space-y-3 min-w-[1040px]">
              {/* Month-label header strip */}
              <div className="overflow-hidden rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)', boxShadow: '0 1px 3px rgba(16,24,40,0.07)' }}>
                <table className="budget-grid w-full border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '160px' }} />
                    {shortMonths.map((m) => <col key={m} />)}
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-20 px-3 py-2 text-left text-[11px] font-bold whitespace-nowrap eyebrow" style={{ background: 'var(--surface)' }}>
                        {t('budgeting.category')}
                      </th>
                      {shortMonths.map((m, i) => {
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
                            title={`${t('budgeting.click_for_detail')} ${m}`}
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
                  <table className="budget-grid w-full border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '160px' }} />
                      {shortMonths.map((m) => <col key={m} />)}
                    </colgroup>
                    <tbody>
                      {renderSectionHeader(sec.label, sec.kind, sectionTotal(sec.leaf, sec.kind))}
                      {!collapsed[sec.kind] && (
                        <>
                          {renderSectionBody(sec.kind)}
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
          </>
          )}
        </div>
      </>
      )}

      {/* Category Manager — kategori → subkategori, edit/hapus/drag */}
      <CategoryManager
        open={managerOpen}
        onOpenChange={setManagerOpen}
        tree={tree}
        dbSynced={dbSynced}
        usage={catUsage}
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
