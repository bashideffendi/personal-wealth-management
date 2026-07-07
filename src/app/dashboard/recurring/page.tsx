'use client'

import { useMemo, useState } from 'react'
import { isExpired, nextRunDate, occurrencesInRange, parseISODate, startOfToday, type RecurLike } from '@/lib/recurrence'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
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
import { useI18n } from '@/lib/i18n/context'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { ProviderCatalog } from '@/components/recurring/provider-catalog'

type TxType = 'income' | 'expense' | 'saving' | 'investment'
type Freq = 'daily' | 'weekly' | 'monthly' | 'yearly'

const MINT = 'var(--c-mint)', AMBER = 'var(--c-amber)', VIOLET = 'var(--c-violet)', CORAL = 'var(--c-coral)'
const VIOLET_INK = 'var(--c-violet-ink)', CORAL_INK = 'var(--c-coral-ink)'
const tint = (c: string, p: number) => `color-mix(in srgb, ${c} ${p}%, transparent)`

const CAT_META: Record<string, { color: string; icon: LucideIcon }> = {
  'Tempat Tinggal': { color: VIOLET, icon: Home },
  'Cicilan / Utang': { color: CORAL, icon: Home },
  Tagihan: { color: AMBER, icon: Zap },
  'Utilitas': { color: AMBER, icon: Zap },
  Langganan: { color: VIOLET, icon: Film },
  Hiburan: { color: VIOLET, icon: Film },
  Asuransi: { color: MINT, icon: Shield },
  Investasi: { color: AMBER, icon: TrendingUp },
  Tabungan: { color: MINT, icon: Wallet },
}
const catMeta = (c: string) => CAT_META[c] ?? { color: 'var(--ink-soft)', icon: Repeat }

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
// Helper module-level: dipanggil dari event handler (bukan render).
const isoDaysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString().slice(0, 10)
// Logika tanggal recurrence dipindah ke lib bersama (dipakai juga widget
// dashboard) — lihat src/lib/recurrence.ts.
const occurrencesIn30 = (r: RecurLike) => occurrencesInRange(r, startOfToday(), 30)

const dmy = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })

/** Ekuivalen bulanan buat agregasi lintas frekuensi. */
const monthlyEq = (r: RecurringTransaction) => r.frequency === 'monthly' ? r.amount : r.frequency === 'weekly' ? r.amount * 52 / 12 : r.frequency === 'yearly' ? r.amount / 12 : r.amount * 365 / 12

/** F13f: klasifikasi DERIVED (tanpa migrasi DB) buat tab Rutin|Cicilan|Langganan. */
type Klas = 'rutin' | 'cicilan' | 'langganan'
const klasOf = (r: RecurringTransaction): Klas =>
  (r.category ?? '').includes('Langganan') ? 'langganan'
    : r.end_date && r.type === 'expense' ? 'cicilan'
      : 'rutin'

const dmyy = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' })

