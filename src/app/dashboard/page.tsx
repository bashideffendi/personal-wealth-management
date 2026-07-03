'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatCompactCurrency, getMonthName } from '@/lib/utils'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { MobileHome } from '@/components/dashboard/mobile-home'
import { MONTHS } from '@/lib/constants'
import { fetchLiquidEntries, sumLiquid, sumCashEquivalent } from '@/lib/liquid'
import { isExpired, occurrencesInRange } from '@/lib/recurrence'
import { rootCategory, loadTree, leafKeys } from '@/lib/budget-categories'
import { useT } from '@/lib/i18n/context'
import { GettingStarted } from '@/components/dashboard/getting-started'
import { DashboardCustomizer, DASHBOARD_BLOCKS } from '@/components/dashboard/dashboard-customizer'
import { SortableSection } from '@/components/dashboard/sortable-section'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable'
import { loadUiPrefs, saveUiPref, DASHBOARD_LAYOUT_VERSION } from '@/lib/ui-prefs'
import { AIInsightsCard } from '@/components/dashboard/ai-insights'
import { FinancialHealthCard } from '@/components/dashboard/financial-health-card'
import { CashFlowForecast } from '@/components/dashboard/cashflow-forecast'
import { MonthChangeStrip } from '@/components/dashboard/month-change-strip'
import { TodayStrip } from '@/components/dashboard/today-strip'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { AssetAllocationCard } from '@/components/dashboard/asset-allocation-card'
import { UpcomingBills } from '@/components/dashboard/upcoming-bills'
import { RecentTransactions } from '@/components/dashboard/recent-transactions'
import { AccountsCard } from '@/components/dashboard/accounts-card'
import { SafeToSpendCard } from '@/components/dashboard/safe-to-spend-card'
import { SubscriptionsCard } from '@/components/dashboard/subscriptions-card'
import { GoalsWidget } from '@/components/dashboard/goals-widget'
import { InsightsPanel } from '@/components/dashboard/insights-panel'
import { NetWorthHero } from '@/components/dashboard/net-worth-hero'
import { computeFinancialHealth } from '@/lib/financial-health'
import { type FlowKind } from '@/components/dashboard/money-flow-sankey'
import { StockLogo } from '@/components/investment/stock-logo'
import { CryptoLogo } from '@/components/investment/crypto-logo'
import type { Transaction, Investment, CreditCard, Contract, Account } from '@/types'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, ArrowRight, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import dynamic from 'next/dynamic'

// Chart palette per design handoff tokens.css — emerald led, then sky,
// amber, coral, violet for categorical variety. Replaces the older
// "lime + orange + black" palette which clashed with the new design tokens.
// Palet token (adaptif tema) — urutan sama dengan hub Kekayaan biar kategori
// yang sama dapet warna yang sama di mana pun.
const CHART_PALETTE = [
  'var(--c-mint)', 'var(--c-violet)', 'var(--c-amber)', 'var(--c-coral)',
  'var(--ink)', 'var(--c-mint-ink)', 'var(--c-violet-ink)', 'var(--ink-soft)',
]

// Charts deferred out of the initial dashboard JS — recharts loads only when a
// chart mounts. Skeletons match each chart's footprint to avoid layout shift.
const skel = (h: number, w?: number) => (
  <div className="animate-pulse rounded-lg" style={{ height: h, width: w, background: 'var(--surface-2)' }} aria-hidden="true" />
)
const MoneyFlowSankey = dynamic(
  () => import('@/components/dashboard/money-flow-sankey').then((m) => m.MoneyFlowSankey),
  { ssr: false, loading: () => skel(300) },
)
const MonthlyFlowChart = dynamic(
  () => import('@/components/dashboard/dashboard-charts').then((m) => m.MonthlyFlowChart),
  { ssr: false, loading: () => skel(260) },
)
const InvestmentPie = dynamic(
  () => import('@/components/dashboard/dashboard-charts').then((m) => m.InvestmentPie),
  { ssr: false, loading: () => skel(120, 120) },
)

// Label kategori investasi via i18n — key sama dengan hub Kekayaan (assets.cat_*).
const INVESTMENT_CATEGORY_KEYS: Record<string, string> = {
  stock: 'assets.cat_stock', mutual_fund: 'assets.cat_mutual_fund', crypto: 'assets.cat_crypto',
  gold: 'assets.cat_gold', bond: 'assets.cat_bond', time_deposit: 'assets.cat_time_deposit',
  p2p: 'assets.cat_p2p', business: 'assets.cat_business',
  forex: 'assets.cat_forex', sbn: 'assets.cat_sbn', pension: 'assets.cat_pension',
}

interface MonthlyData {
  month: string
  income: number
  expense: number
  net: number
}

interface Budget {
  id: string; year: number; month: number; category: string
  type: 'income' | 'expense' | 'saving' | 'investment'; amount: number
}

const DASH_ORDER_LS = 'pwm.dashboard.order.v9'
const DEFAULT_BLOCK_ORDER = DASHBOARD_BLOCKS.map((b) => b.id)
function reconcileBlockOrder(saved: string[]): string[] {
  const valid = saved.filter((id) => DEFAULT_BLOCK_ORDER.includes(id))
  const missing = DEFAULT_BLOCK_ORDER.filter((id) => !valid.includes(id))
  return [...valid, ...missing]
}
function readBlockOrder(): string[] {
  if (typeof window === 'undefined') return DEFAULT_BLOCK_ORDER
  try {
    const raw = localStorage.getItem(DASH_ORDER_LS)
    const arr = raw ? JSON.parse(raw) : []
    return reconcileBlockOrder(Array.isArray(arr) ? arr.filter((x: unknown) => typeof x === 'string') : [])
  } catch {
    return DEFAULT_BLOCK_ORDER
  }
}

