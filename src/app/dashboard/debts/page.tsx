'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import { fetchLiquidEntries, sumLiquid } from '@/lib/liquid'
import type { Debt, CreditCard as CreditCardRow } from '@/types'
import { simulatePayoff, type PayoffResult } from '@/lib/debt-payoff'
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
  Plus, Pencil, Trash2, Loader2, PartyPopper, Receipt, Home, CreditCard, Banknote, Wallet,
  Car, Smartphone, Zap, CheckCircle2, AlertCircle, Lightbulb, TrendingDown, type LucideIcon,
} from 'lucide-react'

const CAT: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  consumer:  { label: 'Konsumtif',      color: '#F43F5E', icon: CreditCard },
  cash_loan: { label: 'Pinjaman Tunai', color: '#F59E0B', icon: Banknote },
  long_term: { label: 'Jangka Panjang', color: '#8B5CF6', icon: Home },
}

const DEBT_TYPE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  consumer: [
    { value: 'kartu_kredit', label: 'Kartu Kredit' }, { value: 'paylater', label: 'Paylater' },
    { value: 'kta', label: 'KTA' }, { value: 'pembiayaan_konsumer', label: 'Pembiayaan Konsumer' },
  ],
  cash_loan: [
    { value: 'pinjaman_pribadi', label: 'Pinjaman Pribadi' }, { value: 'pinjaman_dana_tunai', label: 'Pinjaman Dana Tunai' },
  ],
  long_term: [
    { value: 'kpr', label: 'KPR' }, { value: 'kpa', label: 'KPA' }, { value: 'kpt', label: 'KPT' },
    { value: 'hutang_kendaraan', label: 'Hutang Kendaraan' }, { value: 'pinjaman_bisnis', label: 'Pinjaman Bisnis' },
  ],
}
const getTypeLabel = (type: string) => {
  for (const arr of Object.values(DEBT_TYPE_OPTIONS)) { const f = arr.find((t) => t.value === type); if (f) return f.label }
  return type
}
const isRevolving = (type: string) => type === 'kartu_kredit' || type === 'paylater'

/** Ikon per-tipe utang (lebih spesifik dari kategori): KPR→rumah, kendaraan→mobil, dst. */
const TYPE_ICON: Record<string, LucideIcon> = {
  kpr: Home, kpa: Home, kpt: Home, hutang_kendaraan: Car,
  kartu_kredit: CreditCard, paylater: Smartphone, pembiayaan_konsumer: Wallet,
  kta: Banknote, pinjaman_pribadi: Banknote, pinjaman_dana_tunai: Banknote, pinjaman_bisnis: Banknote,
}
const typeIcon = (type: string): LucideIcon => TYPE_ICON[type] ?? CreditCard

/** Estimasi minimum payment kartu kredit: ~10% saldo, lantai Rp 50rb. */
function ccMinPayment(balance: number): number {
  if (balance <= 0) return 0
  return Math.min(balance, Math.max(50_000, Math.round(balance * 0.1)))
}
function ccNextDueISO(dueDay: number): string {
  const t = new Date(); const y = t.getFullYear(); const m = t.getMonth()
  const thisMonth = new Date(y, m, dueDay)
  const due = thisMonth >= new Date(y, m, t.getDate()) ? thisMonth : new Date(y, m + 1, dueDay)
  return due.toISOString().split('T')[0]
}

function payoffDate(months: number): string {
  if (months <= 0 || months >= 600) return '—'
  const d = new Date(); d.setMonth(d.getMonth() + months)
  return d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })
}
function daysUntil(d: string): number {
  if (!d) return Infinity
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000)
}

const FILTERS: { key: string; cat: string | null }[] = [
  { key: 'Semua', cat: null },
  { key: 'Jangka Panjang', cat: 'long_term' },
  { key: 'Konsumtif', cat: 'consumer' },
  { key: 'Pinjaman Tunai', cat: 'cash_loan' },
]

const emptyForm = {
  id: null as string | null, name: '', category: 'consumer', type: '',
  principal: 0, remaining: 0, interest_rate: 0, monthly_payment: 0,
  due_date: new Date().toISOString().split('T')[0], is_active: true,
}

