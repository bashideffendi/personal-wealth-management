/**
 * Budget category tree (kategori → subkategori) — DB-synced with localStorage fallback.
 *
 * - Stored in public.budget_categories (one JSONB row per user+type) once
 *   migration 031 is applied. Until then, transparently falls back to
 *   localStorage so the feature keeps working (just not synced across devices).
 * - Budget AMOUNTS in public.budgets remain string-keyed by category name; a
 *   subcategory is keyed by the composite "Kategori › Subkategori" (SUB_SEP).
 *   So renames cascade to budgets.category (see cascadeRenameKeys).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  SAVING_CATEGORIES,
  INVESTMENT_CATEGORIES,
} from './constants'

export type BudgetType = 'income' | 'expense' | 'saving' | 'investment'

/**
 * Target anggaran per kategori-leaf (ala Actual goal-templates, versi terstruktur):
 * - fixed         : Rp X tetap / bulan
 * - byDate        : nabung total Rp X sampai bulan `by` (YYYY-MM) → dibagi rata sisa bulan
 * - percentIncome : X% dari pemasukan bulan itu
 * - average       : rata-rata realisasi N bulan terakhir (auto-budget)
 */
export type CatTarget =
  | { mode: 'fixed'; amount: number }
  | { mode: 'byDate'; amount: number; by: string }
  | { mode: 'percentIncome'; percent: number }
  | { mode: 'average'; months: number }

export interface SubNode {
  id: string
  name: string
  target?: CatTarget
}
export interface CatNode {
  id: string
  name: string
  subs: SubNode[]
  /**
   * Omitted/true = aktif (tampil di tabel anggaran & ikut total).
   * false = nonaktif: disembunyikan dari tabel tapi nama + nilai budget tetap
   * disimpan (tinggal diaktifkan lagi). Mirip arsip, bukan hapus.
   */
  enabled?: boolean
  /** Warna kustom (hex dari palet). Default = warna tipe (accent). */
  color?: string
  /** Key ikon kustom dari registry (lihat category-icon.tsx). Default = ikon by-nama. */
  icon?: string
  /** Target anggaran — relevan kalau kategori ini leaf (tanpa subs). */
  target?: CatTarget
}
export type CategoryTree = Record<BudgetType, CatNode[]>

export const BUDGET_TYPES: BudgetType[] = ['income', 'expense', 'saving', 'investment']

/**
 * Jumlah rencana bulanan yang disarankan dari sebuah target.
 * ctx.incomeThisMonth = total rencana pemasukan bulan itu (buat percentIncome);
 * ctx.avgActual = rata-rata realisasi N bulan (buat mode average) — dihitung pemanggil.
 */
export function computeTargetAmount(
  t: CatTarget,
  ctx: { year: number; month: number; incomeThisMonth: number; avgActual: number },
): number {
  switch (t.mode) {
    case 'fixed':
      return Math.max(0, Math.round(t.amount))
    case 'percentIncome':
      return Math.max(0, Math.round((ctx.incomeThisMonth * t.percent) / 100))
    case 'average':
      return Math.max(0, Math.round(ctx.avgActual))
    case 'byDate': {
      const [ty, tm] = t.by.split('-').map(Number)
      if (!ty || !tm) return Math.max(0, Math.round(t.amount))
      const monthsLeft = (ty - ctx.year) * 12 + (tm - ctx.month) + 1
      return monthsLeft > 0
        ? Math.max(0, Math.round(t.amount / monthsLeft))
        : Math.max(0, Math.round(t.amount))
    }
  }
}

/** Separator for composite budget key of a subcategory: "Makanan › Restoran". */
export const SUB_SEP = ' › '

const LS_TREE_KEY = 'pwm.budget.categoryTree'
const LS_ENABLED_KEY = 'pwm.budget.enabledCategories'

const DEFAULTS: Record<BudgetType, readonly string[]> = {
  income: INCOME_CATEGORIES,
  expense: EXPENSE_CATEGORIES,
  saving: SAVING_CATEGORIES,
  investment: INVESTMENT_CATEGORIES,
}

