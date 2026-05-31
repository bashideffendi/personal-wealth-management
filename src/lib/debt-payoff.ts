/**
 * Debt payoff simulation — month-by-month, bunga majemuk bulanan.
 * Snowball (saldo terkecil dulu) vs Avalanche (bunga tertinggi dulu).
 * Cicilan dari utang yang udah lunas otomatis di-roll ke utang prioritas.
 *
 * Pure function, gak nyentuh DB. Angka payoff date + total bunga = hasil
 * simulasi nyata dari data utang, bukan dummy.
 */

export interface PayoffDebt {
  id: string
  name: string
  remaining: number
  interest_rate: number // % per tahun
  monthly_payment: number
}

export interface PayoffResult {
  order: { id: string; name: string; key: string }[] // urutan prioritas (label = bunga/saldo)
  months: number                  // total bulan sampai semua lunas (MAX = gak lunas)
  totalInterest: number
  perDebt: Record<string, number> // id -> bulan ke- lunas
  timeline: { month: number; remaining: number }[]
  events: { month: number; name: string }[] // event "X lunas"
  feasible: boolean               // false kalau ada utang yg cicilannya < bunga (gak akan lunas)
}

const MAX_MONTHS = 600 // cap 50 tahun

export function simulatePayoff(
  debts: PayoffDebt[],
  strategy: 'snowball' | 'avalanche',
  extra = 0,
): PayoffResult {
  const ds = debts
    .filter((d) => d.remaining > 0)
    .map((d) => ({ ...d, bal: d.remaining }))

  const priority = (a: { bal: number; interest_rate: number }, b: { bal: number; interest_rate: number }) =>
    strategy === 'snowball' ? a.bal - b.bal : b.interest_rate - a.interest_rate

  const order = [...ds].sort(priority).map((d) => ({
    id: d.id,
    name: d.name,
    key: strategy === 'snowball' ? formatRp(d.remaining) : `${d.interest_rate}%`,
  }))

  if (ds.length === 0) {
    return { order: [], months: 0, totalInterest: 0, perDebt: {}, timeline: [], events: [], feasible: true }
  }

  const baseMin = ds.reduce((s, d) => s + d.monthly_payment, 0)
  const budget = baseMin + extra
  const perDebt: Record<string, number> = {}
  const timeline: { month: number; remaining: number }[] = []
  const events: { month: number; name: string }[] = []
  let totalInterest = 0
  let month = 0

  while (ds.some((d) => d.bal > 0.01) && month < MAX_MONTHS) {
    month++
    // 1. Akru bunga bulanan
    for (const d of ds) {
      if (d.bal > 0) {
        const i = d.bal * (d.interest_rate / 100 / 12)
        d.bal += i
        totalInterest += i
      }
    }
    // 2. Bayar minimum tiap utang aktif
    let leftover = budget
    for (const d of ds) {
      if (d.bal <= 0) continue
      const pay = Math.min(d.monthly_payment, d.bal)
      d.bal -= pay
      leftover -= pay
    }
    // 3. Sisa budget (ekstra + cicilan utang lunas) → utang prioritas
    const activeOrdered = ds.filter((d) => d.bal > 0).sort(priority)
    for (const d of activeOrdered) {
      if (leftover <= 0) break
      const pay = Math.min(leftover, d.bal)
      d.bal -= pay
      leftover -= pay
    }
    // 4. Catat event lunas
    for (const d of ds) {
      if (d.bal <= 0.01 && !perDebt[d.id]) {
        perDebt[d.id] = month
        events.push({ month, name: d.name })
      }
    }
    timeline.push({ month, remaining: ds.reduce((s, d) => s + Math.max(0, d.bal), 0) })
  }

  const feasible = month < MAX_MONTHS
  return { order, months: month, totalInterest, perDebt, timeline, events, feasible }
}

function formatRp(n: number): string {
  if (n >= 1e9) return `Rp${(n / 1e9).toFixed(1)}M`
  if (n >= 1e6) return `Rp${Math.round(n / 1e6)}jt`
  return `Rp${Math.round(n / 1e3)}rb`
}
