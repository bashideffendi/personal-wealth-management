import type { StockTransaction } from '@/types'

/**
 * FIFO realized P/L lintas semua transaksi saham (di-group per ticker).
 *
 * - Cost basis tiap lot BELI sudah memasukkan fee beli (amortisasi per-lembar:
 *   `price + fee/shares`) — biar realized gain gak overstate.
 * - Saat lot dijual, fee jual dikurangkan proporsional terhadap lembar yang
 *   dipakai dari sell itu.
 * - Lot dikonsumsi FIFO (transaksi diurut tanggal naik per ticker).
 *
 * Pure function — gak nyentuh DB. Diekstrak dari stock-log-panel biar bisa diuji.
 */
export function computeRealizedPL(txs: StockTransaction[]): number {
  const byTicker: Record<string, StockTransaction[]> = {}
  for (const t of txs) {
    const k = t.ticker ?? 'unknown'
    if (!byTicker[k]) byTicker[k] = []
    byTicker[k].push(t)
  }
  let total = 0
  for (const group of Object.values(byTicker)) {
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date))
    const lots: { shares: number; cost: number }[] = []
    for (const t of sorted) {
      if (t.side === 'buy') {
        lots.push({ shares: t.shares, cost: t.price + (t.shares > 0 ? t.fee / t.shares : 0) })
      } else {
        let remaining = t.shares
        while (remaining > 0 && lots.length > 0) {
          const lot = lots[0]
          const take = Math.min(lot.shares, remaining)
          total += take * (t.price - lot.cost) - (t.fee * (take / t.shares))
          lot.shares -= take
          remaining -= take
          if (lot.shares <= 0) lots.shift()
        }
      }
    }
  }
  return total
}
