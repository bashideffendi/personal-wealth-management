'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import type { Goal } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Plus, Pencil, Trash2, Loader2, ArrowRight, Target, TrendingUp, Repeat, Trophy,
  Home, Car, Plane, GraduationCap, Smartphone, Heart, ShieldCheck, PiggyBank, Briefcase,
  Archive, RotateCcw,
  type LucideIcon,
} from 'lucide-react'
import { QuietPageHeader } from '@/components/layout/quiet-page-header'
import { InfoTip } from '@/components/ui/info-tip'
import { GoalPyramid } from '@/components/goals/goal-pyramid'
import { useT } from '@/lib/i18n/context'
import {
  computeGoalProbability, RISK_PROFILES, suggestedRiskProfile,
  categoryToPyramidLayer, PYRAMID_LAYERS, mulberry32, seedFromString, monthsUntil,
  type RiskProfile,
} from '@/lib/goal-probability'

// Labels render via t(`goals.cat_${key}`) / t(`goals.strat_${value}`) — keys only here.
const GOAL_CATEGORY_KEYS = [
  'property', 'vehicle', 'travel', 'education', 'gadget',
  'wedding', 'emergency', 'retirement', 'business', 'other',
] as const

const CATEGORY_ICON: Record<string, LucideIcon> = {
  property: Home, vehicle: Car, travel: Plane, education: GraduationCap,
  gadget: Smartphone, wedding: Heart, emergency: ShieldCheck, retirement: PiggyBank,
  business: Briefcase, other: Target,
}

// Strategi dana = asumsi return buat probabilitas. 'auto' = ikut rekomendasi.
const STRATEGY_VALUES = ['auto', 'tabungan', 'conservative', 'moderate', 'aggressive'] as const
const STRAT_LS_PREFIX = 'pwm.goal.strat.'
const PLAN_LS_PREFIX = 'pwm.goal.plan.'

/** Baca strategi tersimpan: kolom DB → localStorage → 'auto'. Defensif kalau
 *  kolom savings_strategy belum ada (migration 032 belum di-apply). */
function readStoredStrategy(g: Goal): string {
  const col = (g as { savings_strategy?: string | null }).savings_strategy
  if (col) return col
  if (typeof window !== 'undefined') {
    const ls = localStorage.getItem(STRAT_LS_PREFIX + g.id)
    if (ls) return ls
  }
  return 'auto'
}

/** Setoran rencana/bln: kolom DB (migration 048) → localStorage → null.
 *  null = pakai iuran wajib sebagai asumsi setoran. */
function readStoredPlan(g: Goal): number | null {
  const col = (g as { planned_monthly?: number | null }).planned_monthly
  if (col != null && Number(col) > 0) return Number(col)
  if (typeof window !== 'undefined') {
    const ls = Number(localStorage.getItem(PLAN_LS_PREFIX + g.id))
    if (Number.isFinite(ls) && ls > 0) return ls
  }
  return null
}

/** Warna TEKS probabilitas — varian -ink (AA), bukan full-saturation. */
function probInk(p: number): string {
  return p >= 70 ? 'var(--c-mint-ink)' : p >= 40 ? 'var(--c-amber-ink)' : 'var(--c-coral-ink)'
}

interface FormState {
  id: string | null
  name: string
  category: string
  target_amount: number
  current_amount: number
  deadline: string
  notes: string
  savings_strategy: string
  planned_monthly: number
}
const EMPTY: FormState = {
  id: null, name: '', category: 'other',
  target_amount: 0, current_amount: 0, deadline: '', notes: '',
  savings_strategy: 'auto', planned_monthly: 0,
}

// Status pace ala Monarch: bandingin progres aktual vs progres "seharusnya" by
// elapsed waktu (created_at → deadline). Tanpa deadline = gak ada status.
function goalStatus(
  g: Goal,
  pct: number,
  done: boolean,
): { key: string; tone: 'ok' | 'risk' | 'overdue' | 'done' } | null {
  if (done) return { key: 'status_achieved', tone: 'done' }
  if (!g.deadline) return null
  const start = new Date(g.created_at).getTime()
  const end = new Date(g.deadline).getTime()
  const now = Date.now()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  if (now >= end) return { key: 'status_overdue', tone: 'overdue' }
  const expectedPct = ((now - start) / (end - start)) * 100
  return pct + 0.5 >= expectedPct
    ? { key: 'status_on_track', tone: 'ok' }
    : { key: 'status_behind', tone: 'risk' }
}

