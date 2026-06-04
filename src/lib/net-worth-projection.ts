import { simulatePayoff, type PayoffDebt } from './debt-payoff'

export interface ProjectionPoint {
  month: number // bulan ke- dari sekarang (0 = sekarang)
  debt: number // sisa utang di bulan itu
  netWorth: number // proyeksi kekayaan bersih (aset tetap)
}

export interface NetWorthProjection {
  points: ProjectionPoint[]
  months: number // bulan sampai bebas utang
  totalInterest: number
  feasible: boolean
  startNetWorth: number // net worth sekarang
  endNetWorth: number // net worth saat bebas utang (= total aset)
}

/**
 * Proyeksi kekayaan bersih saat utang dilunasi.
 * Asumsi sederhana: aset di luar utang TETAP (no apresiasi/depresiasi) — ini
 * prediksi konservatif, bukan janji. netWorth(bulan) = totalAssets − sisa utang(bulan),
 * sisa utang per bulan dari engine simulatePayoff (bunga majemuk bulanan, nyata).
 */
export function projectNetWorth(
  totalAssets: number,
  debts: PayoffDebt[],
  strategy: 'snowball' | 'avalanche',
  extra = 0,
): NetWorthProjection {
  const startDebt = debts.reduce((s, d) => s + Math.max(0, d.remaining), 0)
  const sim = simulatePayoff(debts, strategy, extra)
  const points: ProjectionPoint[] = [
    { month: 0, debt: startDebt, netWorth: totalAssets - startDebt },
  ]
  for (const t of sim.timeline) {
    const debt = Math.max(0, t.remaining)
    points.push({ month: t.month, debt, netWorth: totalAssets - debt })
  }
  return {
    points,
    months: sim.months,
    totalInterest: sim.totalInterest,
    feasible: sim.feasible,
    startNetWorth: totalAssets - startDebt,
    endNetWorth: totalAssets,
  }
}
