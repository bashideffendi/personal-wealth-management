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

/**
 * CANONICAL asset-class palette — the ONE source of truth for class colors
 * (cards, donut, chips, movers all read this; the per-slug gradient palette
 * in investment-visual.ts was retired after it diverged for 9/11 classes).
 * No red/coral family here on purpose: red is reserved app-wide for LOSS,
 * so an asset class must never wear it (Obligasi used to be #D2495A).
 *
 * F10: 12 kelas diturunkan dari keluarga warna logo (teal/biru/ungu — coral
 * tetap haram di sini) + emas muted (afordansi "Emas") + netral. Hex literal
 * dipertahankan (dipakai konteks non-CSS-var, lihat F0c).
 */
export const ASSET_CLASS_META: Record<AssetClassKey, { label: string; color: string }> = {
  stock_idx:    { label: 'Saham IHSG', color: '#17b890' },
  stock_us:     { label: 'Saham US',   color: '#5d6fe0' },
  mutual_fund:  { label: 'Reksa Dana', color: '#8b4fb0' },
  crypto:       { label: 'Crypto',     color: '#6d3a92' },
  gold:         { label: 'Emas',       color: '#C89B3C' },
  bond:         { label: 'Obligasi',   color: '#8B97F0' },
  sbn:          { label: 'SBN Ritel',  color: '#4350C2' },
  time_deposit: { label: 'Deposito',   color: '#0F6E56' },
  forex:        { label: 'Valas',      color: '#5DCAA5' },
  p2p:          { label: 'P2P Lending', color: '#B07FD6' },
  pension:      { label: 'Dana Pensiun', color: '#6B7280' },
  business:     { label: 'Bisnis',     color: '#3F3F46' },
}

/** Stable display order (matches the donut/kinerja legend). */
export const ASSET_CLASS_ORDER: AssetClassKey[] = [
  'stock_idx', 'stock_us', 'mutual_fund', 'crypto', 'gold',
  'bond', 'sbn', 'time_deposit', 'forex', 'p2p', 'pension', 'business',
]
