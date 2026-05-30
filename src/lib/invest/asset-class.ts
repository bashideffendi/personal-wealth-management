import type { Investment } from '@/types'

/**
 * Asset-class taxonomy for the investment overview.
 *
 * Same as Investment.category EXCEPT `stock` is split into IDX (IHSG) vs US,
 * so allocation / kinerja / holdings can show them separately.
 *
 * US stock = category `stock` with currency USD. IDX stocks are stored in IDR
 * (or blank), so the default falls to IDX — safe even when currency is unset.
 */

export type AssetClassKey =
  | 'stock_idx' | 'stock_us' | 'mutual_fund' | 'crypto' | 'gold'
  | 'bond' | 'sbn' | 'time_deposit' | 'forex' | 'p2p' | 'pension' | 'business'

export function isUsStock(inv: Pick<Investment, 'category' | 'currency'>): boolean {
  return inv.category === 'stock' && (inv.currency ?? '').toUpperCase() === 'USD'
}

export function assetClassKey(inv: Pick<Investment, 'category' | 'currency'>): AssetClassKey {
  if (inv.category === 'stock') return isUsStock(inv) ? 'stock_us' : 'stock_idx'
  return inv.category as AssetClassKey
}

export const ASSET_CLASS_META: Record<AssetClassKey, { label: string; color: string }> = {
  stock_idx:    { label: 'Saham IHSG', color: '#10B981' },
  stock_us:     { label: 'Saham US',   color: '#0EA5E9' },
  mutual_fund:  { label: 'Reksa Dana', color: '#F59E0B' },
  crypto:       { label: 'Crypto',     color: '#8B5CF6' },
  gold:         { label: 'Emas',       color: '#EAB308' },
  bond:         { label: 'Obligasi',   color: '#F43F5E' },
  sbn:          { label: 'SBN Ritel',  color: '#EF4444' },
  time_deposit: { label: 'Deposito',   color: '#14B8A6' },
  forex:        { label: 'Valas',      color: '#6366F1' },
  p2p:          { label: 'P2P Lending', color: '#EC4899' },
  pension:      { label: 'Dana Pensiun', color: '#64748B' },
  business:     { label: 'Bisnis',     color: '#737373' },
}

/** Stable display order (matches the donut/kinerja legend). */
export const ASSET_CLASS_ORDER: AssetClassKey[] = [
  'stock_idx', 'stock_us', 'mutual_fund', 'crypto', 'gold',
  'bond', 'sbn', 'time_deposit', 'forex', 'p2p', 'pension', 'business',
]
