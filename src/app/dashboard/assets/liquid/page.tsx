'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import {
  fetchLiquidEntries,
  sumLiquid,
  findDuplicates,
  type UnifiedLiquidEntry,
} from '@/lib/liquid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Plus, Pencil, Trash2, Loader2, AlertTriangle, RefreshCw, Sparkles,
  Landmark, TrendingUp, Banknote, Smartphone, HandCoins, Wallet,
  Zap, Percent, LayoutGrid, List, ArrowUpDown, type LucideIcon,
} from 'lucide-react'
import { InstitutionLogo } from '@/components/accounts/institution-logo'
import { WealthHeader } from '@/components/wealth/wealth-ui'

// Likuiditas tier (perkiraan dari jenis aset — model belum simpan per-aset).
type Tier = 'instan' | 't1' | 't30' | 't90'
const TIER_META: Record<Tier, { label: string; bar: string }> = {
  instan: { label: 'Instan', bar: '#10B981' },
  t1:     { label: 'T+1',    bar: '#8B5CF6' },
  t30:    { label: 'T+30',   bar: '#F59E0B' },
  t90:    { label: 'T+60–90', bar: '#6366F1' },
}
const TIER_ORDER: Tier[] = ['instan', 't1', 't30', 't90']

// Perkiraan jenis · yield tahunan · likuiditas berdasarkan tipe.
const TYPE_META: Record<string, { jenis: string; yield: number; tier: Tier; icon: LucideIcon; color: string }> = {
  bank:           { jenis: 'Tabungan',   yield: 0.01,  tier: 'instan', icon: Landmark,   color: '#10B981' },
  investment:     { jenis: 'Reksa Dana', yield: 0.045, tier: 't1',     icon: TrendingUp, color: '#8B5CF6' },
  rdn:            { jenis: 'RDN',        yield: 0,     tier: 't1',     icon: TrendingUp, color: '#0EA5E9' },
  cash:           { jenis: 'Kas',        yield: 0,     tier: 'instan', icon: Banknote,   color: '#F59E0B' },
  digital_wallet: { jenis: 'E-Wallet',   yield: 0,     tier: 'instan', icon: Smartphone, color: '#6366F1' },
  receivable:     { jenis: 'Piutang',    yield: 0,     tier: 't30',    icon: HandCoins,  color: '#F43F5E' },
}
// Fallback tipe gak dikenal: jangan tampil mentah — UPPERCASE biar gak keliatan kayak bug.
const metaFor = (type: string) => TYPE_META[type] ?? { jenis: type.toUpperCase(), yield: 0, tier: 'instan' as Tier, icon: Wallet, color: '#64748B' }

const MM_YIELD = 0.0485 // RD Pasar Uang ~ acuan saran optimasi

interface FormState {
  id: string | null
  name: string
  type: 'receivable' | 'cash' | 'bank' | 'digital_wallet'
  balance: number
}
const EMPTY: FormState = { id: null, name: '', type: 'receivable', balance: 0 }

