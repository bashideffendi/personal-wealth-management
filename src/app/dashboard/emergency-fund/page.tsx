'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { Plus, Minus, Pencil, Trash2, Loader2, Check, Info, ArrowDownLeft, ArrowUpRight } from 'lucide-react'

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
const MINT = '#10B981'
// Preset lokasi/instrumen (ikut sheet user) — tetap bisa ketik bebas.
const LOCATION_PRESETS = ['Tabungan', 'Deposito', 'Reksa Dana Pasar Uang', 'Emas', 'Saham', 'P2P Lending', 'Lainnya']

const monthYearNow = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
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

export default function EmergencyFundPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fund, setFund] = useState<EmergencyFund | null>(null)
  const [locations, setLocations] = useState<EmergencyFundLocation[]>([])
  const [transactions, setTransactions] = useState<EmergencyFundTransaction[]>([])

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

  type Account = { id: string; name: string; type: string; current_balance: number }
  type AccAlloc = { id: string; account_id: string; amount: number; accounts: { name: string; current_balance: number } | null }
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountAllocations, setAccountAllocations] = useState<AccAlloc[]>([])
  const allocatedFromAccounts = accountAllocations.reduce((s, a) => s + a.amount, 0)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkForm, setLinkForm] = useState({ id: '', accountId: '', amount: 0 })

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
    if (!user) { setLoading(false); return }
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
    if (fundRes.data) {
      const f = fundRes.data as EmergencyFund
      setFund(f); setJobStability(f.job_stability as JobStability); setDependents(f.dependents)
      setMonthlyExpenses(f.monthly_expenses); setTargetAmount(f.target_amount)
    }
    if (locRes.data) setLocations(locRes.data as EmergencyFundLocation[])
    setAccountAllocations((allocRes.data ?? []) as AccAlloc[])
    setTransactions((txnRes.data ?? []) as EmergencyFundTransaction[])
    setAccounts((accRes.data ?? []) as Account[])
    setLoading(false)
  }

  async function ensureFund(): Promise<string | null> {
    if (fund?.id) return fund.id
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: created } = await supabase.from('emergency_funds').insert({
      user_id: user.id, job_stability: jobStability, dependents, monthly_expenses: monthlyExpenses, target_amount: targetAmount, current_amount: accumulatedFund,
    }).select('*').single()
    if (created) setFund(created as EmergencyFund)
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
    if (fund) await supabase.from('emergency_funds').update(payload).eq('id', fund.id)
    else await supabase.from('emergency_funds').insert(payload)
    setSaving(false); void fetchData()
  }

  // ── Lokasi (di mana dana disimpan) ──
  function openEditLocation(loc: EmergencyFundLocation) { setEditingLocationId(loc.id); setLocationForm({ account_name: loc.account_name, amount: loc.amount }); setLocationDialogOpen(true) }
  async function handleSaveLocation() {
    const fundId = await ensureFund()
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
    if (existingId) await supabase.from('account_allocations').update({ amount: linkForm.amount }).eq('id', existingId)
    else await supabase.from('account_allocations').insert({ user_id: user.id, account_id: linkForm.accountId, purpose_kind: 'emergency_fund', emergency_fund_id: fundId, amount: linkForm.amount })
    setSaving(false); setLinkDialogOpen(false); void fetchData()
  }
  async function handleUnlink(id: string) {
    if (!confirm('Lepas akun ini dari dana darurat? Saldo akunnya gak kehapus, cuma gak di-earmark lagi.')) return
    await supabase.from('account_allocations').delete().eq('id', id); void fetchData()
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
    const acct = accounts.find((a) => a.name.toLowerCase() === dest.toLowerCase())
    if (acct) {
      const alloc = accountAllocations.find((a) => a.account_id === acct.id)
      if (alloc) await supabase.from('account_allocations').update({ amount: total }).eq('id', alloc.id)
      else await supabase.from('account_allocations').insert({ user_id: user.id, account_id: acct.id, purpose_kind: 'emergency_fund', emergency_fund_id: fundId, amount: total })
    } else {
      const loc = locations.find((l) => l.account_name.toLowerCase() === dest.toLowerCase())
      if (loc) await supabase.from('emergency_fund_locations').update({ amount: total }).eq('id', loc.id)
      else await supabase.from('emergency_fund_locations').insert({ fund_id: fundId, account_name: dest, amount: total })
    }
    // 2) Log SELISIH (buat chart perjalanan) kalau berubah.
    if (delta !== 0) {
      await supabase.from('emergency_fund_transactions').insert({
        fund_id: fundId, date: txnForm.date, kind: delta > 0 ? 'setor' : 'tarik', amount: Math.abs(delta), location: dest, note: txnForm.note.trim(),
      })
    }
    // 3) Sinkron current_amount fund.
    await supabase.from('emergency_funds').update({ current_amount: Math.max(0, accumulatedFund + delta) }).eq('id', fundId)
    setSaving(false); setTxnDialogOpen(false); void fetchData()
  }
  async function handleDeleteTxn(t: EmergencyFundTransaction) {
    if (!confirm('Hapus catatan transaksi ini? Saldo lokasi ikut disesuaikan.')) return
    const signed = t.kind === 'setor' ? t.amount : -t.amount
    await supabase.from('emergency_fund_transactions').delete().eq('id', t.id)
    const loc = locations.find((l) => l.account_name.toLowerCase() === t.location.toLowerCase())
    if (loc) await supabase.from('emergency_fund_locations').update({ amount: Math.max(0, loc.amount - signed) }).eq('id', loc.id)
    void fetchData()
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
    { label: 'Esensial saja', note: 'kebutuhan pokok · est. −22%', exp: monthlyExpenses * 0.78 },
    { label: 'Saat ini', note: 'pengeluaran rata-rata kamu', exp: monthlyExpenses },
    { label: 'Gaya hidup penuh', note: 'plus diskresi · est. +35%', exp: monthlyExpenses * 1.35 },
  ].map((s) => ({ ...s, months: s.exp > 0 ? accumulatedFund / s.exp : 0 })) : []

  // Komposisi lokasi (bar) — akun riil (sinkron Aset Likuid) + lokasi non-akun.
  const allLocations = useMemo(() => [
    ...accountAllocations.map((a) => ({ key: `acc-${a.id}`, kind: 'account' as const, name: a.accounts?.name ?? 'Akun', amount: a.amount, balance: a.accounts?.current_balance ?? 0, allocId: a.id, accountId: a.account_id })),
    ...locations.map((l) => ({ key: `loc-${l.id}`, kind: 'manual' as const, name: l.account_name, amount: l.amount, balance: null as number | null, allocId: l.id, accountId: null as string | null })),
  ].filter((l) => l.amount > 0).sort((a, b) => b.amount - a.amount), [accountAllocations, locations])
  const linkedAccountIds = new Set(accountAllocations.map((a) => a.account_id))
  const locPalette = [AMBER, '#8B5CF6', MINT, '#6366F1', '#0EA5E9', '#F43F5E', '#64748B']

  // Perjalanan membangun dana — kumulatif dari log. Baseline = saldo sebelum transaksi tercatat.
  const journey = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
    const net = sorted.reduce((s, t) => s + (t.kind === 'setor' ? t.amount : -t.amount), 0)
    const baseline = Math.max(0, accumulatedFund - net)
    let run = baseline
    const pts = [{ label: 'Awal', value: baseline }]
    for (const t of sorted) { run = Math.max(0, run + (t.kind === 'setor' ? t.amount : -t.amount)); pts.push({ label: dmy(t.date), value: run }) }
    return pts
  }, [transactions, accumulatedFund])

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <datalist id="ef-dest">
        {[...new Set([...accounts.map((a) => a.name), ...locations.map((l) => l.account_name), ...LOCATION_PRESETS])].map((p) => <option key={p} value={p} />)}
      </datalist>
      {/* Header — DI LUAR card (di background halaman), ikut mock */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-xl">
          <p className="text-[11px] font-semibold tracking-[0.16em] uppercase" style={{ color: 'var(--ink-soft)' }}>Bantalan keuangan · {monthYearNow}</p>
          <h1 className="mt-0.5 text-2xl sm:text-3xl leading-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>Dana Darurat</h1>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--ink-muted)' }}>Tabungan terpisah buat kejadian tak terduga: kehilangan pekerjaan, masalah kesehatan, perbaikan besar.</p>
        </div>
        <Button onClick={openTxn}><Plus className="h-4 w-4" /> Atur dana darurat</Button>
      </div>

      {/* Card — cuma ring (kiri, amber-tint) + metrik (kanan, surface). Tanpa judul di dalam. */}
      <div className="grid sm:grid-cols-[auto_1fr] rounded-2xl border overflow-hidden" style={{ borderColor: `${AMBER}33` }}>
        <div className="grid place-items-center p-6 sm:p-8" style={{ background: `${AMBER}0F` }}>
          <div className="relative size-36">
            <svg viewBox="0 0 120 120" className="size-36 -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke={`${AMBER}33`} strokeWidth="11" />
              <circle cx="60" cy="60" r="52" fill="none" stroke={AMBER} strokeWidth="11" strokeLinecap="round" strokeDasharray={2 * Math.PI * 52} strokeDashoffset={(1 - Math.min(progressPercent, 100) / 100) * 2 * Math.PI * 52} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="num font-bold" style={{ fontSize: 'clamp(28px,3vw,36px)', color: AMBER, letterSpacing: '-0.02em' }}>{progressPercent.toFixed(0)}%</span>
              <span className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--ink-soft)' }}>Tercapai</span>
            </div>
          </div>
        </div>
        <div className="p-6 sm:p-8 min-w-0" style={{ background: 'var(--surface)' }}>
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Dana Terkumpul</p>
          <p className="num tabular font-bold leading-none mt-1.5 flex items-baseline gap-2 flex-wrap" style={{ color: 'var(--ink)' }}>
            <span style={{ fontSize: 'clamp(30px,4.5vw,46px)', letterSpacing: '-0.03em' }}>{formatCurrency(accumulatedFund)}</span>
            <span className="text-base font-normal" style={{ color: 'var(--ink-soft)' }}>/ {targetAmount > 0 ? formatCurrency(targetAmount) : 'atur target'}</span>
          </p>
          <div className="mt-4 h-2.5 w-full rounded-full overflow-hidden" style={{ background: `${AMBER}26` }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(progressPercent, accumulatedFund > 0 ? 2 : 0)}%`, background: AMBER }} />
          </div>
          {targetAmount > 0 ? (
            <>
              <div className="mt-5 grid grid-cols-3 gap-4">
                <div><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Cukup buat hidup</p><p className="num font-bold mt-1" style={{ color: MINT, fontSize: 'clamp(15px,1.6vw,19px)' }}>{coverageMonths.toFixed(1)} bulan</p></div>
                <div><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Target</p><p className="num font-bold mt-1" style={{ color: 'var(--ink)', fontSize: 'clamp(15px,1.6vw,19px)' }}>{targetMonths.toFixed(0)} bulan</p></div>
                <div><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Kurang</p><p className="num font-bold mt-1" style={{ color: deficit > 0 ? '#F43F5E' : MINT, fontSize: 'clamp(15px,1.6vw,19px)' }}>{deficit > 0 ? formatCurrency(deficit) : 'Tercapai'}</p></div>
              </div>
              {coverageMonths > 0 && <p className="mt-4 text-[12px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>Kalau penghasilanmu berhenti hari ini, dana ini cukup nutup hidup <span className="font-semibold" style={{ color: 'var(--ink)' }}>± {coverageMonths.toFixed(1)} bulan</span> — kira-kira sampai {etaDate(coverageMonths)}.</p>}
            </>
          ) : (
            <p className="mt-4 text-sm" style={{ color: 'var(--ink-muted)' }}>Atur target di <span className="font-semibold" style={{ color: '#B45309' }}>Kalkulator</span> bawah, terus <button type="button" onClick={openTxn} className="font-semibold underline underline-offset-2" style={{ color: '#B45309' }}>atur dana darurat</button> — cakupan &amp; kekuranganmu langsung muncul di sini.</p>
          )}
        </div>
      </div>

      {/* Edukasi — apa itu dana darurat (adaptasi referensi user) */}
      <div className="s-card p-5 sm:p-6">
        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase flex items-center gap-1.5" style={{ color: '#8B5CF6' }}><Info className="size-3.5" /> Apa itu Dana Darurat?</p>
        <p className="text-sm mt-2 leading-relaxed max-w-3xl" style={{ color: 'var(--ink-muted)' }}>Cadangan uang khusus buat kejadian tak terduga — kehilangan pekerjaan, sakit, perbaikan besar — biar kamu tetap aman <span className="font-semibold" style={{ color: 'var(--ink)' }}>tanpa harus ngutang</span>. Ini fondasi paling dasar, dibangun duluan sebelum mulai investasi.</p>
        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl p-4" style={{ background: `${MINT}14` }}>
            <p className="num text-2xl font-bold" style={{ color: '#059669' }}>3–6 bulan</p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--ink-muted)' }}>pengeluaran — kalau penghasilanmu <span className="font-semibold">stabil</span> (karyawan tetap, gaji rutin).</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: `${AMBER}14` }}>
            <p className="num text-2xl font-bold" style={{ color: '#B45309' }}>6–12 bulan</p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--ink-muted)' }}>pengeluaran — kalau <span className="font-semibold">gak menentu</span> (freelance, komisi, usaha sendiri).</p>
          </div>
        </div>
        <p className="text-[12px] mt-3 leading-relaxed" style={{ color: 'var(--ink-soft)' }}>Makin banyak tanggungan atau biaya hidup tinggi → siapkan lebih besar. Tinjau ulang tiap 6 bulan atau pas biaya hidupmu berubah, biar tetap pas.</p>
      </div>

      {/* Kalkulator + Rencana akselerasi */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="s-card p-5">
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Kalkulator Target</p>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>Target = stabilitas kerja + tanggungan + pengeluaran bulanan.</p>
          <div className="mt-4 grid gap-4">
            <div className="grid gap-1.5">
              <Label>Stabilitas Pekerjaan</Label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(JOB_STABILITY_LABELS) as JobStability[]).map((k) => {
                  const on = jobStability === k
                  return (
                    <button key={k} type="button" onClick={() => setJobStability(k)}
                      className="rounded-lg border px-2 py-2.5 text-[12px] font-medium leading-tight transition"
                      style={{ borderColor: on ? AMBER : 'var(--border-soft)', background: on ? `${AMBER}14` : 'var(--surface)', color: on ? '#B45309' : 'var(--ink-muted)' }}>
                      {JOB_STABILITY_LABELS[k]}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Tanggungan</Label>
                <div className="flex items-center rounded-lg border overflow-hidden h-10" style={{ borderColor: 'var(--border-soft)' }}>
                  <button type="button" onClick={() => setDependents(Math.max(0, dependents - 1))} className="size-10 grid place-items-center shrink-0 transition hover:bg-[var(--surface-2)]" style={{ color: 'var(--ink-muted)' }}><Minus className="size-4" /></button>
                  <span className="flex-1 text-center num font-semibold" style={{ color: 'var(--ink)' }}>{dependents}</span>
                  <button type="button" onClick={() => setDependents(dependents + 1)} className="size-10 grid place-items-center shrink-0 transition hover:bg-[var(--surface-2)]" style={{ color: 'var(--ink-muted)' }}><Plus className="size-4" /></button>
                </div>
              </div>
              <div className="grid gap-1.5"><Label>Pengeluaran / bulan</Label><RpField value={monthlyExpenses} onChange={setMonthlyExpenses} /></div>
            </div>
            <div className="rounded-xl p-4 flex items-center justify-between gap-3" style={{ background: `${AMBER}14` }}>
              <div>
                <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: '#B45309' }}>Rekomendasi</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>Aman {multiplier} bulan tanpa penghasilan ({multiplier}× pengeluaran)</p>
              </div>
              <span className="num text-xl font-bold whitespace-nowrap" style={{ color: AMBER }}>{formatCurrency(recommendation)}</span>
            </div>
            <div className="grid gap-1.5"><Label>Target kamu (Rp) — bisa ubah sendiri</Label><RpField value={targetAmount} onChange={setTargetAmount} /></div>
            <Button onClick={handleSaveSettings} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Simpan target</Button>
          </div>
        </div>

        {plans.length > 0 ? (
          <div className="s-card p-5">
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Rencana Akselerasi</p>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>Ritme setoran buat nutup kekurangan {formatCurrency(deficit)}.</p>
            <div className="mt-3 space-y-2.5">
              {plans.map((p) => (
                <div key={p.label} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ border: `1px solid ${p.recommended ? AMBER : 'var(--border-soft)'}`, background: p.recommended ? `${AMBER}0F` : 'var(--surface)' }}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--ink)' }}>{p.label}{p.recommended && <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase" style={{ background: AMBER, color: '#FFF' }}>Disarankan</span>}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>{p.months} bln · tercapai {p.eta}</p>
                  </div>
                  <p className="num text-lg font-bold whitespace-nowrap" style={{ color: p.recommended ? AMBER : 'var(--ink)' }}>{formatCurrency(p.monthly)}<span className="text-xs font-normal" style={{ color: 'var(--ink-soft)' }}>/bln</span></p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="s-card p-5 grid place-items-center text-center">
            <div>
              <div className="size-11 rounded-full grid place-items-center mx-auto" style={{ background: `${MINT}1A` }}><Check className="size-5" style={{ color: MINT }} /></div>
              <p className="font-semibold mt-2" style={{ color: 'var(--ink)' }}>{targetAmount > 0 ? 'Dana daruratmu aman' : 'Hitung targetmu dulu'}</p>
              <p className="text-[12px] mt-1 max-w-xs" style={{ color: 'var(--ink-muted)' }}>{targetAmount > 0 ? 'Targetmu udah tercapai. Pertahankan — tinjau ulang tiap 6 bulan / pas biaya hidup berubah.' : 'Isi kalkulator di sebelah biar tau target idealmu, terus atur dana daruratmu.'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Perjalanan membangun dana — chart kumulatif dari log */}
      <div className="s-card p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Perjalanan Membangun Dana</p>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
              {journey.length >= 2 ? <>Setoran terakhir {journey[journey.length - 1].label} · estimasi tercapai <span className="font-semibold" style={{ color: 'var(--ink)' }}>{etaDate(deficit > 0 ? deficit / Math.max(1, Math.ceil(deficit / 6)) : 0)}</span></> : 'Catat setoran biar perjalanannya kebentuk di sini.'}
            </p>
          </div>
          {targetAmount > 0 && <span className="text-[11px] num" style={{ color: MINT }}>● Target {formatCurrency(targetAmount)}</span>}
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
                <span className="font-semibold" style={{ color: AMBER }}>Sekarang · {formatCurrency(accumulatedFund)}</span>
              </div>
            </div>
          )
        })() : (
          <div className="mt-4 rounded-xl border border-dashed py-10 text-center" style={{ borderColor: 'var(--border-soft)' }}>
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>Belum ada riwayat setoran.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={openTxn}><Plus className="h-4 w-4" /> Atur dana darurat</Button>
          </div>
        )}
      </div>

      {/* Lokasi dana + Pembentukan (log) */}
      <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr]">
        {/* Disimpan Di Mana — akun riil (sinkron) + non-akun */}
        <div className="s-card p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Uangnya Di Mana?</p>
            <Button variant="outline" size="sm" onClick={openTxn}><Plus className="h-3.5 w-3.5" /> Atur</Button>
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>Rekening tempat dana daruratmu — saldo kebaca otomatis dari Aset Likuid.</p>
          {allLocations.length > 0 && (
            <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
              {allLocations.map((l, i) => <div key={l.key} title={l.name} style={{ width: `${(l.amount / Math.max(1, accumulatedFund)) * 100}%`, background: locPalette[i % locPalette.length] }} />)}
            </div>
          )}
          <div className="mt-3 space-y-2.5">
            {allLocations.map((l, i) => (
              <div key={l.key} className="group flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="size-2 rounded-full shrink-0" style={{ background: locPalette[i % locPalette.length] }} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm truncate" style={{ color: 'var(--ink)' }}>{l.name}{l.kind === 'account' && <span className="text-[9px] uppercase tracking-wide px-1 py-0.5 rounded shrink-0" style={{ background: `${MINT}1A`, color: '#059669' }}>akun</span>}</span>
                    {l.kind === 'account' && <span className="num text-[10px]" style={{ color: 'var(--ink-soft)' }}>saldo akun {formatCurrency(l.balance ?? 0)}</span>}
                  </span>
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  <span className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
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
            {allLocations.length === 0 && <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>Belum ada. Klik &ldquo;Tambah&rdquo; buat catat dana daruratmu.</p>}
          </div>
        </div>

        {/* Pembentukan — log transaksi */}
        <div className="s-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 p-5 pb-3">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Pembentukan Dana</p>
              <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>Riwayat setoran &amp; penarikan.</p>
            </div>
            <Button variant="outline" size="sm" onClick={openTxn}><Plus className="h-4 w-4" /> Atur</Button>
          </div>
          {transactions.length === 0 ? (
            <p className="px-5 pb-5 text-[12px]" style={{ color: 'var(--ink-soft)' }}>Belum ada transaksi tercatat.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-y text-[11px] font-medium" style={{ borderColor: 'var(--border-soft)', color: 'var(--ink-soft)' }}>
                    <th className="px-5 py-2 text-left">Tanggal</th>
                    <th className="px-3 py-2 text-left">Lokasi</th>
                    <th className="px-3 py-2 text-right">Jumlah</th>
                    <th className="px-5 py-2 text-right" />
                  </tr>
                </thead>
                <tbody>
                  {[...transactions].sort((a, b) => b.date.localeCompare(a.date)).map((t) => {
                    const setor = t.kind === 'setor'
                    return (
                      <tr key={t.id} className="group border-b last:border-b-0 transition-colors hover:bg-[var(--surface-2)]" style={{ borderColor: 'var(--border-soft)' }}>
                        <td className="px-5 py-2.5 num whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>{dmy(t.date)}</td>
                        <td className="px-3 py-2.5">
                          <span className="flex items-center gap-1.5 min-w-0">
                            {setor ? <ArrowDownLeft className="size-3.5 shrink-0" style={{ color: MINT }} /> : <ArrowUpRight className="size-3.5 shrink-0" style={{ color: '#F43F5E' }} />}
                            <span className="truncate" style={{ color: 'var(--ink)' }}>{t.location || (setor ? 'Setoran' : 'Penarikan')}</span>
                            {t.note && <span className="truncate text-[11px]" style={{ color: 'var(--ink-soft)' }}>· {t.note}</span>}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right num font-semibold whitespace-nowrap" style={{ color: setor ? MINT : '#F43F5E' }}>{setor ? '+' : '−'}{formatCurrency(t.amount)}</td>
                        <td className="px-5 py-2.5 text-right">
                          <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100 transition" onClick={() => handleDeleteTxn(t)}><Trash2 className="h-3 w-3" style={{ color: 'var(--danger)' }} /></Button>
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

      {/* Skenario + Catatan */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="s-card p-5">
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Skenario Penggunaan</p>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>Tanpa pemasukan baru, dana nutup berapa lama.</p>
          <div className="mt-3 space-y-2">
            {scenarios.length === 0 ? (
              <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>Isi pengeluaran bulanan dulu.</p>
            ) : scenarios.map((s) => (
              <div key={s.label} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5" style={{ background: 'var(--surface-2)' }}>
                <div className="min-w-0"><p className="text-sm" style={{ color: 'var(--ink)' }}>{s.label}</p><p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>{s.note}</p></div>
                <span className="num font-semibold shrink-0 whitespace-nowrap" style={{ color: AMBER }}>{s.months.toFixed(1)} bln</span>
              </div>
            ))}
          </div>
        </div>

        <div className="s-card p-5">
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase flex items-center gap-1.5" style={{ color: '#8B5CF6' }}><Check className="size-3.5" /> Tips Klunting</p>
          <ul className="mt-3 space-y-2.5">
            {['Taruh minimal 30% di instrumen instan (tabungan/e-wallet) biar bisa diakses dalam hitungan menit.', 'Jangan campur sama tabungan tujuan lain (DP rumah, liburan) — pisahin rekeningnya.', 'Bangun dana darurat DULU sebelum mulai investasi — ini bantalan paling dasar.', 'Tinjau ulang target tiap 6 bulan atau pas biaya hidupmu berubah.'].map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px]" style={{ color: 'var(--ink-muted)' }}><Check className="size-3.5 mt-0.5 shrink-0" style={{ color: MINT }} /> {t}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Catat transaksi (pembentukan) */}
      <Dialog open={txnDialogOpen} onOpenChange={setTxnDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atur Dana Darurat</DialogTitle>
            <DialogDescription>Isi <strong>berapa</strong> dana daruratmu di tiap rekening. Klunting cuma <strong>mencatat</strong> — gak mindahin uang &amp; gak ngubah saldo rekening aslimu.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Di rekening / tempat mana?</Label>
              <select value={txnOther ? '__other__' : txnForm.location}
                onChange={(e) => {
                  if (e.target.value === '__other__') { setTxnOther(true); setTxnForm((f) => ({ ...f, location: '', total: 0 })) }
                  else { setTxnOther(false); const acc = accounts.find((a) => a.name === e.target.value); const cur = currentAmountFor(e.target.value); setTxnForm((f) => ({ ...f, location: e.target.value, total: cur > 0 ? cur : (acc?.current_balance ?? 0) })) }
                }}
                className="h-10 rounded-lg border px-3 text-sm outline-none focus:border-[var(--ink)]" style={{ borderColor: 'var(--border-soft)', background: 'var(--surface)', color: 'var(--ink)' }}>
                <option value="">Pilih…</option>
                {accounts.map((a) => <option key={a.id} value={a.name}>{a.name} · saldo {formatCurrency(a.current_balance)}</option>)}
                <option value="__other__">Tempat lain (emas, deposito fisik…)</option>
              </select>
              {txnOther && <Input value={txnForm.location} onChange={(e) => setTxnForm({ ...txnForm, location: e.target.value })} placeholder="Nama tempat (mis. Emas 50gr)" />}
            </div>
            <div className="grid gap-1.5">
              <Label>Berapa di sini yang buat dana darurat?</Label>
              <NumberInput value={txnForm.total} onChange={(n) => setTxnForm({ ...txnForm, total: n })} placeholder="0" />
              {!txnOther && (() => {
                const acc = accounts.find((a) => a.name === txnForm.location)
                return acc ? <button type="button" onClick={() => setTxnForm((f) => ({ ...f, total: acc.current_balance }))} className="self-start text-[11px] font-medium hover:underline" style={{ color: '#B45309' }}>Pakai seluruh saldo rekening ({formatCurrency(acc.current_balance)})</button> : null
              })()}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Tanggal update</Label><Input type="date" value={txnForm.date} onChange={(e) => setTxnForm({ ...txnForm, date: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Catatan (opsional)</Label><Input value={txnForm.note} onChange={(e) => setTxnForm({ ...txnForm, note: e.target.value })} placeholder="mis. nabung dari bonus" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxnDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSaveTxn} disabled={saving || !txnForm.location.trim()}>{saving && <Loader2 className="size-4 animate-spin" />}Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit lokasi (saldo manual) */}
      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLocationId ? 'Edit Aset Non-Akun' : 'Tambah Aset Non-Akun'}</DialogTitle>
            <DialogDescription>Buat dana darurat yang GAK di akun (emas fisik, deposito non-akun). Yang di akun → pakai &ldquo;Hubungkan akun&rdquo; biar saldonya sinkron.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5"><Label>Nama aset</Label><Input value={locationForm.account_name} onChange={(e) => setLocationForm({ ...locationForm, account_name: e.target.value })} placeholder="Emas 50gr, Deposito fisik, dll" /></div>
            <div className="grid gap-1.5"><Label>Saldo (Rp)</Label><NumberInput value={locationForm.amount} onChange={(n) => setLocationForm({ ...locationForm, amount: n })} placeholder="0" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLocationDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSaveLocation} disabled={saving || !locationForm.account_name}>{saving && <Loader2 className="size-4 animate-spin" />}{editingLocationId ? 'Simpan' : 'Tambah'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hubungkan akun (account_allocations — sinkron Aset Likuid) */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hubungkan Akun</DialogTitle>
            <DialogDescription>Earmark sebagian/seluruh saldo akun buat dana darurat. Saldo akun sinkron otomatis dari Aset Likuid — gak bakal basi.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Akun</Label>
              <select value={linkForm.accountId}
                onChange={(e) => { const acc = accounts.find((a) => a.id === e.target.value); setLinkForm((f) => ({ ...f, accountId: e.target.value, amount: f.amount || acc?.current_balance || 0 })) }}
                className="h-10 rounded-lg border px-3 text-sm outline-none focus:border-[var(--ink)]" style={{ borderColor: 'var(--border-soft)', background: 'var(--surface)', color: 'var(--ink)' }}>
                <option value="">Pilih akun…</option>
                {accounts.map((a) => <option key={a.id} value={a.id} disabled={a.id !== linkForm.accountId && linkedAccountIds.has(a.id)}>{a.name} · {formatCurrency(a.current_balance)}{a.id !== linkForm.accountId && linkedAccountIds.has(a.id) ? ' (sudah dihubungkan)' : ''}</option>)}
              </select>
              {accounts.length === 0 && <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>Belum ada akun. Tambah dulu di menu Akun.</p>}
            </div>
            <div className="grid gap-1.5">
              <Label>Jumlah di-earmark buat dana darurat</Label>
              <RpField value={linkForm.amount} onChange={(n) => setLinkForm((f) => ({ ...f, amount: n }))} />
              {(() => { const acc = accounts.find((a) => a.id === linkForm.accountId); return acc && linkForm.amount > acc.current_balance ? <p className="text-[11px]" style={{ color: '#B45309' }}>⚠ Lebih dari saldo akun ({formatCurrency(acc.current_balance)}).</p> : null })()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSaveLink} disabled={saving || !linkForm.accountId}>{saving && <Loader2 className="size-4 animate-spin" />}Simpan</Button>
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