export default function DashboardPage() {
  const supabase = createClient()
  const t = useT()

  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  // Nomor urut fetch — hasil periode lama jangan menimpa periode aktif.
  const fetchSeq = useRef(0)

  const [monthTransactions, setMonthTransactions] = useState<Transaction[]>([])
  const [yearTransactions, setYearTransactions] = useState<Transaction[]>([])
  const [investments, setInvestments] = useState<Investment[]>([])
  const [monthBudgets, setMonthBudgets] = useState<Budget[]>([])
  const [creditCards, setCreditCards] = useState<CreditCard[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [liquidTotal, setLiquidTotal] = useState(0)
  // Kas siap pakai (tanpa piutang) — buat runway & forecast, bukan neraca.
  const [cashEquivalent, setCashEquivalent] = useState(0)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [nonLiquidTotal, setNonLiquidTotal] = useState(0)
  const [debtTotal, setDebtTotal] = useState(0)
  const [activeGoals, setActiveGoals] = useState<Array<{
    id: string; name: string; target_amount: number; current_amount: number; deadline: string | null; created_at?: string | null
  }>>([])
  const [activeDebts, setActiveDebts] = useState<Array<{
    id: string; name: string; remaining: number; due_date: string | null; monthly_payment: number
  }>>([])
  const [recurringItems, setRecurringItems] = useState<Array<{
    id: string; name: string; type: string; amount: number; frequency: string; day_of_period: number
    start_date?: string | null; end_date?: string | null
  }>>([])
  const [userFirstName, setUserFirstName] = useState<string>('')

  // ---- Custom dashboard: urutan section (drag-drop in-place, Monarch-style) ----
  const [blockOrder, setBlockOrder] = useState<string[]>(readBlockOrder)
  const orderTouched = useRef(false)
  // Drag overlay — visual yg gerak pas drag (bukan kartu in-place). dragSize =
  // footprint kartu sumber biar preview-nya seukuran aslinya.
  const [activeId, setActiveId] = useState<string | null>(null)
  // Sheet sankey penuh (mobile) — kartu Beranda cuma ringkasan in/out/sisa.
  const [sankeySheetOpen, setSankeySheetOpen] = useState(false)
  const [dragSize, setDragSize] = useState<{ w: number; h: number } | null>(null)
  const [dragHtml, setDragHtml] = useState<string>('')
  const dragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth])

  // Re-fetch saat ada mutasi data dari mana pun (FAB quick-add / command palette)
  // — router.refresh() gak nge-refresh client-fetch ini.
  useEffect(() => {
    const h = () => { void fetchData() }
    window.addEventListener('klunting:data-changed', h)
    return () => window.removeEventListener('klunting:data-changed', h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Hydrate urutan dari DB sekali (lintas-perangkat); jangan timpa kalau user udah nge-drag sesi ini.
  useEffect(() => {
    void (async () => {
      if (orderTouched.current) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const prefs = await loadUiPrefs(supabase, user.id)
      if (prefs && Array.isArray(prefs.dashboardOrder) && prefs.dashboardLayoutVersion === DASHBOARD_LAYOUT_VERSION && !orderTouched.current) {
        const next = reconcileBlockOrder(prefs.dashboardOrder)
        setBlockOrder(next)
        try { localStorage.setItem(DASH_ORDER_LS, JSON.stringify(next)) } catch { /* ignore */ }
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleBlockDragStart(e: DragStartEvent) {
    const id = e.active.id as string
    setActiveId(id)
    // Snapshot the source card's DOM so the overlay is a faithful frozen copy
    // (no chart remount, no janky tilted placeholder).
    const el = document.querySelector(`[data-block="${id}"]`)
    const card = el?.firstElementChild as HTMLElement | null
    setDragHtml(card ? card.outerHTML : '')
    const r = e.active.rect.current.initial
    if (r) setDragSize({ w: r.width, h: r.height })
  }
  function commitOrder(next: string[]) {
    orderTouched.current = true
    setBlockOrder(next)
    try { localStorage.setItem(DASH_ORDER_LS, JSON.stringify(next)) } catch { /* ignore */ }
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await saveUiPref(supabase, user.id, { dashboardOrder: next, dashboardLayoutVersion: DASHBOARD_LAYOUT_VERSION })
    })()
  }
  function handleBlockDragEnd(e: DragEndEvent) {
    setActiveId(null)
    setDragSize(null)
    setDragHtml('')
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldI = blockOrder.indexOf(active.id as string)
    const newI = blockOrder.indexOf(over.id as string)
    if (oldI < 0 || newI < 0) return
    commitOrder(arrayMove(blockOrder, oldI, newI))
  }
  // Reorder tanpa drag — dipakai tombol ↑/↓ di customizer (grip handle = lg-only,
  // di mobile dia ketutup/nutupin chip header kartu).
  function moveBlock(id: string, dir: -1 | 1) {
    const oldI = blockOrder.indexOf(id)
    const newI = oldI + dir
    if (oldI < 0 || newI < 0 || newI >= blockOrder.length) return
    commitOrder(arrayMove(blockOrder, oldI, newI))
  }

  async function fetchData() {
    setLoading(true)
    setLoadError(false)
    const seq = ++fetchSeq.current
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (seq === fetchSeq.current) setLoading(false); return }
      // Capture first name for greeting per mockup ("Pagi, Bashid")
      const fullName = (user.user_metadata?.full_name as string | undefined)
        || user.email?.split('@')[0]
        || ''

      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const endMonth = selectedMonth === 12 ? 1 : selectedMonth + 1
      const endYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear
      const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

      const [yearRes, invRes, budgetRes, ccRes, liquidEntries, debtRes, ctrRes, nlqRes, goalsRes, recurRes, treeRes, accRes] = await Promise.all([
        supabase
          .from('transactions')
          // Kolom eksplisit (performance-7) — query ini narik setahun transaksi;
          // hindari select('*'). Semua konsumen cuma baca 6 kolom ini.
          .select('id, date, type, category, description, amount')
          .eq('user_id', user.id)
          .gte('date', `${selectedYear}-01-01`)
          .lt('date', `${selectedYear + 1}-01-01`)
          .order('date', { ascending: false }),
        supabase
          .from('investments')
          .select('category, total_value, name, platform, ticker, quantity, avg_cost, current_price')
          .eq('user_id', user.id),
        supabase
          .from('budgets')
          .select('*')
          .eq('user_id', user.id)
          .eq('year', selectedYear)
          .eq('month', selectedMonth),
        supabase
          .from('credit_cards')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true),
        fetchLiquidEntries(supabase, user.id, { strict: true }),
        supabase
          .from('debts')
          .select('id, name, remaining, due_date, monthly_payment')
          .eq('user_id', user.id)
          .eq('is_active', true),
        supabase
          .from('contracts')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_archived', false)
          .order('end_date', { ascending: true }),
        supabase
          .from('assets_non_liquid')
          .select('current_value')
          .eq('user_id', user.id),
        supabase
          .from('goals')
          .select('id, name, target_amount, current_amount, deadline, created_at')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('deadline', { ascending: true, nullsFirst: false })
          .limit(3),
        supabase
          .from('recurring_transactions')
          .select('id, name, type, amount, frequency, day_of_period, start_date, end_date')
          .eq('user_id', user.id)
          .eq('is_active', true),
        loadTree(supabase, user.id),
        supabase
          .from('accounts')
          .select('*')
          .eq('user_id', user.id),
      ])
      // Periode keburu diganti user — buang hasil basi.
      if (seq !== fetchSeq.current) return
      // Query inti gagal = bilang terus terang, jangan render dashboard penuh nol palsu.
      if (yearRes.error) throw yearRes.error
      if (invRes.error) throw invRes.error
      if (ccRes.error) throw ccRes.error
      if (debtRes.error) throw debtRes.error
      if (nlqRes.error) throw nlqRes.error
      if (accRes.error) throw accRes.error

      setUserFirstName(fullName.split(' ')[0])
      setLiquidTotal(sumLiquid(liquidEntries))
      setCashEquivalent(sumCashEquivalent(liquidEntries))
      setAccounts((accRes.data ?? []) as Account[])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setNonLiquidTotal(((nlqRes.data ?? []) as any[]).reduce((s, a) => s + (a.current_value ?? 0), 0))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setActiveGoals((goalsRes.data ?? []) as any[])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const debtRows = (debtRes.data ?? []) as any[]
      // Total utang HARUS termasuk saldo kartu kredit — konsisten sama
      // /dashboard/net-worth + report. Sebelumnya cuma debts.remaining →
      // net worth hero kelebihan sebesar saldo CC.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ccSumForDebt = ((ccRes.data ?? []) as any[]).reduce((s, c) => s + (c.current_balance ?? 0), 0)
      setDebtTotal(debtRows.reduce((s, d) => s + (d.remaining ?? 0), 0) + ccSumForDebt)
      setActiveDebts(debtRows)
      // Recurring yang sudah lewat end_date di-exclude — konsisten halaman Recurring.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setRecurringItems(((recurRes.data ?? []) as any[]).filter((r) => !isExpired(r)))

      const yearTxs = (yearRes.data ?? []) as Transaction[]
      setYearTransactions(yearTxs)
      setMonthTransactions(yearTxs.filter((tx) => tx.date >= startDate && tx.date < endDate))
      setInvestments((invRes.data ?? []) as Investment[])
      // Filter budget ke LEAF KEY tree saat ini — samain PERSIS sama halaman
      // Anggaran (parent = jumlah sub, kategori nonaktif dibuang). Tanpa ini,
      // roll-up dashboard ngejumlahin baris parent BASI (double-count, mis. Family
      // 4,5jt jadi 6jt) + kategori stale yg udah dihapus/rename (Tagihan dll).
      // Fallback (tree DB gak ada) → jangan filter biar kategori custom gak kebuang.
      const allBudgetRows = (budgetRes.data ?? []) as Budget[]
      if (treeRes.dbAvailable) {
        const leafByType: Record<string, Set<string>> = {
          income: new Set(leafKeys(treeRes.tree.income)),
          expense: new Set(leafKeys(treeRes.tree.expense)),
          saving: new Set(leafKeys(treeRes.tree.saving)),
          investment: new Set(leafKeys(treeRes.tree.investment)),
        }
        setMonthBudgets(allBudgetRows.filter((b) => leafByType[b.type]?.has(b.category)))
      } else {
        setMonthBudgets(allBudgetRows)
      }
      setCreditCards((ccRes.data ?? []) as CreditCard[])
      setContracts((ctrRes.data ?? []) as Contract[])
    } catch {
      if (seq === fetchSeq.current) setLoadError(true)
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }

  // ---- KPI aggregations ----
  const totals = useMemo(() => {
    // Kategori 'Transfer' (pindah antar-akun) tercatat sbg 2 leg expense+income
    // → kalau ikut dihitung, gross income & expense double-count, saving-rate ngaco.
    const income = monthTransactions.filter((t) => t.type === 'income' && t.category !== 'Transfer').reduce((s, t) => s + t.amount, 0)
    const expense = monthTransactions.filter((t) => t.type === 'expense' && t.category !== 'Transfer').reduce((s, t) => s + t.amount, 0)
    const saving = monthTransactions.filter((t) => t.type === 'saving').reduce((s, t) => s + t.amount, 0)
    const investment = monthTransactions.filter((t) => t.type === 'investment').reduce((s, t) => s + t.amount, 0)
    return {
      income, expense, saving, investment,
      net: income - expense - saving - investment,
      savingRate: income > 0 ? ((saving + investment) / income) * 100 : 0,
    }
  }, [monthTransactions])

  // ---- Prior-month totals (buat delta KPI vs bulan lalu) ----
  // Dari yearTransactions (tahun yg sama). Januari → bulan lalu = Des tahun
  // sebelumnya yg gak ke-load → null (chip disembunyiin). Exclude Transfer.
  const prevTotals = useMemo(() => {
    if (selectedMonth <= 1) return null
    const pm = selectedMonth - 1
    const start = `${selectedYear}-${String(pm).padStart(2, '0')}-01`
    const end = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
    const ptx = yearTransactions.filter((t) => t.date >= start && t.date < end && t.category !== 'Transfer')
    const income = ptx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = ptx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const saving = ptx.filter((t) => t.type === 'saving').reduce((s, t) => s + t.amount, 0)
    const investment = ptx.filter((t) => t.type === 'investment').reduce((s, t) => s + t.amount, 0)
    return { income, expense, saving, investment, net: income - expense - saving - investment }
  }, [yearTransactions, selectedYear, selectedMonth])

  // Delta % KPI vs bulan lalu. null = jangan tampilin chip:
  //  - bulan berjalan (parsial → banding ke bulan penuh menyesatkan)
  //  - gak ada baseline (Januari, atau nilai bulan lalu 0)
  const isCurrentPeriod =
    selectedYear === new Date().getFullYear() && selectedMonth === new Date().getMonth() + 1
  const kpiDelta = (cur: number, prev: number): number | null => {
    if (prevTotals == null || isCurrentPeriod || prev <= 0) return null
    return ((cur - prev) / prev) * 100
  }

  // ---- Financial Health Score ----
  // Uses 90-day rolling avg from yearTransactions (more stable than current
  // month — the latter can be partial / atypical). Falls back to current
  // month if year data is sparse.
  const fhsResult = useMemo(() => {
    // Compute 90-day window avg from yearTransactions
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const cutoff = ninetyDaysAgo.toISOString().slice(0, 10)
    const recent = yearTransactions.filter((t) => t.date >= cutoff)
    const recentIncome = recent.filter((t) => t.type === 'income' && t.category !== 'Transfer').reduce((s, t) => s + t.amount, 0)
    const recentExpense = recent.filter((t) => t.type === 'expense' && t.category !== 'Transfer').reduce((s, t) => s + t.amount, 0)
    const recentSaved = recent
      .filter((t) => t.type === 'saving' || t.type === 'investment')
      .reduce((s, t) => s + t.amount, 0)

    // Bagi dengan jumlah BULAN DISTINCT yang benar-benar ada di window — bukan
    // 3 tetap. Konsisten sama net-worth & debts page; window 90 hari yang
    // kepotong batas tahun (Jan-Mar) gak lagi menekan rata-rata sampai 3x.
    const monthsInWindow = new Set(recent.map((tx) => tx.date.slice(0, 7)))
    const divisor = Math.min(3, Math.max(1, monthsInWindow.size))
    const hasEnoughHistory = recent.length >= 5
    const monthlyIncome = hasEnoughHistory ? recentIncome / divisor : totals.income
    const monthlyExpense = hasEnoughHistory ? recentExpense / divisor : totals.expense
    const monthlySaved = hasEnoughHistory ? recentSaved / divisor : (totals.saving + totals.investment)

    // Debt aggregates — credit cards + active debts
    const ccBalance = creditCards.reduce((s, c) => s + (c.current_balance || 0), 0)
    // Min payment kanonik (sama dengan halaman Utang & Kekayaan):
    // ~10% tagihan, lantai Rp 50rb, gak lebih dari tagihan.
    const ccMinPayments = creditCards.reduce((s, c) => {
      const bal = c.current_balance || 0
      return s + (bal > 0 ? Math.min(bal, Math.max(50_000, Math.round(bal * 0.1))) : 0)
    }, 0)
    const debtRemaining = activeDebts.reduce((s, d) => s + (d.remaining || 0), 0)
    const debtMonthly = activeDebts.reduce((s, d) => s + (d.monthly_payment || 0), 0)
    // Overdue heuristic: any credit card > 90% utilization
    const hasOverdueDebt = creditCards.some((c) => {
      if (!c.credit_limit || c.credit_limit <= 0) return false
      return (c.current_balance || 0) / c.credit_limit > 0.9
    })

    // Insurance count from contracts (active = not archived)
    const insuranceCount = contracts.filter((c) => c.category === 'insurance').length

    // Investment value
    const investmentValue = investments.reduce((s, i) => s + (i.total_value || 0), 0)

    const fhs = computeFinancialHealth({
      monthlyIncome,
      monthlyExpense,
      monthlySaved,
      liquidBalance: cashEquivalent,
      investmentValue,
      totalDebt: ccBalance + debtRemaining,
      monthlyDebtPayments: ccMinPayments + debtMonthly,
      hasOverdueDebt,
      insuranceCount,
      activeGoals: activeGoals.map((g) => ({
        current: g.current_amount,
        target: g.target_amount,
        deadline: g.deadline,
      })),
      // userAge: not tracked yet — calculator falls back to mid-career default
    })
    // Expose pengeluaran 90-hari (avg) ke kartu — Cash Coverage konsisten sama
    // skor FHS, gak reset ke 0 pas bulan berjalan masih kosong.
    return { ...fhs, _monthlyExpense: monthlyExpense }
  }, [yearTransactions, totals, creditCards, activeDebts, contracts, investments, cashEquivalent, activeGoals])

  // ---- Money Flow Sankey data ----
  // Aggregate by category for each kind. We cap to top 8 per side so the
  // diagram stays legible — anything beyond gets bucketed into "Lainnya".
  const sankeyData = useMemo(() => {
    function bucket(kind: 'income' | 'expense' | 'saving' | 'investment') {
      const byCat: Record<string, number> = {}
      for (const t of monthTransactions) {
        if (t.type !== kind) continue
        if (t.category === 'Transfer') continue // pindah antar-akun, bukan flow nyata
        const cat = (t.category || 'Lainnya').trim() || 'Lainnya'
        byCat[cat] = (byCat[cat] || 0) + t.amount
      }
      const sorted = Object.entries(byCat)
        .map(([name, amount]) => ({ name, amount, kind: kind as FlowKind }))
        .sort((a, b) => b.amount - a.amount)
      const top = sorted.slice(0, 8)
      const rest = sorted.slice(8)
      if (rest.length > 0) {
        const restSum = rest.reduce((s, c) => s + c.amount, 0)
        if (restSum > 0) top.push({ name: `+${rest.length} ${t('dashboard.others')}`, amount: restSum, kind })
      }
      return top
    }

    const income = bucket('income')
    const expense = bucket('expense')
    const saving = bucket('saving')
    const investment = bucket('investment')
    return { income, outflow: [...expense, ...saving, ...investment] }
  }, [monthTransactions])

  // ---- Monthly chart (area with net) ----
  const monthlyData = useMemo<MonthlyData[]>(() => {
    return MONTHS.map((name, idx) => {
      const m = idx + 1
      const mStart = `${selectedYear}-${String(m).padStart(2, '0')}-01`
      const mEndMonth = m === 12 ? 1 : m + 1
      const mEndYear = m === 12 ? selectedYear + 1 : selectedYear
      const mEnd = `${mEndYear}-${String(mEndMonth).padStart(2, '0')}-01`
      const mTx = yearTransactions.filter((tx) => tx.date >= mStart && tx.date < mEnd)
      const income = mTx.filter((t) => t.type === 'income' && t.category !== 'Transfer').reduce((s, t) => s + t.amount, 0)
      const expense = mTx.filter((t) => t.type === 'expense' && t.category !== 'Transfer').reduce((s, t) => s + t.amount, 0)
      return { month: name.substring(0, 3), income, expense, net: income - expense }
    })
  }, [yearTransactions, selectedYear])

  // ---- Investment pie ----
  const investmentPieData = useMemo(() => {
    const byCategory: Record<string, number> = {}
    investments.forEach((inv) => {
      const label = INVESTMENT_CATEGORY_KEYS[inv.category] ? t(INVESTMENT_CATEGORY_KEYS[inv.category]) : inv.category
      byCategory[label] = (byCategory[label] || 0) + (inv.total_value || 0)
    })
    return Object.entries(byCategory)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))
  }, [investments, t])

  // ---- Investment portfolio metrics: total value, top holdings, P/L,
  //      and concentration risk. Used by the upgraded composition card.
  const investmentSummary = useMemo(() => {
    const totalValue = investments.reduce((s, i) => s + (i.total_value || 0), 0)
    const totalCost = investments.reduce(
      (s, i) => s + (i.quantity || 0) * (i.avg_cost || 0),
      0,
    )
    const unrealizedPL = totalValue - totalCost
    const unrealizedPct = totalCost > 0 ? (unrealizedPL / totalCost) * 100 : 0

    const enriched = investments
      .filter((i) => (i.total_value || 0) > 0)
      .map((i) => ({
        id: i.id,
        name: i.name || (INVESTMENT_CATEGORY_KEYS[i.category] ? t(INVESTMENT_CATEGORY_KEYS[i.category]) : i.category),
        platform: i.platform || '',
        ticker: i.ticker ?? null,
        category: i.category,
        value: i.total_value || 0,
        cost: (i.quantity || 0) * (i.avg_cost || 0),
        pl: (i.total_value || 0) - (i.quantity || 0) * (i.avg_cost || 0),
      }))
      .sort((a, b) => b.value - a.value)

    const topHoldings = enriched.slice(0, 4)
    const topPct = totalValue > 0 ? (topHoldings[0]?.value ?? 0) / totalValue * 100 : 0
    // Concentration risk threshold: top holding > 40% is "tinggi"
    const risk: 'rendah' | 'sedang' | 'tinggi' =
      topPct > 40 ? 'tinggi' : topPct > 25 ? 'sedang' : 'rendah'

    return { totalValue, totalCost, unrealizedPL, unrealizedPct, topHoldings, topPct, risk, count: enriched.length }
  }, [investments, t])

  // ---- Calendar: daily net per day of selected month ----
  const calendarData = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()
    const firstDow = new Date(selectedYear, selectedMonth - 1, 1).getDay() // 0 Sun..6 Sat
    const result: Array<{
      day: number | null; date?: string
      income: number; expense: number; net: number
      count: number
    }> = []
    for (let i = 0; i < firstDow; i++) result.push({ day: null, income: 0, expense: 0, net: 0, count: 0 })
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const dayTx = monthTransactions.filter((t) => t.date === dateStr)
      // income/expense kalender: exclude Transfer (pindah antar-akun) + saving/
      // investment (flow terpisah, sesuai KPI 'Tabungan + Investasi' yg sendiri).
      const income = dayTx.filter((t) => t.type === 'income' && t.category !== 'Transfer').reduce((s, t) => s + t.amount, 0)
      const expense = dayTx.filter((t) => t.type === 'expense' && t.category !== 'Transfer').reduce((s, t) => s + t.amount, 0)
      result.push({ day: d, date: dateStr, income, expense, net: income - expense, count: dayTx.length })
    }
    return result
  }, [monthTransactions, selectedYear, selectedMonth])

  // ---- Budget progress per category ----
  const budgetProgress = useMemo(() => {
    // Roll-up ke kategori INDUK: budget sub disimpan composite 'Induk › Sub',
    // tapi transaksi bisa ditag induk ATAU sub → samakan di level induk biar
    // konsisten sama halaman Anggaran + Top Kategori (yang udah pakai rollup).
    const actualByRoot: Record<string, number> = {}
    for (const t of monthTransactions) {
      if (t.type !== 'expense') continue
      const root = rootCategory(t.category)
      actualByRoot[root] = (actualByRoot[root] || 0) + t.amount
    }
    const budgetByRoot: Record<string, number> = {}
    for (const b of monthBudgets) {
      if (b.type !== 'expense' || b.amount <= 0) continue
      const root = rootCategory(b.category)
      budgetByRoot[root] = (budgetByRoot[root] || 0) + b.amount
    }
    return Object.entries(budgetByRoot)
      .map(([category, budget]) => {
        const actual = actualByRoot[category] || 0
        return { category, budget, actual, pct: budget > 0 ? (actual / budget) * 100 : 0 }
      })
      .sort((a, b) => b.pct - a.pct || b.budget - a.budget)
      .slice(0, 6)
  }, [monthBudgets, monthTransactions])

  const yearOptions = Array.from({ length: 11 }, (_, i) => now.getFullYear() - 5 + i)
  const currentMonthYear = `${getMonthName(selectedMonth)} ${selectedYear}`
  // Tagihan rutin (SEMUA frekuensi) yg belum jatuh tempo sisa bulan ini — buat
  // Sisa Aman. Pakai occurrencesInRange biar weekly/daily/yearly & end_date
  // kehitung sama persis dengan halaman Recurring.
  const upcomingRecurring = (() => {
    const isCurrent = selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1
    if (!isCurrent) return 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const daysLeft = new Date(selectedYear, selectedMonth, 0).getDate() - now.getDate()
    return recurringItems
      .filter((r) => r.type === 'expense')
      .reduce((s, r) => s + occurrencesInRange(r, today, daysLeft).length * r.amount, 0)
  })()

  // Prior-3-months transactions for the "Apa yang berubah" strip. Slices
  // yearTransactions to months [selectedMonth-3, selectedMonth-1] within
  // selectedYear. If the window dips below January, we lose those months
  // (the strip itself hides when there's too little prior data).
  const priorMonthsTx = useMemo(() => {
    const out: Transaction[] = []
    for (const t of yearTransactions) {
      const d = new Date(t.date)
      const m = d.getMonth() + 1
      const y = d.getFullYear()
      if (y !== selectedYear) continue
      if (m < selectedMonth - 3 || m > selectedMonth - 1) continue
      out.push(t)
    }
    return out
  }, [yearTransactions, selectedYear, selectedMonth])

  // Trend buat hero: cuma bulan yang SUDAH berjalan. Array 12 bulan penuh
  // (bulan depan = 0) meracuni delta bulan ini, YTD, sparkline & pace forecast.
  const trendForHero =
    selectedYear === now.getFullYear() ? monthlyData.slice(0, now.getMonth() + 1)
    : selectedYear > now.getFullYear() ? []
    : monthlyData

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--ink-soft)' }} />
        <span className="ml-3 text-sm" style={{ color: 'var(--ink-muted)' }}>
          {t('dashboard.loading')}
        </span>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="s-card flex flex-col items-center text-center py-14 px-8 gap-3">
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>{t('common.load_failed')}</p>
        <Button variant="outline" onClick={() => void fetchData()}>{t('common.retry')}</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* F9: mobile = Beranda baru (6 modul, mockup approved); desktop = bento
          existing utuh di dalam wrapper hidden md:contents. */}
      {/* F12: Beranda ala Budget app — grid kategori bulan terpilih; navigasi
          bulan pakai state periode halaman (sama dgn picker desktop). */}
      <MobileHome
        month={selectedMonth}
        year={selectedYear}
        onPrevMonth={() => {
          if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(selectedYear - 1) }
          else setSelectedMonth(selectedMonth - 1)
        }}
        onNextMonth={() => {
          if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(selectedYear + 1) }
          else setSelectedMonth(selectedMonth + 1)
        }}
        netWorth={liquidTotal + nonLiquidTotal + investments.reduce((s, i) => s + (i.total_value || 0), 0) - debtTotal}
        transactions={monthTransactions}
      />
      <div className="hidden md:contents">
      {/* flex-col + gap = ritme sama kayak space-y-6, tapi `order` bisa dipakai
          DashboardCustomizer buat reorder section (data-block) tanpa ngerombak DOM.
          Section fixed (hero/health/forecast/period) gak punya order → tetap di atas. */}
      {/* Greeting + tombol Atur Dashboard (custom show/hide section) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Sapaan ikut jam (ID: "Pagi, Bashid" per mockup) — bukan "Hi" hardcode. */}
        <h1 className="font-semibold tracking-tight truncate" style={{ fontSize: 18, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
          {t(`dashboard.${now.getHours() < 11 ? 'greet_morning' : now.getHours() < 15 ? 'greet_afternoon' : now.getHours() < 19 ? 'greet_evening' : 'greet_night'}`)}{userFirstName ? `, ${userFirstName}` : ''}
        </h1>
        {/* Period selector — top-right (konvensi). Surface bg + border supaya
            kebaca sebagai kontrol, bukan nyatu sama kanvas. Scope: widget bulanan. */}
        <div className="flex items-center gap-2">
          <Select value={String(selectedMonth)} onValueChange={(v) => { if (v) setSelectedMonth(Number(v)) }}>
            <SelectTrigger className="w-[124px] h-9 text-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--card-shadow)' }}>
              <SelectValue placeholder={t('dashboard.month_placeholder')}>{(v) => MONTHS[Number(v) - 1] ?? v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => { if (v) setSelectedYear(Number(v)) }}>
            <SelectTrigger className="w-[90px] h-9 text-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--card-shadow)' }}>
              <SelectValue placeholder={t('dashboard.year_placeholder')}>{(v) => v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <DashboardCustomizer order={blockOrder} onMove={moveBlock} />
        </div>
      </div>

      {/* Hero — Net Worth + period-filtered growth chart */}
      <NetWorthHero
        liquidTotal={liquidTotal}
        nonLiquidTotal={nonLiquidTotal}
        investmentsTotal={investments.reduce((s, i) => s + (i.total_value || 0), 0)}
        debtTotal={debtTotal}
        monthlyTrend={trendForHero}
      />

      {/* FIXED summary band — NetWorth + 4 KPI + Cashflow selalu di atas
          (period-scoped sama picker kanan-atas). Sengaja gak bisa di-drag/hide:
          ini ringkasan utama yang harus selalu kebaca. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label={t('dashboard.kpi_income')}  value={totals.income}  deltaPct={kpiDelta(totals.income, prevTotals?.income ?? 0)}   kind="income" />
        <KpiCard label={t('dashboard.kpi_expense')} value={totals.expense} deltaPct={kpiDelta(totals.expense, prevTotals?.expense ?? 0)} kind="expense" />
        <KpiCard
          label={t('dashboard.kpi_saving_investment')}
          value={totals.saving + totals.investment}
          note={`${t('dashboard.saving_rate')} ${totals.savingRate.toFixed(1)}%`}
          deltaPct={kpiDelta(totals.saving + totals.investment, (prevTotals?.saving ?? 0) + (prevTotals?.investment ?? 0))}
          kind="saving"
        />
        <KpiCard label={t('dashboard.kpi_net_cashflow')} value={totals.net} deltaPct={kpiDelta(totals.net, prevTotals?.net ?? 0)} kind="net" />
      </div>

      {/* Cash-flow forecast — compact reminder of upcoming events. */}
      {/* Runway pakai kas siap pakai — piutang bukan dana yang bisa dibelanjakan. */}
      <CashFlowForecast
        liquidBalance={cashEquivalent}
        recurringItems={recurringItems}
        contracts={contracts}
      />

      {/* "Hari ini" — today's quick stats + budget warning. Self-hides
          if no transactions yet today. */}
      <TodayStrip
        monthTransactions={monthTransactions}
        monthBudgets={monthBudgets}
      />

      {/* "Apa yang berubah" — month vs 3-month-avg change strip. Self-hides
          if there's no meaningful diff or not enough prior data. */}
      <MonthChangeStrip
        currentMonthTx={monthTransactions}
        priorMonthsTx={priorMonthsTx}
        priorMonthCount={3}
        elapsedFraction={isCurrentPeriod ? now.getDate() / new Date(selectedYear, selectedMonth, 0).getDate() : 1}
      />

      {/* Onboarding mission card — auto-hides when user completes setup */}
      <GettingStarted />

      {/* Period context — pemilih ada di kanan-atas; baris tipis ini cuma
          ngingetin widget di bawah lagi nampilin bulan apa. */}
      <p className="t-sm -mt-2" style={{ color: 'var(--ink-soft)' }}>
        {t('dashboard.period')}: <span className="font-semibold" style={{ color: 'var(--ink-muted)' }}>{currentMonthYear}</span>
      </p>

      <DndContext sensors={dragSensors} collisionDetection={closestCorners} onDragStart={handleBlockDragStart} onDragEnd={handleBlockDragEnd} onDragCancel={() => { setActiveId(null); setDragSize(null); setDragHtml('') }}>
      <SortableContext items={blockOrder} strategy={rectSortingStrategy}>
      {/* Movable zone — BENTO grid: 3 kolom × baris 132px, auto-flow dense.
          Tiap card punya lebar (col-span 1/2/3) + tinggi (row-span 1/2/3) dipatok
          desain. dense bikin card kecil ngisi celah di sebelah card tinggi (mis.
          3 card kecil numpuk di kanan kalender). Urutan/visibility via CSS order +
          data-block. items-stretch + h-full → card ngisi penuh selnya. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:auto-rows-[132px] lg:[grid-auto-flow:row_dense] items-stretch">

      {/* Akun & Saldo — "di mana duitku" (widget #1 ala Monarch) */}
      <SortableSection id="akun" order={blockOrder} overflow="scroll-list" className="lg:col-span-1 lg:row-span-4">
        <AccountsCard accounts={accounts} />
      </SortableSection>

      {/* Sisa Aman bulan ini — safe-to-spend (actionable) */}
      <SortableSection id="sisa-aman" order={blockOrder} overflow="fit-static" className="lg:col-span-1 lg:row-span-3">
        <SafeToSpendCard income={totals.income} spent={totals.expense} saved={totals.saving + totals.investment} upcoming={upcomingRecurring} />
      </SortableSection>

      {/* Langganan & Rutin — total komitmen rutin/bulan */}
      <SortableSection id="langganan" order={blockOrder} overflow="scroll-list" className="lg:col-span-1 lg:row-span-3">
        <SubscriptionsCard recurring={recurringItems} />
      </SortableSection>

      {/* Phase 2.3 — AI-generated personalized insights */}
      <SortableSection id="ai-insights" order={blockOrder} overflow="fit-static" className="lg:col-span-2 lg:row-span-3">
        <AIInsightsCard
          monthTransactions={monthTransactions}
          yearTransactions={yearTransactions}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          goals={activeGoals}
        />
      </SortableSection>

      {/* Skor Kesehatan Finansial — skor + breakdown 7-indikator (2 kolom) */}
      <SortableSection id="kesehatan" order={blockOrder} overflow="fit-static" className="lg:col-span-2 lg:row-span-3">
        <FinancialHealthCard
          part="score"
          result={fhsResult}
          liquidBalance={cashEquivalent}
          monthlyExpense={fhsResult._monthlyExpense}
        />
      </SortableSection>

      {/* Cash Coverage — runway likuiditas (kartu terpisah, 1 kolom) */}
      <SortableSection id="cash-coverage" order={blockOrder} overflow="fit-static" className="lg:col-span-1 lg:row-span-3">
        <FinancialHealthCard
          part="coverage"
          result={fhsResult}
          liquidBalance={cashEquivalent}
          monthlyExpense={fhsResult._monthlyExpense}
        />
      </SortableSection>

      {/* Alokasi Kekayaan — komposisi aset (kas / investasi / aset lain) */}
      <SortableSection id="alokasi" order={blockOrder} overflow="fit-static" className="lg:col-span-1 lg:row-span-3">
        <AssetAllocationCard
          liquid={liquidTotal}
          nonLiquid={nonLiquidTotal}
          investment={investments.reduce((s, i) => s + (i.total_value || 0), 0)}
          debt={debtTotal}
        />
      </SortableSection>

      {/* Phase 9 — Money Flow Sankey: Pemasukan ↔ Penggunaan (bipartite) */}
      <SortableSection id="aliran" order={blockOrder} overflow="fill-chart" className="lg:col-span-3 lg:row-span-4">
        <div className="s-card p-4 sm:p-6">
        <div className="mb-3 sm:mb-4 flex items-start justify-between flex-wrap gap-3 shrink-0">
          <div>
            <p className="eyebrow">{t('dashboard.money_flow')}</p>
            <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--ink-soft)' }}>
              {t('dashboard.money_flow_sub')}
            </p>
          </div>
          {/* Legend — ikut grouping sankey (nabung+investasi = satu grup violet) */}
          <div className="hidden md:flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-[11px]" style={{ color: 'var(--ink-soft)' }}>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: 'var(--c-mint)' }} />
              {t('dashboard.kpi_income')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: 'var(--c-coral)' }} />
              {t('dashboard.kpi_expense')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: 'var(--c-violet)' }} />
              {t('dashboard.saving')} + {t('dashboard.investment')}
            </span>
          </div>
        </div>

        {/* Desktop: sankey inline. Mobile: kartu RINGKAS (in/out/sisa + bar) yang
            nge-tap buka sheet sankey penuh — keputusan review: thumbnail bukan
            tempat sankey; layar penuh khusus ala Stockbit. */}
        <div className="hidden md:flex md:flex-1 md:min-h-0 md:flex-col">
          <MoneyFlowSankey
            income={sankeyData.income}
            outflow={sankeyData.outflow}
            height="100%"
            emptyMessage={t('dashboard.sankey_empty')}
          />
        </div>
        <div className="md:hidden">
          {(() => {
            const totalIn = sankeyData.income.reduce((s, c) => s + c.amount, 0)
            const exp = sankeyData.outflow.filter((c) => c.kind === 'expense').reduce((s, c) => s + c.amount, 0)
            const sav = sankeyData.outflow.filter((c) => c.kind === 'saving' || c.kind === 'investment').reduce((s, c) => s + c.amount, 0)
            const totalOut = sankeyData.outflow.reduce((s, c) => s + c.amount, 0)
            if (totalIn === 0 && totalOut === 0) {
              return (
                <p className="text-[13px] text-center py-4" style={{ color: 'var(--ink-soft)' }}>
                  {t('dashboard.sankey_empty')}
                </p>
              )
            }
            const base = Math.max(totalIn, totalOut)
            const sisa = Math.max(0, totalIn - totalOut)
            const pct = (v: number) => `${(v / base) * 100}%`
            return (
              <>
                <div className="flex items-center justify-between gap-2">
                  {[
                    { label: t('dashboard.sankey_in'), val: totalIn, color: 'var(--c-mint-ink)' },
                    { label: t('dashboard.sankey_out'), val: totalOut, color: 'var(--c-coral-ink)' },
                    { label: t('dashboard.sankey_left'), val: sisa, color: 'var(--ink)' },
                  ].map((s) => (
                    <div key={s.label} className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{s.label}</p>
                      <p className="num tabular text-[14px] font-semibold mt-0.5" title={formatCurrency(s.val)} style={{ color: s.color }}>
                        {formatCompactCurrency(s.val)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-2.5 flex h-2 w-full rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }} aria-hidden>
                  {exp > 0 && <span style={{ width: pct(exp), background: 'var(--c-coral)' }} />}
                  {sav > 0 && <span style={{ width: pct(sav), background: 'var(--c-violet)' }} />}
                  {sisa > 0 && <span style={{ width: pct(sisa), background: 'color-mix(in srgb, var(--ink) 22%, transparent)' }} />}
                </div>
                <button
                  type="button"
                  onClick={() => setSankeySheetOpen(true)}
                  className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border py-2 text-[13px] font-medium transition-colors active:bg-[var(--surface-2)]"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
                >
                  {t('dashboard.sankey_view_full')} →
                </button>
              </>
            )
          })()}
          <BottomSheet
            open={sankeySheetOpen}
            onOpenChange={setSankeySheetOpen}
            title={t('dashboard.money_flow')}
            description={t('dashboard.money_flow_sub')}
          >
            <div className="px-1 pb-2">
              <MoneyFlowSankey
                income={sankeyData.income}
                outflow={sankeyData.outflow}
                compact
                height={Math.max(420, Math.min(560, 80 + Math.max(sankeyData.income.length, sankeyData.outflow.length) * 52))}
                emptyMessage={t('dashboard.sankey_empty')}
              />
            </div>
          </BottomSheet>
        </div>
        </div>
      </SortableSection>

      {/* Phase 2.1 + 3.1 — Recent Transactions · Upcoming Bills · Goals (per-card) */}
      <SortableSection id="transaksi" order={blockOrder} overflow="scroll-list" className="lg:col-span-2 lg:row-span-3">
        <RecentTransactions transactions={monthTransactions} />
      </SortableSection>
      <SortableSection id="tagihan" order={blockOrder} overflow="scroll-list" className="lg:col-span-1 lg:row-span-3">
        <UpcomingBills
          contracts={contracts}
          debts={activeDebts}
          creditCards={creditCards}
          recurring={recurringItems}
        />
      </SortableSection>
      <SortableSection id="tujuan" order={blockOrder} overflow="fit-static" className="lg:col-span-1 lg:row-span-3">
        <GoalsWidget goals={activeGoals} />
      </SortableSection>

      {/* Activity calendar (per-card, span 2) */}
      <SortableSection id="kalender" order={blockOrder} overflow="fill-chart" className="lg:col-span-2 lg:row-span-4">
        {/* Transactions calendar — 7-col month grid, colored by net activity */}
        <div className="s-card p-4 sm:p-5 h-full">
          <div className="mb-3 flex items-center justify-between flex-wrap gap-3 shrink-0">
            {/* Eyebrow-only (ala Stockbit) — bulan+tahun digabung ke eyebrow
                biar konteks periode gak hilang pas t-h2 dibuang. */}
            <p className="eyebrow">
              {t('dashboard.activity_this_month')} · {MONTHS[selectedMonth - 1]} {selectedYear}
            </p>
            <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--ink-soft)' }}>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded" style={{ background: 'var(--c-mint)' }} />
                {t('dashboard.kpi_income')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded" style={{ background: 'var(--c-coral)' }} />
                {t('dashboard.kpi_expense')}
              </span>
            </div>
          </div>

          {(() => {
            const today = new Date()
            const isCurrentMonth =
              today.getFullYear() === selectedYear &&
              today.getMonth() + 1 === selectedMonth
            const todayDay = today.getDate()
            const days = calendarData
            // Determine intensity scaling — pick largest absolute movement
            const allAmounts = days
              .filter((c) => c.day !== null)
              .map((c) => Math.max(c.income, c.expense))
            const maxAmt = Math.max(...allAmounts, 1)
            const dayLabels = [
              t('dashboard.dow_sun'),
              t('dashboard.dow_mon'),
              t('dashboard.dow_tue'),
              t('dashboard.dow_wed'),
              t('dashboard.dow_thu'),
              t('dashboard.dow_fri'),
              t('dashboard.dow_sat'),
            ]

            return (
              <>
                {/* Day-of-week header */}
                <div className="grid grid-cols-7 gap-1 mb-1.5 shrink-0">
                  {dayLabels.map((d) => (
                    <div
                      key={d}
                      className="text-center text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--ink-soft)' }}
                    >
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar grid — each cell shows day number + net amount.
                    On mobile, cells are ~45px wide so we use a TIGHT format
                    (no "Rp" prefix, e.g. "+12,5jt" / "−500rb") and a tiny
                    font so amounts fit inside. */}
                <div className="grid grid-cols-7 gap-1 flex-1 auto-rows-fr min-h-0">
                  {days.map((d, i) => {
                    if (d.day === null) return <div key={`pad-${i}`} className="min-h-[32px]" />
                    const isToday = isCurrentMonth && d.day === todayDay
                    const hasIncome = d.income > 0
                    const hasExpense = d.expense > 0
                    const net = d.income - d.expense
                    const intensity = Math.max(hasIncome ? d.income / maxAmt : 0, hasExpense ? d.expense / maxAmt : 0)
                    const isPositive = net > 0
                    const isNegative = net < 0
                    // Tint via token (red-500 lama OFF-palette) + alpha dibatasi 30%
                    // biar teks -ink di atasnya tetap kebaca (AA).
                    const tintPct = Math.round(Math.max(8, intensity * 30))
                    const bg =
                      isPositive
                        ? `color-mix(in srgb, var(--c-mint) ${tintPct}%, transparent)`
                        : isNegative
                          ? `color-mix(in srgb, var(--c-coral) ${tintPct}%, transparent)`
                          : 'transparent'

                    const tooltipParts: string[] = [`${t('dashboard.date_prefix')} ${d.day}`]
                    if (hasIncome) tooltipParts.push(`+${formatCurrency(d.income)}`)
                    if (hasExpense) tooltipParts.push(`-${formatCurrency(d.expense)}`)
                    if (d.count > 0) tooltipParts.push(`${d.count} ${t('dashboard.transactions_unit')}`)

                    // Tiny "Rp"-less format optimized for narrow cells:
                    //   12,500,000 → "12,5jt"  ·  500,000 → "500rb"
                    function tight(n: number) {
                      const abs = Math.abs(n)
                      if (abs >= 1_000_000_000) return `${(abs / 1_000_000_000).toFixed(1)}M`
                      if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace('.', ',')}jt`
                      if (abs >= 1_000) return `${Math.round(abs / 1_000)}rb`
                      return `${abs}`
                    }

                    return (
                      <div
                        key={d.day}
                        className="min-h-[32px] rounded-md relative flex flex-col items-start justify-between px-1 py-0.5 sm:p-1.5 transition hover:scale-[1.04] hover:z-10 cursor-default overflow-hidden"
                        style={{
                          // Borderless: tint = penanda aktivitas (sel kosong polos),
                          // cuma "hari ini" yang dapet ring mint.
                          background: bg,
                          border: isToday ? '2px solid var(--c-mint)' : 'none',
                        }}
                        title={tooltipParts.join(' · ')}
                      >
                        <span
                          className="text-[10px] font-semibold leading-none"
                          style={{ color: 'var(--ink)' }}
                        >
                          {d.day}
                        </span>

                        {(hasIncome || hasExpense) && (
                          <div className="w-full text-right leading-none">
                            {hasIncome && hasExpense ? (
                              <>
                                {/* Mobile: 1 baris net aja — 2 baris bikin SEMUA baris
                                    kalender (auto-rows-fr) ikut melar. Detail tetap ada
                                    di tooltip + breakdown per-hari. */}
                                <p
                                  className="sm:hidden num tabular text-[9px] font-semibold"
                                  style={{ color: net >= 0 ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}
                                >
                                  {net >= 0 ? '+' : '−'}
                                  {tight(net)}
                                </p>
                                <p className="hidden sm:block num tabular text-[9px] font-semibold" style={{ color: 'var(--c-mint-ink)' }}>
                                  +{tight(d.income)}
                                </p>
                                <p className="hidden sm:block num tabular text-[9px] font-semibold mt-0.5" style={{ color: 'var(--c-coral-ink)' }}>
                                  −{tight(d.expense)}
                                </p>
                              </>
                            ) : (
                              <p
                                className="num tabular text-[9px] sm:text-[11px] font-semibold"
                                style={{ color: hasIncome ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}
                              >
                                {hasIncome ? '+' : '−'}
                                {tight(hasIncome ? d.income : d.expense)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )
          })()}
        </div>

      </SortableSection>

      {/* Budget Progress (per-card, span 1) */}
      <SortableSection id="anggaran" order={blockOrder} overflow="scroll-list" className="lg:col-span-1 lg:row-span-3">
        <div className="s-card p-4 sm:p-5 h-full">
          <div className="mb-3">
            <p className="eyebrow">{t('dashboard.budget_progress')}</p>
          </div>
          {budgetProgress.length === 0 ? (
            <div className="flex items-center justify-center text-center text-sm px-4 py-6" style={{ color: 'var(--ink-soft)' }}>
              <span>
                {t('dashboard.no_budget')}.{' '}
                <a href="/dashboard/budgeting" className="inline-flex items-center gap-1 font-medium" style={{ color: 'var(--c-mint-ink)' }}>
                  {t('dashboard.set_now')} <ArrowRight className="h-3 w-3" />
                </a>
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              {budgetProgress.map((row) => {
                const overBudget = row.pct > 100
                const pctCapped = Math.min(row.pct, 120)
                const barColor = overBudget ? 'var(--danger)' : row.pct > 80 ? 'var(--c-amber)' : 'var(--c-mint)'
                return (
                  <div key={row.category}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium truncate" style={{ color: 'var(--ink)' }}>{row.category}</span>
                      <span className="num tabular text-[11px] shrink-0 ml-2" style={{ color: overBudget ? 'var(--danger)' : 'var(--ink-muted)' }}>
                        {row.pct.toFixed(0)}%
                      </span>
                    </div>
                    <span className="quest-bar w-full" style={{ ['--bar-fill' as string]: barColor, ['--bar-h' as string]: '9px' }}>
                      <i style={{ width: `${pctCapped}%` }} />
                    </span>
                    <div className="text-[10px] mt-0.5 num" style={{ color: 'var(--ink-soft)' }}>
                      {formatCurrency(row.actual)} / {formatCurrency(row.budget)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </SortableSection>

      {/* Insights & Alerts */}
      <SortableSection id="insights" order={blockOrder} overflow="fit-static" className="lg:col-span-2 lg:row-span-3">
        <InsightsPanel
          part="alerts"
          monthTransactions={monthTransactions}
          yearTransactions={yearTransactions}
          monthBudgets={monthBudgets}
          creditCards={creditCards}
          contracts={contracts}
          savingRate={totals.savingRate}
        />
      </SortableSection>
      {/* Yearly cash flow — income vs expense twin bars (per-card, span 2) */}
      <SortableSection id="arus-tahunan" order={blockOrder} overflow="fill-chart" className="lg:col-span-2 lg:row-span-4">
        <div className="s-card p-4 sm:p-5 h-full">
          <div className="mb-3 flex items-center justify-between flex-wrap gap-3 shrink-0">
            <p className="eyebrow">{t('dashboard.cashflow_yearly')}</p>
            {/* Surplus/Deficit chip per mockup line 168 */}
            {(() => {
              const yearIncome = monthlyData.reduce((s, m) => s + m.income, 0)
              const yearExpense = monthlyData.reduce((s, m) => s + m.expense, 0)
              const yearNet = yearIncome - yearExpense
              const isSurplus = yearNet >= 0
              return (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    background: isSurplus ? 'var(--c-mint-soft)' : 'var(--c-coral-soft)',
                    color: isSurplus ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)',
                  }}
                >
                  {isSurplus ? t('dashboard.surplus') : t('dashboard.deficit')} {formatCurrency(Math.abs(yearNet))}
                </span>
              )
            })()}
          </div>
          <div className="flex-1 min-h-0"><MonthlyFlowChart data={monthlyData} fill /></div>
        </div>
      </SortableSection>

      {/* Investment allocation donut (per-card, span 1) */}
      <SortableSection id="portofolio" order={blockOrder} overflow="scroll-list" className="lg:col-span-1 lg:row-span-4">
        <div className="s-card p-5 sm:p-6 flex flex-col h-full">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow">{t('dashboard.portfolio')}</p>
            <Link
              href="/dashboard/assets/investment"
              className="text-[11px] font-medium inline-flex items-center gap-0.5 hover:underline"
              style={{ color: 'var(--c-mint-ink)' }}
            >
              {t('dashboard.detail')} <ArrowRight className="size-3" />
            </Link>
          </div>

          {investmentPieData.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center px-6 py-6">
              <div className="size-10 rounded-xl flex items-center justify-center mb-2"
                style={{ background: 'var(--c-violet-soft)' }}>
                <TrendingUp className="size-5" style={{ color: 'var(--c-violet-ink)' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                {t('dashboard.no_investment')}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>
                {t('dashboard.no_investment_desc')}
              </p>
              <Link
                href="/dashboard/assets/investment"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition"
                style={{
                  background: 'var(--c-primary)',
                  color: 'var(--c-primary-foreground)',
                }}
              >
                {t('dashboard.add_investment')} <ArrowRight className="size-3" />
              </Link>
            </div>
          ) : (
            <>
              {/* Total + P/L hero */}
              <div className="mt-3 flex items-end gap-3 flex-wrap">
                <div>
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                    {t('dashboard.total_value')}
                  </p>
                  <p className="num tabular text-2xl font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
                    {formatCurrency(investmentSummary.totalValue)}
                  </p>
                </div>
                {investmentSummary.totalCost > 0 && (
                  <div className="ml-auto text-right">
                    <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                      {t('dashboard.profit_loss')}
                    </p>
                    <p
                      className="num tabular text-sm font-semibold mt-0.5"
                      style={{
                        color: investmentSummary.unrealizedPL >= 0
                          ? 'var(--c-mint-ink)'
                          : 'var(--c-coral-ink)',
                      }}
                    >
                      {investmentSummary.unrealizedPL >= 0 ? '+' : ''}
                      {formatCurrency(investmentSummary.unrealizedPL)}
                      <span className="text-[10px] ml-1 opacity-70">
                        ({investmentSummary.unrealizedPct >= 0 ? '+' : ''}
                        {investmentSummary.unrealizedPct.toFixed(2)}%)
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {/* Compact donut + category legend side-by-side */}
              <div className="mt-3 flex items-center gap-3">
                <div className="shrink-0">
                  <InvestmentPie data={investmentPieData} palette={CHART_PALETTE} />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  {investmentPieData.slice(0, 5).map((row, i) => {
                    const total = investmentPieData.reduce((s, r) => s + r.value, 0)
                    const pct = total > 0 ? (row.value / total) * 100 : 0
                    return (
                      <div key={row.name} className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1.5 truncate" style={{ color: 'var(--ink-muted)' }}>
                          <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length] }} />
                          <span className="truncate">{row.name}</span>
                        </span>
                        <span className="tabular shrink-0 ml-2" style={{ color: 'var(--ink)' }}>{pct.toFixed(1)}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Top holdings list */}
              {investmentSummary.topHoldings.length > 0 && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-soft)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--ink-soft)' }}>
                      {t('dashboard.top_holding')}
                    </p>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                      style={{
                        background:
                          investmentSummary.risk === 'tinggi' ? 'color-mix(in srgb, var(--c-coral) 16%, transparent)'
                          : investmentSummary.risk === 'sedang' ? 'color-mix(in srgb, var(--c-amber) 18%, transparent)'
                          : 'color-mix(in srgb, var(--c-mint) 16%, transparent)',
                        border: 'var(--bar-outline-w, 1.5px) solid var(--outline)',
                        color:
                          investmentSummary.risk === 'tinggi' ? 'var(--c-coral-ink)'
                          : investmentSummary.risk === 'sedang' ? 'var(--c-amber-ink)'
                          : 'var(--c-mint-ink)',
                      }}
                      title={`${t('dashboard.top_holding')} = ${investmentSummary.topPct.toFixed(0)}${t('dashboard.concentration_tooltip')}`}
                    >
                      {t('dashboard.concentration')} {t(`dashboard.risk_${investmentSummary.risk}`)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {investmentSummary.topHoldings.map((h, i) => {
                      const pct = investmentSummary.totalValue > 0 ? (h.value / investmentSummary.totalValue) * 100 : 0
                      const plPct = h.cost > 0 ? (h.pl / h.cost) * 100 : 0
                      const isStock = h.category === 'stock'
                      return (
                        <div key={h.id}>
                          <div className="flex items-center justify-between gap-2 text-[12px]">
                            <span className="truncate flex items-center gap-1.5 min-w-0">
                              {isStock ? (
                                <StockLogo ticker={h.ticker} size={28} />
                              ) : h.category === 'crypto' ? (
                                <CryptoLogo symbol={h.ticker} size={28} />
                              ) : (
                                <span className="text-[10px] tabular shrink-0" style={{ color: 'var(--ink-soft)' }}>
                                  #{i + 1}
                                </span>
                              )}
                              <span className="font-medium truncate" style={{ color: 'var(--ink)' }} title={h.name}>
                                {h.name}
                              </span>
                            </span>
                            <span className="num tabular shrink-0" style={{ color: 'var(--ink)' }}>
                              {formatCurrency(h.value)}
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="quest-bar flex-1" style={{ ['--bar-fill' as string]: CHART_PALETTE[i % CHART_PALETTE.length], ['--bar-h' as string]: '9px' }}>
                              <i style={{ width: `${pct}%` }} />
                            </span>
                            <span className="text-[10px] tabular shrink-0" style={{ color: 'var(--ink-soft)' }}>
                              {pct.toFixed(0)}%
                            </span>
                            {h.cost > 0 && (
                              <span
                                className="text-[10px] tabular shrink-0 font-medium"
                                style={{ color: h.pl >= 0 ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}
                              >
                                {h.pl >= 0 ? '+' : ''}{plPct.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {investmentSummary.count > 4 && (
                    <p className="text-[10px] mt-2.5 text-center" style={{ color: 'var(--ink-soft)' }}>
                      +{investmentSummary.count - 4} {t('dashboard.more_holdings')}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </SortableSection>

      </div>
      </SortableContext>
      {/* DragOverlay — preview bersih yg ngambang di atas (portal ke body, gak
          ke-clip). Seukuran footprint kartu sumber; sumbernya jadi placeholder
          dashed redup. Cuma silhouette berjudul (bukan remount chart) biar mulus. */}
      <DragOverlay adjustScale={false} dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2,0,0,1)' }}>
        {activeId && dragHtml ? (
          <div
            className="overflow-hidden shadow-2xl pointer-events-none cursor-grabbing"
            style={{ width: dragSize?.w, height: dragSize?.h, borderRadius: 18, outline: '2px solid var(--c-mint)', outlineOffset: -1 }}
            dangerouslySetInnerHTML={{ __html: dragHtml }}
          />
        ) : null}
      </DragOverlay>
      </DndContext>
      </div>

    </div>
  )
}

// NetWorthHero, InsightsPanel, Row2, UpcomingBills, RecentTransactions,
// GoalsWidget — all extracted to components/dashboard/*.tsx
