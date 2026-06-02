'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import {
  INCOME_CATEGORIES, EXPENSE_CATEGORIES, SAVING_CATEGORIES, INVESTMENT_CATEGORIES,
} from '@/lib/constants'
import type { Account, RecurringTransaction } from '@/types'
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
  Plus, Pencil, Trash2, Loader2, Play, Pause, Search, Sparkles, Check,
  Home, Zap, Film, Shield, TrendingUp, Repeat, Wallet, CalendarClock, type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

type TxType = 'income' | 'expense' | 'saving' | 'investment'
type Freq = 'daily' | 'weekly' | 'monthly' | 'yearly'

const TYPE_LABELS: Record<TxType, string> = {
  income: 'Pemasukan', expense: 'Pengeluaran', saving: 'Tabungan', investment: 'Investasi',
}
const FREQ_LABELS: Record<Freq, string> = {
  daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan', yearly: 'Tahunan',
}

const CAT_META: Record<string, { color: string; icon: LucideIcon }> = {
  'Tempat Tinggal': { color: '#8B5CF6', icon: Home },
  'Cicilan / Utang': { color: '#F43F5E', icon: Home },
  Tagihan: { color: '#F59E0B', icon: Zap },
  'Utilitas': { color: '#F59E0B', icon: Zap },
  Langganan: { color: '#8B5CF6', icon: Film },
  Hiburan: { color: '#8B5CF6', icon: Film },
  Asuransi: { color: '#10B981', icon: Shield },
  Investasi: { color: '#F59E0B', icon: TrendingUp },
  Tabungan: { color: '#10B981', icon: Wallet },
}
const catMeta = (c: string) => CAT_META[c] ?? { color: '#64748B', icon: Repeat }

const MINT = '#10B981', AMBER = '#F59E0B', VIOLET = '#8B5CF6', CORAL = '#F43F5E'

function categoriesFor(type: TxType): readonly string[] {
  switch (type) {
    case 'income': return INCOME_CATEGORIES
    case 'expense': return EXPENSE_CATEGORIES
    case 'saving': return SAVING_CATEGORIES
    case 'investment': return INVESTMENT_CATEGORIES
  }
}

interface FormState {
  id: string | null
  name: string
  type: TxType
  category: string
  amount: number
  account_id: string
  frequency: Freq
  day_of_period: number
  start_date: string
  end_date: string
  is_active: boolean
  notes: string
}
const EMPTY: FormState = {
  id: null, name: '', type: 'expense', category: 'Langganan',
  amount: 0, account_id: '', frequency: 'monthly', day_of_period: 1,
  start_date: new Date().toISOString().split('T')[0], end_date: '',
  is_active: true, notes: '',
}

const DAY = 86_400_000
function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
function clampDay(year: number, month: number, day: number) {
  const last = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, last))
}

/** Tanggal jatuh tempo berikutnya (≥ hari ini). */
function nextRunDate(r: { frequency: string; day_of_period: number }): Date {
  const t = startOfToday()
  if (r.frequency === 'monthly') {
    const thisMo = clampDay(t.getFullYear(), t.getMonth(), r.day_of_period)
    return thisMo >= t ? thisMo : clampDay(t.getFullYear(), t.getMonth() + 1, r.day_of_period)
  }
  if (r.frequency === 'yearly') {
    const d = new Date(t.getFullYear(), 0, 1); d.setDate(r.day_of_period || 1)
    return d >= t ? d : new Date(t.getFullYear() + 1, 0, r.day_of_period || 1)
  }
  if (r.frequency === 'weekly') { const d = new Date(t); d.setDate(t.getDate() + 7); return d }
  const d = new Date(t); d.setDate(t.getDate() + 1); return d
}

/** Semua kemunculan dalam 30 hari ke depan (buat kalender). */
function occurrencesIn30(r: { frequency: string; day_of_period: number }): Date[] {
  const t = startOfToday(); const end = new Date(t.getTime() + 30 * DAY)
  const out: Date[] = []
  if (r.frequency === 'daily') {
    for (let i = 0; i <= 30; i++) out.push(new Date(t.getTime() + i * DAY))
  } else if (r.frequency === 'weekly') {
    let d = nextRunDate(r)
    while (d <= end) { out.push(new Date(d)); d = new Date(d.getTime() + 7 * DAY) }
  } else if (r.frequency === 'monthly') {
    for (const mo of [t.getMonth(), t.getMonth() + 1]) {
      const d = clampDay(t.getFullYear(), mo, r.day_of_period)
      if (d >= t && d <= end) out.push(d)
    }
  } else {
    const d = nextRunDate(r); if (d <= end) out.push(d)
  }
  return out
}

