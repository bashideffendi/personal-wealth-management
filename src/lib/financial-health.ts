/**
 * Financial Health Score (FHS) — adaptasi dari FinHealth Network
 * methodology (Financial Health Network / CFSI 2016, refined 2024)
 * untuk konteks Indonesia.
 *
 * Score 0-100 yg gabungkan 8 indikator dalam 4 komponen (Spend, Save,
 * Borrow, Plan). Tier:
 *   - Vulnerable  < 40
 *   - Coping     40-59
 *   - Healthy    60-79
 *   - Thriving   80+
 *
 * Filosofi: scorer ini "best-effort" — kalau data ngga lengkap, indikator
 * jadi N/A (0% bobot) bukan dianggap nol. Itu supaya skor user yg baru
 * mulai pake app ngga langsung kelihatan jelek karena data kurang.
 *
 * Algorithm reference: Financial Health Network (2024) FinHealth Score
 * Methodology + adaptasi indikator Indonesia (BPJS, asuransi swasta,
 * SBN/RD sebagai long-term savings).
 */

export interface FHSInput {
  // ─── Cashflow (Spend component) ──────────────────────────────────
  /** Monthly avg income — last 90 days / 3 */
  monthlyIncome: number
  /** Monthly avg expense — last 90 days / 3 */
  monthlyExpense: number
  /** Monthly avg saving + investment contribution */
  monthlySaved: number

  // ─── Buffer (Save component) ─────────────────────────────────────
  /** Sum of liquid accounts: cash + bank + digital wallet */
  liquidBalance: number
  /** Sum of investments.total_value (long-term assets) */
  investmentValue: number

  // ─── Debt (Borrow component) ─────────────────────────────────────
  /** Total outstanding: credit cards + other debts */
  totalDebt: number
  /** Sum of monthly minimum payments on all debts */
  monthlyDebtPayments: number
  /** Any overdue debt or maxed-out (>90% util) credit card */
  hasOverdueDebt: boolean

  // ─── Plan ───────────────────────────────────────────────────────
  /** Number of active insurance contracts (BPJS/health/life/property) */
  insuranceCount: number
  /** Active goals with progress data */
  activeGoals: { current: number; target: number; deadline: string | null }[]

  // ─── Optional context ───────────────────────────────────────────
  /** User age — used to scale long-term savings target. Defaults to mid-career assumption. */
  userAge?: number
}

export type FHSTier = 'vulnerable' | 'coping' | 'healthy' | 'thriving'
export type FHSStatus = 'good' | 'warning' | 'poor' | 'na'

export interface FHSIndicator {
  key: string
  label: string
  /** Display category — one of: Spend / Save / Borrow / Plan */
  group: 'Spend' | 'Save' | 'Borrow' | 'Plan'
  /** 0-100 — how well user is doing on this indicator */
  score: number
  /** 0-1 — weight in total */
  weight: number
  /** Computed: score × weight */
  weighted: number
  status: FHSStatus
  /** Short Indonesian tip if score < 60 — what user can do to improve */
  tip?: string
  /** Helpful one-liner explaining the indicator */
  explainer: string
}

export interface FHSResult {
  score: number  // 0-100, weighted average of indicators (excluding N/A)
  tier: FHSTier
  breakdown: FHSIndicator[]
  /** Sum of weights actually used (exclude N/A indicators) */
  effectiveWeight: number
  /** Indonesian-friendly tier label & color guidance */
  tierMeta: {
    label: string
    color: string
    description: string
  }
}

/**
 * Tier metadata used for display. Indonesian labels for clarity (English
 * "Coping" was confusing — user feedback). Colors match PWM palette.
 */
const TIER_META: Record<FHSTier, { label: string; color: string; description: string }> = {
  vulnerable: {
    label: 'Rentan',
    color: '#F43F5E',
    description: 'Keuangan rentan — fokus stabilkan cashflow & buffer dulu.',
  },
  coping: {
    label: 'Bertahan',
    color: '#F59E0B',
    description: 'Bertahan, tapi belum aman. Ada beberapa area yg perlu diperkuat.',
  },
  healthy: {
    label: 'Sehat',
    color: '#10B981',
    description: 'Sehat secara finansial — pertahankan & mulai pikirkan growth.',
  },
  thriving: {
    label: 'Prima',
    color: '#10B981',
    description: 'Kondisi prima. Optimasi pajak & estate planning mungkin next step.',
  },
}

function tierFor(score: number): FHSTier {
  if (score >= 80) return 'thriving'
  if (score >= 60) return 'healthy'
  if (score >= 40) return 'coping'
  return 'vulnerable'
}

function statusFor(score: number): FHSStatus {
  if (score < 0) return 'na'
  if (score >= 75) return 'good'
  if (score >= 50) return 'warning'
  return 'poor'
}

/** Long-term savings target ratio (× annual income) by age bracket */
function targetSavingsRatio(age?: number): number {
  if (age == null) return 3  // mid-career default
  if (age < 30) return 1
  if (age < 40) return 3
  if (age < 50) return 6
  if (age < 60) return 8
  return 10
}

