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
import { Plus, Pencil, Trash2, Loader2, AlertTriangle, RefreshCw, Sparkles } from 'lucide-react'
import { InstitutionLogo } from '@/components/accounts/institution-logo'
import { WealthHero } from '@/components/wealth/wealth-ui'

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
const TYPE_META: Record<string, { jenis: string; yield: number; tier: Tier }> = {
  bank:           { jenis: 'Tabungan',   yield: 0.01,  tier: 'instan' },
  investment:     { jenis: 'Reksa Dana', yield: 0.045, tier: 't1' },
  cash:           { jenis: 'Kas',        yield: 0,     tier: 'instan' },
  digital_wallet: { jenis: 'E-Wallet',   yield: 0,     tier: 'instan' },
  receivable:     { jenis: 'Piutang',    yield: 0,     tier: 't30' },
}
const metaFor = (type: string) => TYPE_META[type] ?? { jenis: type, yield: 0, tier: 'instan' as Tier }

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

  return (
    <div className="space-y-6">
      <WealthHero
        eyebrow={`${accountCount} aset likuid`}
        title="Aset Likuid"
        accent="#10B981"
        headline={{
          label: 'Total Aset Likuid',
          value: formatCurrency(total),
          sub: `${accountCount} akun aktif · bisa dicairkan cepat`,
        }}
        secondary={[
          { label: 'Cair Instan', value: formatCurrency(stats.instan), color: '#10B981' },
          { label: 'Menghasilkan Bunga', value: formatCurrency(stats.berbunga), color: '#F59E0B' },
          { label: 'Piutang', value: formatCurrency(stats.piutang), color: '#F43F5E' },
        ]}
        actions={<>
          <Button variant="outline" onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Sinkronkan</Button>
          <Button onClick={() => { setForm(EMPTY); setDialogOpen(true) }}><Plus className="h-4 w-4" /> Tambah aset</Button>
        </>}
      />

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
          {/* Tabel rincian */}
          <div className="s-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b" style={{ borderColor: 'var(--border-soft)' }}>
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Rincian Aset Likuid</p>
              <div className="flex flex-wrap gap-1.5">
                {jenisPresent.map((j) => (
                  <button
                    key={j}
                    onClick={() => setFilter(j)}
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium transition"
                    style={{
                      background: filter === j ? 'var(--ink)' : 'var(--surface-2)',
                      color: filter === j ? 'var(--surface)' : 'var(--ink-muted)',
                    }}
                  >
                    {j}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                    <th className="text-left font-medium px-4 py-2.5">Aset</th>
                    <th className="text-left font-medium px-3 py-2.5">Jenis</th>
                    <th className="text-right font-medium px-3 py-2.5">Yield*</th>
                    <th className="text-right font-medium px-3 py-2.5">Likuiditas*</th>
                    <th className="text-right font-medium px-4 py-2.5">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((e) => {
                    const m = metaFor(e.type)
                    return (
                      <tr key={`${e.source}-${e.id}`} className="group border-t" style={{ borderColor: 'var(--border-soft)' }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <InstitutionLogo accountName={e.name} size={32} shape="circle" />
                            <div className="min-w-0">
                              <p className="font-medium truncate" style={{ color: 'var(--ink)' }}>{e.name}</p>
                              <p className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>
                                {e.source === 'account' ? 'Otomatis dari akun' : 'Manual'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
                            {m.jenis}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right num" style={{ color: m.yield > 0 ? '#10B981' : 'var(--ink-soft)' }}>
                          {m.yield > 0 ? `${(m.yield * 100).toFixed(2)}%` : '—'}
                        </td>
                        <td className="px-3 py-3 text-right text-[12px]" style={{ color: m.tier === 'instan' ? '#10B981' : 'var(--ink-muted)' }}>
                          {TIER_META[m.tier].label}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {e.source === 'asset_liquid' && (
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                                <Button variant="ghost" size="icon-sm" onClick={() => { setForm({ id: e.id, name: e.name, type: e.type as FormState['type'], balance: e.balance }); setDialogOpen(true) }}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon-sm" onClick={() => remove(e.id, e.source)}>
                                  <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} />
                                </Button>
                              </div>
                            )}
                            <span className="num font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(e.balance)}</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="px-4 py-2.5 text-[10px] border-t" style={{ color: 'var(--ink-soft)', borderColor: 'var(--border-soft)' }}>
              *Yield &amp; likuiditas = perkiraan berdasarkan jenis aset, bukan rate riil akunmu. <Link href="/dashboard/accounts" className="hover:underline" style={{ color: 'var(--ink-muted)' }}>Kelola akun →</Link>
            </p>
          </div>

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
            <DialogTitle>{form.id ? 'Edit Aset Lain' : 'Tambah Aset Lain'}</DialogTitle>
            <DialogDescription>
              Untuk akun transaksi rutin (BCA/Cash/GoPay), buka menu{' '}
              <Link href="/dashboard/accounts" className="font-semibold hover:underline" style={{ color: 'var(--c-mint)' }}>Akun</Link>
              {' '}— saldo auto update dari transaksi.
            </DialogDescription>
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
