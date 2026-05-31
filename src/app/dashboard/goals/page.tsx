'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
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
  type LucideIcon,
} from 'lucide-react'
import { EduTip } from '@/components/edu/edu-tip'
import { GoalPyramid } from '@/components/goals/goal-pyramid'
import {
  computeGoalProbability, RISK_PROFILES, suggestedRiskProfile,
  categoryToPyramidLayer, PYRAMID_LAYERS, mulberry32, seedFromString,
  type RiskProfile,
} from '@/lib/goal-probability'

const GOAL_CATEGORIES: Record<string, string> = {
  property: 'Properti', vehicle: 'Kendaraan', travel: 'Liburan', education: 'Pendidikan',
  gadget: 'Gadget', wedding: 'Pernikahan', emergency: 'Darurat', retirement: 'Pensiun',
  business: 'Bisnis', other: 'Lainnya',
}

const CATEGORY_ICON: Record<string, LucideIcon> = {
  property: Home, vehicle: Car, travel: Plane, education: GraduationCap,
  gadget: Smartphone, wedding: Heart, emergency: ShieldCheck, retirement: PiggyBank,
  business: Briefcase, other: Target,
}

// Strategi dana = asumsi return buat probabilitas. 'auto' = ikut rekomendasi.
const STRATEGY_OPTIONS: { value: string; label: string }[] = [
  { value: 'auto', label: 'Otomatis (rekomendasi)' },
  { value: 'tabungan', label: 'Tabungan biasa (~2,5%)' },
  { value: 'conservative', label: 'Konservatif (~5%)' },
  { value: 'moderate', label: 'Moderat (~8%)' },
  { value: 'aggressive', label: 'Agresif (~11%)' },
]
const STRAT_LS_PREFIX = 'pwm.goal.strat.'

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

/** Warna probabilitas — sama persis sama meter lama (mint≥70 / amber≥40 / coral). */
function probColor(p: number): string {
  return p >= 70 ? '#10B981' : p >= 40 ? '#F59E0B' : '#F43F5E'
}

function monthsUntil(deadline: string | null): number | null {
  if (!deadline) return null
  const d = new Date(deadline)
  const now = new Date()
  return (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth())
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
}
const EMPTY: FormState = {
  id: null, name: '', category: 'other',
  target_amount: 0, current_amount: 0, deadline: '', notes: '', savings_strategy: 'auto',
}