const dmy = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })

export default function RecurringPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<RecurringTransaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | Freq>('all')

  // Deteksi dari riwayat
  const [detectOpen, setDetectOpen] = useState(false)
  const [candidates, setCandidates] = useState<{ name: string; amount: number; category: string; count: number }[]>([])
  const [detecting, setDetecting] = useState(false)

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const [rR, aR] = await Promise.all([
      supabase.from('recurring_transactions').select('*').eq('user_id', user.id).order('day_of_period'),
      supabase.from('accounts').select('*').eq('user_id', user.id).order('name'),
    ])
    setItems((rR.data ?? []) as RecurringTransaction[])
    setAccounts((aR.data ?? []) as Account[])
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const payload = {
      user_id: user.id, name: form.name, type: form.type, category: form.category,
      amount: form.amount, account_id: form.account_id || null,
      frequency: form.frequency, day_of_period: form.day_of_period,
      start_date: form.start_date, end_date: form.end_date || null,
      is_active: form.is_active, notes: form.notes,
    }
    if (form.id) await supabase.from('recurring_transactions').update(payload).eq('id', form.id)
    else await supabase.from('recurring_transactions').insert(payload)
    setSaving(false); setDialogOpen(false); void load()
  }

  async function remove(id: string) {
    if (!confirm('Hapus pembayaran berulang ini?')) return
    await supabase.from('recurring_transactions').delete().eq('id', id); void load()
  }
  async function toggleActive(r: RecurringTransaction) {
    await supabase.from('recurring_transactions').update({ is_active: !r.is_active }).eq('id', r.id); void load()
  }
  async function runNow(r: RecurringTransaction) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('transactions').insert({
      user_id: user.id, date: new Date().toISOString().split('T')[0], account_id: r.account_id,
      type: r.type, category: r.category, description: `[Auto] ${r.name}`, amount: r.amount,
    })
    await supabase.from('recurring_transactions').update({ last_run_date: new Date().toISOString().split('T')[0] }).eq('id', r.id)
    toast.success(`${r.name} dicatat ke transaksi`)
    void load()
  }

  function openEdit(r: RecurringTransaction) {
    setForm({
      id: r.id, name: r.name, type: r.type, category: r.category, amount: r.amount,
      account_id: r.account_id ?? '', frequency: r.frequency, day_of_period: r.day_of_period,
      start_date: r.start_date, end_date: r.end_date ?? '', is_active: r.is_active, notes: r.notes,
    })
    setDialogOpen(true)
  }
  function openAdd(prefill?: Partial<FormState>) {
    setForm({ ...EMPTY, ...prefill, start_date: new Date().toISOString().split('T')[0] })
    setDialogOpen(true)
  }

  /** Cek dari riwayat: cari transaksi pengeluaran yang berulang (deskripsi sama ≥2×, ~bulanan). */
  async function detectFromHistory() {
    setDetecting(true); setDetectOpen(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setDetecting(false); return }
    const cutoff = new Date(Date.now() - 150 * DAY).toISOString().slice(0, 10)
    const { data } = await supabase.from('transactions')
      .select('description, amount, category, type, date')
      .eq('user_id', user.id).neq('type', 'income').gte('date', cutoff)
    const txs = (data ?? []) as { description: string; amount: number; category: string; type: string }[]
    const existing = new Set(items.map((r) => r.name.trim().toLowerCase().replace(/^\[auto\]\s*/, '')))
    const groups = new Map<string, { name: string; amounts: number[]; category: string; count: number }>()
    for (const t of txs) {
      const name = (t.description || '').replace(/^\[auto\]\s*/i, '').trim()
      if (!name || existing.has(name.toLowerCase())) continue
      const g = groups.get(name.toLowerCase()) ?? { name, amounts: [], category: t.category, count: 0 }
      g.amounts.push(t.amount); g.count++
      groups.set(name.toLowerCase(), g)
    }
    const found = [...groups.values()]
      .filter((g) => g.count >= 2)
      .map((g) => ({ name: g.name, amount: Math.round(g.amounts.reduce((s, a) => s + a, 0) / g.amounts.length), category: g.category, count: g.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
    setCandidates(found); setDetecting(false)
  }

  // ---- Derived ----
  const active = useMemo(() => items.filter((r) => r.is_active), [items])
  const payments = useMemo(() => active.filter((r) => r.type !== 'income'), [active]) // "pembayaran"
  const byFreq = (f: Freq) => payments.filter((r) => r.frequency === f)
  const sum = (arr: RecurringTransaction[]) => arr.reduce((s, r) => s + r.amount, 0)

  const perBulan = sum(byFreq('monthly'))
  const perMinggu = sum(byFreq('weekly'))
  const perTahun = sum(byFreq('yearly'))
  const perHari = sum(byFreq('daily'))
  const totalSetahun = perBulan * 12 + perMinggu * 52 + perTahun + perHari * 365

  const stats = [
    { label: 'Per Bulan', value: formatCurrency(perBulan), sub: `${byFreq('monthly').length} item`, icon: Repeat, color: VIOLET, tint: 'rgba(139,92,246,0.12)' },
    { label: 'Per Minggu', value: formatCurrency(perMinggu), sub: `${byFreq('weekly').length} item`, icon: Repeat, color: AMBER, tint: 'rgba(245,158,11,0.12)' },
    { label: 'Per Tahun', value: formatCurrency(perTahun), sub: `${byFreq('yearly').length} item`, icon: Shield, color: MINT, tint: 'rgba(16,185,129,0.12)' },
    { label: 'Total Setahun', value: formatCurrency(totalSetahun), sub: 'Estimasi', icon: CalendarClock, color: VIOLET, tint: 'rgba(139,92,246,0.12)' },
  ]

  // Kalender 30 hari: amount per tanggal
  const today0 = startOfToday()
  const calendar = useMemo(() => {
    const days: { date: Date; amount: number; count: number }[] = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(today0.getTime() + i * DAY)
      let amount = 0, count = 0
      for (const r of payments) {
        if (occurrencesIn30(r).some((o) => o.toDateString() === d.toDateString())) { amount += r.amount; count++ }
      }
      days.push({ date: d, amount, count })
    }
    return days
  }, [payments]) // eslint-disable-line react-hooks/exhaustive-deps
  const calMax = Math.max(1, ...calendar.map((d) => d.amount))

  // Breakdown per kategori (per bulan equivalent)
  const monthlyEq = (r: RecurringTransaction) => r.frequency === 'monthly' ? r.amount : r.frequency === 'weekly' ? r.amount * 52 / 12 : r.frequency === 'yearly' ? r.amount / 12 : r.amount * 365 / 12
  const breakdown = useMemo(() => {
    const m = new Map<string, { total: number; count: number }>()
    for (const r of payments) {
      const g = m.get(r.category) ?? { total: 0, count: 0 }
      g.total += monthlyEq(r); g.count++
      m.set(r.category, g)
    }
    return [...m.entries()].map(([cat, v]) => ({ cat, ...v })).sort((a, b) => b.total - a.total)
  }, [payments]) // eslint-disable-line react-hooks/exhaustive-deps
  const breakdownTotal = breakdown.reduce((s, b) => s + b.total, 0)

  // Saran heuristik
  const suggestions = useMemo(() => {
    const out: { title: string; body: string }[] = []
    const subs = payments.filter((r) => r.category === 'Langganan' || r.category === 'Hiburan')
    if (subs.length >= 2) out.push({ title: `${subs.length} langganan aktif`, body: `Total ${formatCurrency(sum(subs))}/bln. Cek yang jarang dipakai di halaman Subscription.` })
    const biggest = [...payments].sort((a, b) => monthlyEq(b) - monthlyEq(a))[0]
    if (biggest) out.push({ title: `${biggest.name} komitmen terbesar`, body: `${formatCurrency(Math.round(monthlyEq(biggest)))}/bln (${(monthlyEq(biggest) / Math.max(1, breakdownTotal) * 100).toFixed(0)}% dari total berulang).` })
    const yearlyBig = byFreq('yearly')[0]
    if (yearlyBig) out.push({ title: `${yearlyBig.name} jatuh tempo tahunan`, body: `Sisihkan ${formatCurrency(Math.round(yearlyBig.amount / 12))}/bln biar gak kaget pas ${dmy(nextRunDate(yearlyBig))}.` })
    return out.slice(0, 3)
  }, [payments]) // eslint-disable-line react-hooks/exhaustive-deps

  const visible = filter === 'all' ? items : items.filter((r) => r.frequency === filter)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="eyebrow mb-1.5">{active.length} berulang aktif</p>
          <h1 className="leading-none" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,38px)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>Pembayaran Berulang</h1>
          <p className="text-sm mt-2 max-w-xl" style={{ color: 'var(--ink-muted)' }}>Tagihan tetap, langganan &amp; auto-debet di satu tempat. Klunting bisa deteksi otomatis dari riwayat transaksi.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" onClick={detectFromHistory}><Search className="h-4 w-4" /> Cek dari riwayat</Button>
          <Button onClick={() => openAdd()}><Plus className="h-4 w-4" /> Tambah berulang</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--ink-soft)' }} /></div>
      ) : (
        <>
          {/* Stat strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="s-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium flex items-center gap-1.5" style={{ color: 'var(--ink-soft)' }}><span className="size-1.5 rounded-full" style={{ background: s.color }} />{s.label}</p>
                    <p className="num tabular text-2xl font-bold mt-1.5 whitespace-nowrap" style={{ color: 'var(--ink)' }}>{s.value}</p>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--ink-soft)' }}>{s.sub}</p>
                  </div>
                  <div className="size-8 rounded-lg grid place-items-center shrink-0" style={{ background: s.tint }}><s.icon className="size-4" style={{ color: s.color }} /></div>
                </div>
              </div>
            ))}
          </div>

          {/* Kalender 30 hari */}
          {payments.length > 0 && (
            <div className="s-card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>30 Hari Ke Depan</p>
                <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>Total {formatCurrency(calendar.reduce((s, d) => s + d.amount, 0))}</p>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {calendar.map((d, i) => {
                  const has = d.amount > 0
                  const isToday = i === 0
                  return (
                    <div key={i} className="shrink-0 rounded-lg border grid content-between text-center" title={has ? `${dmy(d.date)} · ${formatCurrency(d.amount)}` : dmy(d.date)}
                      style={{ width: 46, height: 56, padding: 6, borderColor: isToday ? 'var(--ink)' : has ? `${VIOLET}55` : 'var(--border-soft)', background: has ? `${VIOLET}0F` : 'var(--surface)' }}>
                      <span className="num text-[13px] font-semibold" style={{ color: isToday ? 'var(--ink)' : has ? VIOLET : 'var(--ink-soft)' }}>{d.date.getDate()}</span>
                      {has && <span className="num text-[8.5px] leading-tight" style={{ color: VIOLET }}>{d.amount >= 1e6 ? `${(d.amount / 1e6).toFixed(1)}jt` : `${Math.round(d.amount / 1e3)}k`}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <div className="s-card p-12 text-center">
              <div className="size-12 rounded-2xl grid place-items-center mx-auto" style={{ background: 'var(--surface-2)' }}><Repeat className="size-6" style={{ color: 'var(--ink-soft)' }} /></div>
              <p className="font-semibold mt-3" style={{ color: 'var(--ink)' }}>Belum ada pembayaran berulang</p>
              <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>Tambah manual, atau klik &ldquo;Cek dari riwayat&rdquo; biar Klunting deteksi otomatis.</p>
              <Button className="mt-4" onClick={() => openAdd()}><Plus className="h-4 w-4" /> Tambah berulang</Button>
            </div>
          ) : (
            <>
              {/* Tabel */}
              <div className="s-card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b" style={{ borderColor: 'var(--border-soft)' }}>
                  <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Daftar Pembayaran Berulang</p>
                  <div className="flex flex-wrap gap-1.5">
                    {([['all', 'Semua'], ['monthly', 'Bulanan'], ['weekly', 'Mingguan'], ['yearly', 'Tahunan']] as const).map(([f, lbl]) => (
                      <button key={f} onClick={() => setFilter(f)} className="rounded-full px-2.5 py-1 text-[11px] font-medium transition"
                        style={{ background: filter === f ? 'var(--ink)' : 'var(--surface-2)', color: filter === f ? 'var(--surface)' : 'var(--ink-muted)' }}>{lbl}</button>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                        <th className="text-left font-medium px-4 py-2.5">Nama</th>
                        <th className="text-left font-medium px-3 py-2.5">Kategori</th>
                        <th className="text-left font-medium px-3 py-2.5">Frekuensi</th>
                        <th className="text-left font-medium px-3 py-2.5">Akun</th>
                        <th className="text-right font-medium px-3 py-2.5">Jatuh Tempo</th>
                        <th className="text-right font-medium px-4 py-2.5">Nominal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((r) => {
                        const acc = accounts.find((a) => a.id === r.account_id)
                        const meta = catMeta(r.category)
                        const Icon = meta.icon
                        const next = nextRunDate(r)
                        const days = Math.round((next.getTime() - today0.getTime()) / DAY)
                        const urgent = r.is_active && days <= 3
                        return (
                          <tr key={r.id} className="group border-t align-middle" style={{ borderColor: 'var(--border-soft)' }}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="size-8 rounded-lg grid place-items-center shrink-0" style={{ background: `${meta.color}1A`, opacity: r.is_active ? 1 : 0.5 }}><Icon className="size-4" style={{ color: meta.color }} /></div>
                                <div className="min-w-0">
                                  <p className="font-medium truncate flex items-center gap-1.5" style={{ color: 'var(--ink)' }}>{r.name}{!r.is_active && <span className="text-[9px] uppercase tracking-wide px-1 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}>jeda</span>}</p>
                                  <p className="text-[11px] truncate" style={{ color: 'var(--ink-soft)' }}>{TYPE_LABELS[r.type]}{r.notes ? ` · ${r.notes}` : ''}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-[13px]" style={{ color: 'var(--ink-muted)' }}>{r.category}</td>
                            <td className="px-3 py-3"><span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>{FREQ_LABELS[r.frequency]}</span></td>
                            <td className="px-3 py-3 text-[13px] truncate" style={{ color: 'var(--ink-muted)' }}>{acc?.name ?? '—'}</td>
                            <td className="px-3 py-3 text-right">
                              <p className="num text-[13px] font-medium" style={{ color: urgent ? CORAL : 'var(--ink)' }}>{dmy(next)}</p>
                              <p className="num text-[10px]" style={{ color: urgent ? CORAL : 'var(--ink-soft)' }}>{r.is_active ? `${days} hari lagi` : 'dijeda'}</p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="num font-semibold tabular" style={{ color: 'var(--ink)' }}>{formatCurrency(r.amount)}</span>
                              <div className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition mt-1">
                                <Button variant="ghost" size="icon-sm" onClick={() => runNow(r)} title="Catat sekarang" disabled={!r.is_active}><Play className="h-3 w-3" /></Button>
                                <Button variant="ghost" size="icon-sm" onClick={() => toggleActive(r)} title={r.is_active ? 'Jeda' : 'Lanjut'}><Pause className="h-3 w-3" /></Button>
                                <Button variant="ghost" size="icon-sm" onClick={() => openEdit(r)}><Pencil className="h-3 w-3" /></Button>
                                <Button variant="ghost" size="icon-sm" onClick={() => remove(r.id)}><Trash2 className="h-3 w-3" style={{ color: 'var(--danger)' }} /></Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Breakdown + Saran */}
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="s-card p-5">
                  <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Berdasarkan Kategori (per bulan)</p>
                  {breakdown.length > 0 ? (
                    <>
                      <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                        {breakdown.map((b) => <div key={b.cat} title={b.cat} style={{ width: `${(b.total / breakdownTotal) * 100}%`, background: catMeta(b.cat).color }} />)}
                      </div>
                      <div className="mt-3 space-y-2">
                        {breakdown.map((b) => (
                          <div key={b.cat} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2 min-w-0"><span className="size-2 rounded-full shrink-0" style={{ background: catMeta(b.cat).color }} /><span className="truncate" style={{ color: 'var(--ink-muted)' }}>{b.cat}</span></span>
                            <span className="flex items-center gap-3 shrink-0">
                              <span className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{b.count} item</span>
                              <span className="num font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(Math.round(b.total))}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : <p className="text-sm mt-3" style={{ color: 'var(--ink-soft)' }}>Belum ada pembayaran berulang aktif.</p>}
                </div>

                <div className="s-card p-5">
                  <p className="text-[11px] font-semibold tracking-[0.14em] uppercase flex items-center gap-1.5" style={{ color: VIOLET }}><Sparkles className="size-3.5" /> Saran Klunting</p>
                  <div className="mt-3 space-y-2.5">
                    {suggestions.length > 0 ? suggestions.map((s, i) => (
                      <div key={i} className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                        <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{s.title}</p>
                        <p className="text-[12px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>{s.body}</p>
                      </div>
                    )) : <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>Belum ada saran — tambah beberapa pembayaran berulang dulu.</p>}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl grid place-items-center shrink-0" style={{ background: 'rgba(139,92,246,0.12)' }}><Repeat className="size-5" style={{ color: VIOLET }} /></div>
              <div className="min-w-0">
                <DialogTitle className="text-lg" style={{ fontFamily: 'var(--font-display)' }}>{form.id ? 'Edit Berulang' : 'Tambah Berulang'}</DialogTitle>
                <DialogDescription>Auto-generate transaksi sesuai jadwal yang kamu set.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5"><Label>Nama</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Netflix, Cicilan KPR, Gaji…" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Tipe</Label>
                <Select value={form.type} onValueChange={(v) => v && setForm({ ...form, type: v as TxType, category: categoriesFor(v as TxType)[0] })}>
                  <SelectTrigger><SelectValue>{(v) => TYPE_LABELS[v as TxType] ?? 'Pilih'}</SelectValue></SelectTrigger>
                  <SelectContent>{(Object.keys(TYPE_LABELS) as TxType[]).map((k) => <SelectItem key={k} value={k}>{TYPE_LABELS[k]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5"><Label>Kategori</Label>
                <Select value={form.category} onValueChange={(v) => v && setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue>{(v) => v || 'Pilih'}</SelectValue></SelectTrigger>
                  <SelectContent>{categoriesFor(form.type).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Jumlah (Rp)</Label><NumberInput value={form.amount} onChange={(n) => setForm({ ...form, amount: n })} placeholder="0" /></div>
              <div className="grid gap-1.5"><Label>Akun</Label>
                <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v ?? '' })}>
                  <SelectTrigger><SelectValue placeholder="Pilih akun">{(v) => accounts.find((a) => a.id === v)?.name || 'Pilih akun'}</SelectValue></SelectTrigger>
                  <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Frekuensi</Label>
                <Select value={form.frequency} onValueChange={(v) => v && setForm({ ...form, frequency: v as Freq })}>
                  <SelectTrigger><SelectValue>{(v) => FREQ_LABELS[v as Freq] ?? 'Pilih'}</SelectValue></SelectTrigger>
                  <SelectContent>{(Object.keys(FREQ_LABELS) as Freq[]).map((k) => <SelectItem key={k} value={k}>{FREQ_LABELS[k]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5"><Label>Tanggal {form.frequency === 'monthly' ? '(1–31)' : ''}</Label><Input type="number" min={1} max={31} value={form.day_of_period} onChange={(e) => setForm({ ...form, day_of_period: Number(e.target.value) || 1 })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Mulai</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Berakhir (opsional)</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving || !form.name || !form.account_id}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cek dari riwayat dialog */}
      <Dialog open={detectOpen} onOpenChange={setDetectOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl grid place-items-center shrink-0" style={{ background: 'rgba(139,92,246,0.12)' }}><Search className="size-5" style={{ color: VIOLET }} /></div>
              <div className="min-w-0">
                <DialogTitle className="text-lg" style={{ fontFamily: 'var(--font-display)' }}>Deteksi dari Riwayat</DialogTitle>
                <DialogDescription>Transaksi pengeluaran yang muncul berulang (≥2× dalam ~5 bulan) — kandidat buat dijadiin berulang.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="py-2">
            {detecting ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--ink-soft)' }} /></div>
            ) : candidates.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: 'var(--ink-soft)' }}>Belum nemu kandidat berulang dari riwayat transaksimu.</p>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {candidates.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--border-soft)' }}>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate" style={{ color: 'var(--ink)' }}>{c.name}</p>
                      <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{c.category} · muncul {c.count}× · ~{formatCurrency(c.amount)}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => { setDetectOpen(false); openAdd({ name: c.name, amount: c.amount, category: c.category, type: 'expense' }) }}><Plus className="h-3.5 w-3.5" /> Tambah</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
