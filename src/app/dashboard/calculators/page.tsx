'use client'

import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Home, Shield, GraduationCap, Landmark, TrendingUp, Receipt, Coins,
  ArrowRight, Target, Loader2, type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useT } from '@/lib/i18n/context'

const VIOLET = 'var(--c-violet)', MINT = 'var(--c-mint)', AMBER = 'var(--c-amber)', CORAL = 'var(--c-coral)'
const VIOLET_INK = 'var(--c-violet-ink)', MINT_INK = 'var(--c-mint-ink)', AMBER_INK = 'var(--c-amber-ink)', CORAL_INK = 'var(--c-coral-ink)'
const tint = (c: string, p: number) => `color-mix(in srgb, ${c} ${p}%, transparent)`

type CalcKey = 'kpr' | 'pensiun' | 'pendidikan' | 'bpjs' | 'dca' | 'pajak' | 'zakat'
const CALCS: { key: CalcKey; titleKey: string; descKey: string; icon: LucideIcon; color: string; ink: string }[] = [
  { key: 'kpr', titleKey: 'card_kpr_title', descKey: 'card_kpr_desc', icon: Home, color: VIOLET, ink: VIOLET_INK },
  { key: 'pensiun', titleKey: 'card_pensiun_title', descKey: 'card_pensiun_desc', icon: Shield, color: MINT, ink: MINT_INK },
  { key: 'pendidikan', titleKey: 'card_pendidikan_title', descKey: 'card_pendidikan_desc', icon: GraduationCap, color: AMBER, ink: AMBER_INK },
  { key: 'bpjs', titleKey: 'card_bpjs_title', descKey: 'card_bpjs_desc', icon: Landmark, color: MINT, ink: MINT_INK },
  { key: 'dca', titleKey: 'card_dca_title', descKey: 'card_dca_desc', icon: TrendingUp, color: VIOLET, ink: VIOLET_INK },
  { key: 'pajak', titleKey: 'card_pajak_title', descKey: 'card_pajak_desc', icon: Receipt, color: CORAL, ink: CORAL_INK },
  { key: 'zakat', titleKey: 'card_zakat_title', descKey: 'card_zakat_desc', icon: Coins, color: MINT, ink: MINT_INK },
]

