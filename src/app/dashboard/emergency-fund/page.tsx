'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import type { EmergencyFund, EmergencyFundLocation } from '@/types'
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
import { Plus, Pencil, Trash2, Loader2, Check } from 'lucide-react'

type JobStability = 'stabil' | 'cukup_stabil' | 'tidak_stabil'
const JOB_STABILITY_LABELS: Record<JobStability, string> = {
  stabil: 'Stabil', cukup_stabil: 'Cukup Stabil', tidak_stabil: 'Tidak Stabil',
}
function calculateMultiplier(stability: JobStability, dependents: number): number {
  if (stability === 'stabil') return dependents === 0 ? 3 : dependents <= 2 ? 4 : 5
  if (stability === 'cukup_stabil') return dependents === 0 ? 6 : dependents <= 2 ? 7 : 8
  return dependents === 0 ? 9 : dependents <= 2 ? 10 : 12
}

const AMBER = '#F59E0B'
const monthYearNow = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
function etaDate(months: number): string {
  if (!Number.isFinite(months) || months <= 0) return '—'
  const d = new Date(); d.setMonth(d.getMonth() + Math.ceil(months))
  return d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })
}

export default function EmergencyFundPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fund, setFund] = useState<EmergencyFund | null>(null)
  const [locations, setLocations] = useState<EmergencyFundLocation[]>([])

  const [jobStability, setJobStability] = useState<JobStability>('stabil')
  const [dependents, setDependents] = useState(0)
  const [monthlyExpenses, setMonthlyExpenses] = useState(0)
  const [targetAmount, setTargetAmount] = useState(0)

  const [locationDialogOpen, setLocationDialogOpen] = useState(false)
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null)
  const [locationForm, setLocationForm] = useState({ account_name: '', amount: 0 })

  type AccAlloc = { account_id: string; amount: number; accounts: { name: string } | null }
  const [accountAllocations, setAccountAllocations] = useState<AccAlloc[]>([])
  const allocatedFromAccounts = accountAllocations.reduce((s, a) => s + a.amount, 0)

  const multiplier = calculateMultiplier(jobStability, dependents)
  const recommendation = monthlyExpenses * multiplier
  const accumulatedFund = locations.reduce((sum, loc) => sum + loc.amount, 0) + allocatedFromAccounts
  const deficit = Math.max(0, targetAmount - accumulatedFund)
  const progressPercent = targetAmount > 0 ? Math.min(100, (accumulatedFund / targetAmount) * 100) : 0
  const coverageMonths = monthlyExpenses > 0 ? accumulatedFund / monthlyExpenses : 0
  const targetMonths = monthlyExpenses > 0 ? targetAmount / monthlyExpenses : multiplier

  useEffect(() => { void fetchData() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!fund) setTargetAmount(recommendation) }, [recommendation, fund])

  async function fetchData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [fundRes, locRes, allocRes] = await Promise.all([
      supabase.from('emergency_funds').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('emergency_fund_locations').select('*, emergency_funds!inner(user_id)').eq('emergency_funds.user_id', user.id),
      supabase.from('account_allocations').select('account_id, amount, accounts!inner(name)').eq('user_id', user.id).eq('purpose_kind', 'emergency_fund')
        .then((r: { data: unknown; error: unknown }) => r, () => ({ data: [] as unknown[], error: null as unknown })),
    ])
    if (fundRes.data) {
      const f = fundRes.data as EmergencyFund
      setFund(f); setJobStability(f.job_stability as JobStability); setDependents(f.dependents)
      setMonthlyExpenses(f.monthly_expenses); setTargetAmount(f.target_amount)
    }
    if (locRes.data) setLocations(locRes.data as EmergencyFundLocation[])
    setAccountAllocations((allocRes.data ?? []) as AccAlloc[])
    setLoading(false)
  }

  async function handleSaveSettings() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const payload = {
      user_id: user.id, job_stability: jobStability, dependents,
      monthly_expenses: monthlyExpenses, target_amount: targetAmount, current_amount: accumulatedFund,
    }
    if (fund) await supabase.from('emergency_funds').update(payload).eq('id', fund.id)
    else await supabase.from('emergency_funds').insert(payload)
    setSaving(false); void fetchData()
  }

  function openAddLocation() {
    if (!fund) { void handleSaveSettings() }
    setEditingLocationId(null); setLocationForm({ account_name: '', amount: 0 }); setLocationDialogOpen(true)
  }
  function openEditLocation(loc: EmergencyFundLocation) { setEditingLocationId(loc.id); setLocationForm({ account_name: loc.account_name, amount: loc.amount }); setLocationDialogOpen(true) }
  async function handleSaveLocation() {
    let fundId = fund?.id
    if (!fundId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: created } = await supabase.from('emergency_funds').insert({
        user_id: user.id, job_stability: jobStability, dependents, monthly_expenses: monthlyExpenses, target_amount: targetAmount, current_amount: 0,
      }).select('id').single()
      fundId = (created as { id: string } | null)?.id
    }
    if (!fundId) return
    setSaving(true)
    const payload = { fund_id: fundId, account_name: locationForm.account_name, amount: locationForm.amount }
    if (editingLocationId) await supabase.from('emergency_fund_locations').update(payload).eq('id', editingLocationId)
    else await supabase.from('emergency_fund_locations').insert(payload)
    setSaving(false); setLocationDialogOpen(false); void fetchData()
  }
  async function handleDeleteLocation(id: string) {
    await supabase.from('emergency_fund_locations').delete().eq('id', id); void fetchData()
  }

  const plans = useMemo(() => {
    if (deficit <= 0) return []
    return [
      { label: 'Sesuai Rencana', months: 12 },
      { label: 'Agresif', months: 6 },
      { label: 'Akselerasi', months: 3 },
    ].map((p) => ({ ...p, monthly: Math.ceil(deficit / p.months), eta: etaDate(p.months), recommended: p.months === 6 }))
  }, [deficit])

  const scenarios = monthlyExpenses > 0 ? [
    { label: 'Esensial saja', note: 'kebutuhan pokok (estimasi −22%)', exp: monthlyExpenses * 0.78 },
    { label: 'Saat ini', note: 'pengeluaran rata-rata kamu', exp: monthlyExpenses },
    { label: 'Gaya hidup penuh', note: 'plus diskresi (estimasi +35%)', exp: monthlyExpenses * 1.35 },
  ].map((s) => ({ ...s, months: s.exp > 0 ? accumulatedFund / s.exp : 0 })) : []

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Hero premium — ring + angka */}
      <section className="relative overflow-hidden rounded-2xl p-6 sm:p-7" style={{ background: `${AMBER}0F`, border: `1px solid ${AMBER}26` }}>
        <div className="absolute pointer-events-none" style={{ top: -110, right: -70, width: 340, height: 340, borderRadius: '50%', background: `radial-gradient(circle, ${AMBER}26, transparent 65%)` }} />
        <div className="relative flex items-start justify-between gap-4 flex-wrap mb-5">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] uppercase" style={{ color: 'var(--ink-soft)' }}>Bantalan keuangan · {monthYearNow}</p>
            <h1 className="mt-0.5 text-2xl sm:text-3xl leading-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>Dana Darurat</h1>
          </div>
          <Button onClick={openAddLocation}><Plus className="h-4 w-4" /> Setor manual</Button>
        </div>
        <div className="relative grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="relative mx-auto sm:mx-0 size-32">
            <svg viewBox="0 0 120 120" className="size-32 -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--surface-2)" strokeWidth="12" />
              <circle cx="60" cy="60" r="52" fill="none" stroke={AMBER} strokeWidth="12" strokeLinecap="round" strokeDasharray={2 * Math.PI * 52} strokeDashoffset={(1 - Math.min(progressPercent, 100) / 100) * 2 * Math.PI * 52} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="num text-3xl font-bold" style={{ color: AMBER }}>{progressPercent.toFixed(0)}%</span>
              <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Tercapai</span>
            </div>
          </div>
          <div>
            <p className="num tabular font-bold leading-none" style={{ fontSize: 'clamp(30px,4vw,44px)', letterSpacing: '-0.03em', color: 'var(--ink)' }}>
              {formatCurrency(accumulatedFund)} <span className="text-lg font-normal" style={{ color: 'var(--ink-soft)' }}>/ {formatCurrency(targetAmount)}</span>
            </p>
            <div className="mt-3 h-2 w-full rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
              <div className="h-full rounded-full" style={{ width: `${progressPercent}%`, background: AMBER }} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Cakupan saat ini</p><p className="num font-semibold mt-0.5" style={{ color: '#10B981' }}>{coverageMonths.toFixed(1)} bulan</p></div>
              <div><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Target</p><p className="num font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{targetMonths.toFixed(0)} bulan</p></div>
              <div><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Kekurangan</p><p className="num font-semibold mt-0.5" style={{ color: deficit > 0 ? '#F43F5E' : '#10B981' }}>{deficit > 0 ? formatCurrency(deficit) : 'Tercapai'}</p></div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Kalkulator — SELALU tampil (gak disembunyiin) */}
        <div className="s-card p-5">
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Kalkulator Target</p>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>Target dihitung dari stabilitas kerja + tanggungan + pengeluaran.</p>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-1.5">
              <Label>Stabilitas Pekerjaan</Label>
              <Select value={jobStability} onValueChange={(v) => v && setJobStability(v as JobStability)}>
                <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                <SelectContent>{(Object.keys(JOB_STABILITY_LABELS) as JobStability[]).map((k) => (<SelectItem key={k} value={k}>{JOB_STABILITY_LABELS[k]}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Tanggungan</Label><Input type="number" min={0} value={dependents} onChange={(e) => setDependents(Number(e.target.value))} /></div>
              <div className="grid gap-1.5"><Label>Pengeluaran/bln</Label><NumberInput value={monthlyExpenses} onChange={(n) => setMonthlyExpenses(n)} placeholder="0" /></div>
            </div>
            <div className="rounded-lg p-3 flex items-center justify-between" style={{ background: `${AMBER}14` }}>
              <span className="text-sm" style={{ color: 'var(--ink-muted)' }}>Rekomendasi ({multiplier}× pengeluaran)</span>
              <span className="num text-sm font-semibold" style={{ color: AMBER }}>{formatCurrency(recommendation)}</span>
            </div>
            <div className="grid gap-1.5"><Label>Target kamu (Rp)</Label><NumberInput value={targetAmount} onChange={(n) => setTargetAmount(n)} placeholder="0" /></div>
            <Button onClick={handleSaveSettings} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Simpan target</Button>
          </div>
        </div>

        {/* Rencana akselerasi / Catatan */}
        {plans.length > 0 ? (
          <div className="s-card p-5">
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Rencana Akselerasi</p>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>Ritme setoran buat nutup kekurangan {formatCurrency(deficit)}.</p>
            <div className="mt-3 space-y-2.5">
              {plans.map((p) => (
                <div key={p.label} className="flex items-center justify-between rounded-xl px-4 py-3 relative" style={{ border: `1px solid ${p.recommended ? AMBER : 'var(--border-soft)'}`, background: p.recommended ? `${AMBER}0F` : 'var(--surface)' }}>
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--ink)' }}>{p.label}{p.recommended && <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase" style={{ background: AMBER, color: '#FFF' }}>Disarankan</span>}</p>
                    <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{p.months} bln · tercapai {p.eta}</p>
                  </div>
                  <p className="num text-lg font-bold" style={{ color: p.recommended ? AMBER : 'var(--ink)' }}>{formatCurrency(p.monthly)}<span className="text-xs font-normal" style={{ color: 'var(--ink-soft)' }}>/bln</span></p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="s-card p-5">
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: '#8B5CF6' }}>Catatan Klunting</p>
            <ul className="mt-3 space-y-2.5">
              {['Dana darurat ideal 3–6 bulan pengeluaran (lebih kalau penghasilan gak stabil).', 'Taruh minimal 30% di instrumen instan biar bisa diakses dalam hitungan menit.', 'Jangan campur sama tabungan tujuan lain (DP, liburan).', 'Tinjau ulang target tiap 6 bulan / pas biaya hidup berubah.'].map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px]" style={{ color: 'var(--ink-muted)' }}><Check className="size-3.5 mt-0.5 shrink-0" style={{ color: '#10B981' }} /> {t}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Alokasi + Skenario + Catatan (kalau udah ada target/data) */}
      {(plans.length > 0 || accumulatedFund > 0) && (
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="s-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Alokasi Dana</p>
              <Button variant="ghost" size="icon-sm" onClick={openAddLocation}><Plus className="h-3.5 w-3.5" /></Button>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>Di mana dana ditempatkan.</p>
            <div className="mt-3 space-y-2">
              {accountAllocations.map((a, i) => (
                <div key={`acc-${i}`} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 min-w-0"><span className="size-2 rounded-full shrink-0" style={{ background: '#10B981' }} /><span className="truncate" style={{ color: 'var(--ink)' }}>{a.accounts?.name ?? 'Akun'}</span></span>
                  <span className="num font-medium shrink-0" style={{ color: 'var(--ink)' }}>{formatCurrency(a.amount)}</span>
                </div>
              ))}
              {locations.map((loc) => (
                <div key={loc.id} className="group flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 min-w-0"><span className="size-2 rounded-full shrink-0" style={{ background: AMBER }} /><span className="truncate" style={{ color: 'var(--ink)' }}>{loc.account_name}</span></span>
                  <span className="flex items-center gap-1 shrink-0">
                    <span className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEditLocation(loc)}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteLocation(loc.id)}><Trash2 className="h-3 w-3" style={{ color: 'var(--danger)' }} /></Button>
                    </span>
                    <span className="num font-medium" style={{ color: 'var(--ink)' }}>{formatCurrency(loc.amount)}</span>
                  </span>
                </div>
              ))}
              {accountAllocations.length === 0 && locations.length === 0 && (
                <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>Belum ada lokasi. Klik + atau &ldquo;Setor manual&rdquo;.</p>
              )}
            </div>
          </div>

          <div className="s-card p-5">
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Skenario Penggunaan</p>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>Tanpa pemasukan baru, dana nutup berapa lama.</p>
            <div className="mt-3 space-y-2">
              {scenarios.length === 0 ? (
                <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>Isi pengeluaran bulanan dulu.</p>
              ) : scenarios.map((s) => (
                <div key={s.label} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'var(--surface-2)' }}>
                  <div className="min-w-0"><p className="text-sm" style={{ color: 'var(--ink)' }}>{s.label}</p><p className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>{s.note}</p></div>
                  <span className="num font-semibold shrink-0" style={{ color: AMBER }}>{s.months.toFixed(1)} bln</span>
                </div>
              ))}
            </div>
          </div>

          <div className="s-card p-5">
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: '#8B5CF6' }}>Catatan Klunting</p>
            <ul className="mt-3 space-y-2.5">
              {['Dana darurat ideal 3–6 bulan pengeluaran.', 'Minimal 30% di instrumen instan.', 'Jangan campur sama tujuan lain (DP, liburan).', 'Tinjau target tiap 6 bulan.'].map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px]" style={{ color: 'var(--ink-muted)' }}><Check className="size-3.5 mt-0.5 shrink-0" style={{ color: '#10B981' }} /> {t}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Location dialog */}
      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLocationId ? 'Edit Lokasi' : 'Setor / Tambah Lokasi'}</DialogTitle>
            <DialogDescription>Catat di mana dana darurat disimpan + nominalnya.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5"><Label>Akun / lokasi</Label><Input value={locationForm.account_name} onChange={(e) => setLocationForm({ ...locationForm, account_name: e.target.value })} placeholder="Tabungan BCA, Deposito, RD Pasar Uang" /></div>
            <div className="grid gap-1.5"><Label>Jumlah (Rp)</Label><NumberInput value={locationForm.amount} onChange={(n) => setLocationForm({ ...locationForm, amount: n })} placeholder="0" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLocationDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSaveLocation} disabled={saving || !locationForm.account_name}>{saving && <Loader2 className="size-4 animate-spin" />}{editingLocationId ? 'Simpan' : 'Tambah'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