/**
 * Contoh subkategori bawaan — biar user baru langsung paham "oh, subkategori tuh
 * kayak gini". Cuma dipakai saat SEEDING (tree masih kosong); gak pernah nimpa
 * tree user yang udah ada. Tambah entri lain di sini kalau mau contoh lebih.
 */
const DEFAULT_SUBS: Record<string, readonly string[]> = {
  Langganan: ['Netflix', 'Spotify', 'YouTube Premium'],
  Makanan: ['Belanja Dapur', 'Makan di Luar', 'Kopi & Jajan'],
  Transportasi: ['Bensin', 'Ojek/Taksi Online', 'Parkir & Tol', 'Servis Kendaraan'],
  Tagihan: ['Listrik', 'Air (PDAM)', 'Internet', 'Pulsa & Paket Data', 'BPJS'],
}
function subNodesFor(name: string): SubNode[] {
  return (DEFAULT_SUBS[name] ?? []).map((s) => ({ id: newId(), name: s }))
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback (non-secure contexts) — uniqueness is all we need for React keys.
  return 'c' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function emptyTree(): CategoryTree {
  return { income: [], expense: [], saving: [], investment: [] }
}

/** Composite budgets.category key for a subcategory under a category. */
export function subKey(categoryName: string, subName: string): string {
  return `${categoryName}${SUB_SEP}${subName}`
}

/** Induk dari sebuah key. "Langganan › Netflix" → "Langganan"; "Makanan" → "Makanan". */
export function rootCategory(key: string): string {
  const i = key.indexOf(SUB_SEP)
  return i === -1 ? key : key.slice(0, i)
}

export interface CategoryOption {
  /** Key yang disimpan di transaksi: nama induk, atau "Induk › Sub". */
  value: string
  /** Teks tampil di dropdown — sub cukup nama sub-nya (di-indent via depth). */
  label: string
  /** 0 = induk, 1 = subkategori. */
  depth: number
}

/**
 * Opsi kategori buat dropdown transaksi/rules, urut tampilan. Induk tetap bisa
 * dipilih (catch-all + jaga transaksi lama tetap valid); subkategori muncul di
 * bawahnya. Kategori nonaktif di-skip. Satu sumber kebenaran = tree user.
 */
export function categoryOptions(nodes: CatNode[]): CategoryOption[] {
  const out: CategoryOption[] = []
  for (const c of nodes) {
    if (!isEnabled(c)) continue
    out.push({ value: c.name, label: c.name, depth: 0 })
    for (const s of c.subs) out.push({ value: subKey(c.name, s.name), label: s.name, depth: 1 })
  }
  return out
}

function coerceTarget(raw: unknown): CatTarget | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  if (r.mode === 'fixed' && typeof r.amount === 'number') return { mode: 'fixed', amount: r.amount }
  if (r.mode === 'byDate' && typeof r.amount === 'number' && typeof r.by === 'string')
    return { mode: 'byDate', amount: r.amount, by: r.by }
  if (r.mode === 'percentIncome' && typeof r.percent === 'number')
    return { mode: 'percentIncome', percent: r.percent }
  if (r.mode === 'average' && typeof r.months === 'number') return { mode: 'average', months: r.months }
  return undefined
}

/** Coerce arbitrary JSON into a clean CatNode[] (ids guaranteed, names trimmed). */
function normalizeNodes(raw: unknown): CatNode[] {
  if (!Array.isArray(raw)) return []
  const out: CatNode[] = []
  for (const n of raw) {
    if (!n || typeof n !== 'object') continue
    const name = typeof (n as CatNode).name === 'string' ? (n as CatNode).name.trim() : ''
    if (!name) continue
    const rawSubs = (n as CatNode).subs
    const subs: SubNode[] = Array.isArray(rawSubs)
      ? rawSubs
          .map((s) => {
            const st = coerceTarget((s as SubNode)?.target)
            return {
              id: typeof s?.id === 'string' ? s.id : newId(),
              name: typeof s?.name === 'string' ? s.name.trim() : '',
              ...(st ? { target: st } : {}),
            }
          })
          .filter((s) => s.name)
      : []
    const color = typeof (n as CatNode).color === 'string' ? (n as CatNode).color : undefined
    const icon = typeof (n as CatNode).icon === 'string' ? (n as CatNode).icon : undefined
    const target = coerceTarget((n as CatNode).target)
    out.push({
      id: typeof (n as CatNode).id === 'string' ? (n as CatNode).id : newId(),
      name,
      subs,
      // Only persist optional fields when set — keeps default rows clean.
      ...((n as CatNode).enabled === false ? { enabled: false } : {}),
      ...(color ? { color } : {}),
      ...(icon ? { icon } : {}),
      ...(target ? { target } : {}),
    })
  }
  return out
}