/** Score a goal's on-track status — 100 if ahead, drops if behind deadline */
function scoreGoal(g: { current: number; target: number; deadline: string | null }): number {
  if (g.target <= 0) return 50
  const pct = g.current / g.target
  if (!g.deadline) {
    // No deadline → just look at progress %
    return Math.min(100, pct * 100)
  }
  const now = new Date()
  const deadline = new Date(g.deadline)
  const monthsLeft = Math.max(
    0,
    (deadline.getFullYear() - now.getFullYear()) * 12 + (deadline.getMonth() - now.getMonth()),
  )
  // If deadline passed: score based on completion
  if (monthsLeft === 0) return Math.min(100, pct * 100)
  // Required pace assumes started at goal creation; we don't track that, so
  // proxy: target rate = remaining / monthsLeft is OK as a snapshot.
  // We use a simpler heuristic: pct must be ≥ (1 - monthsLeft / 24) — i.e.,
  // if you have 12 months left and you're at 50%, you're on track.
  const expectedPct = Math.max(0, 1 - monthsLeft / 24)
  if (pct >= expectedPct) return 100
  if (expectedPct === 0) return 100
  return Math.min(100, (pct / expectedPct) * 100)
}

/**
 * Compute the FHS score for a user based on all available data.
 *
 * Weights total to 1.0 across all 8 indicators, but if data is missing
 * for any, that indicator is marked N/A (status='na', score=-1) and
 * excluded from the weighted average — preventing missing data from
 * unfairly tanking the score.
 */
