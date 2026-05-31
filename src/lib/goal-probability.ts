/**
 * Goal Probability — Monte Carlo simulation untuk hitung peluang
 * tujuan finansial tercapai pada deadline.
 *
 * Pure function — input goal params + assumptions, output probability +
 * distribusi statistik. Bisa di-test, ngga touch DB.
 *
 * Asumsi default disesuaikan dengan IDR market:
 *   - Konservatif (RDPU/deposito): 5% return, 1% stdev
 *   - Moderat (RD campuran/SBN): 8% return, 8% stdev
 *   - Agresif (saham/RD saham): 11% return, 18% stdev
 *
 * Stdev = annualized standard deviation of returns (volatility).
 */

export type RiskProfile = 'tabungan' | 'conservative' | 'moderate' | 'aggressive'

export interface MarketAssumptions {
  /** Annualized expected return (e.g., 0.08 for 8%) */
  annualReturn: number
  /** Annualized standard deviation (volatility) */
  annualStdev: number
}

export const RISK_PROFILES: Record<RiskProfile, MarketAssumptions & { label: string; description: string }> = {
  tabungan: {
    annualReturn: 0.025,
    annualStdev: 0.003,
    label: 'Tabungan',
    description: 'Tabungan/deposito biasa. Nyaris tanpa imbal hasil, tanpa risiko. Asumsi paling jujur kalau dana gak diinvestasiin.',
  },
  conservative: {
    annualReturn: 0.05,
    annualStdev: 0.01,
    label: 'Konservatif',
    description: 'Deposito, RDPU, SBN ritel. Return rendah, hampir nol risiko.',
  },
  moderate: {
    annualReturn: 0.08,
    annualStdev: 0.08,
    label: 'Moderat',
    description: 'Reksa dana campuran, SBN. Balance growth & stability.',
  },
  aggressive: {
    annualReturn: 0.11,
    annualStdev: 0.18,
    label: 'Agresif',
    description: 'Saham, RD saham, kripto. Return tinggi, volatil.',
  },
}

export interface ProbabilityInput {
  /** Current saved amount */
  current: number
  /** Target amount to reach */
  target: number
  /** Months until deadline */
  monthsLeft: number
  /** Monthly contribution */
  monthlyContribution: number
  /** Market assumptions */
  assumptions: MarketAssumptions
  /** Number of simulation paths (default 5000 — fast, accurate enough) */
  simulations?: number
  /** Optional seeded RNG for deterministic results (default Math.random) */
  rng?: () => number
}

export interface ProbabilityResult {
  /** % of simulation paths that hit target by deadline (0-100) */
  probability: number
  /** Median final value across all simulations */
  medianFinal: number
  /** 10th percentile (pessimistic scenario) */
  p10Final: number
  /** 90th percentile (optimistic scenario) */
  p90Final: number
  /** Required monthly contribution to hit target with 90% probability */
  requiredMonthlyFor90: number
}

/**
 * Box-Muller transform: 2 uniform [0,1) → standard normal samples.
 * We only need one per call; the second is discarded.
 */
function randomNormal(rng: () => number = Math.random): number {
  const u1 = rng()
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2)
}

/**
 * Seedable PRNG (mulberry32) + string→seed hash. Dipakai biar probabilitas
 * deterministik per state goal — gak goyang antar-reload (84% tetep 84%),
 * tapi berubah pas current/target/deadline berubah.
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return function () {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seedFromString(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Run a single simulation path.
 * Each month: apply random return + add contribution.
 */
function simulatePath(
  startBalance: number,
  monthlyContribution: number,
  monthsLeft: number,
  monthlyReturn: number,
  monthlyStdev: number,
  rng: () => number = Math.random,
): number {
  let balance = startBalance
  for (let m = 0; m < monthsLeft; m++) {
    const r = monthlyReturn + monthlyStdev * randomNormal(rng)
    balance = balance * (1 + r) + monthlyContribution
  }
  return balance
}

/**
 * Run Monte Carlo simulation and return probability + statistics.
 *
 * If monthsLeft is 0 or negative, returns deterministic result based on
 * whether current ≥ target.
 */
