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

export interface SubNode {
  id: string
  name: string
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
}
export type CategoryTree = Record<BudgetType, CatNode[]>

export const BUDGET_TYPES: BudgetType[] = ['income', 'expense', 'saving', 'investment']

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
          .map((s) => ({
            id: typeof s?.id === 'string' ? s.id : newId(),
            name: typeof s?.name === 'string' ? s.name.trim() : '',
          }))
          .filter((s) => s.name)
      : []
    out.push({
      id: typeof (n as CatNode).id === 'string' ? (n as CatNode).id : newId(),
      name,
      subs,
      // Only persist the flag when explicitly disabled — keeps default rows clean.
      ...((n as CatNode).enabled === false ? { enabled: false } : {}),
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