export default function LiquidAssetsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<UnifiedLiquidEntry[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<string>('Semua')
  const [view, setView] = useState<'card' | 'table'>('card')
  const [sortKey, setSortKey] = useState<'saldo' | 'yield'>('saldo')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const data = await fetchLiquidEntries(supabase, user.id)
    setEntries(data)
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [])
  useEffect(() => {
    const v = typeof window !== 'undefined' ? localStorage.getItem('pwm.liquid.view') : null
    if (v === 'table' || v === 'card') setView(v)
  }, [])
  function changeView(v: 'card' | 'table') { setView(v); try { localStorage.setItem('pwm.liquid.view', v) } catch { /* ignore */ } }
  function toggleSort(k: 'saldo' | 'yield') {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(k); setSortDir('desc') }
  }

  async function save() {
    if (!form.name.trim()) { alert('Nama aset wajib diisi.'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const now = new Date()
    const payload = {
      user_id: user.id, name: form.name.trim(), type: form.type, balance: form.balance,
      month: now.getMonth() + 1, year: now.getFullYear(),
    }
    const op = form.id
      ? supabase.from('assets_liquid').update(payload).eq('id', form.id)
      : supabase.from('assets_liquid').insert(payload)
    const { error } = await op
    setSaving(false)
    if (error) { alert(`Gagal simpan: ${error.message}`); return }
    setDialogOpen(false)
    void load()
  }

  async function remove(id: string, source: 'account' | 'asset_liquid') {
    if (source === 'account') {
      alert('Akun tidak bisa dihapus dari sini. Buka menu "Akun" untuk menghapus.')
      return
    }
    if (!confirm('Hapus aset ini?')) return
    const { error } = await supabase.from('assets_liquid').delete().eq('id', id)
    if (error) alert(`Gagal hapus: ${error.message}`)
    void load()
  }

  const total = sumLiquid(entries)
  const duplicates = findDuplicates(entries)
  const accountCount = entries.length

  const stats = useMemo(() => {
    let instan = 0, berbunga = 0, annualInterest = 0, piutang = 0, savingsIdle = 0
    for (const e of entries) {
      const m = metaFor(e.type)
      if (m.tier === 'instan') instan += e.balance
      if (m.yield > 0) { berbunga += e.balance; annualInterest += e.balance * m.yield }
      if (e.type === 'receivable') piutang += e.balance
      if (e.type === 'bank') savingsIdle += e.balance
    }
    const weighted = total > 0 ? (annualInterest / total) * 100 : 0
    const berbungaPct = total > 0 ? (berbunga / total) * 100 : 0
    return { instan, berbunga, annualInterest, piutang, savingsIdle, weighted, berbungaPct }
  }, [entries, total])

  // Saran optimasi: pindahin tabungan nganggur ke RD Pasar Uang (estimasi).
  const optimasi = useMemo(() => {
    if (stats.savingsIdle <= 0) return null
    const extra = stats.savingsIdle * (MM_YIELD - metaFor('bank').yield)
    return { movable: stats.savingsIdle, extra }
  }, [stats.savingsIdle])

  // Tangga likuiditas — bucket saldo per tier.
  const ladder = useMemo(() => {
    const buckets: Record<Tier, number> = { instan: 0, t1: 0, t30: 0, t90: 0 }
    for (const e of entries) buckets[metaFor(e.type).tier] += e.balance
    return TIER_ORDER.map((t) => ({ tier: t, amount: buckets[t] })).filter((b) => b.amount > 0)
  }, [entries])

  const jenisPresent = useMemo(() => {
    const set = new Set(entries.map((e) => metaFor(e.type).jenis))
    return ['Semua', ...Array.from(set)]
  }, [entries])

  const visible = filter === 'Semua' ? entries : entries.filter((e) => metaFor(e.type).jenis === filter)

  // Grouping per jenis (buat kartu + allocation bar) + sorting (buat tabel).
  const grouped = useMemo(() => {
    const g: Record<string, UnifiedLiquidEntry[]> = {}
    for (const e of entries) (g[e.type] ??= []).push(e)
    return g
  }, [entries])
  const typeSum = (t: string) => (grouped[t] ?? []).reduce((s, e) => s + e.balance, 0)
  const typesPresent = Object.keys(grouped).sort((a, b) => typeSum(b) - typeSum(a))
  const sorted = [...visible].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    if (sortKey === 'yield') return (metaFor(a.type).yield - metaFor(b.type).yield) * dir
    return (a.balance - b.balance) * dir
  })

  function renderCard(e: UnifiedLiquidEntry) {
    const m = metaFor(e.type)
    const Icon = m.icon
    const isAccount = e.source === 'account'
    return (
      <div key={`${e.source}-${e.id}`} className="group relative overflow-hidden rounded-xl bg-[var(--surface)] border border-[var(--border-soft)] p-5 transition-all hover:border-[var(--ink)] hover:shadow-lg">
        {e.source === 'asset_liquid' && (
          <div className="absolute top-2.5 right-2.5 z-10 flex gap-0.5 rounded-lg p-0.5 opacity-0 shadow-sm transition group-hover:opacity-100" style={{ background: 'var(--surface)' }}>
            <Button variant="ghost" size="icon-sm" onClick={() => { setForm({ id: e.id, name: e.name, type: e.type as FormState['type'], balance: e.balance }); setDialogOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon-sm" onClick={() => remove(e.id, e.source)}><Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} /></Button>
          </div>
        )}
        <div className="flex items-center gap-3">
          {isAccount
            ? <InstitutionLogo accountName={e.name} size={40} shape="circle" />
            : <div className="size-10 rounded-xl grid place-items-center shrink-0" style={{ background: `${m.color}1A` }}><Icon className="size-5" style={{ color: m.color }} /></div>}
          <div className="min-w-0">
            <p className="font-semibold truncate" style={{ color: 'var(--ink)' }}>{e.name}</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>{isAccount ? 'Otomatis dari akun' : 'Manual'}</p>
          </div>
        </div>
        <p className="num text-2xl mt-3 tabular font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(e.balance)}</p>
        <div className="mt-4 pt-3 border-t text-[11px]" style={{ borderColor: 'var(--border-soft)' }}>
          <span style={{ color: 'var(--ink-soft)' }}>
            {TIER_META[m.tier].label}
            {m.yield > 0 && <> · yield <span className="num" style={{ color: '#10B981' }}>{(m.yield * 100).toFixed(2)}%</span></>}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <WealthHeader
        eyebrow={`${accountCount} aset likuid`}
        title="Aset Likuid"
        subtitle="Saldo akun + aset yang bisa dicairkan cepat. Yield & likuiditas perkiraan dari jenis aset."
      >
        <Button variant="outline" onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Sinkronkan</Button>
        <Button onClick={() => { setForm(EMPTY); setDialogOpen(true) }}><Plus className="h-4 w-4" /> Tambah aset</Button>
      </WealthHeader>

      {duplicates.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl p-4" style={{ background: '#F59E0B14', border: '1px solid #F59E0B33' }}>
          <AlertTriangle className="size-5 shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
          <div className="flex-1 text-sm" style={{ color: 'var(--ink)' }}>
            <p className="font-medium">Terdeteksi kemungkinan duplikat</p>
            <p className="mt-1" style={{ color: 'var(--ink-muted)' }}>
              Aset ini punya nama sama dengan Akun → kehitung dua kali:
              <span className="font-semibold"> {duplicates.map((d) => d.name).join(', ')}</span>.
              Hapus dari Aset Likuid biar gak double-count.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <>
          {/* Stat strip — ikut Aset Non-Likuid (ikon + sel kosong di-mute) */}
          <div className="s-card grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 overflow-hidden" style={{ borderColor: 'var(--border-soft)' }}>
            <div className="p-5">
              <p className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: 'var(--ink-soft)' }}>Total Aset Likuid</p>
              <p className="num tabular text-3xl sm:text-4xl font-bold mt-2 leading-none" style={{ color: 'var(--ink)' }}>{formatCurrency(total)}</p>
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--ink-muted)' }}>{accountCount} aset · yield tertimbang <span className="num font-semibold" style={{ color: stats.weighted > 0 ? '#10B981' : 'var(--ink-muted)' }}>{stats.weighted.toFixed(2)}%</span></p>
            </div>
            {([
              { label: 'Cair Instan', val: stats.instan, color: '#10B981', icon: Zap, sub: total > 0 ? `${((stats.instan / total) * 100).toFixed(0)}% siap dipakai` : '—' },
              { label: 'Berbunga', val: stats.berbunga, color: '#F59E0B', icon: Percent, sub: stats.annualInterest > 0 ? `≈ +${formatCurrency(Math.round(stats.annualInterest))}/thn` : 'belum ada' },
              { label: 'Piutang', val: stats.piutang, color: '#F43F5E', icon: HandCoins, sub: 'belum tertagih' },
            ] as const).map((c) => {
              const CIcon = c.icon
              const empty = c.val <= 0
              return (
                <div key={c.label} className="p-5" style={{ opacity: empty ? 0.5 : 1 }}>
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase" style={{ color: c.color }}><CIcon className="size-3" />{c.label}</p>
                  <p className="num tabular text-xl font-bold mt-2 leading-none" style={{ color: 'var(--ink)' }}>{formatCurrency(c.val)}</p>
                  <p className="text-[11px] mt-1.5" style={{ color: 'var(--ink-muted)' }}>{c.sub}</p>
                </div>
              )
            })}
          </div>

          {/* Allocation bar — komposisi per jenis (muncul kalau >=2 jenis) */}
          {total > 0 && typesPresent.length >= 2 && (
            <div className="s-card p-4">
              <div className="flex h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                {typesPresent.map((t) => (typeSum(t) > 0 ? <div key={t} title={metaFor(t).jenis} style={{ width: `${(typeSum(t) / total) * 100}%`, background: metaFor(t).color }} /> : null))}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
                {typesPresent.map((t) => (typeSum(t) > 0 ? (
                  <span key={t} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                    <span className="size-2 rounded-full" style={{ background: metaFor(t).color }} />{metaFor(t).jenis}
                    <span className="num font-semibold" style={{ color: 'var(--ink)' }}>{((typeSum(t) / total) * 100).toFixed(0)}%</span>
                  </span>
                ) : null))}
              </div>
            </div>
          )}

          {/* Toolbar — label + filter pills + toggle ikon (ikut saham/non-likuid) */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Rincian Aset Likuid</p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1.5">
                {jenisPresent.map((j) => (
                  <button key={j} onClick={() => setFilter(j)} className="rounded-full px-2.5 py-1 text-[11px] font-medium transition" style={{ background: filter === j ? 'var(--ink)' : 'var(--surface-2)', color: filter === j ? 'var(--surface)' : 'var(--ink-muted)' }}>{j}</button>
                ))}
              </div>
              <div className="flex items-center rounded-md border overflow-hidden" style={{ borderColor: 'var(--border-soft)' }}>
                <button type="button" onClick={() => changeView('card')} className="size-8 flex items-center justify-center transition" style={{ background: view === 'card' ? 'var(--ink)' : 'var(--surface)', color: view === 'card' ? 'var(--surface)' : 'var(--ink-muted)' }} title="Tampilan kartu" aria-label="Tampilan kartu"><LayoutGrid className="size-4" /></button>
                <button type="button" onClick={() => changeView('table')} className="size-8 flex items-center justify-center transition" style={{ background: view === 'table' ? 'var(--ink)' : 'var(--surface)', color: view === 'table' ? 'var(--surface)' : 'var(--ink-muted)' }} title="Tampilan tabel" aria-label="Tampilan tabel"><List className="size-4" /></button>
              </div>
            </div>
          </div>

          {/* Data — Tabel (datar, sortable) atau Kartu (grouped per jenis) */}
          {view === 'table' ? (
            <div className="overflow-x-auto rounded-xl border bg-[var(--surface)]" style={{ borderColor: 'var(--border-soft)' }}>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border-soft)', color: 'var(--ink-soft)' }}>
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium">Aset</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium">Jenis</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium">Sumber</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium"><button onClick={() => toggleSort('yield')} className="ml-auto inline-flex items-center gap-1 transition-colors hover:text-[var(--ink)]">Yield* {sortKey === 'yield' && <ArrowUpDown className="size-3" />}</button></th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium">Likuiditas*</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-medium"><button onClick={() => toggleSort('saldo')} className="ml-auto inline-flex items-center gap-1 transition-colors hover:text-[var(--ink)]">Saldo {sortKey === 'saldo' && <ArrowUpDown className="size-3" />}</button></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((e) => {
                    const m = metaFor(e.type)
                    const Icon = m.icon
                    const isAccount = e.source === 'account'
                    return (
                      <tr key={`${e.source}-${e.id}`} className="group border-b last:border-b-0 transition-colors hover:bg-[var(--surface-2)]" style={{ borderColor: 'var(--border-soft)' }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {isAccount ? <InstitutionLogo accountName={e.name} size={32} shape="circle" /> : <div className="size-8 rounded-lg grid place-items-center shrink-0" style={{ background: `${m.color}1A` }}><Icon className="size-4" style={{ color: m.color }} /></div>}
                            <p className="font-medium truncate" style={{ color: 'var(--ink)' }}>{e.name}</p>
                          </div>
                        </td>
                        <td className="px-3 py-3"><span className="inline-flex items-center gap-1.5 whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}><span className="size-1.5 rounded-full" style={{ background: m.color }} />{m.jenis}</span></td>
                        <td className="px-3 py-3 whitespace-nowrap" style={{ color: 'var(--ink-soft)' }}>{isAccount ? 'Akun' : 'Manual'}</td>
                        <td className="px-3 py-3 text-right num whitespace-nowrap" style={{ color: m.yield > 0 ? '#10B981' : 'var(--ink-soft)' }}>{m.yield > 0 ? `${(m.yield * 100).toFixed(2)}%` : '—'}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap" style={{ color: m.tier === 'instan' ? '#10B981' : 'var(--ink-muted)' }}>{TIER_META[m.tier].label}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-3">
                            {e.source === 'asset_liquid' && (
                              <div className="flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                                <Button variant="ghost" size="icon-sm" onClick={() => { setForm({ id: e.id, name: e.name, type: e.type as FormState['type'], balance: e.balance }); setDialogOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon-sm" onClick={() => remove(e.id, e.source)}><Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} /></Button>
                              </div>
                            )}
                            <span className="num font-semibold whitespace-nowrap" style={{ color: 'var(--ink)' }}>{formatCurrency(e.balance)}</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-8">
              {typesPresent.map((t) => {
                const list = visible.filter((e) => e.type === t)
                if (!list.length) return null
                const m = metaFor(t)
                const SIcon = m.icon
                const sub = list.reduce((s, e) => s + e.balance, 0)
                return (
                  <section key={t}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="size-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${m.color}1A` }}><SIcon className="size-4" style={{ color: m.color }} /></div>
                      <h3 className="font-semibold" style={{ color: 'var(--ink)' }}>{m.jenis}</h3>
                      <span className="text-[12px]" style={{ color: 'var(--ink-soft)' }}>{list.length} aset</span>
                      <span className="text-[12px]" style={{ color: 'var(--ink-soft)' }}>·</span>
                      <span className="num text-[12px] font-medium" style={{ color: 'var(--ink-muted)' }}>{formatCurrency(sub)}</span>
                      <div className="flex-1 h-px ml-1.5" style={{ background: 'var(--border-soft)' }} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {list.map(renderCard)}
                    </div>
                  </section>
                )
              })}
            </div>
          )}

          {/* Footnote */}
          <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
            *Yield &amp; likuiditas = perkiraan berdasarkan jenis aset, bukan rate riil akunmu. <Link href="/dashboard/accounts" className="hover:underline" style={{ color: 'var(--ink-muted)' }}>Kelola akun →</Link>
          </p>

          {/* 2 panel bawah */}
          <div className="grid gap-3 lg:grid-cols-2">
            {/* Optimasi yield */}
            <div className="s-card p-5">
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Optimasi Yield</p>
              <p className="mt-2 text-xl leading-snug" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
                Bunga tahunan (estimasi) <span className="num font-semibold" style={{ color: '#10B981' }}>{formatCurrency(Math.round(stats.annualInterest))}</span>
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
                Yield tertimbang {stats.weighted.toFixed(2)}% · {stats.berbungaPct.toFixed(0)}% aset likuid sudah berbunga.
              </p>
              {optimasi && (
                <div className="mt-3 rounded-lg px-3 py-2.5" style={{ background: '#F59E0B14' }}>
                  <p className="text-[11px] font-semibold flex items-center gap-1.5" style={{ color: '#B45309' }}>
                    <Sparkles className="size-3.5" /> Saran Klunting
                  </p>
                  <p className="text-[12px] mt-1" style={{ color: 'var(--ink)' }}>
                    Pindahkan <span className="num font-semibold">{formatCurrency(stats.savingsIdle)}</span> dari tabungan ke RD Pasar Uang →
                    potensi <span className="num font-semibold" style={{ color: '#10B981' }}>+{formatCurrency(Math.round(optimasi.extra))}</span>/tahun, likuiditas tetap (T+1).
                  </p>
                </div>
              )}
            </div>

            {/* Tangga likuiditas */}
            <div className="s-card p-5">
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Tangga Likuiditas</p>
              <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                {ladder.map((b) => (
                  <div key={b.tier} style={{ width: `${total > 0 ? (b.amount / total) * 100 : 0}%`, background: TIER_META[b.tier].bar }} />
                ))}
              </div>
              <div className="mt-3 space-y-2">
                {ladder.map((b) => (
                  <div key={b.tier} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2" style={{ color: 'var(--ink-muted)' }}>
                      <span className="size-2 rounded-full" style={{ background: TIER_META[b.tier].bar }} />
                      {TIER_META[b.tier].label}
                    </span>
                    <span className="num font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(b.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl grid place-items-center shrink-0" style={{ background: 'rgba(16,185,129,0.12)' }}><Wallet className="size-5" style={{ color: '#10B981' }} /></div>
              <div className="min-w-0">
                <DialogTitle className="text-lg" style={{ fontFamily: 'var(--font-display)' }}>{form.id ? 'Edit Aset Lain' : 'Tambah Aset Lain'}</DialogTitle>
                <DialogDescription>
                  Untuk akun transaksi rutin (BCA/Cash/GoPay), buka menu{' '}
                  <Link href="/dashboard/accounts" className="font-semibold hover:underline" style={{ color: 'var(--c-mint)' }}>Akun</Link>
                  {' '}— saldo auto update dari transaksi.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Nama</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Piutang Andi, Tabungan Haji, Cash di brankas" />
            </div>
            <div className="grid gap-1.5">
              <Label>Tipe</Label>
              <Select value={form.type} onValueChange={(v) => v && setForm({ ...form, type: v as FormState['type'] })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih tipe">
                    {(v) => ({
                      receivable: 'Piutang', cash: 'Kas (non-transaksional)',
                      bank: 'Bank (terkunci/non-transaksional)', digital_wallet: 'E-Wallet (cadangan)',
                    } as Record<string, string>)[v] ?? 'Pilih tipe'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receivable">Piutang</SelectItem>
                  <SelectItem value="cash">Kas (non-transaksional)</SelectItem>
                  <SelectItem value="bank">Bank (terkunci/non-transaksional)</SelectItem>
                  <SelectItem value="digital_wallet">E-Wallet (cadangan)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Saldo (Rp)</Label>
              <NumberInput value={form.balance} onChange={(n) => setForm({ ...form, balance: n })} placeholder="0" />
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
    </div>
  )
}