export function computeGoalProbability(input: ProbabilityInput): ProbabilityResult {
  const {
    current, target, monthsLeft, monthlyContribution, assumptions,
    simulations = 5000, rng = Math.random,
  } = input

  // Edge: deadline passed
  if (monthsLeft <= 0) {
    const reached = current >= target
    return {
      probability: reached ? 100 : 0,
      medianFinal: current,
      p10Final: current,
      p90Final: current,
      requiredMonthlyFor90: 0,
    }
  }

  // Edge: target already reached
  if (current >= target) {
    return {
      probability: 100,
      medianFinal: current,
      p10Final: current,
      p90Final: current,
      requiredMonthlyFor90: 0,
    }
  }

  const monthlyReturn = assumptions.annualReturn / 12
  const monthlyStdev = assumptions.annualStdev / Math.sqrt(12)

  const finals: number[] = []
  let successCount = 0

  for (let i = 0; i < simulations; i++) {
    const finalBalance = simulatePath(current, monthlyContribution, monthsLeft, monthlyReturn, monthlyStdev, rng)
    finals.push(finalBalance)
    if (finalBalance >= target) successCount++
  }

  // Sort for percentile lookups
  finals.sort((a, b) => a - b)
  const p10Final = finals[Math.floor(simulations * 0.10)]
  const median = finals[Math.floor(simulations * 0.50)]
  const p90Final = finals[Math.floor(simulations * 0.90)]
  const probability = (successCount / simulations) * 100

  // Compute required monthly contribution for 90% success — binary search
  // Range: 0 to 5× current contribution (cap so we don't search forever)
  const upperBound = Math.max(monthlyContribution * 5, target / monthsLeft)
  const requiredMonthlyFor90 = findRequiredContribution(
    current, target, monthsLeft, monthlyReturn, monthlyStdev,
    monthlyContribution, upperBound, rng,
  )

  return {
    probability,
    medianFinal: median,
    p10Final,
    p90Final,
    requiredMonthlyFor90,
  }
}

/**
 * Binary search for the monthly contribution that gives ~90% success rate.
 * Uses 1000 sims per try (less than the main run, fast enough).
 */
function findRequiredContribution(
  current: number, target: number, monthsLeft: number,
  monthlyReturn: number, monthlyStdev: number,
  currentContribution: number, upperBound: number,
  rng: () => number = Math.random,
): number {
  // Quick check: if current contribution already gives 90%+, return it
  let lo = 0
  let hi = upperBound
  for (let iter = 0; iter < 8; iter++) {
    const mid = (lo + hi) / 2
    let successes = 0
    const sims = 800
    for (let i = 0; i < sims; i++) {
      const final = simulatePath(current, mid, monthsLeft, monthlyReturn, monthlyStdev, rng)
      if (final >= target) successes++
    }
    const prob = successes / sims
    if (prob >= 0.90) hi = mid
    else lo = mid
  }
  return Math.round((lo + hi) / 2)
}

/**
 * Map a goal category to a suggested risk tier (BPT layer).
 * Used for the Multi-Goal Pyramid view & probability defaults.
 */
export function suggestedRiskProfile(category: string, monthsLeft: number): RiskProfile {
  // Short horizon → conservative regardless
  if (monthsLeft <= 24) return 'conservative'
  // Long horizon (>10y) → aggressive OK for growth-oriented goals
  if (monthsLeft >= 120) {
    if (['retirement', 'business', 'wedding'].includes(category)) return 'aggressive'
    return 'moderate'
  }
  // Mid horizon: depends on goal type
  if (['emergency', 'travel', 'gadget'].includes(category)) return 'conservative'
  if (['retirement', 'business'].includes(category)) return 'aggressive'
  return 'moderate'
}

/**
 * Map goal category → BPT pyramid layer.
 *   Pelindung: foundation (emergency, short-term essentials)
 *   Pertumbuhan: mid-term goals with steady growth
 *   Mimpi: long-term high-growth ambitions
 */
export type PyramidLayer = 'pelindung' | 'pertumbuhan' | 'mimpi'

export const PYRAMID_LAYERS: Record<PyramidLayer, { label: string; description: string; color: string; emoji: string }> = {
  pelindung: {
    label: 'Aman',
    description: 'Dasar piramida — dana darurat, kebutuhan dekat, proteksi. Amankan ini dulu.',
    color: '#10B981', // mint — fondasi/positif
    emoji: '🛡️',
  },
  pertumbuhan: {
    label: 'Bertumbuh',
    description: 'Tengah — DP rumah, dana pendidikan, pensiun, nikah.',
    color: '#8B5CF6', // violet
    emoji: '📈',
  },
  mimpi: {
    label: 'Ambisi',
    description: 'Puncak — bisnis, liburan impian, gadget. Kejar setelah fondasi aman.',
    color: '#F59E0B', // amber
    emoji: '🚀',
  },
}

export function categoryToPyramidLayer(category: string): PyramidLayer {
  if (['emergency', 'education', 'other'].includes(category)) return 'pelindung'
  if (['property', 'vehicle', 'retirement', 'wedding'].includes(category)) return 'pertumbuhan'
  // travel, gadget, business → mimpi
  return 'mimpi'
}