export default function CalculatorsPage() {
  const t = useT()
  const [selected, setSelected] = useState<CalcKey>('kpr')

  function pick(k: CalcKey) {
    setSelected(k)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="min-w-0">
        <p className="eyebrow mb-1.5">{CALCS.length} {t('calculators.eyebrow_quick_tools')}</p>
        <h1 className="leading-none" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,38px)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>{t('calculators.page_title')}</h1>
        <p className="text-sm mt-2 max-w-2xl" style={{ color: 'var(--ink-muted)' }}>{t('calculators.page_subtitle')}</p>
      </div>

      {/* Featured calculator */}
      {selected === 'kpr' ? <KprFeatured /> :
       selected === 'pensiun' ? <FireCalculator /> :
       selected === 'pendidikan' ? <KidsEducationCalculator /> :
       selected === 'bpjs' ? <PensionGapCalculator /> :
       selected === 'dca' ? <DCASimulator /> :
       selected === 'pajak' ? <TaxCalculator /> :
       <ZakatCalculator />}

      {/* Calculator gallery */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CALCS.filter((c) => c.key !== selected).map((c) => (
          <button key={c.key} type="button" onClick={() => pick(c.key)} className="s-card p-5 text-left transition hover:border-[var(--ink)]" >
            <div className="size-10 rounded-xl grid place-items-center" style={{ background: tint(c.color, 10) }}><c.icon className="size-5" style={{ color: c.ink }} /></div>
            <p className="font-semibold mt-3" style={{ color: 'var(--ink)' }}>{t(`calculators.${c.titleKey}`)}</p>
            <p className="text-[13px] mt-1 leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{t(`calculators.${c.descKey}`)}</p>
            <span className="inline-flex items-center gap-1 text-[13px] font-semibold mt-3" style={{ color: c.ink }}>{t('calculators.open_calculator')} <ArrowRight className="size-3.5" /></span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── KPR featured (slider + komposisi, gaya hero mockup) ──────────
function KprFeatured() {
  const t = useT()
  const supabase = createClient()
  const qc = useQueryClient()
  const [harga, setHarga] = useState(1_200_000_000)
  const [dpPct, setDpPct] = useState(20)
  const [tenor, setTenor] = useState(15)
  const [bunga, setBunga] = useState(7.25)
  const [creating, setCreating] = useState(false)

  const dp = Math.round(harga * dpPct / 100)
  const principal = Math.max(0, harga - dp)
  const r = bunga / 100 / 12, n = tenor * 12
  const monthly = principal > 0 && r > 0 ? (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : 0
  const total = monthly * n
  const bungaTotal = Math.max(0, total - principal)
  const pokokPct = total > 0 ? (principal / total) * 100 : 0
  const jt = formatCurrency

  async function makeGoal() {
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCreating(false); return }
    const deadline = new Date(); deadline.setFullYear(deadline.getFullYear() + 2)
    // category pakai KEY goals ('property'), bukan label — label dirender via i18n.
    const { error } = await supabase.from('goals').insert({
      user_id: user.id, name: 'DP Rumah (KPR)', category: 'property',
      target_amount: dp, current_amount: 0, deadline: deadline.toISOString().slice(0, 10),
      notes: `KPR ${formatCurrency(harga)} · tenor ${tenor} thn @ ${bunga}%`, is_active: true,
    })
    setCreating(false)
    if (error) { toast.error(t('common.mutation_failed')); return }
    qc.invalidateQueries({ queryKey: ['goals-page'] })
    toast.success(t('calculators.toast_goal_created'))
  }

  return (
    <div className="grid lg:grid-cols-2 rounded-2xl overflow-hidden border" >
      {/* Input (kiri, tinted) */}
      <div className="p-6 sm:p-7" style={{ background: 'var(--surface-2)' }}>
        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase flex items-center gap-2" style={{ color: VIOLET_INK }}>
          <span className="size-7 rounded-lg grid place-items-center" style={{ background: tint(VIOLET, 10) }}><Home className="size-4" /></span> {t('calculators.kpr_popular_badge')}
        </p>
        <p className="text-xl mt-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>{t('calculators.kpr_featured_title')}</p>
        <div className="mt-5 space-y-5">
          <div className="grid gap-1.5">
            <Label>{t('calculators.kpr_property_price')}</Label>
            <NumberInput value={harga} onChange={setHarga} placeholder="0" />
          </div>
          <Slider label={t('calculators.kpr_down_payment')} valueLabel={formatCurrency(dp)} min={10} max={50} value={dpPct} onChange={setDpPct} suffix={`${dpPct}% · 10–50`} />
          <Slider label={t('calculators.kpr_loan_tenor')} valueLabel={`${tenor} ${t('calculators.unit_years')}`} min={5} max={30} value={tenor} onChange={setTenor} suffix={t('calculators.kpr_tenor_range')} />
          <Slider label={t('calculators.kpr_interest_effective')} valueLabel={`${bunga.toFixed(2)}%`} min={4} max={15} step={0.25} value={bunga} onChange={setBunga} suffix="4–15%" />
        </div>
      </div>
      {/* Result (kanan) */}
      <div className="p-6 sm:p-7" style={{ background: 'var(--surface)' }}>
        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>{t('calculators.calc_result')}</p>
        <p className="num tabular font-bold leading-none mt-3" style={{ fontSize: 'clamp(34px,4.5vw,46px)', color: VIOLET_INK, letterSpacing: '-0.03em' }}>{formatCurrency(Math.round(monthly))}</p>
        <p className="text-sm mt-1" style={{ color: 'var(--ink-soft)' }}>{t('calculators.kpr_monthly_for')} {tenor} {t('calculators.unit_years')}</p>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{t('calculators.kpr_total_paid')}</p><p className="num font-bold mt-0.5" style={{ color: 'var(--ink)' }}>{jt(total)}</p></div>
          <div><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{t('calculators.kpr_total_interest')}</p><p className="num font-bold mt-0.5" style={{ color: CORAL_INK }}>{jt(bungaTotal)}</p></div>
          <div><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{t('calculators.kpr_principal')}</p><p className="num font-bold mt-0.5" style={{ color: 'var(--ink)' }}>{jt(principal)}</p></div>
        </div>
        <p className="text-[10px] uppercase tracking-wide mt-5 mb-1.5" style={{ color: 'var(--ink-soft)' }}>{t('calculators.kpr_payment_composition')}</p>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
          <div style={{ width: `${pokokPct}%`, background: VIOLET }} />
          <div style={{ width: `${100 - pokokPct}%`, background: CORAL }} />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[11px]">
          <span style={{ color: VIOLET_INK }}>● {t('calculators.kpr_principal')} {pokokPct.toFixed(0)}%</span>
          <span style={{ color: CORAL_INK }}>{t('calculators.kpr_interest')} {(100 - pokokPct).toFixed(0)}% ●</span>
        </div>
        <Button className="mt-5" onClick={makeGoal} disabled={creating || dp <= 0}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />} {t('calculators.kpr_make_goal')}</Button>
      </div>
    </div>
  )
}

function Slider({ label, valueLabel, suffix, min, max, step = 1, value, onChange }: {
  label: string; valueLabel: string; suffix: string; min: number; max: number; step?: number; value: number; onChange: (n: number) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="num text-sm font-semibold" style={{ color: 'var(--ink)' }}>{valueLabel}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full mt-2" style={{ accentColor: VIOLET }} />
      <p className="text-[10px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>{suffix}</p>
    </div>
  )
}

// ─── Pension Gap (BPJS JHT + JP + DPLK) ──────────
//
// Fitur unik untuk Indonesia: gabungkan estimasi 3 pilar pensiun (BPJS
// Ketenagakerjaan JHT, JP, dan DPLK sukarela) lalu tunjukin gap vs target
// replacement ratio (70-80% dari gaji terakhir).
//
// Asumsi penting:
//   - JHT: kontribusi 5.7% upah, return ~6%/thn (BPJS TK average)
//   - JP: benefit bulanan ~1% × gaji × tahun kontribusi (min Rp 354k, max Rp 4.25jt per 2024)
//   - DPLK: deductible 5% gross income, max Rp 2.4jt/thn (PMK 168/2023)
//   - Target replacement ratio default 75%
//
// Aturan & angka harus diparameterkan — bisa berubah tiap revisi UU/PMK.
function PensionGapCalculator() {
  const t = useT()
  const [currentAge, setCurrentAge] = useState(30)
  const [retireAge, setRetireAge] = useState(56)  // BPJS JHT eligibility usia 56
  const [monthlySalary, setMonthlySalary] = useState(15_000_000)
  const [yearsContributed, setYearsContributed] = useState(5)  // sudah kerja berapa tahun
  const [currentJhtBalance, setCurrentJhtBalance] = useState(0)
  const [currentDplkBalance, setCurrentDplkBalance] = useState(0)
  const [dplkMonthly, setDplkMonthly] = useState(0)
  const [replacementTarget, setReplacementTarget] = useState(75)  // % target pensiun

  const result = useMemo(() => {
    const yearsToRetire = Math.max(0, retireAge - currentAge)
    const totalYearsAtRetire = yearsContributed + yearsToRetire
    const monthsToRetire = yearsToRetire * 12

    // ── JHT estimate (lump sum at retirement) ──
    // Kontribusi: 5.7% upah/bln. Return: 6%/thn. Future value of:
    //   (a) current balance compounding
    //   (b) future contributions stream (annuity)
    const monthlyJhtContrib = monthlySalary * 0.057
    const monthlyReturn = 0.06 / 12
    const fvCurrent = currentJhtBalance * Math.pow(1 + monthlyReturn, monthsToRetire)
    const fvContrib = monthsToRetire > 0
      ? monthlyJhtContrib * (Math.pow(1 + monthlyReturn, monthsToRetire) - 1) / monthlyReturn
      : 0
    const jhtAtRetire = fvCurrent + fvContrib

    // ── JP estimate (monthly pension benefit) ──
    // Formula: 1% × gaji × tahun kontribusi, dengan floor & cap resmi.
    // Syarat manfaat BULANAN: minimal 15 tahun iuran — di bawah itu JP cair
    // sekali (lump sum) yang nilainya kecil; biar jujur dihitung 0 di sini.
    const jpEligible = totalYearsAtRetire >= 15
    const jpMonthlyRaw = 0.01 * monthlySalary * totalYearsAtRetire
    const jpMonthly = jpEligible ? Math.min(Math.max(jpMonthlyRaw, 354_310), 4_250_000) : 0

    // ── DPLK estimate ──
    const fvDplkCurrent = currentDplkBalance * Math.pow(1 + monthlyReturn, monthsToRetire)
    const fvDplkContrib = (monthsToRetire > 0 && dplkMonthly > 0)
      ? dplkMonthly * (Math.pow(1 + monthlyReturn, monthsToRetire) - 1) / monthlyReturn
      : 0
    const dplkAtRetire = fvDplkCurrent + fvDplkContrib

    // Convert lump sums (JHT + DPLK) to monthly income via 4% safe withdrawal rule
    const totalLumpSum = jhtAtRetire + dplkAtRetire
    const monthlyFromLumpSum = (totalLumpSum * 0.04) / 12

    // Total estimated monthly retirement income
    const monthlyIncomeAtRetire = monthlyFromLumpSum + jpMonthly

    // Target = % dari gaji terakhir (asumsi gaji sama, tidak naik)
    const targetMonthly = (monthlySalary * replacementTarget) / 100
    const replacementActual = monthlySalary > 0 ? (monthlyIncomeAtRetire / monthlySalary) * 100 : 0
    const gap = Math.max(0, targetMonthly - monthlyIncomeAtRetire)

    // ── Suggested DPLK top-up to close gap ──
    // Gap bulanan → kebutuhan lump sum via kebalikan aturan 4%: gap×12/0.04 = gap×300.
    // Gap SUDAH memperhitungkan JHT/DPLK/JP — jangan dikurangi saldo lagi
    // (versi lama mengurangkan dplkAtRetire dua kali → saran top-up ketinggian rendah).
    const requiredLumpSum = gap > 0 ? gap * 300 : 0
    const suggestedDplkExtra = monthsToRetire > 0 && requiredLumpSum > 0
      ? Math.ceil((requiredLumpSum * monthlyReturn) / (Math.pow(1 + monthlyReturn, monthsToRetire) - 1))
      : 0

    // ── Tax saving from DPLK contribution ──
    // Deductible: min(5% × gross annual, Rp 2.4jt/year). PMK 168/2023.
    const annualDplk = dplkMonthly * 12
    const annualGross = monthlySalary * 12
    const deductibleCap = Math.min(annualGross * 0.05, 2_400_000)
    const deductibleAmount = Math.min(annualDplk, deductibleCap)
    // Assume PPh 21 marginal rate ~15-25% (mid-income); use 15% as illustration
    const taxSaving = deductibleAmount * 0.15

    return {
      yearsToRetire, totalYearsAtRetire,
      jhtAtRetire, jpMonthly, dplkAtRetire,
      monthlyFromLumpSum, monthlyIncomeAtRetire,
      targetMonthly, replacementActual, gap,
      suggestedDplkExtra, taxSaving,
      deductibleAmount, deductibleCap,
    }
  }, [currentAge, retireAge, monthlySalary, yearsContributed, currentJhtBalance,
      currentDplkBalance, dplkMonthly, replacementTarget])

  const onTrack = result.replacementActual >= replacementTarget
  const status = onTrack ? t('calculators.status_healthy')
    : result.replacementActual >= replacementTarget * 0.7 ? t('calculators.status_caution')
    : t('calculators.status_at_risk')
  const statusBase = onTrack ? MINT : result.replacementActual >= replacementTarget * 0.7 ? AMBER : CORAL
  const statusInk = onTrack ? MINT_INK : result.replacementActual >= replacementTarget * 0.7 ? AMBER_INK : CORAL_INK

  return (
    <div className="pt-4 grid gap-6 lg:grid-cols-2">
      <div className="s-card p-6">
        <h3 className="font-semibold">{t('calculators.bpjs_param_title')}</h3>
        <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
          {t('calculators.bpjs_param_desc')}
        </p>
        <div className="mt-4 space-y-3">
          <Row label={t('calculators.bpjs_current_age')} v={currentAge} onChange={setCurrentAge} unit={t('calculators.unit_yr')} />
          <Row label={t('calculators.bpjs_retire_age')} v={retireAge} onChange={setRetireAge} unit={t('calculators.unit_yr')} />
          <Row label={t('calculators.bpjs_monthly_salary')} v={monthlySalary} onChange={setMonthlySalary} />
          <Row label={t('calculators.bpjs_years_worked')} v={yearsContributed} onChange={setYearsContributed} unit={t('calculators.unit_yr')} />
          <Row label={t('calculators.bpjs_jht_balance')} v={currentJhtBalance} onChange={setCurrentJhtBalance} />
          <Row label={t('calculators.bpjs_dplk_balance')} v={currentDplkBalance} onChange={setCurrentDplkBalance} />
          <Row label={t('calculators.bpjs_dplk_voluntary')} v={dplkMonthly} onChange={setDplkMonthly} />
          <Row label={t('calculators.bpjs_replacement_target')} v={replacementTarget} onChange={setReplacementTarget} unit="%" />
        </div>
      </div>

      <div className="s-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">{t('calculators.bpjs_result_title')}</h3>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
              {t('calculators.bpjs_result_desc')}
            </p>
          </div>
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide"
            style={{ background: tint(statusBase, 10), color: statusInk }}
          >
            {status}
          </span>
        </div>

        <div className="mt-5 text-center p-4 rounded-lg" style={{ background: 'var(--surface-2)' }}>
          <p className="num text-5xl font-bold leading-none" style={{ color: statusInk }}>
            {result.replacementActual.toFixed(0)}%
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--ink-soft)' }}>
            {t('calculators.bpjs_of_target')} {replacementTarget}%
          </p>
        </div>

        <div className="mt-5 space-y-2">
          <ResultRow label={t('calculators.bpjs_jht_lump')} v={result.jhtAtRetire} />
          <ResultRow label={t('calculators.bpjs_dplk_lump')} v={result.dplkAtRetire} />
          <ResultRow label={t('calculators.bpjs_income_lump')} v={result.monthlyFromLumpSum} />
          <ResultRow label={t('calculators.bpjs_jp_monthly')} v={result.jpMonthly} />
          <ResultRow
            label={t('calculators.bpjs_total_income')}
            v={result.monthlyIncomeAtRetire}
            accent="var(--ink)"
            big
          />
          <ResultRow label={t('calculators.bpjs_target_monthly')} v={result.targetMonthly} />
          {result.gap > 0 && (
            <ResultRow label={t('calculators.bpjs_gap_monthly')} v={result.gap} accent={CORAL_INK} />
          )}
        </div>

        {result.gap > 0 && result.suggestedDplkExtra > 0 && (
          <div
            className="mt-5 pt-4 border-t rounded-lg p-4"
            style={{
              borderColor: 'var(--border-soft)',
              background: tint(MINT, 6),
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: MINT_INK }}>
              {t('calculators.bpjs_recommendation')}
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--ink)' }}>
              {t('calculators.bpjs_topup_dplk')}{' '}
              <span className="num font-bold">
                +{formatCurrency(result.suggestedDplkExtra)}{t('calculators.per_month')}
              </span>{' '}
              {t('calculators.bpjs_to_close_gap')}
            </p>
            {result.taxSaving > 0 && (
              <p className="text-xs mt-2" style={{ color: 'var(--ink-muted)' }}>
                {t('calculators.bpjs_tax_bonus_prefix')} {formatCurrency(result.deductibleAmount)}{t('calculators.bpjs_tax_bonus_suffix')} ±{formatCurrency(result.taxSaving)}{t('calculators.bpjs_tax_bonus_note')}
              </p>
            )}
          </div>
        )}

        <p className="text-[10px] mt-4" style={{ color: 'var(--ink-soft)' }}>
          {t('calculators.bpjs_disclaimer')}
        </p>
      </div>
    </div>
  )
}

// ─── FIRE / Retirement ──────────────────────────
function FireCalculator() {
  const t = useT()
  const [currentAge, setCurrentAge] = useState(30)
  const [retireAge, setRetireAge] = useState(55)
  const [monthlyExpense, setMonthlyExpense] = useState(15_000_000)
  const [currentSavings, setCurrentSavings] = useState(0)
  const [annualReturn, setAnnualReturn] = useState(8)

  const result = useMemo(() => {
    const yearsToRetire = Math.max(0, retireAge - currentAge)
    // Target: 25x annual expense (4% rule)
    const annualExp = monthlyExpense * 12
    const targetCorpus = annualExp * 25
    const r = annualReturn / 100
    // FV of currentSavings after yearsToRetire
    const fvCurrent = currentSavings * Math.pow(1 + r, yearsToRetire)
    // Remaining needed
    const needed = Math.max(0, targetCorpus - fvCurrent)
    // PMT monthly to reach needed: FV of annuity
    const monthlyR = r / 12
    const n = yearsToRetire * 12
    const monthlySave = n > 0 && monthlyR > 0
      ? needed / (((Math.pow(1 + monthlyR, n) - 1) / monthlyR) * (1 + monthlyR))
      : needed / Math.max(1, n)
    return { yearsToRetire, targetCorpus, fvCurrent, needed, monthlySave, annualExp }
  }, [currentAge, retireAge, monthlyExpense, currentSavings, annualReturn])

  return (
    <div className="pt-4 grid gap-6 lg:grid-cols-2">
      <div className="s-card p-6">
        <h3 className="font-semibold">{t('calculators.fire_param_title')}</h3>
        <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
          {t('calculators.fire_param_desc')}
        </p>
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t('calculators.fire_current_age')}</Label>
              <Input type="number" min={18} max={80} value={currentAge || ''} onChange={(e) => setCurrentAge(Number(e.target.value) || 0)} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('calculators.fire_retire_age')}</Label>
              <Input type="number" min={currentAge + 1} max={90} value={retireAge || ''} onChange={(e) => setRetireAge(Number(e.target.value) || 0)} />
            </div>
          </div>
          <Row label={t('calculators.fire_monthly_expense')} v={monthlyExpense} onChange={setMonthlyExpense} />
          <Row label={t('calculators.fire_current_savings')} v={currentSavings} onChange={setCurrentSavings} />
          <div className="grid gap-1.5">
            <Label>{t('calculators.fire_annual_return')}</Label>
            <Input type="number" step="any" value={annualReturn || ''} onChange={(e) => setAnnualReturn(Number(e.target.value) || 0)} />
          </div>
        </div>
      </div>

      <div className="s-card p-6">
        <h3 className="font-semibold">{t('calculators.result_heading')}</h3>
        <div className="mt-4 space-y-2">
          <ResultRow label={t('calculators.fire_target_corpus')} v={result.targetCorpus} />
          <ResultRow label={`${t('calculators.fire_fv_savings')} (${result.yearsToRetire} ${t('calculators.years_left')})`} v={result.fvCurrent} />
          <ResultRow label={t('calculators.shortfall')} v={result.needed} accent="var(--danger)" />
        </div>
        <div className="mt-4 pt-4 border-t" >
          <ResultRow label={t('calculators.save_per_month')} v={result.monthlySave} big accent="var(--c-mint-ink)" />
          <p className="text-xs mt-3" style={{ color: 'var(--ink-soft)' }}>
            {t('calculators.fire_summary_prefix')} <span className="num font-semibold">{formatCurrency(result.monthlySave)}</span>{t('calculators.fire_summary_mid')} {result.yearsToRetire} {t('calculators.fire_summary_years_at')} {annualReturn}{t('calculators.fire_summary_return_suffix')} {retireAge}.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Kids Education ─────────────────────────────
function KidsEducationCalculator() {
  const t = useT()
  const [childAge, setChildAge] = useState(5)
  const [collegeAge, setCollegeAge] = useState(18)
  const [currentCost, setCurrentCost] = useState(200_000_000) // Biaya kuliah 4 tahun hari ini
  const [inflation, setInflation] = useState(10) // inflasi pendidikan tahunan %
  const [currentSavings, setCurrentSavings] = useState(0)
  const [annualReturn, setAnnualReturn] = useState(7)

  const result = useMemo(() => {
    const years = Math.max(0, collegeAge - childAge)
    const futureCost = currentCost * Math.pow(1 + inflation / 100, years)
    const r = annualReturn / 100
    const fvCurrent = currentSavings * Math.pow(1 + r, years)
    const needed = Math.max(0, futureCost - fvCurrent)
    const monthlyR = r / 12
    const n = years * 12
    const monthlySave = n > 0 && monthlyR > 0
      ? needed / (((Math.pow(1 + monthlyR, n) - 1) / monthlyR) * (1 + monthlyR))
      : needed / Math.max(1, n)
    return { years, futureCost, fvCurrent, needed, monthlySave }
  }, [childAge, collegeAge, currentCost, inflation, currentSavings, annualReturn])

  return (
    <div className="pt-4 grid gap-6 lg:grid-cols-2">
      <div className="s-card p-6">
        <h3 className="font-semibold">{t('calculators.param_heading')}</h3>
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t('calculators.edu_child_age')}</Label>
              <Input type="number" min={0} max={25} value={childAge || ''} onChange={(e) => setChildAge(Number(e.target.value) || 0)} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('calculators.edu_college_age')}</Label>
              <Input type="number" min={childAge + 1} max={30} value={collegeAge || ''} onChange={(e) => setCollegeAge(Number(e.target.value) || 0)} />
            </div>
          </div>
          <Row label={t('calculators.edu_current_cost')} v={currentCost} onChange={setCurrentCost} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t('calculators.edu_inflation')}</Label>
              <Input type="number" step="any" value={inflation || ''} onChange={(e) => setInflation(Number(e.target.value) || 0)} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('calculators.edu_return')}</Label>
              <Input type="number" step="any" value={annualReturn || ''} onChange={(e) => setAnnualReturn(Number(e.target.value) || 0)} />
            </div>
          </div>
          <Row label={t('calculators.edu_current_savings')} v={currentSavings} onChange={setCurrentSavings} />
        </div>
      </div>

      <div className="s-card p-6">
        <h3 className="font-semibold">{t('calculators.result_heading')}</h3>
        <div className="mt-4 space-y-2">
          <ResultRow label={`${t('calculators.edu_need_in')} ${result.years} ${t('calculators.years_left')}`} v={result.futureCost} />
          <ResultRow label={t('calculators.edu_fv_savings')} v={result.fvCurrent} />
          <ResultRow label={t('calculators.shortfall')} v={result.needed} accent="var(--danger)" />
        </div>
        <div className="mt-4 pt-4 border-t" >
          <ResultRow label={t('calculators.save_per_month')} v={result.monthlySave} big accent="var(--c-mint-ink)" />
        </div>
      </div>
    </div>
  )
}

