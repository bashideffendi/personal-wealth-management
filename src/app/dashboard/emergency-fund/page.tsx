'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import type { EmergencyFund, EmergencyFundLocation, EmergencyFundTransaction } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Plus, Minus, Pencil, Trash2, Loader2, Check, ChevronDown, ShieldCheck, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { InstitutionLogo } from '@/components/accounts/institution-logo'
import { QuietPageHeader } from '@/components/layout/quiet-page-header'
import { useT } from '@/lib/i18n/context'

type JobStability = 'stabil' | 'cukup_stabil' | 'tidak_stabil'
const JOB_STABILITY_LABELS: Record<JobStability, string> = {
  stabil: 'Stabil', cukup_stabil: 'Cukup Stabil', tidak_stabil: 'Tidak Stabil',
}
function calculateMultiplier(stability: JobStability, dependents: number): number {
  if (stability === 'stabil') return dependents === 0 ? 3 : dependents <= 2 ? 4 : 5
  if (stability === 'cukup_stabil') return dependents === 0 ? 6 : dependents <= 2 ? 7 : 8
  return dependents === 0 ? 9 : dependents <= 2 ? 10 : 12
}

const AMBER = 'var(--c-amber)'
const AMBER_INK = 'var(--c-amber-ink)'
const MINT = 'var(--c-mint)'
const MINT_INK = 'var(--c-mint-ink)'
const tint = (c: string, p: number) => `color-mix(in srgb, ${c} ${p}%, transparent)`
// Preset lokasi/instrumen (ikut sheet user) — tetap bisa ketik bebas.
const LOCATION_PRESETS = ['Tabungan', 'Deposito', 'Reksa Dana Pasar Uang', 'Emas', 'Saham', 'P2P Lending', 'Lainnya']

const dmy = (d: string) => (d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' }) : '—')
const todayISO = () => new Date().toISOString().split('T')[0]
function etaDate(months: number): string {
  if (!Number.isFinite(months) || months <= 0) return '—'
  const d = new Date(); d.setMonth(d.getMonth() + Math.ceil(months))
  return d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })
}

// Form "Atur dana darurat" — user isi TOTAL dana darurat di sebuah tempat
// (bukan setor/tarik). Selisih vs nilai lama otomatis jadi log perjalanan.
interface TxnForm { date: string; location: string; total: number; note: string }
const EMPTY_TXN: TxnForm = { date: todayISO(), location: '', total: 0, note: '' }

type Account = { id: string; name: string; type: string; current_balance: number }
type AccAlloc = { id: string; account_id: string; amount: number; accounts: { name: string; current_balance: number } | null }