export default function DebtsOverviewPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [debts, setDebts] = useState<Debt[]>([])
  const [cards, setCards] = useState<CreditCardRow[]>([])
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [totalAssets, setTotalAssets] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<typeof emptyForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('Semua')
  const [tlStrategy, setTlStrategy] = useState<'snowball' | 'avalanche'>('avalanche')
  const [extraPayment, setExtraPayment] = useState(0)

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90)
    const [debtsRes, ccRes, txRes, liqEntries, nlqRes, invRes] = await Promise.all([
      supabase.from('debts').select('*').eq('user_id', user.id).order('remaining', { ascending: false }),
      supabase.from('credit_cards').select('*').eq('user_id', user.id).eq('is_active', true).order('current_balance', { ascending: false }),
      supabase.from('transactions').select('amount, date').eq('user_id', user.id).eq('type', 'income').gte('date', cutoff.toISOString().slice(0, 10)),
      fetchLiquidEntries(supabase, user.id),
      supabase.from('assets_non_liquid').select('current_value').eq('user_id', user.id),
      supabase.from('investments').select('total_value').eq('user_id', user.id),
    ])
    setDebts((debtsRes.data ?? []) as Debt[])
    setCards((ccRes.data ?? []) as CreditCardRow[])
    const incomeRows = (txRes.data ?? []) as { amount: number; date: string }[]
    const totalIncome = incomeRows.reduce((s, t) => s + (t.amount || 0), 0)
    // Bagi pakai jumlah bulan DISTINCT yg beneran ada (cap 3, lantai 1) — bukan
    // hardcode /3 yg under-estimate income kalau histori < 3 bln → DTI palsu rendah.
    const incomeMonths = new Set(incomeRows.map((t) => (t.date || '').slice(0, 7)).filter(Boolean)).size
    setMonthlyIncome(incomeRows.length > 0 ? totalIncome / Math.min(3, Math.max(1, incomeMonths)) : 0)
    const nlq = ((nlqRes.data ?? []) as { current_value: number }[]).reduce((s, a) => s + (a.current_value ?? 0), 0)
    const inv = ((invRes.data ?? []) as { total_value: number }[]).reduce((s, a) => s + (a.total_value ?? 0), 0)
    setTotalAssets(sumLiquid(liqEntries) + nlq + inv)
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const payload = {
      user_id: user.id, name: form.name, category: form.category, type: form.type,
      principal: form.principal, remaining: form.remaining,
      interest_rate: form.interest_rate, monthly_payment: form.monthly_payment,
      due_date: form.due_date, is_active: form.is_active,
    }
    if (form.id) await supabase.from('debts').update(payload).eq('id', form.id)
    else await supabase.from('debts').insert(payload)
    setSaving(false); setDialogOpen(false); void load()
  }
  async function remove(id: string) {
    if (!confirm('Hapus utang ini?')) return
    await supabase.from('debts').delete().eq('id', id); void load()
  }
  function openEdit(d: Debt) {
    setForm({ id: d.id, name: d.name, category: d.category, type: d.type,
      principal: d.principal, remaining: d.remaining, interest_rate: d.interest_rate,
      monthly_payment: d.monthly_payment, due_date: d.due_date, is_active: d.is_active })
    setDialogOpen(true)
  }

  const active = useMemo(() => debts.filter((d) => d.is_active && d.remaining > 0), [debts])
  // Kartu kredit = utang revolving → dipetakan ke bentuk Debt biar ikut total,
  // DTI, strategi pelunasan & timeline. Sumber tetap tabel credit_cards.
  const ccDebts = useMemo<Debt[]>(() => cards
    .filter((c) => c.current_balance > 0)
    .map((c) => ({
      id: `cc:${c.id}`, user_id: '', name: c.name, category: 'consumer', type: 'kartu_kredit',
      principal: c.current_balance, remaining: c.current_balance,
      interest_rate: (c.interest_rate || 0) * 12, // %/bln → %/thn (biar konsisten sama utang lain)
      monthly_payment: ccMinPayment(c.current_balance),
      due_date: ccNextDueISO(c.due_day), is_active: true, created_at: '',
    })), [cards])
  const allActive = useMemo(() => [...active, ...ccDebts], [active, ccDebts])

  const totalRemaining = allActive.reduce((s, d) => s + d.remaining, 0)
  const totalPrincipal = allActive.reduce((s, d) => s + d.principal, 0)
  const totalMonthly = allActive.reduce((s, d) => s + d.monthly_payment, 0)
  const longTermMonthly = allActive.filter((d) => d.category === 'long_term').reduce((s, d) => s + d.monthly_payment, 0)
  const consumerMonthly = allActive.filter((d) => d.category !== 'long_term').reduce((s, d) => s + d.monthly_payment, 0)
  const totalPaid = Math.max(0, totalPrincipal - totalRemaining)
  const paidPct = totalPrincipal > 0 ? (totalPaid / totalPrincipal) * 100 : 0
  const dti = monthlyIncome > 0 ? (totalMonthly / monthlyIncome) * 100 : null
  const frontEnd = monthlyIncome > 0 ? (longTermMonthly / monthlyIncome) * 100 : null
  const debtToAsset = totalAssets > 0 ? (totalRemaining / totalAssets) * 100 : null
  const dtiColor = dti == null ? 'var(--ink-soft)' : dti <= 36 ? 'var(--c-mint)' : dti <= 60 ? 'var(--c-amber)' : 'var(--c-coral)'

  const snowball = useMemo(() => simulatePayoff(allActive, 'snowball'), [allActive])
  const avalanche = useMemo(() => simulatePayoff(allActive, 'avalanche'), [allActive])
  // Highlight perbandingan: selisih bunga + siapa yg lebih cepat lunas.
  const interestDiff = Math.round(Math.abs(snowball.totalInterest - avalanche.totalInterest))
  const cheaper: 'snowball' | 'avalanche' = avalanche.totalInterest <= snowball.totalInterest ? 'avalanche' : 'snowball'
  const monthsDiff = Math.max(0, snowball.months - avalanche.months) // Avalanche biasanya lunas duluan
  const snowFirst = snowball.order[0]
  const snowFirstMonth = snowFirst ? (snowball.perDebt[snowFirst.id] ?? 0) : 0
  // Nudge refinance: utang APR tinggi (>=18%) — estimasi hemat SETAHUN kalau pindah ke ~12%.
  const REFI_TARGET = 12
  const highApr = allActive.filter((d) => d.interest_rate >= 18)
  const maxApr = highApr.reduce((m, d) => Math.max(m, d.interest_rate), 0)
  const refiSaving = Math.round(highApr.reduce((s, d) => s + (d.remaining * Math.max(0, d.interest_rate - REFI_TARGET)) / 100, 0))

  // "Bebas utang konsumtif" = bulan terakhir utang non-jangka-panjang lunas (pakai strategi aktif).
  const tlResult = tlStrategy === 'snowball' ? snowball : avalanche
  // What-if percepat pelunasan: engine udah dukung param `extra` — bandingin vs base (extra=0).
  const extraMax = Math.max(5_000_000, Math.ceil(totalMonthly / 1_000_000) * 1_000_000)
  const whatIf = useMemo(() => simulatePayoff(allActive, tlStrategy, extraPayment), [allActive, tlStrategy, extraPayment])
  const monthsSaved = Math.max(0, tlResult.months - whatIf.months)
  const interestSaved = Math.max(0, tlResult.totalInterest - whatIf.totalInterest)
  const consumerFreeMonth = useMemo(() => {
    const months = allActive.filter((d) => d.category !== 'long_term').map((d) => tlResult.perDebt[d.id] ?? 0)
    return months.length ? Math.max(...months) : 0
  }, [allActive, tlResult])

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)
    return !f || f.cat == null ? allActive : allActive.filter((d) => d.category === f.cat)
  }, [allActive, filter])
  const upcoming = useMemo(() => [...allActive].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')).slice(0, 4), [allActive])

  return (
    <div className="space-y-6">
      {/* Header terang — eyebrow + judul serif + subtitle + aksi (pola Dana Darurat) */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-xl">
          <p className="eyebrow" style={{ color: 'var(--ink-soft)' }}>{allActive.length} utang aktif</p>
          <h1 className="mt-1 text-2xl sm:text-[28px] leading-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>
            Utang &amp; Strategi Pelunasan
          </h1>
          <p className="text-sm mt-1.5" style={{ color: 'var(--ink-muted)' }}>
            Konsolidasi seluruh kewajiban, dengan dua strategi pelunasan untuk dibandingkan.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/dashboard/debts/payments"><Button variant="outline"><Receipt className="h-4 w-4" /> Pembayaran</Button></Link>
          <Button onClick={() => { setForm(emptyForm); setDialogOpen(true) }}><Plus className="h-4 w-4" /> Utang baru</Button>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : allActive.length === 0 ? (
        <div className="s-card p-12 text-center">
          <PartyPopper className="size-12 mx-auto" style={{ color: '#10B981' }} />
          <p className="mt-3 font-semibold" style={{ color: 'var(--ink)' }}>Bebas utang</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>Gak ada utang aktif. Mantap — jaga terus.</p>
        </div>
      ) : (
        <>
          {/* 3 stat card ringkasan */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="s-card p-5">
              <p className="eyebrow" style={{ color: 'var(--ink-soft)' }}>Sisa Total Utang</p>
              <p className="num font-bold mt-2 leading-none" style={{ fontSize: 26, color: 'var(--c-coral)', letterSpacing: '-0.02em' }}>{formatCurrency(totalRemaining)}</p>
              <p className="text-[12px] mt-2 leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                Sudah dibayar <span className="num font-semibold" style={{ color: 'var(--c-mint)' }}>{formatCurrency(totalPaid)}</span> dari pokok awal <span className="num">{formatCurrency(totalPrincipal)}</span>
              </p>
              <div className="mt-3 h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(paidPct, 100)}%`, background: 'var(--c-mint)' }} />
              </div>
              <div className="mt-1 flex justify-between text-[10px]" style={{ color: 'var(--ink-soft)' }}>
                <span className="num">{paidPct.toFixed(0)}% lunas</span><span className="num">{Math.max(0, 100 - paidPct).toFixed(0)}% tersisa</span>
              </div>
            </div>

            <div className="s-card p-5">
              <p className="eyebrow" style={{ color: 'var(--ink-soft)' }}>Cicilan / Bulan</p>
              <p className="num font-bold mt-2 leading-none" style={{ fontSize: 26, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{formatCurrency(totalMonthly)}</p>
              <div className="mt-3 space-y-1.5 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5" style={{ color: 'var(--ink-muted)' }}><span className="size-2 rounded-full" style={{ background: 'var(--c-violet)' }} />Jangka Panjang</span>
                  <span className="num" style={{ color: 'var(--ink)' }}>{formatCurrency(longTermMonthly)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5" style={{ color: 'var(--ink-muted)' }}><span className="size-2 rounded-full" style={{ background: 'var(--c-coral)' }} />Konsumtif</span>
                  <span className="num" style={{ color: 'var(--ink)' }}>{formatCurrency(consumerMonthly)}</span>
                </div>
              </div>
            </div>

            <div className="s-card p-5">
              <p className="eyebrow" style={{ color: 'var(--ink-soft)' }}>Debt-to-Income</p>
              <p className="num font-bold mt-2 leading-none" style={{ fontSize: 26, color: dtiColor, letterSpacing: '-0.02em' }}>{dti != null ? `${dti.toFixed(1)}%` : '—'}</p>
              <p className="text-[12px] mt-2" style={{ color: 'var(--ink-muted)' }}>dari pendapatan bulanan</p>
              <div className="mt-3 relative h-2 w-full rounded-full overflow-hidden" role="progressbar"
                aria-valuenow={dti != null ? Math.round(dti) : 0} aria-valuemin={0} aria-valuemax={60}
                aria-label={dti != null ? `Debt-to-Income ${dti.toFixed(1)} persen — ideal di bawah 36 persen` : 'Debt-to-Income belum ada data pendapatan'}
                style={{ background: 'var(--surface-2)' }}>
                <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${Math.min((dti ?? 0) / 60 * 100, 100)}%`, background: dtiColor }} />
                {/* tanda ambang ideal 36% (di 60% lebar = skala 0–60%) */}
                <div className="absolute inset-y-0" style={{ left: '60%', width: 1.5, background: 'var(--ink-soft)', opacity: 0.45 }} />
              </div>
              <div className="mt-1 flex justify-between text-[10px]" style={{ color: 'var(--ink-soft)' }}><span>Ideal &lt; 36%</span><span>60%+</span></div>
            </div>
          </div>

          {/* Nudge refinance — utang bunga tinggi */}
          {highApr.length > 0 && refiSaving > 0 && (
            <div className="s-card flex items-start gap-3 p-4" style={{ borderColor: 'color-mix(in srgb, var(--c-amber) 32%, var(--border-soft))', background: 'color-mix(in srgb, var(--c-amber) 5%, var(--surface))' }}>
              <div className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ background: 'var(--c-amber-soft)', color: 'var(--c-amber)' }}>
                <TrendingDown className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold" style={{ color: 'var(--ink)' }}>Bunga tinggi — pertimbangin pindah</p>
                <p className="text-[13px] mt-0.5 leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                  {highApr.map((d) => d.name).slice(0, 3).join(', ')}{highApr.length > 3 ? ` +${highApr.length - 3}` : ''} bunganya sampai <span className="num font-semibold" style={{ color: 'var(--c-coral)' }}>{maxApr}%/thn</span>. Balance transfer atau KTA bunga ~12% bisa hemat sekitar <span className="num font-semibold" style={{ color: 'var(--c-mint)' }}>{formatCompactCurrency(refiSaving)}/tahun</span>. Strategi <span style={{ color: 'var(--c-violet)', fontWeight: 500 }}>Avalanche</span> udah otomatis prioritasin ini.
                </p>
              </div>
            </div>
          )}

          {/* Tabel utang */}
          <div className="s-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b" style={{ borderColor: 'var(--border-soft)' }}>
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Daftar Utang</p>
              <div className="flex flex-wrap gap-1.5">
                {FILTERS.filter((f) => f.cat == null || allActive.some((d) => d.category === f.cat)).map((f) => (
                  <button key={f.key} onClick={() => setFilter(f.key)} aria-pressed={filter === f.key} className="rounded-full px-2.5 py-1 text-[11px] font-medium transition"
                    style={{ background: filter === f.key ? 'var(--ink)' : 'var(--surface-2)', color: filter === f.key ? 'var(--surface)' : 'var(--ink)' }}>
                    {f.key}
                  </button>
                ))}
              </div>
            </div>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                    <th className="text-left font-medium px-4 py-2.5">Utang</th>
                    <th className="text-left font-medium px-3 py-2.5">Jenis</th>
                    <th className="text-right font-medium px-3 py-2.5">Sisa / Pokok</th>
                    <th className="text-right font-medium px-3 py-2.5">Bunga</th>
                    <th className="text-right font-medium px-3 py-2.5">Cicilan</th>
                    <th className="text-right font-medium px-4 py-2.5">Tenor</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((d) => {
                    const meta = CAT[d.category] ?? CAT.consumer
                    const Icon = typeIcon(d.type)
                    const isCC = d.id.startsWith('cc:')
                    const paid = d.principal > 0 ? ((d.principal - d.remaining) / d.principal) * 100 : 0
                    const tenor = isRevolving(d.type) ? 'Revolving' : (d.monthly_payment > 0 ? `± ${Math.ceil(d.remaining / d.monthly_payment)} bln` : '—')
                    return (
                      <tr key={d.id} className="group border-t align-top" style={{ borderColor: 'var(--border-soft)' }}>
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="size-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${meta.color}1A` }}>
                              <Icon className="size-4" style={{ color: meta.color }} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate" style={{ color: 'var(--ink)' }}>{d.name}</p>
                              <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>jatuh tempo {d.due_date ? new Date(d.due_date).getDate() : '—'}/bulan</p>
                              <div className="mt-1.5 h-1 w-28 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                                <div className="h-full rounded-full" style={{ width: `${Math.min(paid, 100)}%`, background: meta.color }} />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3"><span className="inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${meta.color}1A`, color: meta.color }}>{getTypeLabel(d.type)}</span></td>
                        <td className="px-3 py-3 text-right">
                          <p className="num font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(d.remaining)}</p>
                          <p className="num text-[10px]" style={{ color: 'var(--ink-soft)' }}>dari {formatCurrency(d.principal)}</p>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="num font-medium" style={{ color: d.interest_rate >= 18 ? 'var(--c-coral)' : 'var(--ink)' }}>{d.interest_rate}%</span>
                          <p className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>per tahun</p>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="num" style={{ color: 'var(--ink)' }}>{d.monthly_payment > 0 ? formatCurrency(d.monthly_payment) : '—'}</span>
                          {d.monthly_payment > 0 && <p className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>per bulan</p>}
                          <div className="flex justify-end gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition mt-1">
                            {isCC ? (
                              <Link href="/dashboard/credit-cards"><Button variant="ghost" size="icon-sm" title="Kelola di Kartu Kredit"><CreditCard className="h-3 w-3" /></Button></Link>
                            ) : (
                              <>
                                <Button variant="ghost" size="icon-sm" onClick={() => openEdit(d)}><Pencil className="h-3 w-3" /></Button>
                                <Button variant="ghost" size="icon-sm" onClick={() => remove(d.id)}><Trash2 className="h-3 w-3" style={{ color: 'var(--danger)' }} /></Button>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right num text-[12px]" style={{ color: 'var(--ink-muted)' }}>{tenor}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile: kartu per-utang (tabel di-hide di <sm) */}
            <div className="sm:hidden divide-y" style={{ borderColor: 'var(--border-soft)' }}>
              {visible.map((d) => {
                const meta = CAT[d.category] ?? CAT.consumer
                const Icon = typeIcon(d.type)
                const isCC = d.id.startsWith('cc:')
                const paid = d.principal > 0 ? ((d.principal - d.remaining) / d.principal) * 100 : 0
                const tenor = isRevolving(d.type) ? 'Revolving' : (d.monthly_payment > 0 ? `± ${Math.ceil(d.remaining / d.monthly_payment)} bln` : '—')
                return (
                  <div key={d.id} className="flex items-start gap-3 p-4">
                    <div className="size-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${meta.color}1A` }}>
                      <Icon className="size-4" style={{ color: meta.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium truncate" style={{ color: 'var(--ink)' }}>{d.name}</p>
                        <span className="inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold shrink-0" style={{ background: `${meta.color}1A`, color: meta.color }}>{getTypeLabel(d.type)}</span>
                      </div>
                      <p className="num font-semibold mt-1" style={{ color: 'var(--ink)' }}>
                        {formatCurrency(d.remaining)} <span className="text-[10px] font-normal" style={{ color: 'var(--ink-soft)' }}>/ {formatCurrency(d.principal)}</span>
                      </p>
                      <div className="mt-1.5 h-1 w-full rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(paid, 100)}%`, background: meta.color }} />
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                        <span>Bunga <span className="num font-medium" style={{ color: d.interest_rate >= 18 ? 'var(--c-coral)' : 'var(--ink)' }}>{d.interest_rate}%</span></span>
                        <span>Cicilan <span className="num font-medium" style={{ color: 'var(--ink)' }}>{d.monthly_payment > 0 ? formatCurrency(d.monthly_payment) : '—'}</span></span>
                        <span className="num shrink-0">{tenor}</span>
                      </div>
                      {!isCC && (
                        <div className="mt-2 flex gap-3">
                          <button type="button" onClick={() => openEdit(d)} className="text-[11px] font-medium" style={{ color: 'var(--ink-muted)' }}>Edit</button>
                          <button type="button" onClick={() => remove(d.id)} className="text-[11px] font-medium" style={{ color: 'var(--c-coral)' }}>Hapus</button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ★ CENTERPIECE — Dua strategi pelunasan, di-highlight */}
          <div>
            <div className="mb-3">
              <p className="eyebrow" style={{ color: 'var(--ink-soft)' }}>Strategi Pelunasan</p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--ink-muted)' }}>Dua jalur lunas yang sama-sama valid — pilih yang cocok sama gaya kamu.</p>
            </div>
            {/* Rekomendasi tradeoff eksplisit */}
            <div className="mb-3 flex items-start gap-2.5 rounded-xl p-3.5" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
              <Lightbulb className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--c-amber)' }} />
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink)' }}>
                {interestDiff > 0 ? (
                  <><span style={{ color: 'var(--c-violet)', fontWeight: 600 }}>Avalanche</span> hemat <span className="num">{formatCompactCurrency(interestDiff)}</span> bunga{monthsDiff > 0 ? <> &amp; lunas <span className="num">{monthsDiff} bln</span> lebih cepat</> : null}. Pilih <span style={{ color: 'var(--c-mint)', fontWeight: 600 }}>Snowball</span> kalau butuh dorongan — utang pertama{snowFirst ? ` (${snowFirst.name})` : ''} lunas <span className="num">{payoffDate(snowFirstMonth)}</span>.</>
                ) : (
                  <>Buat utang kamu sekarang, dua strategi hasilnya mirip — pilih yang bikin kamu paling konsisten bayar.</>
                )}
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <StrategyCard
                strategy="snowball" result={snowball} debts={allActive}
                accent="var(--c-mint)" accentSoft="var(--c-mint-soft)"
                savedNote={cheaper === 'snowball' && interestDiff > 0 ? `Bunga termurah · hemat ${formatCompactCurrency(interestDiff)}` : 'Win tercepat — momentum dulu'}
              />
              <StrategyCard
                strategy="avalanche" result={avalanche} debts={allActive}
                accent="var(--c-violet)" accentSoft="var(--c-violet-soft)"
                savedNote={cheaper === 'avalanche' && interestDiff > 0 ? `Bunga termurah · hemat ${formatCompactCurrency(interestDiff)}` : 'Paling efisien matematis'}
              />
            </div>
          </div>

          {/* Timeline pelunasan */}
          <div className="s-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Timeline Pelunasan</p>
                <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>
                  {consumerFreeMonth > 0 && consumerFreeMonth < 600 && (<>Bebas utang konsumtif <span className="num font-semibold" style={{ color: 'var(--c-mint)' }}>{payoffDate(consumerFreeMonth)}</span> · </>)}
                  Semua lunas <span className="num font-semibold" style={{ color: 'var(--ink)' }}>{payoffDate(tlResult.months)}</span>
                </p>
              </div>
              <div className="flex gap-1.5">
                {(['snowball', 'avalanche'] as const).map((s) => (
                  <button key={s} onClick={() => setTlStrategy(s)} aria-pressed={tlStrategy === s} className="rounded-full px-2.5 py-1 text-[11px] font-medium capitalize transition"
                    style={{ background: tlStrategy === s ? (s === 'snowball' ? 'var(--c-mint)' : 'var(--c-violet)') : 'var(--surface-2)', color: tlStrategy === s ? '#FFF' : 'var(--ink)' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <PayoffTimeline result={tlResult} accent={tlStrategy === 'snowball' ? '#10B981' : '#8B5CF6'} />
          </div>

          {/* What-If: percepat pelunasan dengan cicilan ekstra */}
          <div className="s-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Percepat Pelunasan</p>
                <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>
                  Tambah cicilan ekstra/bulan (strategi <span className="capitalize font-medium" style={{ color: 'var(--ink)' }}>{tlStrategy}</span>) — geser buat liat lunas lebih cepat &amp; hemat bunga.
                </p>
              </div>
              {extraPayment > 0 && (
                <button type="button" onClick={() => setExtraPayment(0)} className="text-[11px] font-medium shrink-0" style={{ color: 'var(--ink-soft)' }}>Reset</button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[0, 500_000, 1_000_000, 2_000_000, 5_000_000].map((v) => (
                <button key={v} type="button" onClick={() => setExtraPayment(v)} aria-pressed={extraPayment === v} className="rounded-full px-2.5 py-1 text-[11px] font-medium transition"
                  style={{ background: extraPayment === v ? 'var(--c-mint)' : 'var(--surface-2)', color: extraPayment === v ? '#FFF' : 'var(--ink)' }}>
                  {v === 0 ? 'Tanpa ekstra' : `+${formatCompactCurrency(v)}`}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="range" min={0} max={extraMax} step={100_000} value={Math.min(extraPayment, extraMax)}
                onChange={(e) => setExtraPayment(Number(e.target.value))}
                className="flex-1 accent-[#10B981]" aria-label="Cicilan ekstra per bulan"
              />
              <span className="num text-sm font-semibold shrink-0 w-32 text-right" style={{ color: 'var(--c-mint)' }}>+{formatCurrency(extraPayment)}</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 pt-3" style={{ borderTop: '1px solid var(--border-soft)' }}>
              <div><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Lunas Jadi</p><p className="num text-sm font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{payoffDate(whatIf.months)}</p></div>
              <div><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Lebih Cepat</p><p className="num text-sm font-semibold mt-0.5" style={{ color: monthsSaved > 0 ? 'var(--c-mint)' : 'var(--ink-soft)' }}>{monthsSaved > 0 ? `${monthsSaved} bln` : '—'}</p></div>
              <div><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Hemat Bunga</p><p className="num text-sm font-semibold mt-0.5" style={{ color: interestSaved > 0 ? 'var(--c-mint)' : 'var(--ink-soft)' }}>{interestSaved > 0 ? formatCompactCurrency(Math.round(interestSaved)) : '—'}</p></div>
            </div>
          </div>

          {/* Pembayaran mendatang + Rasio */}
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="s-card p-5">
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Pembayaran Mendatang</p>
              <div className="mt-3 space-y-2.5">
                {upcoming.map((d) => {
                  const days = daysUntil(d.due_date)
                  const urgent = days <= 7
                  const isCC = d.id.startsWith('cc:')
                  return (
                    <div key={d.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-9 rounded-lg flex flex-col items-center justify-center shrink-0" style={{ background: urgent ? 'var(--c-coral-soft)' : 'var(--surface-2)' }}>
                          <span className="text-[8px] uppercase leading-none" style={{ color: urgent ? 'var(--c-coral)' : 'var(--ink-soft)' }}>{d.due_date ? new Date(d.due_date).toLocaleDateString('id-ID', { month: 'short' }) : '—'}</span>
                          <span className="text-sm font-bold leading-none num" style={{ color: urgent ? 'var(--c-coral)' : 'var(--ink)' }}>{d.due_date ? new Date(d.due_date).getDate() : ''}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{d.name}</p>
                          <p className="text-[10px] flex items-center gap-1" style={{ color: urgent ? 'var(--c-coral)' : 'var(--ink-soft)' }}>
                            {urgent ? <><AlertCircle className="size-2.5" /> Mendesak · {days <= 0 ? 'jatuh tempo' : `${days} hari lagi`}</> : isCC ? <><CheckCircle2 className="size-2.5" style={{ color: 'var(--c-mint)' }} /> Auto-debet aktif</> : `${days} hari lagi`}
                          </p>
                        </div>
                      </div>
                      <span className="num font-semibold text-sm shrink-0" style={{ color: 'var(--ink)' }}>{formatCurrency(d.monthly_payment)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="s-card p-5">
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Rasio Utang</p>
              <div className="mt-3 space-y-3.5">
                <RatioRow label="Debt-to-Income (DTI)" ideal="Ideal < 36%" value={dti} idealMax={36} />
                <RatioRow label="Debt-to-Asset" ideal="Ideal < 50%" value={debtToAsset} idealMax={50} />
                <RatioRow label="Front-End (KPR / Pendapatan)" ideal="Ideal < 28%" value={frontEnd} idealMax={28} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl grid place-items-center shrink-0" style={{ background: 'rgba(244,63,94,0.12)' }}><Banknote className="size-5" style={{ color: '#F43F5E' }} /></div>
              <div className="min-w-0">
                <DialogTitle className="text-lg" style={{ fontFamily: 'var(--font-display)' }}>{form.id ? 'Edit Utang' : 'Utang Baru'}</DialogTitle>
                <DialogDescription>Catat utang biar masuk hitungan net worth, DTI &amp; strategi pelunasan.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Nama</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Kategori</Label>
                <Select value={form.category} onValueChange={(v) => v && setForm({ ...form, category: v, type: '' })}>
                  <SelectTrigger><SelectValue placeholder="Pilih kategori">{(v) => CAT[v as string]?.label ?? 'Pilih kategori'}</SelectValue></SelectTrigger>
                  <SelectContent>{Object.entries(CAT).map(([k, v]) => (<SelectItem key={k} value={k}>{v.label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Tipe</Label>
                <Select value={form.type} onValueChange={(v) => v && setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih tipe" /></SelectTrigger>
                  <SelectContent>{(DEBT_TYPE_OPTIONS[form.category] ?? []).map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Pokok Awal</Label><NumberInput value={form.principal} onChange={(n) => setForm({ ...form, principal: n })} placeholder="0" /></div>
              <div className="grid gap-1.5"><Label>Sisa</Label><NumberInput value={form.remaining} onChange={(n) => setForm({ ...form, remaining: n })} placeholder="0" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="grid gap-1.5"><Label>Bunga %</Label><Input type="number" step="any" value={form.interest_rate || ''} onChange={(e) => setForm({ ...form, interest_rate: Number(e.target.value) || 0 })} /></div>
              <div className="grid gap-1.5"><Label>Cicilan/bln</Label><NumberInput value={form.monthly_payment} onChange={(n) => setForm({ ...form, monthly_payment: n })} placeholder="0" /></div>
              <div className="grid gap-1.5"><Label>Jatuh Tempo</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving || !form.name || !form.type || (!isRevolving(form.type) && form.monthly_payment <= 0)}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}{form.id ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StrategyCard({ strategy, result, debts, accent, accentSoft, savedNote }: {
  strategy: 'snowball' | 'avalanche'; result: PayoffResult; debts: Debt[]; accent: string; accentSoft: string; savedNote?: string
}) {
  const isSnow = strategy === 'snowball'
  const title = isSnow ? 'Snowball' : 'Avalanche'
  const desc = isSnow
    ? "Lunasi yang paling kecil dulu. Cepat dapat 'kemenangan' kecil, momentum motivasi."
    : 'Lunasi yang paling tinggi bunganya dulu. Total bunga paling hemat secara matematika.'
  const cocok = isSnow
    ? 'Cocok jika kamu butuh dorongan emosional dan disiplin baru terbentuk.'
    : 'Cocok jika kamu kuat menahan diri dan mengejar efisiensi maksimum.'
  const karakter = isSnow ? 'Cepat' : 'Efisien'
  const byId = new Map(debts.map((d) => [d.id, d]))
  return (
    <div className="rounded-2xl p-5 sm:p-6 transition-shadow hover:shadow-lg" style={{ background: accentSoft, border: `1.5px solid color-mix(in srgb, ${accent} 55%, transparent)` }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: accent }}>Strategi</p>
          <h3 className="text-2xl leading-none mt-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>{title}</h3>
        </div>
        <span className="rounded-full px-3 py-1 text-[11px] font-semibold num shrink-0" style={{ background: 'var(--surface)', color: accent }}>Lunas {payoffDate(result.months)}</span>
      </div>
      <p className="mt-3 text-[15px] leading-snug italic" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>{desc}</p>
      <p className="text-[12.5px] mt-1.5 leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{cocok}</p>
      {savedNote && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold" style={{ background: 'var(--surface)', color: accent }}>
          <Zap className="size-3" /> {savedNote}
        </div>
      )}
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--ink-soft)' }}>Urutan Pelunasan</p>
      <div className="mt-2 space-y-1.5">
        {result.order.slice(0, 5).map((o, i) => {
          const d = byId.get(o.id)
          return (
            <div key={o.id} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: 'var(--surface)' }}>
              <span className="flex items-center gap-2.5 min-w-0">
                <span className="num size-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: i === 0 ? accent : 'var(--surface-2)', color: i === 0 ? '#FFF' : 'var(--ink-muted)' }}>{i + 1}</span>
                <span className="text-sm truncate" style={{ color: 'var(--ink)' }}>{o.name}</span>
              </span>
              <span className="num text-[12px] shrink-0 ml-2" style={{ color: 'var(--ink-muted)' }}>
                {isSnow
                  ? formatCompactCurrency(d?.remaining ?? 0)
                  : <>{(d?.interest_rate ?? 0)}% · <span style={{ color: 'var(--ink-soft)' }}>{formatCompactCurrency(d?.remaining ?? 0)}</span></>}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 pt-3" style={{ borderTop: `1px solid color-mix(in srgb, ${accent} 28%, transparent)` }}>
        <div><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Lunas Total</p><p className="num text-sm font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{payoffDate(result.months)}</p></div>
        <div><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Total Bunga</p><p className="num text-sm font-semibold mt-0.5" style={{ color: accent }}>{formatCompactCurrency(Math.round(result.totalInterest))}</p></div>
        <div><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Karakter</p><p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{karakter}</p></div>
      </div>
      {!result.feasible && <p className="mt-3 text-[11px] leading-relaxed" style={{ color: 'var(--c-coral)' }}>Cicilan masih lebih kecil dari bunga — naikin cicilan biar utang beneran turun.</p>}
    </div>
  )
}

function PayoffTimeline({ result, accent }: { result: PayoffResult; accent: string }) {
  const tl = result.timeline
  if (tl.length < 2) return <p className="mt-4 text-sm" style={{ color: 'var(--ink-soft)' }}>Timeline belum bisa dihitung (cek cicilan vs bunga).</p>
  const maxM = tl[tl.length - 1].month
  const maxR = tl[0].remaining || 1
  const xs = (m: number) => (m / maxM) * 100
  const ys = (r: number) => 100 - (r / maxR) * 100
  const pts = tl.map((p) => `${xs(p.month).toFixed(2)},${ys(p.remaining).toFixed(2)}`).join(' ')
  const axisMarks = [12, 24, 36, 48, 60].filter((m) => m <= maxM)
  const fill = `color-mix(in srgb, ${accent} 12%, transparent)`
  return (
    <div className="mt-4">
      <div className="relative" role="img" aria-label="Grafik timeline pelunasan: sisa utang menurun seiring bulan sampai lunas" style={{ height: 140 }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <polygon points={`0,100 ${pts} 100,100`} fill={fill} />
          <polyline points={pts} fill="none" stroke={accent} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        {result.events.map((e) => {
          const rAt = tl.find((p) => p.month === e.month)?.remaining ?? 0
          return (
            <div key={`${e.name}-${e.month}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${xs(e.month)}%`, top: `${ys(rAt)}%` }}>
              <div className="size-2 rounded-full ring-2 ring-[var(--surface)]" style={{ background: accent }} title={`${e.name} lunas`} />
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px]" style={{ color: 'var(--ink-soft)' }}>
        <span>Sekarang</span>
        {axisMarks.map((m) => (<span key={m} className="num">{m} bln</span>))}
      </div>
      {result.events.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {result.events.slice(0, 6).map((e) => (
            <span key={`leg-${e.name}-${e.month}`} className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px]" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
              <span className="size-1.5 rounded-full" style={{ background: accent }} />
              {e.name} lunas · <span className="num">{payoffDate(e.month)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function RatioRow({ label, ideal, value, idealMax }: { label: string; ideal: string; value: number | null; idealMax: number }) {
  const color = value == null ? 'var(--ink-soft)'
    : value < idealMax ? 'var(--c-mint)'
    : value < idealMax * 1.5 ? 'var(--c-amber)'
    : 'var(--c-coral)'
  const pct = value != null ? Math.min((value / (idealMax * 2)) * 100, 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm" style={{ color: 'var(--ink)' }}>{label}</p>
          <p className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>{ideal}</p>
        </div>
        <span className="num font-semibold text-sm flex items-center gap-1.5 shrink-0" style={{ color }}>
          {value != null ? `${value.toFixed(1)}%` : '—'}<span className="size-1.5 rounded-full" style={{ background: color }} />
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