// ─── DCA Simulator ──────────────────────────────
function DCASimulator() {
  const t = useT()
  const [monthly, setMonthly] = useState(2_000_000)
  const [years, setYears] = useState(5)
  const [annualReturn, setAnnualReturn] = useState(12) // saham Indo avg ~12%

  const result = useMemo(() => {
    const n = years * 12
    const r = annualReturn / 100 / 12
    // FV of annuity (end of period)
    const fv = n > 0 && r !== 0
      ? monthly * ((Math.pow(1 + r, n) - 1) / r)
      : monthly * n
    const invested = monthly * n
    const gain = fv - invested
    // Growth curve per year
    const data: { year: number; invested: number; value: number }[] = []
    for (let y = 1; y <= years; y++) {
      const ny = y * 12
      const fvy = ny > 0 && r !== 0
        ? monthly * ((Math.pow(1 + r, ny) - 1) / r)
        : monthly * ny
      data.push({ year: y, invested: monthly * ny, value: fvy })
    }
    return { fv, invested, gain, data }
  }, [monthly, years, annualReturn])

  return (
    <div className="pt-4 grid gap-6 lg:grid-cols-2">
      <div className="s-card p-6">
        <h3 className="font-semibold">{t('calculators.dca_input_title')}</h3>
        <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
          {t('calculators.dca_input_desc')}
        </p>
        <div className="mt-4 space-y-3">
          <Row label={t('calculators.dca_monthly')} v={monthly} onChange={setMonthly} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t('calculators.dca_duration')}</Label>
              <Input type="number" min={1} max={50} value={years || ''} onChange={(e) => setYears(Number(e.target.value) || 0)} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('calculators.dca_return')}</Label>
              <Input type="number" step="any" value={annualReturn || ''} onChange={(e) => setAnnualReturn(Number(e.target.value) || 0)} />
            </div>
          </div>
        </div>
      </div>

      <div className="s-card p-6">
        <h3 className="font-semibold">{t('calculators.dca_result_prefix')} {years} {t('calculators.unit_years')}</h3>
        <div className="mt-4 space-y-2">
          <ResultRow label={t('calculators.dca_total_invested')} v={result.invested} />
          <ResultRow label={t('calculators.dca_final_value')} v={result.fv} big accent="var(--c-mint-ink)" />
          <ResultRow label={t('calculators.dca_capital_gain')} v={result.gain} accent="var(--c-mint-ink)" />
        </div>
        {result.data.length > 0 && (
          <div className="mt-4 pt-4 border-t" >
            <p className="eyebrow mb-2">{t('calculators.dca_projection_per_year')}</p>
            <div className="space-y-1 text-xs max-h-40 overflow-y-auto">
              {result.data.map((d) => (
                <div key={d.year} className="flex items-center justify-between" style={{ color: 'var(--ink-muted)' }}>
                  <span>{t('calculators.dca_year')} {d.year}</span>
                  <span className="num tabular font-medium" style={{ color: 'var(--ink)' }}>
                    {formatCurrency(d.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Zakat ─────────────────────────────────────────
function ZakatCalculator() {
  const t = useT()
  const [goldPricePerGram, setGoldPricePerGram] = useState(1_250_000) // Rp / gram emas
  const [cash, setCash] = useState(0)
  const [savings, setSavings] = useState(0)
  const [investments, setInvestments] = useState(0)
  const [goldValue, setGoldValue] = useState(0)
  const [debts, setDebts] = useState(0)
  const [monthlyIncome, setMonthlyIncome] = useState(0)

  const nisabGold = 85 * goldPricePerGram
  const totalAssets = cash + savings + investments + goldValue
  const netAssets = totalAssets - debts
  const zakatMaal = netAssets >= nisabGold ? netAssets * 0.025 : 0

  // Zakat profesi: 2.5% dari penghasilan bulanan (kalau per tahun ≥ nisab)
  const nisabYearly = nisabGold
  const yearlyIncome = monthlyIncome * 12
  const zakatProfesi = yearlyIncome >= nisabYearly ? monthlyIncome * 0.025 : 0

  return (
    <div className="pt-4 grid gap-6 lg:grid-cols-2">
      <div className="s-card p-6">
        <h3 className="font-semibold">{t('calculators.zakat_maal_title')}</h3>
        <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
          {t('calculators.zakat_maal_desc')}
        </p>
        <div className="mt-4 space-y-3">
          <Row label={t('calculators.zakat_gold_price')} v={goldPricePerGram} onChange={setGoldPricePerGram} />
          <Row label={t('calculators.zakat_cash')} v={cash} onChange={setCash} />
          <Row label={t('calculators.zakat_savings')} v={savings} onChange={setSavings} />
          <Row label={t('calculators.zakat_investments')} v={investments} onChange={setInvestments} />
          <Row label={t('calculators.zakat_gold_value')} v={goldValue} onChange={setGoldValue} />
          <Row label={t('calculators.zakat_debts')} v={debts} onChange={setDebts} />
        </div>
        <div className="mt-5 pt-4 border-t space-y-2" >
          <ResultRow label={t('calculators.zakat_nisab')} v={nisabGold} />
          <ResultRow label={t('calculators.zakat_net_assets')} v={netAssets} />
          <ResultRow
            label={t('calculators.zakat_maal_result')}
            v={zakatMaal}
            accent={zakatMaal > 0 ? 'var(--ink)' : 'var(--ink-soft)'}
            big
          />
          {netAssets < nisabGold && netAssets > 0 && (
            <p className="text-[11px] mt-2" style={{ color: 'var(--ink-soft)' }}>
              {t('calculators.zakat_below_nisab')} {formatCurrency(nisabGold - netAssets)}
            </p>
          )}
        </div>
      </div>

      <div className="s-card p-6">
        <h3 className="font-semibold">{t('calculators.zakat_profesi_title')}</h3>
        <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
          {t('calculators.zakat_profesi_desc')}
        </p>
        <div className="mt-4 space-y-3">
          <Row label={t('calculators.zakat_net_income')} v={monthlyIncome} onChange={setMonthlyIncome} />
        </div>
        <div className="mt-5 pt-4 border-t space-y-2" >
          <ResultRow label={t('calculators.zakat_yearly_income')} v={yearlyIncome} />
          <ResultRow
            label={t('calculators.zakat_profesi_result')}
            v={zakatProfesi}
            accent={zakatProfesi > 0 ? 'var(--ink)' : 'var(--ink-soft)'}
            big
          />
          {yearlyIncome < nisabYearly && yearlyIncome > 0 && (
            <p className="text-[11px] mt-2" style={{ color: 'var(--ink-soft)' }}>
              {t('calculators.zakat_below_nisab_yearly')} ({formatCurrency(nisabYearly)})
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Pajak PPh 21 ──────────────────────────────────
const PTKP = {
  'TK/0': 54_000_000, 'TK/1': 58_500_000, 'TK/2': 63_000_000, 'TK/3': 67_500_000,
  'K/0':  58_500_000, 'K/1':  63_000_000, 'K/2':  67_500_000, 'K/3':  72_000_000,
}

function TaxCalculator() {
  const t = useT()
  const [monthlyGross, setMonthlyGross] = useState(0)
  const [bonusYearly, setBonusYearly] = useState(0)
  const [status, setStatus] = useState<keyof typeof PTKP>('TK/0')

  const result = useMemo(() => {
    const annualGross = monthlyGross * 12 + bonusYearly
    // Biaya jabatan: 5% gross, max 6jt/tahun
    const biayaJabatan = Math.min(annualGross * 0.05, 6_000_000)
    const pkp = Math.max(0, annualGross - biayaJabatan - PTKP[status])
    // Tarif progresif 2024:
    //   0 - 60jt: 5%
    //   60jt - 250jt: 15%
    //   250jt - 500jt: 25%
    //   500jt - 5M: 30%
    //   > 5M: 35%
    const brackets = [
      { cap:    60_000_000, rate: 0.05 },
      { cap:   250_000_000, rate: 0.15 },
      { cap:   500_000_000, rate: 0.25 },
      { cap: 5_000_000_000, rate: 0.30 },
      { cap: Infinity,      rate: 0.35 },
    ]
    let remaining = pkp
    let prevCap = 0
    let tax = 0
    const breakdown: { bracket: string; tax: number }[] = []
    for (const b of brackets) {
      const span = Math.min(remaining, b.cap - prevCap)
      if (span <= 0) break
      const amt = span * b.rate
      tax += amt
      breakdown.push({
        bracket: `${formatCurrency(prevCap)} - ${b.cap === Infinity ? '∞' : formatCurrency(b.cap)} @ ${(b.rate * 100).toFixed(0)}%`,
        tax: amt,
      })
      remaining -= span
      prevCap = b.cap
      if (remaining <= 0) break
    }
    return { annualGross, biayaJabatan, pkp, tax, monthlyTax: tax / 12, breakdown, takeHome: annualGross - tax }
  }, [monthlyGross, bonusYearly, status])

  return (
    <div className="pt-4 grid gap-6 lg:grid-cols-2">
      <div className="s-card p-6">
        <h3 className="font-semibold">{t('calculators.input_heading')}</h3>
        <div className="mt-4 space-y-3">
          <Row label={t('calculators.tax_monthly_gross')} v={monthlyGross} onChange={setMonthlyGross} />
          <Row label={t('calculators.tax_bonus_yearly')} v={bonusYearly} onChange={setBonusYearly} />
          <div className="grid gap-1.5">
            <Label>{t('calculators.tax_family_status')}</Label>
            <Select value={status} onValueChange={(v) => v && setStatus(v as keyof typeof PTKP)}>
              <SelectTrigger>
                <SelectValue placeholder={t('calculators.tax_select_status')}>
                  {(v) => v && PTKP[v as keyof typeof PTKP] !== undefined
                    ? `${v} — ${formatCurrency(PTKP[v as keyof typeof PTKP])}`
                    : t('calculators.tax_select_status')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PTKP).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{k} — {formatCurrency(v)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="s-card p-6">
        <h3 className="font-semibold">{t('calculators.result_heading')}</h3>
        <div className="mt-4 space-y-2">
          <ResultRow label={t('calculators.tax_gross_yearly')} v={result.annualGross} />
          <ResultRow label={t('calculators.tax_biaya_jabatan')} v={result.biayaJabatan} />
          <ResultRow label="PTKP" v={PTKP[status]} />
          <ResultRow label={t('calculators.tax_pkp')} v={result.pkp} />
        </div>
        <div className="mt-4 pt-4 border-t" >
          {result.breakdown.length > 0 && (
            <>
              <p className="eyebrow mb-2">{t('calculators.tax_breakdown')}</p>
              <div className="space-y-1 text-xs">
                {result.breakdown.map((b, i) => (
                  <div key={i} className="flex items-center justify-between" style={{ color: 'var(--ink-muted)' }}>
                    <span className="truncate">{b.bracket}</span>
                    <span className="num tabular">{formatCurrency(b.tax)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="mt-4 pt-4 border-t space-y-2" >
          <ResultRow label={t('calculators.tax_yearly')} v={result.tax} accent="var(--danger)" big />
          <ResultRow label={t('calculators.tax_monthly')} v={result.monthlyTax} accent="var(--ink)" />
          <ResultRow label={t('calculators.tax_take_home')} v={result.takeHome} accent="var(--c-mint-ink)" />
        </div>
      </div>
    </div>
  )
}

function Row({ label, v, onChange, unit }: { label: string; v: number; onChange: (n: number) => void; unit?: string }) {
  return (
    <div className="grid gap-1.5">
      <Label>{unit ? `${label} (${unit})` : label}</Label>
      <NumberInput value={v} onChange={onChange} placeholder="0" />
    </div>
  )
}

function ResultRow({ label, v, big, accent }: { label: string; v: number; big?: boolean; accent?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className={big ? 'font-semibold' : 'text-sm'} style={{ color: 'var(--ink-muted)' }}>
        {label}
      </span>
      <span className={`num tabular ${big ? 'text-xl font-semibold' : 'text-sm'}`} style={{ color: accent ?? 'var(--ink)' }}>
        {formatCurrency(v)}
      </span>
    </div>
  )
}