export default function GoalsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [goals, setGoals] = useState<Goal[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [depositGoal, setDepositGoal] = useState<Goal | null>(null)
  const [depositAmt, setDepositAmt] = useState(0)
  const [depositing, setDepositing] = useState(false)

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('goals').select('*').eq('user_id', user.id).order('deadline', { ascending: true })
    setGoals((data ?? []) as Goal[])

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
    const incRows = (inc ?? []) as { amount: number }[]
    const totalInc = incRows.reduce((s, t) => s + (t.amount ?? 0), 0)
    setMonthlyIncome(totalInc / 3)

    setLoading(false)
  }

  async function doDeposit() {
    if (!depositGoal || depositAmt <= 0) return
    setDepositing(true)
    const newCurrent = depositGoal.current_amount + depositAmt
    await supabase.from('goals').update({ current_amount: newCurrent }).eq('id', depositGoal.id)
    setDepositing(false)
    setDepositGoal(null)
    setDepositAmt(0)
    void load()
  }

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const payload = {
      user_id: user.id,
      name: form.name,
      category: form.category,
      target_amount: form.target_amount,
      current_amount: form.current_amount,
      deadline: form.deadline || null,
      notes: form.notes,
      is_active: true,
    }
    let goalId = form.id
    if (form.id) {
      await supabase.from('goals').update(payload).eq('id', form.id)
    } else {
      const { data: inserted } = await supabase.from('goals').insert(payload).select('id').single()
      goalId = (inserted as { id: string } | null)?.id ?? null
    }
    if (goalId) await persistStrategy(goalId, form.savings_strategy)
    setSaving(false)
    setDialogOpen(false)
    void load()
  }

  /** Simpan strategi dana: localStorage (selalu jalan) + DB best-effort —
   *  kalau kolom savings_strategy belum ada (migration 032), error diabaikan. */
  async function persistStrategy(goalId: string, strat: string) {
    try { localStorage.setItem(STRAT_LS_PREFIX + goalId, strat) } catch { /* ignore */ }
    await supabase.from('goals').update({ savings_strategy: strat }).eq('id', goalId)
  }

  async function remove(id: string) {
    if (!confirm('Hapus goal ini?')) return
    await supabase.from('goals').delete().eq('id', id)
    void load()
  }

  function openEdit(g: Goal) {
    setForm({
      id: g.id, name: g.name, category: g.category,
      target_amount: g.target_amount, current_amount: g.current_amount,
      deadline: g.deadline ?? '', notes: g.notes,
      savings_strategy: readStoredStrategy(g),
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

  // Hitung sekali: per-goal derived + Monte Carlo (dipakai card + stat rata-rata)
  const derived = useMemo(() => {
    return activeGoals.map((g) => {
      const pct = g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0
      const remaining = Math.max(0, g.target_amount - g.current_amount)
      const months = monthsUntil(g.deadline)
      const perMonth = months && months > 0 ? Math.ceil(remaining / months) : null
      const done = pct >= 100
      const layer = categoryToPyramidLayer(g.category)
      const layerColor = PYRAMID_LAYERS[layer].color

      let prob: number | null = null
      let requiredFor90: number | null = null
      let assumption: { label: string; ret: number } | null = null
      if (done) {
        prob = 100
      } else if (g.deadline && months && months > 0) {
        const stored = readStoredStrategy(g)
        const profile: RiskProfile = stored !== 'auto' ? (stored as RiskProfile) : suggestedRiskProfile(g.category, months)
        const a = RISK_PROFILES[profile]
        assumption = { label: a.label, ret: a.annualReturn }
        const r = computeGoalProbability({
          current: g.current_amount, target: g.target_amount, monthsLeft: months,
          monthlyContribution: perMonth ?? 0,
          assumptions: { annualReturn: a.annualReturn, annualStdev: a.annualStdev },
          simulations: 2000,
          // Seed deterministik per state goal → angka gak goyang antar-reload.
          rng: mulberry32(seedFromString(`${g.id}:${g.current_amount}:${g.target_amount}:${g.deadline}`)),
        })
        prob = r.probability
        requiredFor90 = r.requiredMonthlyFor90
      }
      return { g, pct, remaining, months, perMonth, done, layer, layerColor, prob, requiredFor90, assumption }
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
    ? `${stats.iuranVsIncome.toFixed(0)}% dari pemasukan`
    : `${stats.deadlineCount} tujuan ber-deadline`
  const iuranSubColor = stats.iuranVsIncome == null ? 'var(--ink-soft)'
    : stats.iuranVsIncome > 50 ? '#F43F5E'
    : stats.iuranVsIncome > 30 ? '#F59E0B'
    : 'var(--ink-soft)'

  const statCards = [
    { label: 'Total Target', value: formatCurrency(stats.totalTarget), sub: `${activeGoals.length} tujuan`, subColor: 'var(--ink-soft)', icon: Target, color: 'var(--ink)', chip: 'var(--surface-2)' },
    { label: 'Sudah Terkumpul', value: formatCurrency(stats.totalCurrent), sub: `${stats.pct.toFixed(1)}% dari target`, subColor: 'var(--ink-soft)', icon: TrendingUp, color: '#10B981', chip: '#10B9811A' },
    { label: 'Iuran Wajib / Bulan', value: formatCurrency(stats.iuranBulan), sub: iuranSub, subColor: iuranSubColor, icon: Repeat, color: '#8B5CF6', chip: '#8B5CF61A' },
    { label: 'Probabilitas Rata-rata', value: stats.avgProb != null ? `${stats.avgProb.toFixed(0)}%` : '—', sub: 'rata-rata · asumsi diinvestasikan', subColor: 'var(--ink-soft)', icon: Sparkles, color: '#F59E0B', chip: '#F59E0B1A' },
  ]

  function scrollToPyramid() {
    document.getElementById('goal-pyramid')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="space-y-6">
      {/* Header — light, serif title (personality moment) */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] uppercase" style={{ color: 'var(--ink-soft)' }}>
            {activeGoals.length} Tujuan Aktif{stats.tercapai > 0 && ` · ${stats.tercapai} Tercapai`}
          </p>
          <h1
            className="mt-1 text-3xl sm:text-4xl leading-tight"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}
          >
            Tujuan Finansial
          </h1>
          <p className="text-sm mt-1.5 flex items-center gap-1.5 max-w-xl" style={{ color: 'var(--ink-muted)' }}>
            Pantau progres tiap milestone. Probabilitas dari simulasi Monte Carlo, bukan tebakan.
            <EduTip topic="mental-accounting" side="bottom" />
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeGoals.length > 0 && (
            <Button variant="outline" onClick={scrollToPyramid}>
              <Target className="h-4 w-4" /> Goal Pyramid
            </Button>
          )}
          <Button onClick={() => { setForm(EMPTY); setDialogOpen(true) }}>
            <Plus className="h-4 w-4" /> Tujuan baru
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : activeGoals.length === 0 ? (
        <div className="s-card flex flex-col items-center text-center py-16 px-8">
          <div className="size-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--c-primary-soft)' }}>
            <Target className="size-7" style={{ color: 'var(--c-primary)' }} />
          </div>
          <h3 className="text-2xl font-semibold tracking-tight mb-2" style={{ color: 'var(--ink)' }}>
            Belum ada tujuan
          </h3>
          <p className="text-sm max-w-xs" style={{ color: 'var(--ink-muted)' }}>
            Liburan? Beli rumah? Apapun, kita bantu sampai kesana.
          </p>
        </div>
      ) : (
        <>
          {/* 4 stat cards */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {statCards.map((c) => (
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

          {/* Goal cards + pyramid sebagai cell terakhir */}
          <div className="grid gap-3 sm:grid-cols-2">
            {derived.map((d, i) => {
              const { g, pct, remaining, perMonth, done, layerColor, prob, requiredFor90 } = d
              const Icon = CATEGORY_ICON[g.category] ?? Target
              return (
                <div
                  key={g.id}
                  className="group relative overflow-hidden rounded-xl bg-[var(--surface)] border border-[var(--border-soft)] hover:border-[var(--ink)] transition-colors"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: layerColor }} />
                  <div className="p-5 pl-6">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="size-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${layerColor}1A` }}>
                          <Icon className="size-4" style={{ color: layerColor }} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold truncate" style={{ color: 'var(--ink)' }}>{g.name}</p>
                            {i === 0 && g.deadline && !done && (
                              <span
                                className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wide"
                                style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}
                              >
                                Terdekat
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                            {g.deadline
                              ? `Target ${new Date(g.deadline).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}`
                              : (GOAL_CATEGORIES[g.category] ?? g.category)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(g)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => remove(g.id)}>
                          <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 flex items-end gap-3">
                      <p className="leading-none" style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', color: layerColor }}>
                        {pct.toFixed(0)}%
                      </p>
                      <div className="pb-1 min-w-0">
                        <p className="num text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>
                          {formatCurrency(g.current_amount)}
                          <span className="font-normal" style={{ color: 'var(--ink-muted)' }}> / {formatCurrency(g.target_amount)}</span>
                        </p>
                        <p className="num text-[11px] mt-0.5" style={{ color: done ? '#10B981' : layerColor }}>
                          {done ? 'Target tercapai' : `Sisa ${formatCurrency(remaining)}`}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 h-2 w-full rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: done ? '#10B981' : layerColor }} />
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Iuran / Bulan</p>
                        <p className="num text-sm font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
                          {perMonth != null ? formatCurrency(perMonth) : '—'}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Probabilitas</p>
                        <p className="num text-sm font-semibold mt-0.5" style={{ color: prob != null ? probColor(prob) : 'var(--ink-soft)' }}>
                          {prob != null ? `${prob.toFixed(0)}%` : '—'}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" className="shrink-0 text-[11px]" onClick={() => { setDepositGoal(g); setDepositAmt(0) }}>
                        Setor sekarang <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {d.assumption && !done && (
                      <p className="mt-2.5 text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                        Asumsi {d.assumption.label.toLowerCase()} ~{Math.round(d.assumption.ret * 100)}%/th
                        {prob != null && prob < 70 && requiredFor90 != null && perMonth != null && requiredFor90 > perMonth && (
                          <> · naikin ke <span className="num font-medium" style={{ color: 'var(--ink-muted)' }}>{formatCurrency(requiredFor90)}/bln</span> buat ~90%</>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}

            <div id="goal-pyramid" className="scroll-mt-24">
              <GoalPyramid
                goals={activeGoals}
                onSetor={(id) => {
                  const g = activeGoals.find((x) => x.id === id)
                  if (g) { setDepositGoal(g); setDepositAmt(0) }
                }}
              />
            </div>
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit Tujuan' : 'Tujuan baru'}</DialogTitle>
            <DialogDescription>Set target keuangan dengan deadline opsional.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Nama Tujuan</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="DP Rumah, Liburan Bali..." />
            </div>
            <div className="grid gap-1.5">
              <Label>Kategori</Label>
              <Select value={form.category} onValueChange={(v) => v && setForm({ ...form, category: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori">
                    {(v) => GOAL_CATEGORIES[v] ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(GOAL_CATEGORIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Target (Rp)</Label>
                <NumberInput value={form.target_amount} onChange={(n) => setForm({ ...form, target_amount: n })} placeholder="0" />
              </div>
              <div className="grid gap-1.5">
                <Label>Terkumpul (Rp)</Label>
                <NumberInput value={form.current_amount} onChange={(n) => setForm({ ...form, current_amount: n })} placeholder="0" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Deadline (opsional)</Label>
              <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Strategi dana</Label>
              <Select value={form.savings_strategy} onValueChange={(v) => v && setForm({ ...form, savings_strategy: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih strategi">
                    {(v) => STRATEGY_OPTIONS.find((o) => o.value === v)?.label ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STRATEGY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                Nentuin asumsi return buat ngitung probabilitas. Pilih &ldquo;Tabungan&rdquo; kalau dana cuma disisihin, bukan diinvestasiin.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label>Catatan</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving || !form.name}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.id ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Setor — nambah nominal ke Terkumpul (aksi beneran, bukan buka form edit) */}
      <Dialog open={!!depositGoal} onOpenChange={(o) => { if (!o) { setDepositGoal(null); setDepositAmt(0) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Setor ke {depositGoal?.name}</DialogTitle>
            <DialogDescription>Tambah nominal yang baru kamu sisihkan — langsung nambah ke &ldquo;Terkumpul&rdquo;.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Nominal setoran (Rp)</Label>
              <NumberInput value={depositAmt} onChange={setDepositAmt} placeholder="0" />
            </div>
            {depositGoal && (
              <p className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                Terkumpul: <span className="num">{formatCurrency(depositGoal.current_amount)}</span>
                {depositAmt > 0 && (
                  <> {' → '}<span className="num font-semibold" style={{ color: '#10B981' }}>{formatCurrency(depositGoal.current_amount + depositAmt)}</span></>
                )}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDepositGoal(null); setDepositAmt(0) }}>Batal</Button>
            <Button onClick={doDeposit} disabled={depositing || depositAmt <= 0}>
              {depositing && <Loader2 className="h-4 w-4 animate-spin" />}
              Setor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