/** Kategori dianggap aktif kecuali ditandai nonaktif eksplisit (enabled === false). */
export function isEnabled(n: { enabled?: boolean }): boolean {
  return n.enabled !== false
}

/** Read the user's current "enabled" categories (legacy localStorage) for a type. */
function localEnabled(type: BudgetType): string[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_ENABLED_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Record<BudgetType, string[]>>
    const arr = parsed[type]
    return Array.isArray(arr) && arr.length ? arr : null
  } catch {
    return null
  }
}

/** Seed a default tree from the user's legacy enabled-categories, else from constants. */
export function seedDefaultTree(): CategoryTree {
  const tree = emptyTree()
  for (const type of BUDGET_TYPES) {
    const names = localEnabled(type) ?? [...DEFAULTS[type]]
    tree[type] = names.map((name) => ({ id: newId(), name, subs: subNodesFor(name) }))
  }
  return tree
}

export function loadLocalTree(): CategoryTree {
  if (typeof window === 'undefined') return seedDefaultTree()
  try {
    const raw = window.localStorage.getItem(LS_TREE_KEY)
    if (!raw) return seedDefaultTree()
    const parsed = JSON.parse(raw) as Partial<Record<BudgetType, unknown>>
    const tree = emptyTree()
    let any = false
    for (const type of BUDGET_TYPES) {
      const nodes = normalizeNodes(parsed[type])
      if (nodes.length) any = true
      tree[type] = nodes
    }
    return any ? tree : seedDefaultTree()
  } catch {
    return seedDefaultTree()
  }
}

export function saveLocalTree(tree: CategoryTree): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_TREE_KEY, JSON.stringify(tree))
  } catch {
    /* quota / private mode — ignore */
  }
}

/**
 * Load the category tree for a user. Tries DB first; on ANY error (e.g. table
 * not yet created by migration 031) falls back to localStorage.
 * Returns dbAvailable so the caller knows where subsequent saves should go.
 */
export async function loadTree(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ tree: CategoryTree; dbAvailable: boolean }> {
  try {
    const { data, error } = await supabase
      .from('budget_categories')
      .select('type, tree')
      .eq('user_id', userId)

    if (error) return { tree: loadLocalTree(), dbAvailable: false }

    const tree = emptyTree()
    let any = false
    for (const row of data ?? []) {
      const t = (row as { type: BudgetType }).type
      if (BUDGET_TYPES.includes(t)) {
        const nodes = normalizeNodes((row as { tree: unknown }).tree)
        tree[t] = nodes
        if (nodes.length) any = true
      }
    }

    if (!any) {
      // First run with DB available — seed from local/defaults and persist.
      const seeded = loadLocalTree()
      await saveTreeToDb(supabase, userId, seeded)
      return { tree: seeded, dbAvailable: true }
    }

    // Fill any type missing a row from defaults (in-memory; persisted on next save).
    for (const type of BUDGET_TYPES) {
      if (!tree[type].length) {
        tree[type] = [...DEFAULTS[type]].map((name) => ({ id: newId(), name, subs: subNodesFor(name) }))
      }
    }
    return { tree, dbAvailable: true }
  } catch {
    return { tree: loadLocalTree(), dbAvailable: false }
  }
}

async function saveTreeToDb(
  supabase: SupabaseClient,
  userId: string,
  tree: CategoryTree,
): Promise<void> {
  const rows = BUDGET_TYPES.map((type) => ({
    user_id: userId,
    type,
    tree: tree[type],
    updated_at: new Date().toISOString(),
  }))
  await supabase.from('budget_categories').upsert(rows, { onConflict: 'user_id,type' })
}

