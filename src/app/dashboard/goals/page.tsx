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
  Plus, Pencil, Trash2, Loader2, ArrowRight, Target, TrendingUp, Repeat, Sparkles,
  Home, Car, Plane, GraduationCap, Smartphone, Heart, ShieldCheck, PiggyBank, Briefcase,
  Archive, RotateCcw,
  type LucideIcon,
} from 'lucide-react'
import { QuietPageHeader } from '@/components/layout/quiet-page-header'
import { RingProgress } from '@/components/ui/ring-progress'
import { InfoTip } from '@/components/ui/info-tip'
import { GoalPyramid } from '@/components/goals/goal-pyramid'
import { useI18n } from '@/lib/i18n/context'
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

const STATUS_TONE: Record<'ok' | 'risk' | 'overdue' | 'done', { bg: string; ink: string }> = {
  ok: { bg: 'var(--c-mint-soft)', ink: 'var(--c-mint-ink)' },
  done: { bg: 'var(--c-mint-soft)', ink: 'var(--c-mint-ink)' },
  risk: { bg: 'var(--c-amber-soft)', ink: 'var(--c-amber-ink)' },
  overdue: { bg: 'var(--c-coral-soft)', ink: 'var(--c-coral-ink)' },
}

const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`

export default function GoalsPage() {
  const { t, locale } = useI18n()
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
        if (txErr) {
          // Kompensasi: linked-transaction gagal → balikin current_amount goal supaya
          // progres goal gak naik tanpa transaksi saving tercatat (biar konsisten).
          await supabase.from('goals').update({ current_amount: depositGoal.current_amount }).eq('id', depositGoal.id)
          setDepositing(false)
          toast.error(t('goals.deposit_tx_error'))
          refresh()
          return
        }
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

  const iuranSub = stats.iuranVsIncome != null
    ? `${stats.iuranVsIncome.toFixed(0)}% ${t('goals.of_income')}`
    : `${stats.deadlineCount} ${t('goals.goals_with_deadline')}`
  const iuranSubColor = stats.iuranVsIncome == null ? 'var(--ink-soft)'
    : stats.iuranVsIncome > 50 ? 'var(--c-coral-ink)'
    : stats.iuranVsIncome > 30 ? 'var(--c-amber-ink)'
    : 'var(--ink-soft)'

  // Angka stat compact ala kpi-card Beranda — full digit dipertahanin via title.
  const statCards = [
    { label: t('goals.stat_total_target'), value: formatCompactCurrency(stats.totalTarget), full: formatCurrency(stats.totalTarget) as string | undefined, sub: `${activeGoals.length} ${t('goals.goals_unit')}`, subColor: 'var(--ink-soft)', icon: Target, color: 'var(--ink)', chip: 'var(--surface-2)' },
    { label: t('goals.stat_collected'), value: formatCompactCurrency(stats.totalCurrent), full: formatCurrency(stats.totalCurrent) as string | undefined, sub: `${stats.pct.toFixed(1)}% ${t('goals.of_target')}`, subColor: 'var(--ink-soft)', icon: TrendingUp, color: 'var(--c-mint)', chip: 'var(--c-mint-soft)' },
    { label: t('goals.stat_monthly_contribution'), value: formatCompactCurrency(stats.iuranBulan), full: formatCurrency(stats.iuranBulan) as string | undefined, sub: iuranSub, subColor: iuranSubColor, icon: Repeat, color: 'var(--c-violet)', chip: 'var(--c-violet-soft)' },
    { label: t('goals.stat_avg_probability'), value: stats.avgProb != null ? `${stats.avgProb.toFixed(0)}%` : '—', full: undefined as string | undefined, sub: t('goals.avg_if_invested'), subColor: 'var(--ink-soft)', icon: Sparkles, color: 'var(--c-amber)', chip: 'var(--c-amber-soft)' },
  ]

  function scrollToPyramid() {
    document.getElementById('goal-pyramid')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

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
            {activeGoals.length > 0 && (
              <Button variant="outline" onClick={scrollToPyramid}>
                <Target className="h-4 w-4" /> {t('goals.goal_pyramid')}
              </Button>
            )}
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
            <Target className="size-7" style={{ color: 'var(--c-primary-ink)' }} />
          </div>
          <h3 className="text-2xl font-semibold tracking-tight mb-2" style={{ color: 'var(--ink)' }}>
            {t('goals.empty_title')}
          </h3>
          <p className="text-sm max-w-xs" style={{ color: 'var(--ink-muted)' }}>
            {t('goals.empty_desc')}
          </p>
          <Button className="mt-4" onClick={() => { setForm(EMPTY); setDialogOpen(true) }}>
            <Plus className="h-4 w-4" /> {t('goals.new_goal')}
          </Button>
        </div>
      ) : (
        <>
          {/* F10 mobile: ringkasan = ring total terkumpul (4 tile pindah md+) */}
          <section className="s-card px-4 py-3.5 flex items-center gap-4 md:hidden">
            <RingProgress
              pct={stats.pct}
              size={84}
              strokeWidth={9}
              color="var(--c-violet)"
              label={stats.totalTarget > 0 ? `${stats.pct.toFixed(0)}%` : '—'}
              subLabel={t('goals.of_target')}
              className="shrink-0"
            />
            <div className="min-w-0">
              <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                {t('goals.stat_collected')} · {activeGoals.length} {t('goals.goals_unit')}
              </p>
              <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
                <span className="num tabular font-semibold" style={{ fontSize: 20, letterSpacing: '-0.02em', color: 'var(--ink)' }} title={formatCurrency(stats.totalCurrent)}>
                  {formatCompactCurrency(stats.totalCurrent)}
                </span>
                <span className="num text-[11.5px]" style={{ color: 'var(--ink-soft)' }} title={formatCurrency(stats.totalTarget)}>
                  / {formatCompactCurrency(stats.totalTarget)}
                </span>
              </p>
              {stats.avgProb != null && (
                <span className="inline-block mt-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: 'var(--c-violet-soft)', color: 'var(--c-violet-ink)' }}>
                  {t('goals.stat_avg_probability')} {stats.avgProb.toFixed(0)}%
                </span>
              )}
            </div>
          </section>

          {/* 4 stat cards (md+) */}
          <div className="hidden md:grid gap-3 grid-cols-2 lg:grid-cols-4">
            {statCards.map((c) => (
              <div key={c.label} className="s-card p-5">
                <div className="flex items-start justify-between">
                  <p className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>{c.label}</p>
                  <div className="size-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: c.chip }}>
                    <c.icon className="size-4" style={{ color: c.color }} />
                  </div>
                </div>
                <p className="num tabular text-[19px] sm:text-2xl font-semibold mt-3 leading-none" title={c.full} style={{ color: 'var(--ink)' }}>
                  {c.value}
                </p>
                <p className="text-[11px] mt-1.5" style={{ color: c.subColor }}>{c.sub}</p>
              </div>
            ))}
          </div>

          {/* Goal cards + pyramid sebagai cell terakhir */}
          <div className="grid gap-3 sm:grid-cols-2">
            {derived.map((d, i) => {
              const { g, pct, remaining, perMonth, planned, contribution, done, layerColor, layerInk, prob, requiredFor90 } = d
              const Icon = CATEGORY_ICON[g.category] ?? Target
              const status = goalStatus(g, pct, done)
              // Detail asumsi → tooltip ⓘ di label Probabilitas. Footnote lama
              // ngulang angka iuran yang udah tampil dua baris di atasnya.
              const assumption = d.profileKey && !done
                ? `${t('goals.assume_prefix')} ${t(`goals.profile_${d.profileKey}`)} ~${Math.round((d.profileRet ?? 0) * 100)}${t('goals.percent_per_year')}, ${t('goals.assume_contrib')} ${formatCurrency(contribution)}${t('goals.per_month_suffix')}${planned == null ? ` (${t('goals.assume_default_plan')})` : ''}${prob != null && prob < 70 && requiredFor90 != null && requiredFor90 > contribution ? ` · ${t('goals.bump_to')} ${formatCurrency(requiredFor90)}${t('goals.per_month_suffix')} ${t('goals.for_90')}` : ''}`
                : null
              return (
                <div
                  key={g.id}
                  className="group relative overflow-hidden rounded-xl bg-[var(--surface)] border-[length:var(--outline-w)] border-[var(--outline)] shadow-[var(--card-shadow)] hover:border-[var(--ink)] transition-colors"
                >
                  {/* Layout per mockup user: header (nama + meta + CTA kanan) →
                      angka terkumpul SERIF besar "dari target" kecil → bar + %
                      → hairline → footer 3 kolom small-caps. */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        {/* F10 mobile: ring progres gantiin chip ikon (md+ tetap ikon) */}
                        <RingProgress
                          pct={pct}
                          size={36}
                          strokeWidth={4}
                          color={done ? 'var(--c-mint)' : layerColor}
                          label={`${Math.min(pct, 999).toFixed(0)}`}
                          className="shrink-0 md:hidden"
                        />
                        <div className="size-8 rounded-xl hidden md:flex items-center justify-center shrink-0" style={{ background: tint(layerColor, 11) }}>
                          <Icon className="size-4" style={{ color: layerInk }} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold truncate" style={{ color: 'var(--ink)' }}>{g.name}</p>
                            {i === 0 && g.deadline && !done && (
                              <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--ink-soft)' }}>
                                {t('goals.badge_nearest')}
                              </span>
                            )}
                          </div>
                          {/* Status = teks berwarna di meta (per mockup), bukan pill. */}
                          <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--ink-muted)' }}>
                            {g.deadline
                              ? `${t('goals.target_prefix')} ${new Date(g.deadline).toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID', { month: 'short', year: 'numeric' })}`
                              : (categoryLabel(g.category) ?? g.category)}
                            {status && (
                              <>
                                {' · '}
                                <span className="font-semibold" style={{ color: STATUS_TONE[status.tone].ink }}>
                                  {t(`goals.${status.key}`)}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Edit/hapus: hover-reveal di pointer, selalu tampak di touch */}
                        <div className="flex gap-0.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 transition">
                          <Button variant="ghost" size="icon-sm" aria-label={t('goals.edit_aria')} onClick={() => openEdit(g)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" aria-label={t('goals.delete_aria')} onClick={() => remove(g.id)}>
                            <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} />
                          </Button>
                        </div>
                        {done ? (
                          <Button variant="outline" size="sm" className="rounded-full text-[11px]" onClick={() => setActive(g.id, false)}>
                            <Archive className="h-3.5 w-3.5" /> {t('goals.archive')}
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" className="rounded-full text-[11px]" onClick={() => { setDepositGoal(g); setDepositAmt(0); setDepositLogTx(false) }}>
                            <span className="sm:hidden">{t('goals.deposit_short')}</span>
                            <span className="hidden sm:inline">{t('goals.deposit_now')}</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Angka sebagai perhiasan: terkumpul serif besar, target kecil
                        di baseline yang sama — satu baris, gak boleh patah aneh. */}
                    <p className="mt-3.5 leading-none truncate">
                      <span className="num" style={{ fontSize: '1.375rem', letterSpacing: '-0.01em', color: 'var(--ink)' }}>
                        {formatCurrency(g.current_amount)}
                      </span>
                      <span className="num text-[12.5px] ml-2" style={{ color: 'var(--ink-soft)' }}>
                        {t('goals.amount_of')} {formatCurrency(g.target_amount)}
                      </span>
                    </p>

                    <div className="mt-3.5 flex items-center gap-3">
                      <span className="quest-bar flex-1" style={{ ['--bar-fill' as string]: done ? 'var(--c-mint)' : layerColor }}>
                        <i style={{ width: `${Math.min(pct, 100)}%` }} />
                      </span>
                      <span className="num text-[12px] font-semibold shrink-0" style={{ color: done ? 'var(--c-mint-ink)' : layerInk }}>
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Footer 3 kolom — anchor kiri · tengah · kanan, label dijepit
                      h-4 biar tombol ⓘ gak ngedorong kolomnya turun. */}
                  <div className="px-4 py-3 border-t hidden sm:grid grid-cols-3 gap-3" style={{ borderColor: 'var(--outline)' }}>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide whitespace-nowrap flex items-center h-4" style={{ color: 'var(--ink-soft)' }}>
                        {t('goals.monthly_label')}
                      </p>
                      <p className="num text-[13px] font-semibold mt-0.5 truncate" style={{ color: 'var(--ink)' }}>
                        {perMonth != null ? formatCurrency(perMonth) : '—'}
                      </p>
                    </div>
                    <div className="min-w-0 text-center">
                      <p className="text-[10px] uppercase tracking-wide whitespace-nowrap flex items-center justify-center h-4" style={{ color: 'var(--ink-soft)' }}>
                        {t('goals.footer_remaining')}
                      </p>
                      <p className="num text-[13px] font-semibold mt-0.5 truncate" style={{ color: done ? 'var(--c-mint-ink)' : 'var(--ink)' }}>
                        {done ? t('goals.target_reached') : formatCurrency(remaining)}
                      </p>
                    </div>
                    <div className="min-w-0 text-right">
                      <p className="text-[10px] uppercase tracking-wide whitespace-nowrap flex items-center justify-end gap-1 h-4" style={{ color: 'var(--ink-soft)' }}>
                        {t('goals.probability_label')}
                        {assumption && <InfoTip text={assumption} />}
                      </p>
                      {/* Berwarna cuma kalau user set rencana sendiri (default = hipotesis). */}
                      <p className="num text-[13px] font-semibold mt-0.5" style={{ color: prob == null ? 'var(--ink-soft)' : planned != null ? probInk(prob) : 'var(--ink)' }}>
                        {prob != null ? `${prob.toFixed(0)}%` : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}

            <div id="goal-pyramid" className="scroll-mt-24">
              <GoalPyramid
                goals={activeGoals}
                onSetor={(id) => {
                  const g = activeGoals.find((x) => x.id === id)
                  if (g) { setDepositGoal(g); setDepositAmt(0); setDepositLogTx(false) }
                }}
              />
            </div>
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
                    <div key={g.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0" style={{ borderColor: 'var(--outline)' }}>
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
