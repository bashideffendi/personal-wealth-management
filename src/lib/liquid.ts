/**
 * Unified liquid-balance helpers.
 *
 * Liquid balance = money you can spend / convert to cash quickly.
 * In this app it comes from TWO sources:
 *
 * 1. `accounts` table (source of truth, auto-updated by transactions):
 *    cash / bank / digital_wallet types.
 * 2. `assets_liquid` table (manual entries for liquid items that are NOT
 *    transactional accounts): receivables, locked savings, foreign cash, etc.
 *
 * We DO NOT sync the two tables. Instead we read from both and present a
 * unified view. This avoids dual-write bugs and makes accounts.current_balance
 * the single source of truth for any account also tracked there.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type LiquidType = 'cash' | 'bank' | 'digital_wallet' | 'investment' | 'receivable'

export interface UnifiedLiquidEntry {
  id: string
  name: string
  type: LiquidType
  balance: number
  source: 'account' | 'asset_liquid'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, any, any>

export async function fetchLiquidEntries(
  supabase: DB,
  userId: string,
  opts?: { strict?: boolean },
): Promise<UnifiedLiquidEntry[]> {
  const [accRes, alRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, name, type, current_balance')
      .eq('user_id', userId),
    supabase
      .from('assets_liquid')
      .select('id, name, type, balance')
      .eq('user_id', userId),
  ])

  // strict: gagal query = throw (caller react-query nampilin error card).
  // Default lama (?? []) bikin total "Rp 0 palsu" pas fetch gagal — caller
  // dengan error-state harap pakai strict.
  if (opts?.strict) {
    if (accRes.error) throw accRes.error
    if (alRes.error) throw alRes.error
  }

  const fromAccounts: UnifiedLiquidEntry[] = (accRes.data ?? []).map((a: { id: string; name: string; type: string; current_balance: number }) => ({
    id: a.id,
    name: a.name,
    type: a.type as LiquidType,
    balance: a.current_balance ?? 0,
    source: 'account',
  }))
  const fromAssets: UnifiedLiquidEntry[] = (alRes.data ?? []).map((a: { id: string; name: string; type: string; balance: number }) => ({
    id: a.id,
    name: a.name,
    type: a.type as LiquidType,
    balance: a.balance ?? 0,
    source: 'asset_liquid',
  }))

  return [...fromAccounts, ...fromAssets]
}

/** Total liquid (excludes nothing — caller can filter by type if needed). */
export function sumLiquid(entries: UnifiedLiquidEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.balance || 0), 0)
}

/** Cash + equivalents (everything except receivable). */
export function sumCashEquivalent(entries: UnifiedLiquidEntry[]): number {
  return entries
    .filter((e) => e.type !== 'receivable')
    .reduce((sum, e) => sum + (e.balance || 0), 0)
}

/** Receivable only. */
export function sumReceivable(entries: UnifiedLiquidEntry[]): number {
  return entries
    .filter((e) => e.type === 'receivable')
    .reduce((sum, e) => sum + (e.balance || 0), 0)
}

/**
 * Detect possible duplicates between accounts and assets_liquid.
 * Returns asset_liquid entries whose name (case-insensitive) matches an account.
 * The user probably intended one or the other but ended up with both.
 */
export function findDuplicates(entries: UnifiedLiquidEntry[]): UnifiedLiquidEntry[] {
  const accountNames = new Set(
    entries
      .filter((e) => e.source === 'account')
      .map((e) => e.name.trim().toLowerCase())
  )
  return entries.filter(
    (e) => e.source === 'asset_liquid' && accountNames.has(e.name.trim().toLowerCase())
  )
}
