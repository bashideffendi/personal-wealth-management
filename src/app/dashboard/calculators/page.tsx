'use client'

import { useMemo, useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export default function CalculatorsPage() {
  return (
    <div className="space-y-6">
      <section
        className="relative overflow-hidden rounded-3xl"
        style={{
          background: 'linear-gradient(135deg, #0A0A0F 0%, #14141A 50%, #0F1F1A 100%)',
          color: '#F5F5F7',
          boxShadow: '0 24px 60px -20px rgba(0,0,0,0.40)',
        }}
      >
        <div
          className="absolute pointer-events-none"
          style={{
            top: -100, right: -60, width: 360, height: 360,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.16), transparent 65%)',
          }}
        />
        <div className="relative p-6 sm:p-7">
          <p
            className="text-[11px] font-semibold tracking-[0.18em] uppercase"
            style={{ color: '#6EE7B7' }}
          >
            Alat Hitung
          </p>
          <h1
            className="font-bold tracking-tight mt-2"
            style={{
              fontSize: 'clamp(28px, 4vw, 40px)',
              color: '#FFFFFF',
              letterSpacing: '-0.035em',
            }}
          >
            Kalkulator
          </h1>
          <p className="text-sm mt-3" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Zakat, pajak penghasilan, simulasi cicilan KPR/KKB, FIRE, dana pendidikan, DCA, & Pension Gap.
          </p>
        </div>
      </section>

      <Tabs defaultValue="zakat">
        <TabsList className="flex-wrap">
          <TabsTrigger value="zakat">Zakat</TabsTrigger>
          <TabsTrigger value="tax">Pajak (PPh 21)</TabsTrigger>
          <TabsTrigger value="pension">Pension Gap</TabsTrigger>
          <TabsTrigger value="loan">KPR / Cicilan</TabsTrigger>
          <TabsTrigger value="fire">FIRE / Pensiun</TabsTrigger>
          <TabsTrigger value="kids">Dana Pendidikan</TabsTrigger>
          <TabsTrigger value="dca">DCA Simulator</TabsTrigger>
        </TabsList>
        <TabsContent value="zakat"><ZakatCalculator /></TabsContent>
        <TabsContent value="tax"><TaxCalculator /></TabsContent>
        <TabsContent value="pension"><PensionGapCalculator /></TabsContent>
        <TabsContent value="loan"><LoanCalculator /></TabsContent>
        <TabsContent value="fire"><FireCalculator /></TabsContent>
        <TabsContent value="kids"><KidsEducationCalculator /></TabsContent>
        <TabsContent value="dca"><DCASimulator /></TabsContent>
      </Tabs>
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
    // Formula: 1% × gaji × tahun kontribusi. Capped.
    const jpMonthlyRaw = 0.01 * monthlySalary * totalYearsAtRetire
    const jpMonthly = Math.min(Math.max(jpMonthlyRaw, 354_310), 4_250_000)

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
    // Find PMT that future-values to (gap × 12 / 0.04) = gap×300 over the period
    const requiredLumpSum = gap > 0 ? gap * 300 : 0  // 4% rule reverse
    const additionalLumpNeeded = Math.max(0, requiredLumpSum - dplkAtRetire - jhtAtRetire +
      jhtAtRetire)  // already counted; this is just gap-converted
    const suggestedDplkExtra = monthsToRetire > 0 && additionalLumpNeeded > 0
      ? Math.ceil((additionalLumpNeeded * monthlyReturn) / (Math.pow(1 + monthlyReturn, monthsToRetire) - 1))
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
  const status = onTrack ? 'Sehat'
    : result.replacementActual >= replacementTarget * 0.7 ? 'Caution'
    : 'At Risk'
  const statusColor = onTrack ? '#10B981'
    : result.replacementActual >= replacementTarget * 0.7 ? '#F59E0B'
    : '#F43F5E'

  return (
    <div className="pt-4 grid gap-6 lg:grid-cols-2">
      <div className="s-card p-6">
        <h3 className="font-semibold">Parameter Pensiun</h3>
        <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
          Estimasi 3 pilar: BPJS JHT (5.7% upah) + Jaminan Pensiun + DPLK sukarela.
        </p>
        <div className="mt-4 space-y-3">
          <Row label="Umur Sekarang" v={currentAge} onChange={setCurrentAge} unit="thn" />
          <Row label="Target Umur Pensiun" v={retireAge} onChange={setRetireAge} unit="thn" />
          <Row label="Gaji Bulanan (kotor)" v={monthlySalary} onChange={setMonthlySalary} />
          <Row label="Sudah Kerja" v={yearsContributed} onChange={setYearsContributed} unit="thn" />
          <Row label="Saldo JHT Sekarang" v={currentJhtBalance} onChange={setCurrentJhtBalance} />
          <Row label="Saldo DPLK Sekarang" v={currentDplkBalance} onChange={setCurrentDplkBalance} />
          <Row label="DPLK Sukarela / bln" v={dplkMonthly} onChange={setDplkMonthly} />
          <Row label="Target Replacement Ratio" v={replacementTarget} onChange={setReplacementTarget} unit="%" />
        </div>
      </div>

      <div className="s-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">Replacement Ratio Pensiun</h3>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
              % gaji terakhir yang bisa kamu replace di pensiun.
            </p>
          </div>
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide"
            style={{ background: `${statusColor}1A`, color: statusColor }}
          >
            {status}
          </span>
        </div>

        <div className="mt-5 text-center p-4 rounded-lg" style={{ background: 'var(--surface-2)' }}>
          <p className="num text-5xl font-bold leading-none" style={{ color: statusColor }}>
            {result.replacementActual.toFixed(0)}%
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--ink-soft)' }}>
            dari target {replacementTarget}%
          </p>
        </div>

        <div className="mt-5 space-y-2">
          <ResultRow label="JHT (lump sum @ pensiun)" v={result.jhtAtRetire} />
          <ResultRow label="DPLK (lump sum @ pensiun)" v={result.dplkAtRetire} />
          <ResultRow label="Income dari lump sum (4% rule/bln)" v={result.monthlyFromLumpSum} />
          <ResultRow label="JP (benefit bulanan)" v={result.jpMonthly} />
          <ResultRow
            label="Total Income / bln @ pensiun"
            v={result.monthlyIncomeAtRetire}
            accent="var(--ink)"
            big
          />
          <ResultRow label="Target / bln" v={result.targetMonthly} />
          {result.gap > 0 && (
            <ResultRow label="GAP / bln" v={result.gap} accent="#F43F5E" />
          )}
        </div>

        {result.gap > 0 && result.suggestedDplkExtra > 0 && (
          <div
            className="mt-5 pt-4 border-t rounded-lg p-4"
            style={{
              borderColor: 'var(--border-soft)',
              background: 'rgba(16,185,129,0.06)',
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#10B981' }}>
              Rekomendasi
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--ink)' }}>
              Top-up DPLK{' '}
              <span className="num font-bold">
                +{formatCurrency(result.suggestedDplkExtra)}/bln
              </span>{' '}
              untuk menutup gap.
            </p>
            {result.taxSaving > 0 && (
              <p className="text-xs mt-2" style={{ color: 'var(--ink-muted)' }}>
                Bonus: kontribusi DPLK Rp {formatCurrency(result.deductibleAmount)}/thn deductible →
                hemat pajak ±{formatCurrency(result.taxSaving)}/thn (PMK 168/2023, asumsi PPh marginal 15%).
              </p>
            )}
          </div>
        )}

        <p className="text-[10px] mt-4" style={{ color: 'var(--ink-soft)' }}>
          Estimasi kasar — return JHT diasumsikan 6%/thn, JP capped Rp 4.25jt/bln (2024). Gunakan iAkun
          BPJS TK untuk angka aktual.
        </p>
      </div>
    </div>
  )
}

