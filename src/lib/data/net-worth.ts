/**
 * Rumus KANONIK kekayaan bersih — satu-satunya tempat aturan ini ditulis.
 * Dulu disalin di 6 tempat (dashboard, Akun, Net Worth + snapshot client,
 * laporan bulanan, cron snapshot); household membaca hasil snapshot.
 *
 *   aset       = likuid (accounts.current_balance + assets_liquid.balance,
 *                termasuk piutang) + assets_non_liquid.current_value
 *                + investments.total_value
 *   kewajiban  = debts.remaining (is_active) + credit_cards.current_balance
 *                (is_active) — kartu = meteran utang (lihat AGENTS.md)
 *
 * Filter is_active dilakukan di query pemanggil; fungsi ini murni aritmetika.
 */

export type NetWorthParts = {
  liquid: number
  nonLiquid: number
  investments: number
  debts: number
  creditCards: number
}

export type NetWorth = { assets: number; liabilities: number; netWorth: number }

export function computeNetWorth(p: NetWorthParts): NetWorth {
  const assets = (p.liquid || 0) + (p.nonLiquid || 0) + (p.investments || 0)
  const liabilities = (p.debts || 0) + (p.creditCards || 0)
  return { assets, liabilities, netWorth: assets - liabilities }
}

/** Jumlahkan satu kolom angka dari baris DB (null/undefined = 0). */
export function sumField<K extends string>(
  rows: ReadonlyArray<Partial<Record<K, number | null>>> | null | undefined,
  field: K,
): number {
  return (rows ?? []).reduce((s, r) => s + (Number(r[field]) || 0), 0)
}