export default function RecurringPage() {
  const { t, locale } = useI18n()
  const KLAS_LABELS: Record<Klas, string> = locale === 'en'
    ? { rutin: 'Repeat', cicilan: 'Installment', langganan: 'Subscription' }
    : { rutin: 'Rutin', cicilan: 'Cicilan', langganan: 'Langganan' }
  const TYPE_LABELS: Record<TxType, string> = {
    income: t('recurring.type_income'), expense: t('recurring.type_expense'),
    saving: t('recurring.type_saving'), investment: t('recurring.type_investment'),
  }
  const FREQ_LABELS: Record<Freq, string> = {
    daily: t('recurring.freq_daily'), weekly: t('recurring.freq_weekly'),
    monthly: t('recurring.freq_monthly'), yearly: t('recurring.freq_yearly'),
  }
  const supabase = createClient()
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | Freq>('all')
  // F13f: tab klasifikasi + katalog provider + detail sheet
  const [tab, setTab] = useState<Klas>('rutin')
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'paid' | 'upcoming'>('paid')

  // Deteksi dari riwayat
  const [detectOpen, setDetectOpen] = useState(false)
  const [candidates, setCandidates] = useState<{ name: string; amount: number; category: string; count: number }[]>([])
  const [detecting, setDetecting] = useState(false)


  const pageQuery = useQuery({
    queryKey: ['recurring'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('unauthenticated')
      const [rR, aR] = await Promise.all([
        supabase.from('recurring_transactions').select('*').eq('user_id', user.id).order('day_of_period'),
        supabase.from('accounts').select('*').eq('user_id', user.id).order('name'),
      ])
      if (rR.error) throw rR.error
      if (aR.error) throw aR.error
      return { items: (rR.data ?? []) as RecurringTransaction[], accounts: (aR.data ?? []) as Account[] }
    },
  })
  const loading = pageQuery.isLoading
  const items = useMemo(() => pageQuery.data?.items ?? [], [pageQuery.data])
  const accounts = pageQuery.data?.accounts ?? []
  const refresh = () => qc.invalidateQueries({ queryKey: ['recurring'] })

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
    const { error } = form.id
      ? await supabase.from('recurring_transactions').update(payload).eq('id', form.id)
      : await supabase.from('recurring_transactions').insert(payload)
    setSaving(false)
    if (error) { toast.error(t('common.mutation_failed')); return }
    setDialogOpen(false)
    refresh()
  }

  async function remove(id: string) {
    if (!confirm(t('recurring.confirm_delete'))) return
    const { error } = await supabase.from('recurring_transactions').delete().eq('id', id)
    if (error) { toast.error(t('common.delete_failed')); return }
    refresh()
  }
  async function toggleActive(r: RecurringTransaction) {
    const { error } = await supabase.from('recurring_transactions').update({ is_active: !r.is_active }).eq('id', r.id)
    if (error) { toast.error(t('common.mutation_failed')); return }
    refresh()
  }
  async function runNow(r: RecurringTransaction) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('transactions').insert({
      user_id: user.id, date: new Date().toISOString().split('T')[0], account_id: r.account_id,
      type: r.type, category: r.category, description: `[Auto] ${r.name}`, amount: r.amount,
    })
    if (error) { toast.error(t('common.mutation_failed')); return }
    // last_run_date cuma penanda; transaksi utamanya sudah benar tercatat.
    await supabase.from('recurring_transactions').update({ last_run_date: new Date().toISOString().split('T')[0] }).eq('id', r.id)
    toast.success(`${r.name} ${t('recurring.toast_recorded_suffix')}`)
    refresh()
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

  /** Cek dari riwayat: deskripsi sama dengan pola bulanan-ish (≥2 bulan berbeda, ≤2×/bulan). */
  async function detectFromHistory() {
    setDetecting(true); setDetectOpen(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setDetecting(false); return }
    const cutoff = isoDaysAgo(150)
    const { data } = await supabase.from('transactions')
      .select('description, amount, category, type, date')
      .eq('user_id', user.id).neq('type', 'income').gte('date', cutoff)
    const txs = (data ?? []) as { description: string; amount: number; category: string; type: string; date: string }[]
    const existing = new Set(items.map((r) => r.name.trim().toLowerCase().replace(/^\[auto\]\s*/, '')))
    const groups = new Map<string, { name: string; amounts: number[]; category: string; count: number; months: Set<string> }>()
    for (const tx of txs) {
      const name = (tx.description || '').replace(/^\[auto\]\s*/i, '').trim()
      if (!name || existing.has(name.toLowerCase())) continue
      const g = groups.get(name.toLowerCase()) ?? { name, amounts: [], category: tx.category, count: 0, months: new Set<string>() }
      g.amounts.push(tx.amount); g.count++; g.months.add((tx.date || '').slice(0, 7))
      groups.set(name.toLowerCase(), g)
    }
    const found = [...groups.values()]
      // Pola langganan: nyebar di ≥2 bulan dan gak lebih dari ~2×/bulan —
      // nyaring belanja harian ("Makan siang") yang kebetulan berulang.
      .filter((g) => g.months.size >= 2 && g.count / g.months.size <= 2)
      .map((g) => ({ name: g.name, amount: Math.round(g.amounts.reduce((s, a) => s + a, 0) / g.amounts.length), category: g.category, count: g.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
    setCandidates(found); setDetecting(false)
  }

  // ---- Derived ----
  const active = useMemo(() => items.filter((r) => r.is_active && !isExpired(r)), [items])
  const payments = useMemo(() => active.filter((r) => r.type !== 'income'), [active]) // "pembayaran"
  const byFreq = (f: Freq) => payments.filter((r) => r.frequency === f)
  const sum = (arr: RecurringTransaction[]) => arr.reduce((s, r) => s + r.amount, 0)

  const perBulan = sum(byFreq('monthly'))
  const perMinggu = sum(byFreq('weekly'))
  const perTahun = sum(byFreq('yearly'))
  const perHari = sum(byFreq('daily'))
  const totalSetahun = perBulan * 12 + perMinggu * 52 + perTahun + perHari * 365

  const stats = [
    { label: t('recurring.stat_per_month'), value: formatCompactCurrency(perBulan), full: formatCurrency(perBulan), sub: `${byFreq('monthly').length} ${t('recurring.item')}`, icon: Repeat, color: VIOLET, tint: tint(VIOLET, 12) },
    { label: t('recurring.stat_per_week'), value: formatCompactCurrency(perMinggu), full: formatCurrency(perMinggu), sub: `${byFreq('weekly').length} ${t('recurring.item')}`, icon: Repeat, color: AMBER, tint: tint(AMBER, 12) },
    { label: t('recurring.stat_per_year'), value: formatCompactCurrency(perTahun), full: formatCurrency(perTahun), sub: `${byFreq('yearly').length} ${t('recurring.item')}`, icon: Shield, color: MINT, tint: tint(MINT, 12) },
    { label: t('recurring.stat_total_year'), value: formatCompactCurrency(totalSetahun), full: formatCurrency(totalSetahun), sub: t('recurring.estimate'), icon: CalendarClock, color: VIOLET, tint: tint(VIOLET, 12) },
  ]

  // Kalender 30 hari: amount per tanggal
  const today0 = startOfToday()
  const calendar = useMemo(() => {
    const t0 = startOfToday()
    const days: { date: Date; amount: number; count: number }[] = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(t0.getTime() + i * DAY)
      let amount = 0, count = 0
      for (const r of payments) {
        if (occurrencesIn30(r).some((o) => o.toDateString() === d.toDateString())) { amount += r.amount; count++ }
      }
      days.push({ date: d, amount, count })
    }
    return days
  }, [payments])

  // Breakdown per kategori (per bulan equivalent)
  const breakdown = useMemo(() => {
    const m = new Map<string, { total: number; count: number }>()
    for (const r of payments) {
      const g = m.get(r.category) ?? { total: 0, count: 0 }
      g.total += monthlyEq(r); g.count++
      m.set(r.category, g)
    }
    return [...m.entries()].map(([cat, v]) => ({ cat, ...v })).sort((a, b) => b.total - a.total)
  }, [payments])
  const breakdownTotal = breakdown.reduce((s, b) => s + b.total, 0)

  // Saran heuristik
  const suggestions = useMemo(() => {
    const out: { title: string; body: string }[] = []
    const subs = payments.filter((r) => r.category === 'Langganan' || r.category === 'Hiburan')
    if (subs.length >= 2) out.push({ title: `${subs.length} ${t('recurring.sug_subs_title_suffix')}`, body: `${t('recurring.total')} ${formatCurrency(subs.reduce((s, r) => s + r.amount, 0))}${t('recurring.per_month_short')}. ${t('recurring.sug_subs_body')}` })
    const biggest = [...payments].sort((a, b) => monthlyEq(b) - monthlyEq(a))[0]
    if (biggest) out.push({ title: `${biggest.name} ${t('recurring.sug_biggest_title_suffix')}`, body: `${formatCurrency(Math.round(monthlyEq(biggest)))}${t('recurring.per_month_short')} (${(monthlyEq(biggest) / Math.max(1, breakdownTotal) * 100).toFixed(0)}% ${t('recurring.sug_biggest_body_suffix')}).` })
    const yearlyBig = payments.filter((r) => r.frequency === 'yearly')[0]
    const yNext = yearlyBig ? nextRunDate(yearlyBig) : null
    if (yearlyBig && yNext) out.push({ title: `${yearlyBig.name} ${t('recurring.sug_yearly_title_suffix')}`, body: `${t('recurring.sug_yearly_set_aside')} ${formatCurrency(Math.round(yearlyBig.amount / 12))}${t('recurring.per_month_short')} ${t('recurring.sug_yearly_body_suffix')} ${dmy(yNext)}.` })
    return out.slice(0, 3)
  }, [payments, breakdownTotal, t])

  // F13f: tab klasifikasi memfilter list; filter frekuensi existing digabung
  const klasCounts = useMemo(() => {
    const c: Record<Klas, number> = { rutin: 0, cicilan: 0, langganan: 0 }
    for (const r of items) c[klasOf(r)]++
    return c
  }, [items])
  const visible = items.filter((r) => klasOf(r) === tab && (filter === 'all' || r.frequency === filter))

  // F13f: detail item (bottom sheet)
  const detailItem = useMemo(() => items.find((r) => r.id === detailId) ?? null, [items, detailId])
  const detailData = useMemo(() => {
    if (!detailItem) return null
    const t0 = startOfToday()
    const startD = parseISODate(detailItem.start_date)
    // Terbayar = occurrence dari start_date s.d. hari ini (inklusif)
    const past = startD && startD <= t0
      ? occurrencesInRange(detailItem, startD, Math.round((t0.getTime() - startD.getTime()) / DAY)).filter((d) => d.getTime() <= t0.getTime())
      : []
    return {
      paidCount: past.length,
      totalPaid: past.length * detailItem.amount,
      paidList: past.slice(-12).reverse(),
      upcoming: occurrencesInRange(detailItem, t0, 365).slice(0, 12),
    }
  }, [detailItem])
  const detailList = detailData ? (detailTab === 'paid' ? detailData.paidList : detailData.upcoming) : []

  function openDetail(r: RecurringTransaction) {
    setDetailTab('paid')
    setDetailId(r.id)
  }
  // Tab Langganan: tombol tambah buka katalog provider dulu
  function handleAdd() {
    if (tab === 'langganan') setCatalogOpen(true)
    else openAdd()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="leading-tight truncate" style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{t('recurring.title')}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" onClick={detectFromHistory}><Search className="h-4 w-4" /> {t('recurring.check_history')}</Button>
          <Button onClick={handleAdd}><Plus className="h-4 w-4" /> {t('recurring.add_recurring')}</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--ink-soft)' }} /></div>
      ) : pageQuery.isError ? (
        <div className="s-card flex flex-col items-center text-center py-14 px-8 gap-3">
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>{t('common.load_failed')}</p>
          <Button variant="outline" onClick={() => pageQuery.refetch()}>{t('common.retry')}</Button>
        </div>
      ) : (
        <>
          {/* F10: pas kosong, 4 tile "Rp 0" mati di-hide di mobile — diganti
              1 kartu ringkas (empty state di bawah yang cerita). */}
          {items.length === 0 && stats.length > 0 && (
            <div className="s-card px-4 py-3 flex items-center justify-between md:hidden">
              <div>
                <p className="text-[11px] font-medium" style={{ color: 'var(--ink-soft)' }}>{stats[0].label}</p>
                <p className="num tabular text-[18px] font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{stats[0].value}</p>
              </div>
              <span className="text-[11.5px] rounded-full px-2.5 py-1" style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}>{stats[0].sub}</span>
            </div>
          )}
          {/* Stat strip */}
          <div className={items.length === 0 ? 'hidden md:grid grid-cols-2 lg:grid-cols-4 gap-3' : 'grid grid-cols-2 lg:grid-cols-4 gap-3'}>
            {stats.map((s) => (
              <div key={s.label} className="s-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium flex items-center gap-1.5" style={{ color: 'var(--ink-soft)' }}><span className="size-1.5 rounded-full" style={{ background: s.color }} />{s.label}</p>
                    <p className="num tabular text-[19px] font-semibold mt-1.5 whitespace-nowrap" title={s.full} style={{ color: 'var(--ink)' }}>{s.value}</p>
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
                <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>{t('recurring.next_30_days')}</p>
                <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{t('recurring.total')} {formatCurrency(calendar.reduce((s, d) => s + d.amount, 0))}</p>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {calendar.map((d, i) => {
                  const has = d.amount > 0
                  const isToday = i === 0
                  return (
                    <div key={i} className="shrink-0 rounded-lg border grid content-between text-center" title={has ? `${dmy(d.date)} · ${formatCurrency(d.amount)}` : dmy(d.date)}
                      style={{ width: 46, height: 56, padding: 6, borderColor: isToday ? 'var(--ink)' : has ? tint(VIOLET, 33) : 'var(--border-soft)', background: has ? tint(VIOLET, 6) : 'var(--surface)' }}>
                      <span className="num text-[13px] font-semibold" style={{ color: isToday ? 'var(--ink)' : has ? VIOLET_INK : 'var(--ink-soft)' }}>{d.date.getDate()}</span>
                      {has && <span className="num text-[8.5px] leading-tight" style={{ color: VIOLET_INK }}>{d.amount >= 1e6 ? `${(d.amount / 1e6).toFixed(1)}jt` : `${Math.round(d.amount / 1e3)}k`}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {items.length === 0 ? (
            /* F10: empty state hangat — chip ikon tint brand, bukan abu datar */
            <div className="s-card px-6 py-10 text-center">
              <div className="size-16 rounded-[22px] grid place-items-center mx-auto" style={{ background: 'var(--c-mint-soft)' }}><Repeat className="size-7" style={{ color: 'var(--c-mint-ink)' }} /></div>
              <p className="text-[15px] font-semibold mt-3.5" style={{ color: 'var(--ink)' }}>{t('recurring.empty_title')}</p>
              <p className="text-[12.5px] mt-1 max-w-[300px] mx-auto leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{t('recurring.empty_body')}</p>
              <Button className="mt-4 rounded-full" onClick={() => openAdd()}><Plus className="h-4 w-4" /> {t('recurring.add_recurring')}</Button>
            </div>
          ) : (
            <>
              {/* F13f: segmented Rutin | Cicilan | Langganan (derived, tanpa migrasi) */}
              <div className="grid grid-cols-3 gap-1 rounded-xl p-1" style={{ background: 'var(--surface-2)' }}>
                {(['rutin', 'cicilan', 'langganan'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTab(k)}
                    className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-medium transition-colors"
                    style={{
                      background: tab === k ? 'var(--surface)' : 'transparent',
                      color: tab === k ? 'var(--ink)' : 'var(--ink-muted)',
                      boxShadow: tab === k ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    {KLAS_LABELS[k]}
                    <span className="num tabular text-[10px] min-w-[18px] px-1 py-px rounded-full" style={{ background: tab === k ? 'var(--surface-2)' : tint('var(--ink)', 6), color: 'var(--ink-soft)' }}>{klasCounts[k]}</span>
                  </button>
                ))}
              </div>

              {/* Tabel */}
              <div className="s-card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b" style={{ borderColor: 'var(--border-soft)' }}>
                  <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>{t('recurring.list_title')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {([['all', t('recurring.filter_all')], ['monthly', t('recurring.freq_monthly')], ['weekly', t('recurring.freq_weekly')], ['daily', t('recurring.freq_daily')], ['yearly', t('recurring.freq_yearly')]] as const).map(([f, lbl]) => (
                      <button key={f} onClick={() => setFilter(f)} className="rounded-full px-2.5 py-1 text-[11px] font-medium transition"
                        style={{ background: filter === f ? 'var(--ink)' : 'var(--surface-2)', color: filter === f ? 'var(--surface)' : 'var(--ink-muted)' }}>{lbl}</button>
                    ))}
                  </div>
                </div>
                {visible.length === 0 && (
                  <p className="text-[12px] text-center py-8" style={{ color: 'var(--ink-soft)' }}>{locale === 'en' ? 'No items in this tab' : 'Belum ada item di tab ini'}</p>
                )}
                <div className={visible.length === 0 ? 'hidden' : 'overflow-x-auto hidden md:block'}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                        <th className="text-left font-medium px-4 py-2.5">{t('recurring.col_name')}</th>
                        <th className="text-left font-medium px-3 py-2.5">{t('recurring.col_category')}</th>
                        <th className="text-left font-medium px-3 py-2.5">{t('recurring.col_frequency')}</th>
                        <th className="text-left font-medium px-3 py-2.5">{t('recurring.col_account')}</th>
                        <th className="text-right font-medium px-3 py-2.5">{t('recurring.col_due')}</th>
                        <th className="text-right font-medium px-4 py-2.5">{t('recurring.col_amount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((r) => {
                        const acc = accounts.find((a) => a.id === r.account_id)
                        const meta = catMeta(r.category)
                        const Icon = meta.icon
                        const next = nextRunDate(r)
                        const ended = isExpired(r)
                        const days = next ? Math.round((next.getTime() - today0.getTime()) / DAY) : 0
                        const urgent = r.is_active && !ended && next != null && days <= 3
                        return (
                          <tr key={r.id} className="group border-t align-middle" style={{ borderColor: 'var(--border-soft)' }}>
                            <td className="px-4 py-3">
                              {/* F13f: tap area nama = buka detail (aksi lain di kolom kanan tetap) */}
                              <button type="button" onClick={(e) => { e.stopPropagation(); openDetail(r) }} className="flex items-center gap-3 min-w-0 w-full text-left cursor-pointer">
                                <div className="size-8 rounded-lg grid place-items-center shrink-0" style={{ background: tint(meta.color, 10), opacity: r.is_active ? 1 : 0.5 }}><Icon className="size-4" style={{ color: meta.color }} /></div>
                                <div className="min-w-0">
                                  <p className="font-medium truncate flex items-center gap-1.5" style={{ color: 'var(--ink)' }}>{r.name}{!r.is_active && <span className="text-[9px] uppercase tracking-wide px-1 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}>{t('recurring.badge_paused')}</span>}</p>
                                  <p className="text-[11px] truncate" style={{ color: 'var(--ink-soft)' }}>{TYPE_LABELS[r.type]}{r.notes ? ` · ${r.notes}` : ''}</p>
                                </div>
                              </button>
                            </td>
                            <td className="px-3 py-3 text-[13px]" style={{ color: 'var(--ink-muted)' }}>{r.category}</td>
                            <td className="px-3 py-3"><span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>{FREQ_LABELS[r.frequency]}</span></td>
                            <td className="px-3 py-3 text-[13px] truncate" style={{ color: 'var(--ink-muted)' }}>{acc?.name ?? '—'}</td>
                            <td className="px-3 py-3 text-right">
                              <p className="num text-[13px] font-medium" style={{ color: urgent ? CORAL_INK : 'var(--ink)' }}>{next ? dmy(next) : '—'}</p>
                              <p className="num text-[10px]" style={{ color: urgent ? CORAL_INK : 'var(--ink-soft)' }}>{ended ? t('recurring.badge_ended') : r.is_active ? `${days} ${t('recurring.days_left')}` : t('recurring.paused')}</p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="num font-semibold tabular" style={{ color: 'var(--ink)' }}>{formatCurrency(r.amount)}</span>
                              <div className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition mt-1">
                                <Button variant="ghost" size="icon-sm" onClick={() => runNow(r)} title={t('recurring.action_record_now')} disabled={!r.is_active || isExpired(r)}><Play className="h-3 w-3" /></Button>
                                <Button variant="ghost" size="icon-sm" onClick={() => toggleActive(r)} title={r.is_active ? t('recurring.action_pause') : t('recurring.action_resume')}><Pause className="h-3 w-3" /></Button>
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
                {/* Mobile: baris-compact (1 baris + hairline; tap = detail, edit dari detail) */}
                <div className="md:hidden">
                  {visible.map((r, i) => {
                    const meta = catMeta(r.category)
                    const Icon = meta.icon
                    const next = nextRunDate(r)
                    const ended = isExpired(r)
                    const days = next ? Math.round((next.getTime() - today0.getTime()) / DAY) : 0
                    const urgent = r.is_active && !ended && next != null && days <= 3
                    return (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => openDetail(r)}
                        className="w-full text-left flex items-center gap-3 px-3.5 transition-colors active:bg-[var(--surface-2)]"
                        style={{ minHeight: 56, borderTop: i ? '1px solid var(--border-soft)' : 'none', opacity: r.is_active ? 1 : 0.6 }}
                      >
                        <div className="size-[30px] rounded-lg grid place-items-center shrink-0" style={{ background: tint(meta.color, 10) }}>
                          <Icon className="size-[15px]" style={{ color: meta.color }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-medium truncate leading-tight flex items-center gap-1.5" style={{ color: 'var(--ink)' }}>
                            {r.name}
                            {!r.is_active && <span className="text-[9px] uppercase tracking-wide px-1 py-0.5 rounded shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}>{t('recurring.badge_paused')}</span>}
                          </p>
                          <p className="text-[11px] truncate leading-tight mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                            {FREQ_LABELS[r.frequency]} · {next ? dmy(next) : '—'}{r.is_active && !ended && next ? ` · ${days} ${t('recurring.days_left')}` : ended ? ` · ${t('recurring.badge_ended')}` : ''}
                          </p>
                        </div>
                        <p className="num tabular text-[14px] font-semibold leading-tight shrink-0" style={{ color: urgent ? CORAL_INK : 'var(--ink)' }}>
                          {formatCurrency(r.amount)}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Breakdown + Saran */}
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="s-card p-5">
                  <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>{t('recurring.by_category')}</p>
                  {breakdown.length > 0 ? (
                    <>
                      <div className="mt-3 flex w-full quest-track" style={{ ['--bar-h' as string]: '10px' }}>
                        {breakdown.map((b) => <div key={b.cat} title={b.cat} style={{ width: `${(b.total / breakdownTotal) * 100}%`, background: catMeta(b.cat).color }} />)}
                      </div>
                      <div className="mt-3 space-y-2">
                        {breakdown.map((b) => (
                          <div key={b.cat} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2 min-w-0"><span className="size-2 rounded-full shrink-0" style={{ background: catMeta(b.cat).color }} /><span className="truncate" style={{ color: 'var(--ink-muted)' }}>{b.cat}</span></span>
                            <span className="flex items-center gap-3 shrink-0">
                              <span className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{b.count} {t('recurring.item')}</span>
                              <span className="num font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(Math.round(b.total))}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : <p className="text-sm mt-3" style={{ color: 'var(--ink-soft)' }}>{t('recurring.no_active')}</p>}
                </div>

                <div className="s-card p-5">
                  <p className="text-[11px] font-semibold tracking-[0.14em] uppercase flex items-center gap-1.5" style={{ color: VIOLET_INK }}><Sparkles className="size-3.5" /> {t('recurring.suggestions_title')}</p>
                  <div className="mt-3 space-y-2.5">
                    {suggestions.length > 0 ? suggestions.map((s, i) => (
                      <div key={i} className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                        <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{s.title}</p>
                        <p className="hidden md:block text-[12px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>{s.body}</p>
                      </div>
                    )) : <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>{t('recurring.no_suggestions')}</p>}
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
              <div className="size-10 rounded-xl grid place-items-center shrink-0" style={{ background: tint(VIOLET, 12) }}><Repeat className="size-5" style={{ color: VIOLET_INK }} /></div>
              <div className="min-w-0">
                <DialogTitle className="text-lg" style={{ fontFamily: 'var(--font-display)' }}>{form.id ? t('recurring.dialog_edit_title') : t('recurring.dialog_add_title')}</DialogTitle>
                <DialogDescription>{t('recurring.dialog_description')}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5"><Label>{t('recurring.field_name')}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('recurring.field_name_placeholder')} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>{t('recurring.field_type')}</Label>
                <Select value={form.type} onValueChange={(v) => v && setForm({ ...form, type: v as TxType, category: categoriesFor(v as TxType)[0] })}>
                  <SelectTrigger><SelectValue>{(v) => TYPE_LABELS[v as TxType] ?? t('recurring.select_placeholder')}</SelectValue></SelectTrigger>
                  <SelectContent>{(Object.keys(TYPE_LABELS) as TxType[]).map((k) => <SelectItem key={k} value={k}>{TYPE_LABELS[k]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5"><Label>{t('recurring.field_category')}</Label>
                <Select value={form.category} onValueChange={(v) => v && setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue>{(v) => v || t('recurring.select_placeholder')}</SelectValue></SelectTrigger>
                  <SelectContent>{categoriesFor(form.type).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>{t('recurring.field_amount')}</Label><NumberInput value={form.amount} onChange={(n) => setForm({ ...form, amount: n })} placeholder="0" /></div>
              <div className="grid gap-1.5"><Label>{t('recurring.field_account')}</Label>
                <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v ?? '' })}>
                  <SelectTrigger><SelectValue placeholder={t('recurring.select_account_placeholder')}>{(v) => accounts.find((a) => a.id === v)?.name || t('recurring.select_account_placeholder')}</SelectValue></SelectTrigger>
                  <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>{t('recurring.field_frequency')}</Label>
                <Select value={form.frequency} onValueChange={(v) => v && setForm({ ...form, frequency: v as Freq })}>
                  <SelectTrigger><SelectValue>{(v) => FREQ_LABELS[v as Freq] ?? t('recurring.select_placeholder')}</SelectValue></SelectTrigger>
                  <SelectContent>{(Object.keys(FREQ_LABELS) as Freq[]).map((k) => <SelectItem key={k} value={k}>{FREQ_LABELS[k]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5"><Label>{t('recurring.field_date')} {form.frequency === 'monthly' ? '(1–31)' : ''}</Label>
                {form.frequency === 'monthly'
                  ? <Input type="number" min={1} max={31} value={form.day_of_period} onChange={(e) => setForm({ ...form, day_of_period: Number(e.target.value) || 1 })} />
                  : <p className="text-[12px] flex items-center rounded-md border px-3" style={{ color: 'var(--ink-soft)', borderColor: 'var(--border-soft)', minHeight: 36 }}>{form.frequency === 'weekly' ? t('recurring.weekly_follows_start') : form.frequency === 'yearly' ? t('recurring.yearly_follows_start') : t('recurring.daily_every_day')}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>{t('recurring.field_start')}</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>{t('recurring.field_end')}</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('recurring.cancel')}</Button>
            <Button onClick={save} disabled={saving || !form.name || !form.account_id}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{t('recurring.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cek dari riwayat dialog */}
      <Dialog open={detectOpen} onOpenChange={setDetectOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl grid place-items-center shrink-0" style={{ background: tint(VIOLET, 12) }}><Search className="size-5" style={{ color: VIOLET_INK }} /></div>
              <div className="min-w-0">
                <DialogTitle className="text-lg" style={{ fontFamily: 'var(--font-display)' }}>{t('recurring.detect_title')}</DialogTitle>
                <DialogDescription>{t('recurring.detect_description')}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="py-2">
            {detecting ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--ink-soft)' }} /></div>
            ) : candidates.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: 'var(--ink-soft)' }}>{t('recurring.detect_empty')}</p>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {candidates.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--border-soft)' }}>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate" style={{ color: 'var(--ink)' }}>{c.name}</p>
                      <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{c.category} · {t('recurring.appeared')} {c.count}× · ~{formatCurrency(c.amount)}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => { setDetectOpen(false); openAdd({ name: c.name, amount: c.amount, category: c.category, type: 'expense' }) }}><Plus className="h-3.5 w-3.5" /> {t('recurring.add')}</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* F13f: katalog provider langganan */}
      <ProviderCatalog
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        onPick={(p) => { setCatalogOpen(false); openAdd({ name: p.name, category: p.category, type: 'expense', frequency: 'monthly' }) }}
        onManual={() => { setCatalogOpen(false); openAdd({ type: 'expense', category: 'Langganan', frequency: 'monthly' }) }}
      />

      {/* F13f: detail item (bottom sheet) */}
      <BottomSheet open={!!detailItem} onOpenChange={(o) => { if (!o) setDetailId(null) }} title={detailItem?.name ?? ''}>
        {detailItem && detailData && (
          <div className="px-1 pb-2 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="num tabular text-[22px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>{formatCurrency(detailItem.amount)}</p>
                <p className="text-[11.5px] mt-0.5 truncate" style={{ color: 'var(--ink-soft)' }}>{FREQ_LABELS[detailItem.frequency]} · {detailItem.category}</p>
              </div>
              <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>{KLAS_LABELS[klasOf(detailItem)]}</span>
            </div>

            <div className="rounded-xl px-3.5 py-3 flex items-center justify-between gap-3" style={{ background: 'var(--surface-2)' }}>
              <p className="text-[12px] font-medium" style={{ color: 'var(--ink-muted)' }}>{locale === 'en' ? 'Total paid' : 'Total terbayar'}</p>
              <p className="num tabular text-[14px] font-semibold whitespace-nowrap" style={{ color: 'var(--ink)' }}>{formatCurrency(detailData.totalPaid)} <span className="text-[11px] font-medium" style={{ color: 'var(--ink-soft)' }}>· {detailData.paidCount}×</span></p>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-lg p-1" style={{ background: 'var(--surface-2)' }}>
              {([['paid', locale === 'en' ? 'Paid' : 'Terbayar'], ['upcoming', locale === 'en' ? 'Upcoming' : 'Mendatang']] as const).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setDetailTab(k)}
                  className="rounded-md py-1.5 text-[12px] font-medium transition-colors"
                  style={{
                    background: detailTab === k ? 'var(--surface)' : 'transparent',
                    color: detailTab === k ? 'var(--ink)' : 'var(--ink-muted)',
                    boxShadow: detailTab === k ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  }}
                >{lbl}</button>
              ))}
            </div>

            <div>
              {detailList.map((d, i) => (
                <div key={i} className="flex items-center justify-between py-2" style={{ borderTop: i ? '1px solid var(--border-soft)' : 'none' }}>
                  <span className="num text-[13px]" style={{ color: 'var(--ink-muted)' }}>{dmyy(d)}</span>
                  <span className="num tabular text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{formatCurrency(detailItem.amount)}</span>
                </div>
              ))}
              {detailList.length === 0 && (
                <p className="text-[12px] text-center py-6" style={{ color: 'var(--ink-soft)' }}>{locale === 'en' ? 'Nothing yet' : 'Belum ada'}</p>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setDetailId(null)}>{locale === 'en' ? 'Close' : 'Tutup'}</Button>
              <Button className="flex-1" onClick={() => { const r = detailItem; setDetailId(null); openEdit(r) }}><Pencil className="h-4 w-4" /> Edit</Button>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