// ─── FIRE / Retirement ──────────────────────────
function FireCalculator() {
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
        <h3 className="font-semibold">Parameter FIRE</h3>
        <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
          4% rule: butuh 25× pengeluaran tahunan untuk financial independence.
        </p>
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Umur Sekarang</Label>
              <Input type="number" min={18} max={80} value={currentAge || ''} onChange={(e) => setCurrentAge(Number(e.target.value) || 0)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Umur Target Pensiun</Label>
              <Input type="number" min={currentAge + 1} max={90} value={retireAge || ''} onChange={(e) => setRetireAge(Number(e.target.value) || 0)} />
            </div>
          </div>
          <Row label="Pengeluaran / bulan saat pensiun" v={monthlyExpense} onChange={setMonthlyExpense} />
          <Row label="Tabungan/investasi saat ini" v={currentSavings} onChange={setCurrentSavings} />
          <div className="grid gap-1.5">
            <Label>Assumed Return tahunan (%)</Label>
            <Input type="number" step="any" value={annualReturn || ''} onChange={(e) => setAnnualReturn(Number(e.target.value) || 0)} />
          </div>
        </div>
      </div>

      <div className="s-card p-6">
        <h3 className="font-semibold">Hasil</h3>
        <div className="mt-4 space-y-2">
          <ResultRow label={`Target (25× annual expense)`} v={result.targetCorpus} />
          <ResultRow label={`FV tabungan saat ini (${result.yearsToRetire} tahun lagi)`} v={result.fvCurrent} />
          <ResultRow label="Kekurangan" v={result.needed} accent="var(--danger)" />
        </div>
        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-soft)' }}>
          <ResultRow label="Tabung / bulan" v={result.monthlySave} big accent="var(--c-mint)" />
          <p className="text-xs mt-3" style={{ color: 'var(--ink-soft)' }}>
            Dengan menabung/investasi <span className="num font-semibold">{formatCurrency(result.monthlySave)}</span>/bulan selama {result.yearsToRetire} tahun pada return {annualReturn}%/tahun, kamu bisa pensiun umur {retireAge}.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Kids Education ─────────────────────────────
function KidsEducationCalculator() {
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
        <h3 className="font-semibold">Parameter</h3>
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Umur Anak Sekarang</Label>
              <Input type="number" min={0} max={25} value={childAge || ''} onChange={(e) => setChildAge(Number(e.target.value) || 0)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Umur Masuk Kuliah</Label>
              <Input type="number" min={childAge + 1} max={30} value={collegeAge || ''} onChange={(e) => setCollegeAge(Number(e.target.value) || 0)} />
            </div>
          </div>
          <Row label="Biaya kuliah (nilai hari ini)" v={currentCost} onChange={setCurrentCost} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Inflasi pendidikan %/tahun</Label>
              <Input type="number" step="any" value={inflation || ''} onChange={(e) => setInflation(Number(e.target.value) || 0)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Return investasi %/tahun</Label>
              <Input type="number" step="any" value={annualReturn || ''} onChange={(e) => setAnnualReturn(Number(e.target.value) || 0)} />
            </div>
          </div>
          <Row label="Tabungan pendidikan saat ini" v={currentSavings} onChange={setCurrentSavings} />
        </div>
      </div>

      <div className="s-card p-6">
        <h3 className="font-semibold">Hasil</h3>
        <div className="mt-4 space-y-2">
          <ResultRow label={`Kebutuhan ${result.years} tahun lagi`} v={result.futureCost} />
          <ResultRow label="FV tabungan saat ini" v={result.fvCurrent} />
          <ResultRow label="Kekurangan" v={result.needed} accent="var(--danger)" />
        </div>
        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-soft)' }}>
          <ResultRow label="Tabung / bulan" v={result.monthlySave} big accent="var(--c-mint)" />
        </div>
      </div>
    </div>
  )
}

// ─── DCA Simulator ──────────────────────────────
function DCASimulator() {
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
        <h3 className="font-semibold">DCA Input</h3>
        <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
          Dollar Cost Averaging — invest jumlah tetap setiap bulan.
        </p>
        <div className="mt-4 space-y-3">
          <Row label="DCA / bulan" v={monthly} onChange={setMonthly} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Durasi (tahun)</Label>
              <Input type="number" min={1} max={50} value={years || ''} onChange={(e) => setYears(Number(e.target.value) || 0)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Return %/tahun</Label>
              <Input type="number" step="any" value={annualReturn || ''} onChange={(e) => setAnnualReturn(Number(e.target.value) || 0)} />
            </div>
          </div>
        </div>
      </div>

      <div className="s-card p-6">
        <h3 className="font-semibold">Hasil {years} Tahun</h3>
        <div className="mt-4 space-y-2">
          <ResultRow label="Total diinvestasikan" v={result.invested} />
          <ResultRow label="Nilai akhir (compounding)" v={result.fv} big accent="var(--c-mint)" />
          <ResultRow label="Capital gain" v={result.gain} accent="var(--c-mint)" />
        </div>
        {result.data.length > 0 && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-soft)' }}>
            <p className="eyebrow mb-2">Proyeksi per Tahun</p>
            <div className="space-y-1 text-xs max-h-40 overflow-y-auto">
              {result.data.map((d) => (
                <div key={d.year} className="flex items-center justify-between" style={{ color: 'var(--ink-muted)' }}>
                  <span>Tahun {d.year}</span>
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
        <h3 className="font-semibold">Zakat Maal (Harta)</h3>
        <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
          2.5% dari aset bersih, jika mencapai nisab (senilai 85gr emas).
        </p>
        <div className="mt-4 space-y-3">
          <Row label="Harga Emas / gram" v={goldPricePerGram} onChange={setGoldPricePerGram} />
          <Row label="Uang Tunai & Setara" v={cash} onChange={setCash} />
          <Row label="Tabungan" v={savings} onChange={setSavings} />
          <Row label="Investasi (saham/RD)" v={investments} onChange={setInvestments} />
          <Row label="Nilai Emas (Rp)" v={goldValue} onChange={setGoldValue} />
          <Row label="Utang Jatuh Tempo" v={debts} onChange={setDebts} />
        </div>
        <div className="mt-5 pt-4 border-t space-y-2" style={{ borderColor: 'var(--border-soft)' }}>
          <ResultRow label="Nisab (85gr emas)" v={nisabGold} />
          <ResultRow label="Aset bersih" v={netAssets} />
          <ResultRow
            label="Zakat Maal (2.5%)"
            v={zakatMaal}
            accent={zakatMaal > 0 ? 'var(--ink)' : 'var(--ink-soft)'}
            big
          />
          {netAssets < nisabGold && netAssets > 0 && (
            <p className="text-[11px] mt-2" style={{ color: 'var(--ink-soft)' }}>
              Belum mencapai nisab — kekurangan {formatCurrency(nisabGold - netAssets)}
            </p>
          )}
        </div>
      </div>

      <div className="s-card p-6">
        <h3 className="font-semibold">Zakat Profesi</h3>
        <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
          2.5% dari gaji bulanan (jika setahun ≥ nisab).
        </p>
        <div className="mt-4 space-y-3">
          <Row label="Penghasilan Bersih / bulan" v={monthlyIncome} onChange={setMonthlyIncome} />
        </div>
        <div className="mt-5 pt-4 border-t space-y-2" style={{ borderColor: 'var(--border-soft)' }}>
          <ResultRow label="Penghasilan / tahun" v={yearlyIncome} />
          <ResultRow
            label="Zakat Profesi / bulan"
            v={zakatProfesi}
            accent={zakatProfesi > 0 ? 'var(--ink)' : 'var(--ink-soft)'}
            big
          />
          {yearlyIncome < nisabYearly && yearlyIncome > 0 && (
            <p className="text-[11px] mt-2" style={{ color: 'var(--ink-soft)' }}>
              Belum mencapai nisab tahunan ({formatCurrency(nisabYearly)})
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
      const t = span * b.rate
      tax += t
      breakdown.push({
        bracket: `${formatCurrency(prevCap)} - ${b.cap === Infinity ? '∞' : formatCurrency(b.cap)} @ ${(b.rate * 100).toFixed(0)}%`,
        tax: t,
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
        <h3 className="font-semibold">Input</h3>
        <div className="mt-4 space-y-3">
          <Row label="Gaji Bulanan Bruto" v={monthlyGross} onChange={setMonthlyGross} />
          <Row label="Bonus / THR per tahun" v={bonusYearly} onChange={setBonusYearly} />
          <div className="grid gap-1.5">
            <Label>Status Keluarga (PTKP)</Label>
            <Select value={status} onValueChange={(v) => v && setStatus(v as keyof typeof PTKP)}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih status">
                  {(v) => v && PTKP[v as keyof typeof PTKP] !== undefined
                    ? `${v} — ${formatCurrency(PTKP[v as keyof typeof PTKP])}`
                    : 'Pilih status'}
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
        <h3 className="font-semibold">Hasil</h3>
        <div className="mt-4 space-y-2">
          <ResultRow label="Gross / tahun" v={result.annualGross} />
          <ResultRow label="Biaya jabatan" v={result.biayaJabatan} />
          <ResultRow label="PTKP" v={PTKP[status]} />
          <ResultRow label="PKP (Pajak Kena Pajak)" v={result.pkp} />
        </div>
        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-soft)' }}>
          {result.breakdown.length > 0 && (
            <>
              <p className="eyebrow mb-2">Breakdown Tarif</p>
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
        <div className="mt-4 pt-4 border-t space-y-2" style={{ borderColor: 'var(--border-soft)' }}>
          <ResultRow label="Pajak / tahun" v={result.tax} accent="var(--danger)" big />
          <ResultRow label="Pajak / bulan" v={result.monthlyTax} accent="var(--ink)" />
          <ResultRow label="Take home / tahun" v={result.takeHome} accent="var(--c-mint)" />
        </div>
      </div>
    </div>
  )
}

// ─── KPR / KKB ─────────────────────────────────────
function LoanCalculator() {
  const [principal, setPrincipal] = useState(0)
  const [annualRate, setAnnualRate] = useState(7.5)
  const [tenureYears, setTenureYears] = useState(15)

  const result = useMemo(() => {
    const r = annualRate / 100 / 12
    const n = tenureYears * 12
    if (principal <= 0 || r <= 0 || n <= 0) {
      return { monthly: 0, totalPayment: 0, totalInterest: 0, schedule: [] as { month: number; principal: number; interest: number; balance: number }[] }
    }
    const monthly = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    const schedule: { month: number; principal: number; interest: number; balance: number }[] = []
    let balance = principal
    for (let m = 1; m <= Math.min(n, 24); m++) {
      const interest = balance * r
      const principalPay = monthly - interest
      balance -= principalPay
      schedule.push({ month: m, principal: principalPay, interest, balance })
    }
    const totalPayment = monthly * n
    return { monthly, totalPayment, totalInterest: totalPayment - principal, schedule }
  }, [principal, annualRate, tenureYears])

  return (
    <div className="pt-4 grid gap-6 lg:grid-cols-2">
      <div className="s-card p-6">
        <h3 className="font-semibold">Input</h3>
        <div className="mt-4 space-y-3">
          <Row label="Pokok Pinjaman (Rp)" v={principal} onChange={setPrincipal} />
          <div className="grid gap-1.5">
            <Label>Bunga Tahunan (%)</Label>
            <Input type="number" step="any" value={annualRate || ''} onChange={(e) => setAnnualRate(Number(e.target.value) || 0)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Tenor (tahun)</Label>
            <Input type="number" min={1} max={30} value={tenureYears || ''} onChange={(e) => setTenureYears(Number(e.target.value) || 0)} />
          </div>
        </div>
        <div className="mt-5 pt-4 border-t space-y-2" style={{ borderColor: 'var(--border-soft)' }}>
          <ResultRow label="Cicilan / bulan" v={result.monthly} big accent="var(--ink)" />
          <ResultRow label="Total pembayaran" v={result.totalPayment} />
          <ResultRow label="Total bunga" v={result.totalInterest} accent="var(--danger)" />
        </div>
      </div>

      <div className="s-card p-6">
        <h3 className="font-semibold">Skedul Amortisasi (24 bulan pertama)</h3>
        {result.schedule.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border-soft)' }}>
                  <th className="text-left py-2" style={{ color: 'var(--ink-muted)' }}>Bulan</th>
                  <th className="text-right py-2" style={{ color: 'var(--ink-muted)' }}>Pokok</th>
                  <th className="text-right py-2" style={{ color: 'var(--ink-muted)' }}>Bunga</th>
                  <th className="text-right py-2" style={{ color: 'var(--ink-muted)' }}>Sisa</th>
                </tr>
              </thead>
              <tbody>
                {result.schedule.map((s) => (
                  <tr key={s.month} className="border-b" style={{ borderColor: 'var(--border-soft)' }}>
                    <td className="py-1.5 num">{s.month}</td>
                    <td className="text-right py-1.5 num tabular">{formatCurrency(s.principal)}</td>
                    <td className="text-right py-1.5 num tabular" style={{ color: 'var(--danger)' }}>{formatCurrency(s.interest)}</td>
                    <td className="text-right py-1.5 num tabular" style={{ color: 'var(--ink-muted)' }}>{formatCurrency(s.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm mt-4" style={{ color: 'var(--ink-soft)' }}>Isi input untuk melihat skedul.</p>
        )}
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