// Warna titik status — satu-satunya warna di baris meta (disiplin ink-first).
const STATUS_DOT: Record<'ok' | 'risk' | 'overdue' | 'done', string> = {
  ok: 'var(--c-mint)',
  done: 'var(--c-mint)',
  risk: 'var(--c-amber)',
  overdue: 'var(--c-coral)',
}

/**
 * TickGauge — isi solid tipis + jarum penanda di ujung, berjalan di atas
 * jejak tick samar (skala cetak). Versi tick-penuh sebelumnya kebaca kayak
 * barcode di lebar besar — solid jauh lebih tenang, jarum kasih presisi.
 * Ink-first: warna cuma saat tercapai (mint) / lewat deadline (coral).
 */
function TickGauge({ pct, tone }: { pct: number; tone: string }) {
  const w = Math.min(pct, 100)
  return (
    <div className="relative h-[14px] w-full" aria-hidden>
      <div
        className="absolute inset-x-0 bottom-[3px] h-[7px]"
        style={{ background: 'repeating-linear-gradient(90deg, var(--border) 0 2px, transparent 2px 7px)' }}
      />
      <div className="absolute left-0 bottom-[3px] h-[7px]" style={{ width: `${w}%`, background: tone }} />
      <div className="absolute bottom-0 h-[14px] w-[2px]" style={{ left: `calc(${w}% - 1px)`, background: tone }} />
    </div>
  )
}