export function computeFinancialHealth(input: FHSInput): FHSResult {
  const indicators: FHSIndicator[] = []

  // ─── 1. Savings Rate (15%) ─────────────────────────────────────
  // % income that gets saved/invested. Industry healthy: ≥20%.
  if (input.monthlyIncome > 0) {
    const rate = input.monthlySaved / input.monthlyIncome
    let score = 0
    if (rate >= 0.30) score = 100
    else if (rate >= 0.20) score = 85
    else if (rate >= 0.15) score = 70
    else if (rate >= 0.10) score = 55
    else if (rate >= 0.05) score = 35
    else if (rate > 0) score = 20
    indicators.push({
      key: 'savings-rate',
      label: 'Savings Rate',
      group: 'Spend',
      score,
      weight: 0.15,
      weighted: score * 0.15,
      status: statusFor(score),
      explainer: `Kamu nabung & investasi ${(rate * 100).toFixed(1)}% dari pendapatan bulanan.`,
      tip: score < 60 ? 'Targetin minimal 20% income untuk tabungan + investasi (50/30/20 rule).' : undefined,
    })
  } else {
    indicators.push({
      key: 'savings-rate',
      label: 'Savings Rate',
      group: 'Spend',
      score: -1, weight: 0.15, weighted: 0, status: 'na',
      explainer: 'Belum ada data pendapatan. Catat income kamu dulu.',
    })
  }

  // ─── 2. Liquid Buffer (20%) ────────────────────────────────────
  // Tabungan likuid vs pengeluaran bulanan. Standar: 3-6×.
  if (input.monthlyExpense > 0) {
    const ratio = input.liquidBalance / input.monthlyExpense
    let score = 0
    if (ratio >= 6) score = 100
    else if (ratio >= 3) score = 80
    else if (ratio >= 1.5) score = 55
    else if (ratio >= 0.5) score = 30
    else if (ratio > 0) score = 15
    indicators.push({
      key: 'liquid-buffer',
      label: 'Dana Darurat',
      group: 'Save',
      score,
      weight: 0.20,
      weighted: score * 0.20,
      status: statusFor(score),
      explainer: `Saldo likuid kamu cukup buat ${ratio.toFixed(1)} bulan pengeluaran.`,
      tip: score < 60 ? 'Target ideal 3-6× pengeluaran bulanan di tabungan/RDPU/deposito.' : undefined,
    })
  } else {
    indicators.push({
      key: 'liquid-buffer',
      label: 'Dana Darurat',
      group: 'Save',
      score: -1, weight: 0.20, weighted: 0, status: 'na',
      explainer: 'Belum ada data pengeluaran untuk hitung target buffer.',
    })
  }

  // ─── 3. DTI / DSR (10%) ────────────────────────────────────────
  // Total monthly debt payment / income. OJK guideline: ≤30-35%.
  if (input.monthlyIncome > 0) {
    const dti = input.monthlyDebtPayments / input.monthlyIncome
    let score = 0
    if (input.totalDebt === 0) score = 100  // no debt = perfect
    else if (dti < 0.20) score = 100
    else if (dti < 0.30) score = 80
    else if (dti < 0.36) score = 60
    else if (dti < 0.45) score = 35
    else score = 10
    indicators.push({
      key: 'dti',
      label: 'Debt-to-Income',
      group: 'Borrow',
      score,
      weight: 0.10,
      weighted: score * 0.10,
      status: statusFor(score),
      explainer: input.totalDebt === 0
        ? 'Bebas utang — keren!'
        : `Cicilan kamu ${(dti * 100).toFixed(1)}% dari income bulanan (target ≤36%).`,
      tip: score < 60 ? 'Cicilan total >36% income = high risk. Pertimbangkan refinance atau debt consolidation.' : undefined,
    })
  } else {
    indicators.push({
      key: 'dti', label: 'Debt-to-Income', group: 'Borrow',
      score: -1, weight: 0.10, weighted: 0, status: 'na',
      explainer: 'Belum bisa dihitung — perlu data income.',
    })
  }

  // ─── 4. Debt Status (10%) ──────────────────────────────────────
  // Ada utang macet / kartu kredit maxed-out?
  {
    let score: number
    if (input.totalDebt === 0) score = 100
    else if (input.hasOverdueDebt) score = 0
    else score = 90
    indicators.push({
      key: 'debt-status',
      label: 'Status Utang',
      group: 'Borrow',
      score,
      weight: 0.10,
      weighted: score * 0.10,
      status: statusFor(score),
      explainer: input.totalDebt === 0
        ? 'Tidak ada utang aktif.'
        : input.hasOverdueDebt
          ? 'Ada utang macet atau kartu kredit hampir maxed-out.'
          : 'Utang aktif tapi terkelola — semua dalam batas wajar.',
      tip: input.hasOverdueDebt ? 'Prioritas #1: lunasi utang yg overdue dulu — bunga & denda menumpuk cepat.' : undefined,
    })
  }

  // ─── 5. Insurance Coverage (10%) ───────────────────────────────
  // Punya min 2 polis (kesehatan + jiwa)? BPJS Kesehatan + lainnya.
  {
    let score = 0
    if (input.insuranceCount >= 2) score = 100
    else if (input.insuranceCount === 1) score = 55
    indicators.push({
      key: 'insurance',
      label: 'Asuransi',
      group: 'Plan',
      score,
      weight: 0.10,
      weighted: score * 0.10,
      status: statusFor(score),
      explainer: input.insuranceCount === 0
        ? 'Belum ada polis asuransi tercatat.'
        : `${input.insuranceCount} polis asuransi aktif.`,
      tip: score < 60 ? 'Minimal punya BPJS Kesehatan + 1 asuransi tambahan (jiwa/kesehatan swasta).' : undefined,
    })
  }

  // ─── 6. Long-Term Savings (15%) ────────────────────────────────
  // Investasi (saham, RD, SBN, emas) vs annual income.
  // Target ratio scales by age (younger = lower target).
  if (input.monthlyIncome > 0) {
    const annualIncome = input.monthlyIncome * 12
    const target = targetSavingsRatio(input.userAge)
    const ratio = input.investmentValue / annualIncome
    const score = Math.min(100, Math.round((ratio / target) * 100))
    indicators.push({
      key: 'long-term-savings',
      label: 'Investasi Jangka Panjang',
      group: 'Save',
      score,
      weight: 0.15,
      weighted: score * 0.15,
      status: statusFor(score),
      explainer: `Aset investasi kamu ${ratio.toFixed(1)}× annual income (target umur kamu: ${target}×).`,
      tip: score < 60 ? `Targetin investasi minimal ${target}× annual income — DCA via reksa dana cocok untuk pemula.` : undefined,
    })
  } else {
    indicators.push({
      key: 'long-term-savings', label: 'Investasi Jangka Panjang', group: 'Save',
      score: -1, weight: 0.15, weighted: 0, status: 'na',
      explainer: 'Belum bisa dihitung — perlu data income.',
    })
  }

  // ─── 7. Goal Planning (20%) ────────────────────────────────────
  // Punya goal aktif & on-track?
  if (input.activeGoals.length > 0) {
    const avgScore = input.activeGoals.reduce((s, g) => s + scoreGoal(g), 0) / input.activeGoals.length
    const score = Math.round(avgScore)
    indicators.push({
      key: 'goal-progress',
      label: 'Progress Goal',
      group: 'Plan',
      score,
      weight: 0.20,
      weighted: score * 0.20,
      status: statusFor(score),
      explainer: `${input.activeGoals.length} goal aktif, rata-rata ${score}% on-track.`,
      tip: score < 60 ? 'Beberapa goal di belakang jadwal — review deadline atau naikkan kontribusi bulanan.' : undefined,
    })
  } else {
    indicators.push({
      key: 'goal-progress',
      label: 'Progress Goal',
      group: 'Plan',
      score: 30,  // Soft penalty for not having goals — encourages user to set them
      weight: 0.20,
      weighted: 30 * 0.20,
      status: 'warning',
      explainer: 'Belum ada goal aktif.',
      tip: 'Set minimal 1 goal (DP rumah, dana darurat, dll) untuk arahin tabungan.',
    })
  }

  // ─── Compute weighted total ────────────────────────────────────
  const usedIndicators = indicators.filter((i) => i.status !== 'na')
  const effectiveWeight = usedIndicators.reduce((s, i) => s + i.weight, 0)
  const score = effectiveWeight > 0
    ? Math.round(usedIndicators.reduce((s, i) => s + i.weighted, 0) / effectiveWeight)
    : 0

  const tier = tierFor(score)

  return {
    score,
    tier,
    breakdown: indicators,
    effectiveWeight,
    tierMeta: TIER_META[tier],
  }
}