/** Persist the tree to DB (if available) or localStorage otherwise. */
export async function saveTree(
  supabase: SupabaseClient,
  userId: string,
  dbAvailable: boolean,
  tree: CategoryTree,
): Promise<void> {
  saveLocalTree(tree) // keep a local mirror regardless (offline / cross-tab)
  if (dbAvailable) await saveTreeToDb(supabase, userId, tree)
}

/**
 * Cascade kategori renames/reassign ke SEMUA tabel yang nyimpen `category`
 * sebagai string: budgets, transactions, recurring_transactions. `pairs` =
 * [oldKey, newKey][]. Dipakai buat dua hal:
 *   - rename: ['Makanan' → 'Konsumsi'] (+ composite sub keys-nya)
 *   - reassign saat hapus: beberapa key lama → satu kategori tujuan (merge)
 * Tanpa ini, rename kategori cuma kena budget → transaksi lama jadi "yatim"
 * (ke-split jadi 2 kategori). Tiap update di-scope per (user, type, oldKey).
 */
export async function cascadeRenameKeys(
  supabase: SupabaseClient,
  userId: string,
  type: BudgetType,
  pairs: [string, string][],
): Promise<void> {
  for (const [oldKey, newKey] of pairs) {
    if (oldKey === newKey) continue
    const scope = (table: string) =>
      supabase
        .from(table)
        .update({ category: newKey })
        .eq('user_id', userId)
        .eq('type', type)
        .eq('category', oldKey)
    // Jalan paralel; tabel/kolom yang gak ada balikin error object (gak throw),
    // jadi aman walau recurring_transactions belum ada di sebagian env.
    await Promise.all([scope('budgets'), scope('transactions'), scope('recurring_transactions')])
  }
}

/**
 * Hitung jumlah transaksi per kategori, dikelompokin `${type}::${category}`.
 * Dipakai Kelola Kategori buat nampilin "N transaksi" tiap baris + ngingetin
 * (sekaligus nawarin pindahin) sebelum kategori yang masih kepake dihapus.
 */
export async function loadCategoryUsage(
  supabase: SupabaseClient,
  userId: string,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('transactions')
    .select('type, category')
    .eq('user_id', userId)
  if (error || !data) return {}
  const out: Record<string, number> = {}
  for (const row of data as { type: string; category: string | null }[]) {
    if (!row.category) continue
    const k = `${row.type}::${row.category}`
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

/**
 * Realisasi (aktual) per kategori per BULAN untuk satu tahun — jumlahkan amount
 * transaksi, dikelompokin `${type}::${category}::${month}` (month = 1–12).
 * Key kategori sama persis dgn budget (single source of truth), jadi tiap baris
 * anggaran tinggal lookup. Dipakai view Anggaran bulanan (Rencana vs Realisasi).
 */
export async function loadMonthlyActuals(
  supabase: SupabaseClient,
  userId: string,
  year: string,
): Promise<Record<string, number>> {
  const start = `${year}-01-01`
  const end = `${Number(year) + 1}-01-01`
  const { data, error } = await supabase
    .from('transactions')
    .select('type, category, amount, date')
    .eq('user_id', userId)
    .gte('date', start)
    .lt('date', end)
  if (error || !data) return {}
  const out: Record<string, number> = {}
  for (const row of data as {
    type: string
    category: string | null
    amount: number | null
    date: string | null
  }[]) {
    if (!row.category || !row.date) continue
    const month = Number(row.date.slice(5, 7)) // 'YYYY-MM-DD' → MM
    if (!month) continue
    const k = `${row.type}::${row.category}::${month}`
    out[k] = (out[k] ?? 0) + (row.amount ?? 0)
  }
  return out
}

/**
 * Flat list of budget-row keys for a type, in display order:
 * a category with NO subs is itself a leaf key; a category WITH subs contributes
 * its subcategory composite keys (the category becomes a rollup, not a leaf).
 */
export function leafKeys(nodes: CatNode[]): string[] {
  const keys: string[] = []
  for (const c of nodes) {
    if (!isEnabled(c)) continue // kategori nonaktif: keluar dari tabel & total
    if (c.subs.length) for (const s of c.subs) keys.push(subKey(c.name, s.name))
    else keys.push(c.name)
  }
  return keys
}