export default function EmergencyFundPage() {
  const t = useT()
  const supabase = createClient()
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)

  const [jobStability, setJobStability] = useState<JobStability>('stabil')
  const [dependents, setDependents] = useState(0)
  const [monthlyExpenses, setMonthlyExpenses] = useState(0)
  const [targetAmount, setTargetAmount] = useState(0)

  const [locationDialogOpen, setLocationDialogOpen] = useState(false)
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null)
  const [locationForm, setLocationForm] = useState({ account_name: '', amount: 0 })

  const [txnDialogOpen, setTxnDialogOpen] = useState(false)
  const [txnForm, setTxnForm] = useState<TxnForm>(EMPTY_TXN)
  const [txnOther, setTxnOther] = useState(false)

  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkForm, setLinkForm] = useState({ id: '', accountId: '', amount: 0 })

  // react-query — back-nav dilayani cache (5 query gak diulang tiap visit),
  // gagal fetch dapet error state + retry (dulu: halaman kosong diam-diam).
  const pageQuery = useQuery({
    queryKey: ['emergency-fund'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('unauthenticated')
      const [fundRes, locRes, allocRes, txnRes, accRes] = await Promise.all([
        supabase.from('emergency_funds').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('emergency_fund_locations').select('*, emergency_funds!inner(user_id)').eq('emergency_funds.user_id', user.id),
        supabase.from('account_allocations').select('id, account_id, amount, accounts!inner(name, current_balance)').eq('user_id', user.id).eq('purpose_kind', 'emergency_fund')
          .then((r: { data: unknown; error: unknown }) => r, () => ({ data: [] as unknown[], error: null as unknown })),
        // Best-effort: tabel transaksi mungkin belum ada (migration 034 belum di-apply).
        supabase.from('emergency_fund_transactions').select('*, emergency_funds!inner(user_id)').eq('emergency_funds.user_id', user.id).order('date', { ascending: true })
          .then((r: { data: unknown; error: unknown }) => r, () => ({ data: [] as unknown[], error: null as unknown })),
        supabase.from('accounts').select('id, name, type, current_balance').eq('user_id', user.id),
      ])
      if (fundRes.error) throw fundRes.error
      if (locRes.error) throw locRes.error
      if (accRes.error) throw accRes.error
      return {
        fund: (fundRes.data ?? null) as EmergencyFund | null,
        locations: (locRes.data ?? []) as EmergencyFundLocation[],
        allocations: (allocRes.data ?? []) as AccAlloc[],
        transactions: (txnRes.data ?? []) as EmergencyFundTransaction[],
        accounts: (accRes.data ?? []) as Account[],
      }
    },
  })
  const loading = pageQuery.isLoading
  const fund = pageQuery.data?.fund ?? null
  const locations = pageQuery.data?.locations ?? []
  const transactions = pageQuery.data?.transactions ?? []
  const accounts = pageQuery.data?.accounts ?? []
  const accountAllocations = pageQuery.data?.allocations ?? []
  const allocatedFromAccounts = accountAllocations.reduce((s, a) => s + a.amount, 0)
  const refresh = () => qc.invalidateQueries({ queryKey: ['emergency-fund'] })

  // Seed form kalkulator dari fund tersimpan (hidrasi sekali per perubahan data).
  useEffect(() => {
    const f = pageQuery.data?.fund
    if (f) {
      setJobStability(f.job_stability as JobStability)
      setDependents(f.dependents)
      setMonthlyExpenses(f.monthly_expenses)
      setTargetAmount(f.target_amount)
    }
  }, [pageQuery.data?.fund])

  const multiplier = calculateMultiplier(jobStability, dependents)
  const recommendation = monthlyExpenses * multiplier
  const accumulatedFund = locations.reduce((sum, loc) => sum + loc.amount, 0) + allocatedFromAccounts
  const deficit = Math.max(0, targetAmount - accumulatedFund)
  const progressPercent = targetAmount > 0 ? Math.min(100, (accumulatedFund / targetAmount) * 100) : 0
  const coverageMonths = monthlyExpenses > 0 ? accumulatedFund / monthlyExpenses : 0
  const targetMonths = monthlyExpenses > 0 ? targetAmount / monthlyExpenses : multiplier

  useEffect(() => { if (!fund) setTargetAmount(recommendation) }, [recommendation, fund])

  async function ensureFund(): Promise<string | null> {
    if (fund?.id) return fund.id
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: created, error } = await supabase.from('emergency_funds').insert({
      user_id: user.id, job_stability: jobStability, dependents, monthly_expenses: monthlyExpenses, target_amount: targetAmount, current_amount: accumulatedFund,
    }).select('*').single()
    if (error) { toast.error(t('common.mutation_failed')); return null }
    return (created as { id: string } | null)?.id ?? null
  }

  async function handleSaveSettings() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const payload = {
      user_id: user.id, job_stability: jobStability, dependents,
      monthly_expenses: monthlyExpenses, target_amount: targetAmount, current_amount: accumulatedFund,
    }
    const { error } = fund
      ? await supabase.from('emergency_funds').update(payload).eq('id', fund.id)
      : await supabase.from('emergency_funds').insert(payload)
    setSaving(false)
    if (error) { toast.error(t('common.mutation_failed')); return }
    refresh()
  }

  // ── Lokasi (di mana dana disimpan) ──
  function openEditLocation(loc: EmergencyFundLocation) { setEditingLocationId(loc.id); setLocationForm({ account_name: loc.account_name, amount: loc.amount }); setLocationDialogOpen(true) }
  async function handleSaveLocation() {
    const fundId = await ensureFund()
    if (!fundId) return
    setSaving(true)
    const payload = { fund_id: fundId, account_name: locationForm.account_name, amount: locationForm.amount }
    const { error } = editingLocationId
      ? await supabase.from('emergency_fund_locations').update(payload).eq('id', editingLocationId)
      : await supabase.from('emergency_fund_locations').insert(payload)
    setSaving(false)
    if (error) { toast.error(t('common.mutation_failed')); return }
    setLocationDialogOpen(false); refresh()
  }
  async function handleDeleteLocation(id: string) {
    const { error } = await supabase.from('emergency_fund_locations').delete().eq('id', id)
    if (error) { toast.error(t('common.delete_failed')); return }
    refresh()
  }

  // ── Hubungkan akun (account_allocations — saldo sinkron dari Aset Likuid) ──
  function openLink(alloc?: { id: string; account_id: string; amount: number }) {
    setLinkForm(alloc ? { id: alloc.id, accountId: alloc.account_id, amount: alloc.amount } : { id: '', accountId: '', amount: 0 })
    setLinkDialogOpen(true)
  }
  async function handleSaveLink() {
    const fundId = await ensureFund()
    const { data: { user } } = await supabase.auth.getUser()
    if (!fundId || !user || !linkForm.accountId) return
    setSaving(true)
    const existingId = linkForm.id || accountAllocations.find((a) => a.account_id === linkForm.accountId)?.id
    const { error } = existingId
      ? await supabase.from('account_allocations').update({ amount: linkForm.amount }).eq('id', existingId)
      : await supabase.from('account_allocations').insert({ user_id: user.id, account_id: linkForm.accountId, purpose_kind: 'emergency_fund', emergency_fund_id: fundId, amount: linkForm.amount })
    setSaving(false)
    if (error) { toast.error(t('common.mutation_failed')); return }
    setLinkDialogOpen(false); refresh()
  }
  async function handleUnlink(id: string) {
    if (!confirm(t('emergency_fund.confirm_unlink'))) return
    const { error } = await supabase.from('account_allocations').delete().eq('id', id)
    if (error) { toast.error(t('common.delete_failed')); return }
    refresh()
  }

  // ── Pembentukan (catat setoran / penarikan) ──
  function openTxn() { setTxnForm({ ...EMPTY_TXN, date: todayISO() }); setTxnOther(false); setTxnDialogOpen(true) }
  // Nilai earmark/lokasi terkini buat sebuah tempat (akun atau non-akun).
  function currentAmountFor(place: string): number {
    const acct = accounts.find((a) => a.name.toLowerCase() === place.toLowerCase())
    if (acct) return accountAllocations.find((a) => a.account_id === acct.id)?.amount ?? 0
    return locations.find((l) => l.account_name.toLowerCase() === place.toLowerCase())?.amount ?? 0
  }
  async function handleSaveTxn() {
    const fundId = await ensureFund()
    const { data: { user } } = await supabase.auth.getUser()
    const dest = txnForm.location.trim()
    if (!fundId || !user || !dest) return
    setSaving(true)
    const total = Math.max(0, txnForm.total)
    const current = currentAmountFor(dest)
    const delta = total - current
    // 1) SET nilai (total), BUKAN mindahin uang — saldo rekening asli gak disentuh.
    // Tiga langkah berurutan: berhenti + toast di langkah yang gagal, biar
    // gak ada state sobek (lokasi keupdate tapi log/total nggak).
    const acct = accounts.find((a) => a.name.toLowerCase() === dest.toLowerCase())
    let stepErr: unknown = null
    if (acct) {
      const alloc = accountAllocations.find((a) => a.account_id === acct.id)
      ;({ error: stepErr } = alloc
        ? await supabase.from('account_allocations').update({ amount: total }).eq('id', alloc.id)
        : await supabase.from('account_allocations').insert({ user_id: user.id, account_id: acct.id, purpose_kind: 'emergency_fund', emergency_fund_id: fundId, amount: total }))
    } else {
      const loc = locations.find((l) => l.account_name.toLowerCase() === dest.toLowerCase())
      ;({ error: stepErr } = loc
        ? await supabase.from('emergency_fund_locations').update({ amount: total }).eq('id', loc.id)
        : await supabase.from('emergency_fund_locations').insert({ fund_id: fundId, account_name: dest, amount: total }))
    }
    if (stepErr) { setSaving(false); toast.error(t('common.mutation_failed')); return }
    // 2) Log SELISIH (buat chart perjalanan) kalau berubah.
    if (delta !== 0) {
      const { error: logErr } = await supabase.from('emergency_fund_transactions').insert({
        fund_id: fundId, date: txnForm.date, kind: delta > 0 ? 'setor' : 'tarik', amount: Math.abs(delta), location: dest, note: txnForm.note.trim(),
      })
      if (logErr) { setSaving(false); toast.error(t('common.mutation_failed')); refresh(); return }
    }
    // 3) Sinkron current_amount fund.
    await supabase.from('emergency_funds').update({ current_amount: Math.max(0, accumulatedFund + delta) }).eq('id', fundId)
    setSaving(false); setTxnDialogOpen(false); refresh()
  }
  async function handleDeleteTxn(tx: EmergencyFundTransaction) {
    if (!confirm(t('emergency_fund.confirm_delete_txn'))) return
    const signed = tx.kind === 'setor' ? tx.amount : -tx.amount
    const { error } = await supabase.from('emergency_fund_transactions').delete().eq('id', tx.id)
    if (error) { toast.error(t('common.delete_failed')); return }
    // Reverse nominal DI TEMPATNYA — akun ter-link ATAU lokasi manual. Dulu
    // cuma lokasi manual yang di-reverse: hapus log transaksi akun bikin
    // total drift permanen.
    const acct = accounts.find((a) => a.name.toLowerCase() === tx.location.toLowerCase())
    if (acct) {
      const alloc = accountAllocations.find((a) => a.account_id === acct.id)
      if (alloc) {
        const { error: e2 } = await supabase.from('account_allocations').update({ amount: Math.max(0, alloc.amount - signed) }).eq('id', alloc.id)
        if (e2) toast.error(t('common.mutation_failed'))
      }
    } else {
      const loc = locations.find((l) => l.account_name.toLowerCase() === tx.location.toLowerCase())
      if (loc) {
        const { error: e2 } = await supabase.from('emergency_fund_locations').update({ amount: Math.max(0, loc.amount - signed) }).eq('id', loc.id)
        if (e2) toast.error(t('common.mutation_failed'))
      }
    }
    // Sinkron total fund juga (saveTxn sinkron, delete dulunya nggak — drift).
    if (fund) await supabase.from('emergency_funds').update({ current_amount: Math.max(0, accumulatedFund - signed) }).eq('id', fund.id)
    refresh()
  }

  // Rencana setoran — KAMU yang nentuin berapa sanggup nyisihin/bln (bukan "ritme
  // disarankan" yang dikarang). Prefill ke pace 12 bln biar langsung ada hasil.
  const [monthlySaving, setMonthlySaving] = useState(0)
  useEffect(() => { setMonthlySaving((v) => (v > 0 || deficit <= 0 ? v : Math.ceil(deficit / 12))) }, [deficit])
  const monthsToGoal = monthlySaving > 0 ? Math.ceil(deficit / monthlySaving) : 0

  // Komposisi lokasi (bar) — akun riil (sinkron Aset Likuid) + lokasi non-akun.
  const allLocations = [
    ...accountAllocations.map((a) => ({ key: `acc-${a.id}`, kind: 'account' as const, name: a.accounts?.name ?? 'Akun', amount: a.amount, balance: a.accounts?.current_balance ?? 0, allocId: a.id, accountId: a.account_id })),
    ...locations.map((l) => ({ key: `loc-${l.id}`, kind: 'manual' as const, name: l.account_name, amount: l.amount, balance: null as number | null, allocId: l.id, accountId: null as string | null })),
  ].filter((l) => l.amount > 0).sort((a, b) => b.amount - a.amount)
  const linkedAccountIds = new Set(accountAllocations.map((a) => a.account_id))
  const locPalette = [AMBER, 'var(--c-violet)', MINT, 'var(--ink)', 'var(--c-coral)', 'var(--ink-soft)']

  // Perjalanan membangun dana — kumulatif dari log. Baseline = saldo sebelum transaksi tercatat.
  const journey = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
    const net = sorted.reduce((s, t) => s + (t.kind === 'setor' ? t.amount : -t.amount), 0)
    const baseline = Math.max(0, accumulatedFund - net)
    let run = baseline
    const pts = [{ label: t('emergency_fund.journey_start'), value: baseline }]
    for (const tx of sorted) { run = Math.max(0, run + (tx.kind === 'setor' ? tx.amount : -tx.amount)); pts.push({ label: dmy(tx.date), value: run }) }
    return pts
  }, [transactions, accumulatedFund, t])

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin" /></div>
  }
  if (pageQuery.isError) {
    return (
      <div className="s-card flex flex-col items-center text-center py-14 px-8 gap-3">
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>{t('common.load_failed')}</p>
        <Button variant="outline" onClick={() => pageQuery.refetch()}>{t('common.retry')}</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <datalist id="ef-dest">
        {[...new Set([...accounts.map((a) => a.name), ...locations.map((l) => l.account_name), ...LOCATION_PRESETS])].map((p) => <option key={p} value={p} />)}
      </datalist>
      {/* Header quiet (konsisten work pages) — subtitle + edukasi + tips
          ngumpul di satu ⓘ, gak jadi kartu statis yang makan halaman. */}
      <QuietPageHeader
        icon={ShieldCheck}
        title={t('emergency_fund.page_title')}
        info={`${t('emergency_fund.page_subtitle')} ${t('emergency_fund.info_benchmark')} ${t('emergency_fund.tip_1')} ${t('emergency_fund.tip_2')}`}
        actions={<Button onClick={openTxn}><Plus className="h-4 w-4" /> {t('emergency_fund.set_fund_button')}</Button>}
      />

      {/* Card — cuma ring (kiri, amber-tint) + metrik (kanan, surface). Tanpa judul di dalam. */}
      <div className="grid sm:grid-cols-[auto_1fr] rounded-2xl border overflow-hidden" style={{ borderColor: tint(AMBER, 20) }}>
        <div className="grid place-items-center p-6 sm:p-8" style={{ background: tint(AMBER, 6) }}>
          <div className="relative size-36">
            <svg viewBox="0 0 120 120" className="size-36 -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke={tint(AMBER, 20)} strokeWidth="11" />
              <circle cx="60" cy="60" r="52" fill="none" stroke={AMBER} strokeWidth="11" strokeLinecap="round" strokeDasharray={2 * Math.PI * 52} strokeDashoffset={(1 - Math.min(progressPercent, 100) / 100) * 2 * Math.PI * 52} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="num font-bold" style={{ fontSize: 'clamp(28px,3vw,36px)', color: AMBER_INK, letterSpacing: '-0.02em' }}>{progressPercent.toFixed(0)}%</span>
              <span className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--ink-soft)' }}>{t('emergency_fund.ring_achieved')}</span>
            </div>
          </div>
        </div>
        <div className="p-6 sm:p-8 min-w-0" style={{ background: 'var(--surface)' }}>
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>{t('emergency_fund.accumulated_label')}</p>
          <p className="num tabular font-bold leading-none mt-1.5 flex items-baseline gap-2 flex-wrap" style={{ color: 'var(--ink)' }}>
            <span style={{ fontSize: 'clamp(30px,4.5vw,46px)', letterSpacing: '-0.03em' }}>{formatCurrency(accumulatedFund)}</span>
            <button type="button" onClick={() => document.getElementById('ef-kalkulator')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="text-base font-normal inline-flex items-center gap-1 hover:underline" style={{ color: 'var(--ink-soft)' }}>/ {targetAmount > 0 ? formatCurrency(targetAmount) : t('emergency_fund.set_target_inline')} <Pencil className="size-3" /></button>
          </p>
          <span className="quest-bar mt-4 w-full" style={{ ['--bar-fill' as string]: AMBER, ['--bar-h' as string]: '10px' }}><i style={{ width: `${Math.max(progressPercent, accumulatedFund > 0 ? 2 : 0)}%` }} /></span>
          {targetAmount > 0 ? (
            <>
              <div className="mt-5 grid grid-cols-3 gap-4">
                {/* Mint cuma kalau coverage udah nyampe target — 0 bulan jangan hijau. */}
                <div><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{t('emergency_fund.metric_coverage')}</p><p className="num font-bold mt-1" style={{ color: coverageMonths >= targetMonths && targetAmount > 0 ? 'var(--c-mint-ink)' : 'var(--ink)', fontSize: 'clamp(15px,1.6vw,19px)' }}>{coverageMonths.toFixed(1)} {t('emergency_fund.months_unit')}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{t('emergency_fund.metric_target')}</p><p className="num font-bold mt-1" style={{ color: 'var(--ink)', fontSize: 'clamp(15px,1.6vw,19px)' }}>{targetMonths.toFixed(0)} {t('emergency_fund.months_unit')}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{t('emergency_fund.metric_deficit')}</p><p className="num font-bold mt-1" style={{ color: deficit > 0 ? 'var(--c-coral-ink)' : MINT_INK, fontSize: 'clamp(15px,1.6vw,19px)' }}>{deficit > 0 ? formatCurrency(deficit) : t('emergency_fund.metric_achieved')}</p></div>
              </div>
              {coverageMonths > 0 && <p className="mt-4 text-[12px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{t('emergency_fund.coverage_explainer_pre')} <span className="font-semibold" style={{ color: 'var(--ink)' }}>± {coverageMonths.toFixed(1)} {t('emergency_fund.months_unit')}</span> {t('emergency_fund.coverage_explainer_until')} {etaDate(coverageMonths)}.</p>}
            </>
          ) : (
            <p className="mt-4 text-sm" style={{ color: 'var(--ink-muted)' }}>{t('emergency_fund.empty_target_pre')} <span className="font-semibold" style={{ color: 'var(--c-amber-ink)' }}>{t('emergency_fund.empty_target_calculator')}</span> {t('emergency_fund.empty_target_mid')} <button type="button" onClick={openTxn} className="font-semibold underline underline-offset-2" style={{ color: 'var(--c-amber-ink)' }}>{t('emergency_fund.empty_target_action')}</button> {t('emergency_fund.empty_target_post')}</p>
          )}
        </div>
      </div>

      {/* Kalkulator (kiri) + Rencana setoran (kanan) */}
      <div className="grid gap-3 lg:grid-cols-2 items-start">
        <div id="ef-kalkulator" className="scroll-mt-20 s-card p-5">
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>{t('emergency_fund.calc_title')}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>{t('emergency_fund.calc_subtitle')}</p>
          <div className="mt-4 grid gap-4">
            <div className="grid gap-1.5">
              <Label>{t('emergency_fund.calc_job_stability')}</Label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(JOB_STABILITY_LABELS) as JobStability[]).map((k) => {
                  const on = jobStability === k
                  return (
                    <button key={k} type="button" onClick={() => setJobStability(k)}
                      className="rounded-lg border px-2 py-2.5 text-[12px] font-medium leading-tight transition"
                      style={{ borderColor: on ? AMBER : 'var(--border-soft)', background: on ? tint(AMBER, 9) : 'var(--surface)', color: on ? 'var(--c-amber-ink)' : 'var(--ink-muted)' }}>
                      {t(`emergency_fund.job_stability_${k}`)}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t('emergency_fund.calc_dependents')}</Label>
                <div className="flex items-center rounded-lg border overflow-hidden h-10" style={{ borderColor: 'var(--border-soft)' }}>
                  <button type="button" onClick={() => setDependents(Math.max(0, dependents - 1))} className="size-10 grid place-items-center shrink-0 transition hover:bg-[var(--surface-2)]" style={{ color: 'var(--ink-muted)' }}><Minus className="size-4" /></button>
                  <span className="flex-1 text-center num font-semibold" style={{ color: 'var(--ink)' }}>{dependents}</span>
                  <button type="button" onClick={() => setDependents(dependents + 1)} className="size-10 grid place-items-center shrink-0 transition hover:bg-[var(--surface-2)]" style={{ color: 'var(--ink-muted)' }}><Plus className="size-4" /></button>
                </div>
              </div>
              <div className="grid gap-1.5"><Label>{t('emergency_fund.calc_monthly_expenses')}</Label><RpField value={monthlyExpenses} onChange={setMonthlyExpenses} /></div>
            </div>
            <div className="rounded-xl p-4 flex items-center justify-between gap-3" style={{ background: tint(AMBER, 9) }}>
              <div>
                <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: 'var(--c-amber-ink)' }}>{t('emergency_fund.calc_recommendation')}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>{t('emergency_fund.calc_rec_pre')} {multiplier} {t('emergency_fund.calc_rec_mid')} ({multiplier}{t('emergency_fund.calc_rec_post')})</p>
              </div>
              <span className="num text-xl font-bold whitespace-nowrap" style={{ color: AMBER_INK }}>{formatCurrency(recommendation)}</span>
            </div>
            <div className="grid gap-1.5"><Label>{t('emergency_fund.calc_your_target')}</Label><RpField value={targetAmount} onChange={setTargetAmount} /></div>
            <Button onClick={handleSaveSettings} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{t('emergency_fund.calc_save_target')}</Button>
          </div>
        </div>

        <div className="grid gap-3">
        {deficit > 0 ? (
          <div className="s-card p-5">
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>{t('emergency_fund.plan_title')}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>{t('emergency_fund.plan_short_pre')} {formatCurrency(deficit)}. {t('emergency_fund.plan_short_question')}</p>
            <div className="mt-3"><RpField value={monthlySaving} onChange={setMonthlySaving} /></div>
            {monthsToGoal > 0 ? (
              <div className="mt-3 rounded-xl p-4" style={{ background: tint(AMBER, 9) }}>
                <p className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>{t('emergency_fund.plan_with')} <span className="num font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(monthlySaving)}</span>{t('emergency_fund.plan_per_month_reached')}</p>
                <p className="num text-xl font-bold mt-0.5" style={{ color: AMBER_INK }}>{etaDate(monthsToGoal)} <span className="text-sm font-normal" style={{ color: 'var(--ink-soft)' }}>· ≈ {monthsToGoal} {t('emergency_fund.plan_months_left')}</span></p>
              </div>
            ) : (
              <p className="mt-3 text-[12px]" style={{ color: 'var(--ink-soft)' }}>{t('emergency_fund.plan_enter_hint')}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{t('emergency_fund.plan_finish_in')}</span>
              {[6, 12, 24].map((m) => (
                <button key={m} type="button" onClick={() => setMonthlySaving(Math.ceil(deficit / m))} className="rounded-full px-2.5 py-1 text-[11px] font-medium transition" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>{m} {t('emergency_fund.months_unit_short')}</button>
              ))}
            </div>
            <p className="text-[11px] mt-3 leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{t('emergency_fund.plan_tip_pre')} <strong>{t('emergency_fund.plan_tip_emphasis')}</strong> {t('emergency_fund.plan_tip_post')}</p>
          </div>
        ) : (
          <div className="s-card p-5 grid place-items-center text-center">
            <div>
              <div className="size-11 rounded-full grid place-items-center mx-auto" style={{ background: tint(MINT, 10) }}><Check className="size-5" style={{ color: MINT }} /></div>
              <p className="font-semibold mt-2" style={{ color: 'var(--ink)' }}>{targetAmount > 0 ? t('emergency_fund.safe_title') : t('emergency_fund.calc_first_title')}</p>
              <p className="text-[12px] mt-1 max-w-xs" style={{ color: 'var(--ink-muted)' }}>{targetAmount > 0 ? t('emergency_fund.safe_body') : t('emergency_fund.calc_first_body')}</p>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Perjalanan membangun dana — chart kumulatif dari log */}
      <div className="s-card p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>{t('emergency_fund.journey_title')}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
              {/* ETA dari pace RENCANA user (monthlySaving) — rumus lama
                  deficit/ceil(deficit/6) selalu ±6 bulan, angka karangan. */}
              {journey.length >= 2 ? (
                <>
                  {t('emergency_fund.journey_last_deposit')} {journey[journey.length - 1].label}
                  {deficit > 0 && monthsToGoal > 0 && (
                    <> · {t('emergency_fund.journey_est_reached')} <span className="font-semibold" style={{ color: 'var(--ink)' }}>{etaDate(monthsToGoal)}</span></>
                  )}
                </>
              ) : t('emergency_fund.journey_empty_subtitle')}
            </p>
          </div>
          {targetAmount > 0 && <span className="text-[11px] num" style={{ color: MINT_INK }}>● {t('emergency_fund.metric_target')} {formatCurrency(targetAmount)}</span>}
        </div>
        {journey.length >= 2 ? (() => {
          const W = 720, H = 180, padT = 14, padB = 6
          const maxV = Math.max(targetAmount, ...journey.map((p) => p.value), 1)
          const xi = (i: number) => (i / (journey.length - 1)) * W
          const yv = (v: number) => padT + (1 - v / maxV) * (H - padT - padB)
          const linePts = journey.map((p, i) => `${xi(i)},${yv(p.value)}`).join(' ')
          const areaPts = `0,${H} ${linePts} ${W},${H}`
          return (
            <div className="mt-4 relative" style={{ height: 200 }}>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
                <defs><linearGradient id="efg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={AMBER} stopOpacity="0.18" /><stop offset="100%" stopColor={AMBER} stopOpacity="0" /></linearGradient></defs>
                {targetAmount > 0 && <line x1={0} y1={yv(targetAmount)} x2={W} y2={yv(targetAmount)} stroke={MINT} strokeWidth="1.5" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />}
                <polygon points={areaPts} fill="url(#efg)" />
                <polyline points={linePts} fill="none" stroke={AMBER} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
              <div className="flex items-center justify-between mt-1.5 text-[10px]" style={{ color: 'var(--ink-soft)' }}>
                <span>{journey[0].label}</span>
                <span className="font-semibold" style={{ color: AMBER_INK }}>{t('emergency_fund.journey_now')} · {formatCurrency(accumulatedFund)}</span>
              </div>
            </div>
          )
        })() : (
          <div className="mt-4 rounded-xl border border-dashed py-10 text-center" style={{ borderColor: 'var(--border-soft)' }}>
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>{t('emergency_fund.journey_no_history')}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={openTxn}><Plus className="h-4 w-4" /> {t('emergency_fund.set_fund_button')}</Button>
          </div>
        )}
      </div>

      {/* Lokasi dana + Pembentukan (log) */}
      <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr]">
        {/* Disimpan Di Mana — akun riil (sinkron) + non-akun */}
        <div className="s-card p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>{t('emergency_fund.locations_title')}</p>
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>{t('emergency_fund.locations_subtitle')}</p>
          {allLocations.length > 0 && (
            <div className="mt-3 flex w-full quest-track" style={{ ['--bar-h' as string]: '9px' }}>
              {allLocations.map((l, i) => <div key={l.key} title={l.name} style={{ width: `${(l.amount / Math.max(1, accumulatedFund)) * 100}%`, background: locPalette[i % locPalette.length] }} />)}
            </div>
          )}
          <div className="mt-3 space-y-2.5">
            {allLocations.map((l, i) => (
              <div key={l.key} className="group flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="size-2 rounded-full shrink-0" style={{ background: locPalette[i % locPalette.length] }} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm truncate" style={{ color: 'var(--ink)' }}>{l.name}{l.kind === 'account' && <span className="text-[9px] uppercase tracking-wide px-1 py-0.5 rounded shrink-0" style={{ background: tint(MINT, 10), color: 'var(--c-mint-ink)' }}>{t('emergency_fund.location_account_badge')}</span>}</span>
                    {l.kind === 'account' && (
                      <span className="num text-[10px]" style={{ color: 'var(--ink-soft)' }}>
                        {t('emergency_fund.location_account_balance')} {formatCurrency(l.balance ?? 0)}
                        {l.amount > (l.balance ?? Infinity) && <span className="font-semibold" style={{ color: 'var(--c-amber-ink)' }}> · {t('emergency_fund.over_balance_badge')}</span>}
                      </span>
                    )}
                  </span>
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  <span className="flex gap-0.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition">
                    {l.kind === 'account'
                      ? <>
                          <Button variant="ghost" size="icon-sm" onClick={() => openLink({ id: l.allocId, account_id: l.accountId!, amount: l.amount })}><Pencil className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => handleUnlink(l.allocId)}><Trash2 className="h-3 w-3" style={{ color: 'var(--danger)' }} /></Button>
                        </>
                      : <>
                          <Button variant="ghost" size="icon-sm" onClick={() => openEditLocation({ id: l.allocId, fund_id: fund?.id ?? '', account_name: l.name, amount: l.amount })}><Pencil className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteLocation(l.allocId)}><Trash2 className="h-3 w-3" style={{ color: 'var(--danger)' }} /></Button>
                        </>}
                  </span>
                  <span className="num font-medium text-sm" style={{ color: 'var(--ink)' }}>{formatCurrency(l.amount)}</span>
                </span>
              </div>
            ))}
            {allLocations.length === 0 && <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{t('emergency_fund.locations_empty')}</p>}
          </div>
        </div>

        {/* Pembentukan — log transaksi */}
        <div className="s-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 p-5 pb-3">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>{t('emergency_fund.log_title')}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>{t('emergency_fund.log_subtitle')}</p>
            </div>
          </div>
          {transactions.length === 0 ? (
            <p className="px-5 pb-5 text-[12px]" style={{ color: 'var(--ink-soft)' }}>{t('emergency_fund.log_empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-y text-[11px] font-medium" style={{ borderColor: 'var(--border-soft)', color: 'var(--ink-soft)' }}>
                    <th className="px-5 py-2 text-left">{t('emergency_fund.col_date')}</th>
                    <th className="px-3 py-2 text-left">{t('emergency_fund.col_location')}</th>
                    <th className="px-3 py-2 text-right">{t('emergency_fund.col_amount')}</th>
                    <th className="px-5 py-2 text-right" />
                  </tr>
                </thead>
                <tbody>
                  {[...transactions].sort((a, b) => b.date.localeCompare(a.date)).map((tx) => {
                    const setor = tx.kind === 'setor'
                    return (
                      <tr key={tx.id} className="group border-b last:border-b-0 transition-colors hover:bg-[var(--surface-2)]" style={{ borderColor: 'var(--border-soft)' }}>
                        <td className="px-5 py-2.5 num whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>{dmy(tx.date)}</td>
                        <td className="px-3 py-2.5">
                          <span className="flex items-center gap-1.5 min-w-0">
                            {setor ? <ArrowDownLeft className="size-3.5 shrink-0" style={{ color: MINT }} /> : <ArrowUpRight className="size-3.5 shrink-0" style={{ color: 'var(--c-coral-ink)' }} />}
                            <span className="truncate" style={{ color: 'var(--ink)' }}>{tx.location || (setor ? t('emergency_fund.txn_deposit') : t('emergency_fund.txn_withdrawal'))}</span>
                            {tx.note && <span className="truncate text-[11px]" style={{ color: 'var(--ink-soft)' }}>· {tx.note}</span>}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right num font-semibold whitespace-nowrap" style={{ color: setor ? MINT_INK : 'var(--c-coral-ink)' }}>{setor ? '+' : '−'}{formatCurrency(tx.amount)}</td>
                        <td className="px-5 py-2.5 text-right">
                          <Button variant="ghost" size="icon-sm" className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition" onClick={() => handleDeleteTxn(tx)}><Trash2 className="h-3 w-3" style={{ color: 'var(--danger)' }} /></Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Catat transaksi (pembentukan) */}
      <Dialog open={txnDialogOpen} onOpenChange={setTxnDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl grid place-items-center shrink-0" style={{ background: tint(MINT, 10) }}><ShieldCheck className="size-5" style={{ color: MINT }} /></div>
              <div className="min-w-0">
                <DialogTitle className="text-lg" style={{ fontFamily: 'var(--font-display)' }}>{t('emergency_fund.txn_dialog_title')}</DialogTitle>
                <DialogDescription>{t('emergency_fund.txn_dialog_desc')}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="flex items-start gap-2 rounded-lg p-3" style={{ background: tint(MINT, 9), border: `1px solid ${tint(MINT, 20)}` }}>
              <Check className="size-4 mt-0.5 shrink-0" style={{ color: 'var(--c-mint-ink)' }} />
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ink)' }}>{t('emergency_fund.txn_note_pre')} <strong>{t('emergency_fund.txn_note_emphasis')}</strong> {t('emergency_fund.txn_note_post')}</p>
            </div>

            <div className="grid gap-1.5">
              <Label>{t('emergency_fund.txn_where_label')}</Label>
              {(() => {
                const acc = accounts.find((a) => a.name === txnForm.location)
                return (
                  <div className="relative">
                    <div className="flex items-center gap-3 h-12 rounded-lg border px-3" style={{ boxShadow: 'var(--card-shadow)', borderColor: 'var(--border-soft)', background: 'var(--surface)' }}>
                      {txnOther ? (
                        <><div className="size-8 rounded-lg grid place-items-center shrink-0" style={{ background: 'var(--surface-2)' }}><Plus className="size-4" style={{ color: 'var(--ink-muted)' }} /></div><span className="text-sm" style={{ color: 'var(--ink)' }}>{t('emergency_fund.txn_other_place')}</span></>
                      ) : acc ? (
                        <><InstitutionLogo accountName={acc.name} size={32} shape="circle" /><span className="min-w-0"><span className="block text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{acc.name}</span><span className="block num text-[11px]" style={{ color: 'var(--ink-soft)' }}>{t('emergency_fund.txn_recorded_balance')} {formatCurrency(acc.current_balance)}</span></span></>
                      ) : (
                        <span className="text-sm" style={{ color: 'var(--ink-soft)' }}>{t('emergency_fund.txn_select_account')}</span>
                      )}
                      <ChevronDown className="size-4 ml-auto shrink-0" style={{ color: 'var(--ink-soft)' }} />
                    </div>
                    <select aria-label={t('emergency_fund.txn_select_account_aria')} value={txnOther ? '__other__' : txnForm.location}
                      onChange={(e) => {
                        if (e.target.value === '__other__') { setTxnOther(true); setTxnForm((f) => ({ ...f, location: '', total: 0 })) }
                        else { setTxnOther(false); const a2 = accounts.find((a) => a.name === e.target.value); const cur = currentAmountFor(e.target.value); setTxnForm((f) => ({ ...f, location: e.target.value, total: cur > 0 ? cur : (a2?.current_balance ?? 0) })) }
                      }}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer">
                      <option value="">{t('emergency_fund.txn_select_placeholder')}</option>
                      {accounts.map((a) => <option key={a.id} value={a.name}>{a.name} — {t('emergency_fund.txn_balance_inline')} {formatCurrency(a.current_balance)}</option>)}
                      <option value="__other__">{t('emergency_fund.txn_other_option')}</option>
                    </select>
                  </div>
                )
              })()}
              {txnOther && <Input value={txnForm.location} onChange={(e) => setTxnForm({ ...txnForm, location: e.target.value })} placeholder={t('emergency_fund.txn_place_name_placeholder')} />}
            </div>

            <div className="grid gap-1.5">
              <Label>{t('emergency_fund.txn_amount_label')}</Label>
              <div className="flex items-center rounded-lg border overflow-hidden h-14" style={{ borderColor: 'var(--border-soft)' }}>
                <span className="self-stretch grid place-items-center px-3.5 text-sm font-medium" style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}>Rp</span>
                <NumberInput value={txnForm.total} onChange={(n) => setTxnForm({ ...txnForm, total: n })} placeholder="0" className="flex-1 border-0 h-full text-2xl font-bold" />
              </div>
              {(() => {
                const acc = accounts.find((a) => a.name === txnForm.location)
                if (!acc || acc.current_balance <= 0) return null
                const pct = (txnForm.total / acc.current_balance) * 100
                const over = pct > 100
                return (
                  <div className="mt-1">
                    <span className="quest-bar w-full" style={{ ['--bar-fill' as string]: over ? 'var(--c-coral)' : MINT, ['--bar-h' as string]: '8px' }}><i style={{ width: `${Math.min(100, pct)}%` }} /></span>
                    <div className="flex items-center justify-between mt-1.5 text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                      <span>{t('emergency_fund.txn_marked')} <span className="font-semibold" style={{ color: over ? 'var(--c-coral-ink)' : 'var(--ink)' }}>{pct.toFixed(0)}%</span> {t('emergency_fund.txn_of_balance')}{over ? ` · ${t('emergency_fund.txn_over_balance')}` : ''}</span>
                      <button type="button" onClick={() => setTxnForm((f) => ({ ...f, total: acc.current_balance }))} className="num hover:underline" style={{ color: 'var(--ink-soft)' }}>{formatCurrency(txnForm.total)} / {formatCurrency(acc.current_balance)}</button>
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>{t('emergency_fund.txn_date_label')}</Label><Input type="date" value={txnForm.date} onChange={(e) => setTxnForm({ ...txnForm, date: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>{t('emergency_fund.txn_note_label')}</Label><Input value={txnForm.note} onChange={(e) => setTxnForm({ ...txnForm, note: e.target.value })} placeholder={t('emergency_fund.txn_note_placeholder')} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxnDialogOpen(false)}>{t('emergency_fund.cancel')}</Button>
            <Button onClick={handleSaveTxn} disabled={saving || !txnForm.location.trim()}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {t('emergency_fund.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit lokasi (saldo manual) */}
      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLocationId ? t('emergency_fund.loc_dialog_edit_title') : t('emergency_fund.loc_dialog_add_title')}</DialogTitle>
            <DialogDescription>{t('emergency_fund.loc_dialog_desc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5"><Label>{t('emergency_fund.loc_asset_name')}</Label><Input value={locationForm.account_name} onChange={(e) => setLocationForm({ ...locationForm, account_name: e.target.value })} placeholder={t('emergency_fund.loc_asset_name_placeholder')} /></div>
            <div className="grid gap-1.5"><Label>{t('emergency_fund.loc_balance')}</Label><NumberInput value={locationForm.amount} onChange={(n) => setLocationForm({ ...locationForm, amount: n })} placeholder="0" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLocationDialogOpen(false)}>{t('emergency_fund.cancel')}</Button>
            <Button onClick={handleSaveLocation} disabled={saving || !locationForm.account_name}>{saving && <Loader2 className="size-4 animate-spin" />}{editingLocationId ? t('emergency_fund.save') : t('emergency_fund.add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hubungkan akun (account_allocations — sinkron Aset Likuid) */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('emergency_fund.link_dialog_title')}</DialogTitle>
            <DialogDescription>{t('emergency_fund.link_dialog_desc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>{t('emergency_fund.link_account_label')}</Label>
              <select value={linkForm.accountId}
                onChange={(e) => { const acc = accounts.find((a) => a.id === e.target.value); setLinkForm((f) => ({ ...f, accountId: e.target.value, amount: f.amount || acc?.current_balance || 0 })) }}
                className="h-10 rounded-lg border px-3 text-sm outline-none focus:border-[var(--ink)]" style={{ borderColor: 'var(--border-soft)', background: 'var(--surface)', color: 'var(--ink)' }}>
                <option value="">{t('emergency_fund.link_select_account')}</option>
                {accounts.map((a) => <option key={a.id} value={a.id} disabled={a.id !== linkForm.accountId && linkedAccountIds.has(a.id)}>{a.name} · {formatCurrency(a.current_balance)}{a.id !== linkForm.accountId && linkedAccountIds.has(a.id) ? ` (${t('emergency_fund.link_already_linked')})` : ''}</option>)}
              </select>
              {accounts.length === 0 && <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{t('emergency_fund.link_no_accounts')}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label>{t('emergency_fund.link_earmark_label')}</Label>
              <RpField value={linkForm.amount} onChange={(n) => setLinkForm((f) => ({ ...f, amount: n }))} />
              {(() => { const acc = accounts.find((a) => a.id === linkForm.accountId); return acc && linkForm.amount > acc.current_balance ? <p className="text-[11px]" style={{ color: 'var(--c-amber-ink)' }}>{t('emergency_fund.link_over_balance')} ({formatCurrency(acc.current_balance)}).</p> : null })()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>{t('emergency_fund.cancel')}</Button>
            <Button onClick={handleSaveLink} disabled={saving || !linkForm.accountId}>{saving && <Loader2 className="size-4 animate-spin" />}{t('emergency_fund.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RpField({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center rounded-lg border overflow-hidden h-10" style={{ borderColor: 'var(--border-soft)' }}>
      <span className="self-stretch grid place-items-center px-2.5 text-xs font-medium" style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}>Rp</span>
      <NumberInput value={value} onChange={onChange} placeholder="0" className="flex-1 border-0" />
    </div>
  )
}