export default function GoalsPage() {
  const t = useT()
  const supabase = createClient()
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [depositGoal, setDepositGoal] = useState<Goal | null>(null)
  const [depositAmt, setDepositAmt] = useState(0)
  const [depositLogTx, setDepositLogTx] = useState(false)
  const [depositing, setDepositing] = useState(false)
  const [archivedOpen, setArchivedOpen] = useState(false)

  const pageQuery = useQuery({
    queryKey: ['goals-page'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('unauthenticated')
      const { data, error } = await supabase
        .from('goals').select('*').eq('user_id', user.id)
        .order('deadline', { ascending: true })
      if (error) throw error
      // Exclude tujuan bersama (household_id set) — itu tampil di halaman
      // Keluarga, biar gak kehitung dobel. Pre-migration: undefined → tampil.
      const goals = ((data ?? []) as (Goal & { household_id?: string | null })[])
        .filter((g) => !g.household_id)

      // Pemasukan rata-rata/bln dari 3 bln terakhir — buat ngukur "iuran wajib"
      // vs cashflow REAL (bukan ngarang). Mirror cara dashboard hitung income.
      const since = new Date()
      since.setMonth(since.getMonth() - 3)
      const { data: inc } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', user.id)
        .eq('type', 'income')
        .gte('date', since.toISOString().slice(0, 10))
      const totalInc = ((inc ?? []) as { amount: number }[]).reduce((s, r) => s + (r.amount ?? 0), 0)
      return { goals, monthlyIncome: totalInc / 3 }
    },
  })

  const loading = pageQuery.isLoading
  const goals = useMemo(() => pageQuery.data?.goals ?? [], [pageQuery.data])
  const monthlyIncome = pageQuery.data?.monthlyIncome ?? 0
  const refresh = () => qc.invalidateQueries({ queryKey: ['goals-page'] })

  async function doDeposit() {
    if (!depositGoal || depositAmt <= 0) return
    setDepositing(true)
    const newCurrent = depositGoal.current_amount + depositAmt
    const { error } = await supabase.from('goals').update({ current_amount: newCurrent }).eq('id', depositGoal.id)
    if (error) {
      setDepositing(false)
      toast.error(t('goals.deposit_error'))
      return
    }
    if (depositLogTx) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { error: txErr } = await supabase.from('transactions').insert({
          user_id: user.id,
          date: new Date().toISOString().slice(0, 10),
          type: 'saving',
          category: 'Sinking Fund',
          description: `${t('goals.deposit_tx_desc')} ${depositGoal.name}`,
          amount: depositAmt,
        })
        if (txErr) toast.error(t('goals.deposit_tx_error'))
      }
    }
    setDepositing(false)
    setDepositGoal(null)
    setDepositAmt(0)
    setDepositLogTx(false)
    toast.success(t('goals.deposit_success'))
    refresh()
  }

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      category: form.category,
      target_amount: form.target_amount,
      current_amount: form.current_amount,
      deadline: form.deadline || null,
      notes: form.notes,
      is_active: true,
    }
    let goalId = form.id
    if (form.id) {
      const { error } = await supabase.from('goals').update(payload).eq('id', form.id)
      if (error) { setSaving(false); toast.error(t('goals.save_error')); return }
    } else {
      const { data: inserted, error } = await supabase.from('goals').insert(payload).select('id').single()
      if (error) { setSaving(false); toast.error(t('goals.save_error')); return }
      goalId = (inserted as { id: string } | null)?.id ?? null
    }
    if (goalId) await persistExtras(goalId, form.savings_strategy, form.planned_monthly)
    setSaving(false)
    setDialogOpen(false)
    refresh()
  }

  /** Simpan strategi + setoran rencana: localStorage (selalu jalan) + DB
   *  best-effort — kalau kolomnya belum ada (migration 032/048), error
   *  diabaikan dan localStorage jadi sumbernya. */
  async function persistExtras(goalId: string, strat: string, plan: number) {
    try {
      localStorage.setItem(STRAT_LS_PREFIX + goalId, strat)
      if (plan > 0) localStorage.setItem(PLAN_LS_PREFIX + goalId, String(plan))
      else localStorage.removeItem(PLAN_LS_PREFIX + goalId)
    } catch { /* ignore */ }
    await supabase.from('goals').update({ savings_strategy: strat }).eq('id', goalId)
    await supabase.from('goals').update({ planned_monthly: plan > 0 ? plan : null }).eq('id', goalId)
  }

  async function remove(id: string) {
    if (!confirm(t('goals.confirm_delete'))) return
    const { error } = await supabase.from('goals').delete().eq('id', id)
    if (error) { toast.error(t('goals.delete_error')); return }
    refresh()
  }

  async function setActive(id: string, active: boolean) {
    const { error } = await supabase.from('goals').update({ is_active: active }).eq('id', id)
    if (error) { toast.error(t('goals.save_error')); return }
    toast.success(active ? t('goals.unarchived_toast') : t('goals.archived_toast'))
    refresh()
  }

  function openEdit(g: Goal) {
    setForm({
      id: g.id, name: g.name, category: g.category,
      target_amount: g.target_amount, current_amount: g.current_amount,
      deadline: g.deadline ?? '', notes: g.notes,
      savings_strategy: readStoredStrategy(g),
      planned_monthly: readStoredPlan(g) ?? 0,
    })
    setDialogOpen(true)
  }

  // Aktif + urut by deadline (paling urgent dulu = Prioritas #1, tanpa deadline di akhir)
  const activeGoals = useMemo(() => {
    return goals
      .filter((g) => g.is_active)
      .sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0
        if (!a.deadline) return 1
        if (!b.deadline) return -1
        return a.deadline.localeCompare(b.deadline)
      })
  }, [goals])

  const archivedGoals = useMemo(() => goals.filter((g) => !g.is_active), [goals])

  // Hitung sekali: per-goal derived + Monte Carlo (dipakai card + stat rata-rata).
  // Setoran yang diasumsikan = rencana user (planned_monthly) kalau ada, kalau
  // nggak iuran wajib — dan asumsinya SELALU ditulis di card, biar probabilitas
  // kebaca sebagai "peluang KALAU nyetor segini", bukan ramalan gratis.
  const derived = useMemo(() => {
    return activeGoals.map((g) => {
      const pct = g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0
      const remaining = Math.max(0, g.target_amount - g.current_amount)
      const months = monthsUntil(g.deadline)
      const perMonth = months && months > 0 ? Math.ceil(remaining / months) : null
      const done = pct >= 100
      const planned = readStoredPlan(g)
      const contribution = planned ?? perMonth ?? 0
      const layer = categoryToPyramidLayer(g.category, months)
      const layerColor = PYRAMID_LAYERS[layer].color
      const layerInk = PYRAMID_LAYERS[layer].ink

      let prob: number | null = null
      let requiredFor90: number | null = null
      let profileKey: RiskProfile | null = null
      let profileRet: number | null = null
      if (done) {
        prob = 100
      } else if (g.deadline && months === 0) {
        prob = 0 // deadline lewat, belum tercapai
      } else if (g.deadline && months && months > 0) {
        const stored = readStoredStrategy(g)
        const profile: RiskProfile = stored !== 'auto' ? (stored as RiskProfile) : suggestedRiskProfile(g.category, months)
        const a = RISK_PROFILES[profile]
        profileKey = profile
        profileRet = a.annualReturn
        const r = computeGoalProbability({
          current: g.current_amount, target: g.target_amount, monthsLeft: months,
          monthlyContribution: contribution,
          assumptions: { annualReturn: a.annualReturn, annualStdev: a.annualStdev },
          simulations: 2000,
          // Seed deterministik per state goal → angka gak goyang antar-reload.
          rng: mulberry32(seedFromString(`${g.id}:${g.current_amount}:${g.target_amount}:${g.deadline}:${contribution}`)),
        })
        prob = r.probability
        requiredFor90 = r.requiredMonthlyFor90
      }
      return { g, pct, remaining, months, perMonth, planned, contribution, done, layer, layerColor, layerInk, prob, requiredFor90, profileKey, profileRet }
    })
  }, [activeGoals])

  const stats = useMemo(() => {
    const totalTarget = derived.reduce((s, d) => s + d.g.target_amount, 0)
    const totalCurrent = derived.reduce((s, d) => s + d.g.current_amount, 0)
    const pct = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0
    const iuranBulan = derived.reduce((s, d) => s + (d.perMonth ?? 0), 0)
    const deadlineCount = derived.filter((d) => d.perMonth != null).length
    const probs = derived.filter((d) => d.prob != null).map((d) => d.prob as number)
    const avgProb = probs.length > 0 ? probs.reduce((s, p) => s + p, 0) / probs.length : null
    const tercapai = derived.filter((d) => d.done).length
    // % iuran wajib terhadap pemasukan real — null kalau gak ada data income.
    const iuranVsIncome = monthlyIncome > 0 ? (iuranBulan / monthlyIncome) * 100 : null
    return { totalTarget, totalCurrent, pct, iuranBulan, deadlineCount, avgProb, tercapai, iuranVsIncome }
  }, [derived, monthlyIncome])

  const iuranWarnColor = stats.iuranVsIncome == null ? 'var(--ink-soft)'
    : stats.iuranVsIncome > 50 ? 'var(--c-coral-ink)'
    : stats.iuranVsIncome > 30 ? 'var(--c-amber-ink)'
    : 'var(--ink-soft)'

  // Localized labels for category & strategy selects (keys stay stable, labels via t())
  const categoryLabel = (key: string) => t(`goals.cat_${key}`)
  const strategyLabel = (value: string) => t(`goals.strat_${value}`)

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      <QuietPageHeader
        title={t('goals.title')}
        info={t('goals.subtitle')}
        actions={
          <>
            <Button onClick={() => { setForm(EMPTY); setDialogOpen(true) }}>
              <Plus className="h-4 w-4" /> {t('goals.new_goal')}
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : pageQuery.isError ? (
        <div className="s-card flex flex-col items-center text-center py-14 px-8 gap-3">
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>{t('goals.load_error')}</p>
          <Button variant="outline" onClick={() => pageQuery.refetch()}>{t('goals.retry')}</Button>
        </div>
      ) : activeGoals.length === 0 ? (
        <div className="s-card flex flex-col items-center text-center py-16 px-8">
          <div className="size-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--c-primary-soft)' }}>
            <Target className="size-7" style={{ color: 'var(--c-primary)' }} />
          </div>
          <h3 className="text-2xl font-semibold tracking-tight mb-2" style={{ color: 'var(--ink)' }}>
            {t('goals.empty_title')}
          </h3>
          <p className="text-sm max-w-xs" style={{ color: 'var(--ink-muted)' }}>
            {t('goals.empty_desc')}
          </p>
        </div>
      ) : (
        <>
          {/* Baris stat — pola KPI tile app-wide (selaras Transaksi/Anggaran/
              Investasi): card netral + icon chip soft-tint. Kartu ke-4 =
              Tercapai (nyata & memotivasi), bukan probabilitas rata-rata
              sirkular yang dulu nangkring di situ. */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[
              { label: t('goals.stat_total_target'), value: formatCompactCurrency(stats.totalTarget), sub: `${activeGoals.length} ${t('goals.goals_unit')}`, subColor: 'var(--ink-soft)', icon: Target, color: 'var(--ink)', chip: 'var(--surface-2)' },
              { label: t('goals.stat_collected'), value: formatCompactCurrency(stats.totalCurrent), sub: `${stats.pct.toFixed(1)}% ${t('goals.of_target')}`, subColor: 'var(--ink-soft)', icon: TrendingUp, color: 'var(--c-mint)', chip: 'var(--c-mint-soft)' },
              { label: t('goals.stat_monthly_contribution'), value: formatCompactCurrency(stats.iuranBulan), sub: stats.iuranVsIncome != null ? `${stats.iuranVsIncome.toFixed(0)}% ${t('goals.of_income')}` : `${stats.deadlineCount} ${t('goals.goals_with_deadline')}`, subColor: iuranWarnColor, icon: Repeat, color: 'var(--c-violet)', chip: 'var(--c-violet-soft)' },
              { label: t('goals.stat_achieved'), value: `${stats.tercapai} / ${activeGoals.length}`, sub: activeGoals[0]?.deadline ? `${t('goals.stat_nearest')} ${new Date(activeGoals[0].deadline).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}` : '—', subColor: 'var(--ink-soft)', icon: Trophy, color: 'var(--c-amber)', chip: 'var(--c-amber-soft)' },
            ].map((c) => (
              <div key={c.label} className="s-card p-5">
                <div className="flex items-start justify-between">
                  <p className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>{c.label}</p>
                  <div className="size-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: c.chip }}>
                    <c.icon className="size-4" style={{ color: c.color }} />
                  </div>
                </div>
                <p className="num tabular text-xl sm:text-2xl font-bold mt-3 leading-none" style={{ color: 'var(--ink)' }}>
                  {c.value}
                </p>
                <p className="text-[11px] mt-1.5" style={{ color: c.subColor }}>{c.sub}</p>
              </div>
            ))}
          </div>

          {/* Lembar tujuan — direktif prioritas + baris passbook */}
          <div className="s-card p-0 overflow-hidden">
            <GoalPyramid
              goals={activeGoals}
              onSetor={(id) => {
                const g = activeGoals.find((x) => x.id === id)
                if (g) { setDepositGoal(g); setDepositAmt(0); setDepositLogTx(false) }
              }}
            />
            {derived.map((d, i) => {
              const { g, pct, remaining, perMonth, planned, contribution, done, prob, requiredFor90 } = d
              const Icon = CATEGORY_ICON[g.category] ?? Target
              const status = goalStatus(g, pct, done)
              const gaugeTone = done ? 'var(--c-mint)' : status?.tone === 'overdue' ? 'var(--c-coral)' : 'var(--ink)'
              // Detail asumsi pindah ke tooltip ⓘ — baris harus kebaca sekali
              // lirik, bukan paragraf metadata.
              const assumption = d.profileKey && !done
                ? `${t('goals.assume_prefix')} ${t(`goals.profile_${d.profileKey}`)} ~${Math.round((d.profileRet ?? 0) * 100)}${t('goals.percent_per_year')}, ${t('goals.assume_contrib')} ${formatCurrency(contribution)}${t('goals.per_month_suffix')}${planned == null ? ` (${t('goals.assume_default_plan')})` : ''}${prob != null && prob < 70 && requiredFor90 != null && requiredFor90 > contribution ? ` · ${t('goals.bump_to')} ${formatCurrency(requiredFor90)}${t('goals.per_month_suffix')} ${t('goals.for_90')}` : ''}`
                : null
              return (
                <div
                  key={g.id}
                  className="group px-5 sm:px-7 py-4 border-t transition-colors hover:bg-[color-mix(in_srgb,var(--surface-2)_45%,transparent)]"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {/* Satu napas per goal: nama+meta | angka | gauge | % | aksi.
                      Kolom konsisten antar baris biar mata bisa scan vertikal. */}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 md:grid md:grid-cols-[minmax(0,1fr)_205px_150px_92px_auto] md:gap-x-7">
                    <div className="min-w-0 flex items-start gap-3 w-full md:w-auto">
                      <span className="num text-[10px] pt-[5px] shrink-0" style={{ color: 'var(--ink-soft)' }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className="size-[15px] shrink-0" strokeWidth={1.75} style={{ color: 'var(--ink-soft)' }} />
                          <h3 className="text-[17px] leading-tight truncate" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
                            {g.name}
                          </h3>
                          {i === 0 && g.deadline && !done && (
                            <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--ink-soft)' }}>
                              {t('goals.badge_nearest')}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap" style={{ color: 'var(--ink-soft)' }}>
                          {g.deadline
                            ? `${t('goals.target_prefix')} ${new Date(g.deadline).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}`
                            : categoryLabel(g.category)}
                          {status && (
                            <>
                              <span aria-hidden>·</span>
                              <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-[9.5px]" style={{ color: 'var(--ink-muted)' }}>
                                <span aria-hidden className="size-[5px] rounded-full" style={{ background: STATUS_DOT[status.tone] }} />
                                {t(`goals.${status.key}`)}
                              </span>
                            </>
                          )}
                          {assumption && <InfoTip text={assumption} />}
                        </p>
                      </div>
                    </div>

                    <div className="md:text-right">
                      <p className="num text-[13px]" style={{ color: 'var(--ink)' }}>
                        <span className="font-semibold">{formatCompactCurrency(g.current_amount)}</span>
                        <span style={{ color: 'var(--ink-soft)' }}> / {formatCompactCurrency(g.target_amount)}</span>
                      </p>
                      <p className="num text-[10.5px] mt-0.5" style={{ color: done ? 'var(--c-mint-ink)' : 'var(--ink-soft)' }}>
                        {done
                          ? t('goals.target_reached')
                          : perMonth != null
                            ? `${t('goals.meta_monthly')} ${formatCompactCurrency(perMonth)}${t('goals.per_month_suffix')}`
                            : `${t('goals.remaining')} ${formatCompactCurrency(remaining)}`}
                      </p>
                    </div>

                    <div className="w-full md:w-auto">
                      <TickGauge pct={pct} tone={gaugeTone} />
                    </div>

                    <div className="md:text-right">
                      <p className="leading-none" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.9rem', color: 'var(--ink)' }}>
                        {pct.toFixed(0)}<span style={{ fontSize: '1rem' }}>%</span>
                      </p>
                      {prob != null && !done && (
                        // Peluang diwarnai cuma kalau user set rencana sendiri —
                        // angka default (iuran wajib) itu hipotesis, tampil tinta.
                        <p className="text-[10px] mt-1" style={{ color: planned != null ? probInk(prob) : 'var(--ink-soft)' }}>
                          {t('goals.probability_label').toLowerCase()} <span className="num font-semibold">{prob.toFixed(0)}%</span>
                        </p>
                      )}
                    </div>

                    <div className="flex md:flex-col items-center md:items-end gap-x-4 gap-y-1.5 ml-auto md:ml-0">
                      {done ? (
                        <button
                          type="button"
                          onClick={() => setActive(g.id, false)}
                          className="inline-flex items-center gap-1.5 text-[12px] font-semibold underline underline-offset-4 decoration-[1.5px] hover:opacity-70 transition whitespace-nowrap"
                          style={{ color: 'var(--ink)' }}
                        >
                          <Archive className="size-3.5" /> {t('goals.archive')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setDepositGoal(g); setDepositAmt(0); setDepositLogTx(false) }}
                          className="inline-flex items-center gap-1 text-[12px] font-semibold underline underline-offset-4 decoration-[1.5px] hover:opacity-70 transition whitespace-nowrap"
                          style={{ color: 'var(--ink)' }}
                        >
                          {t('goals.deposit_now')} <ArrowRight className="size-3.5" />
                        </button>
                      )}
                      {/* Selalu kelihatan di touch; hover-reveal di pointer device */}
                      <div className="flex gap-0.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 transition">
                        <Button variant="ghost" size="icon-sm" aria-label={t('goals.edit_aria')} onClick={() => openEdit(g)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label={t('goals.delete_aria')} onClick={() => remove(g.id)}>
                          <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Arsip — goal tercapai/disimpan, collapsed biar gak makan tempat */}
          {archivedGoals.length > 0 && (
            <div className="s-card p-5">
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 text-left"
                onClick={() => setArchivedOpen((v) => !v)}
              >
                <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>
                  {t('goals.archived_title')} ({archivedGoals.length})
                </p>
                <span className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{archivedOpen ? '−' : '+'}</span>
              </button>
              {archivedOpen && (
                <div className="mt-3">
                  {archivedGoals.map((g) => (
                    <div key={g.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0" style={{ borderColor: 'var(--border-soft)' }}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{g.name}</p>
                        <p className="num text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                          {formatCurrency(g.current_amount)} / {formatCurrency(g.target_amount)}
                        </p>
                      </div>
                      <div className="flex gap-0.5 shrink-0">
                        <Button variant="ghost" size="icon-sm" aria-label={t('goals.unarchive')} onClick={() => setActive(g.id, true)}>
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label={t('goals.delete_aria')} onClick={() => remove(g.id)}>
                          <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl grid place-items-center shrink-0" style={{ background: 'var(--c-mint-soft)' }}><Target className="size-5" style={{ color: 'var(--c-mint-ink)' }} /></div>
              <div className="min-w-0">
                <DialogTitle className="text-lg" style={{ fontFamily: 'var(--font-display)' }}>{form.id ? t('goals.dialog_edit_title') : t('goals.dialog_new_title')}</DialogTitle>
                <DialogDescription>{t('goals.dialog_desc')}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>{t('goals.field_name')}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('goals.field_name_ph')} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('goals.field_category')}</Label>
              <Select value={form.category} onValueChange={(v) => v && setForm({ ...form, category: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('goals.field_category_ph')}>
                    {(v) => categoryLabel(v) ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {GOAL_CATEGORY_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>{categoryLabel(k)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t('goals.field_target')}</Label>
                <NumberInput value={form.target_amount} onChange={(n) => setForm({ ...form, target_amount: n })} placeholder="0" />
              </div>
              <div className="grid gap-1.5">
                <Label>{t('goals.field_collected')}</Label>
                <NumberInput value={form.current_amount} onChange={(n) => setForm({ ...form, current_amount: n })} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t('goals.field_deadline')}</Label>
                <Input type="date" min={form.id ? undefined : today} value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t('goals.field_plan')}</Label>
                <NumberInput value={form.planned_monthly} onChange={(n) => setForm({ ...form, planned_monthly: n })} placeholder="0" />
              </div>
            </div>
            <p className="text-[11px] -mt-1" style={{ color: 'var(--ink-soft)' }}>
              {t('goals.field_plan_hint')}
            </p>
            <div className="grid gap-1.5">
              <Label>{t('goals.field_strategy')}</Label>
              <Select value={form.savings_strategy} onValueChange={(v) => v && setForm({ ...form, savings_strategy: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('goals.field_strategy_ph')}>
                    {(v) => strategyLabel(v) ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STRATEGY_VALUES.map((v) => (
                    <SelectItem key={v} value={v}>{strategyLabel(v)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                {t('goals.strategy_hint')}
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label>{t('goals.field_notes')}</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('goals.cancel')}</Button>
            <Button onClick={save} disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.id ? t('goals.save') : t('goals.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Setor — nambah nominal ke Terkumpul (aksi beneran, bukan buka form edit) */}
      <Dialog open={!!depositGoal} onOpenChange={(o) => { if (!o) { setDepositGoal(null); setDepositAmt(0); setDepositLogTx(false) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('goals.deposit_to')} {depositGoal?.name}</DialogTitle>
            <DialogDescription>{t('goals.deposit_desc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>{t('goals.deposit_amount')}</Label>
              <NumberInput value={depositAmt} onChange={setDepositAmt} placeholder="0" />
            </div>
            {depositGoal && (
              <p className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                {t('goals.collected_label')} <span className="num">{formatCurrency(depositGoal.current_amount)}</span>
                {depositAmt > 0 && (
                  <> {' → '}<span className="num font-semibold" style={{ color: 'var(--c-mint-ink)' }}>{formatCurrency(depositGoal.current_amount + depositAmt)}</span></>
                )}
              </p>
            )}
            <label className="flex items-center gap-2 text-[12px] cursor-pointer select-none" style={{ color: 'var(--ink-muted)' }}>
              <input
                type="checkbox"
                checked={depositLogTx}
                onChange={(e) => setDepositLogTx(e.target.checked)}
                className="size-3.5 accent-[var(--c-mint)]"
              />
              {t('goals.deposit_log_tx')}
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDepositGoal(null); setDepositAmt(0); setDepositLogTx(false) }}>{t('goals.cancel')}</Button>
            <Button onClick={doDeposit} disabled={depositing || depositAmt <= 0}>
              {depositing && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('goals.deposit_submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
