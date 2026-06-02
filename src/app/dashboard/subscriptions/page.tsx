'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import type { Account, Subscription } from '@/types'
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
  Plus, Trash2, Loader2, Check, ScanLine, Scissors,
  CalendarClock, CircleDollarSign, CheckCircle2, type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

const MINT = '#10B981', AMBER = '#F59E0B', VIOLET = '#8B5CF6', CORAL = '#F43F5E', INDIGO = '#6366F1'
const DAY = 86_400_000

type Cycle = 'weekly' | 'monthly' | 'yearly'
type Status = 'active' | 'consider' | 'cancel'
const CYCLE_LABEL: Record<Cycle, string> = { weekly: 'Mingguan', monthly: 'Bulanan', yearly: 'Tahunan' }
const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  active: { label: 'Aktif', color: '#047857', bg: 'rgba(16,185,129,0.12)' },
  consider: { label: 'Pertimbangkan', color: '#B45309', bg: 'rgba(245,158,11,0.14)' },
  cancel: { label: 'Cabut', color: '#BE123C', bg: 'rgba(244,63,94,0.12)' },
}
const MONOGRAM_COLORS = [VIOLET, MINT, AMBER, CORAL, INDIGO, '#0EA5E9', '#EC4899']
function monoColor(name: string) {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return MONOGRAM_COLORS[Math.abs(h) % MONOGRAM_COLORS.length]
}

interface FormState {
  id: string | null
  name: string; provider: string; price: number; cycle: Cycle
  billing_day: number; status: Status; usage_note: string; account_id: string
}
const EMPTY: FormState = {
  id: null, name: '', provider: '', price: 0, cycle: 'monthly',
  billing_day: 1, status: 'active', usage_note: '', account_id: '',
}

function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
function nextBilling(day: number): Date {
  const t = startOfToday(); const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()
  const thisMo = new Date(t.getFullYear(), t.getMonth(), Math.min(day, last))
  if (thisMo >= t) return thisMo
  const lastN = new Date(t.getFullYear(), t.getMonth() + 2, 0).getDate()
  return new Date(t.getFullYear(), t.getMonth() + 1, Math.min(day, lastN))
}
const dmy = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
const monthlyEq = (s: Subscription) => s.cycle === 'monthly' ? s.price : s.cycle === 'yearly' ? s.price / 12 : s.price * 52 / 12
const annualEq = (s: Subscription) => s.cycle === 'monthly' ? s.price * 12 : s.cycle === 'yearly' ? s.price : s.price * 52

export default function SubscriptionsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [tableReady, setTableReady] = useState(true)
  const [subs, setSubs] = useState<Subscription[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const [sR, aR] = await Promise.all([
      supabase.from('subscriptions').select('*').eq('user_id', user.id).order('price', { ascending: false }),
      supabase.from('accounts').select('*').eq('user_id', user.id).order('name'),
    ])
    if (sR.error) { setTableReady(false); setSubs([]) }
    else { setTableReady(true); setSubs((sR.data ?? []) as Subscription[]) }
    setAccounts((aR.data ?? []) as Account[])
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const payload = {
      user_id: user.id, name: form.name, provider: form.provider, price: form.price,
      cycle: form.cycle, billing_day: form.billing_day, status: form.status,
      usage_note: form.usage_note, account_id: form.account_id || null, is_active: form.status !== 'cancel',
    }
    const res = form.id
      ? await supabase.from('subscriptions').update(payload).eq('id', form.id)
      : await supabase.from('subscriptions').insert(payload)
    setSaving(false)
    if (res.error) { toast.error('Gagal — pastikan migration 036 sudah di-apply'); return }
    setDialogOpen(false); void load()
  }
  async function remove(id: string) {
    if (!confirm('Hapus langganan ini?')) return
    await supabase.from('subscriptions').delete().eq('id', id); void load()
  }
  function openEdit(s: Subscription) {
    setForm({ id: s.id, name: s.name, provider: s.provider, price: s.price, cycle: s.cycle as Cycle, billing_day: s.billing_day, status: s.status as Status, usage_note: s.usage_note, account_id: s.account_id ?? '' })
    setDialogOpen(true)
  }
  function openAdd() { setForm(EMPTY); setDialogOpen(true) }

  // ---- Derived ----
  const active = subs.filter((s) => s.status !== 'cancel')
  const perBulan = active.reduce((s, x) => s + monthlyEq(x), 0)
  const perTahun = active.reduce((s, x) => s + annualEq(x), 0)
  const trimmable = subs.filter((s) => s.status === 'consider' || s.status === 'cancel')
  const trimMonthly = trimmable.reduce((s, x) => s + monthlyEq(x), 0)
  const veryActive = subs.filter((s) => s.status === 'active').length

  const stats = [
    { label: 'Per Bulan', value: formatCurrency(Math.round(perBulan)), sub: `${active.length} aktif`, icon: CircleDollarSign, color: VIOLET, tint: 'rgba(139,92,246,0.12)' },
    { label: 'Per Tahun', value: formatCurrency(Math.round(perTahun)), sub: 'Estimasi total', icon: CalendarClock, color: INDIGO, tint: 'rgba(99,102,241,0.12)' },
    { label: 'Bisa Dipangkas', value: formatCurrency(Math.round(trimMonthly)), sub: `${trimmable.length} jarang dipakai`, icon: Scissors, color: AMBER, tint: 'rgba(245,158,11,0.12)' },
    { label: 'Sangat Aktif', value: `${veryActive} item`, sub: 'Layak dipertahankan', icon: CheckCircle2, color: MINT, tint: 'rgba(16,185,129,0.12)' },
  ]

  const today0 = startOfToday()
  const upcoming = useMemo(() => [...active].map((s) => ({ s, due: nextBilling(s.billing_day) })).sort((a, b) => a.due.getTime() - b.due.getTime()).slice(0, 6), [subs]) // eslint-disable-line react-hooks/exhaustive-deps
  const visible = filter === 'all' ? subs : subs.filter((s) => s.status === filter)

  function audit() {
    if (trimmable.length === 0) { toast.success('Semua langganan masih layak dipertahankan 👍'); return }
    toast(`${trimmable.length} langganan jarang dipakai — potensi hemat ${formatCurrency(Math.round(trimMonthly))}/bln`, { icon: '✂️' })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="eyebrow mb-1.5">{active.length} langganan aktif</p>
          <h1 className="leading-none" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,38px)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>Subscription</h1>
          <p className="text-sm mt-2 max-w-xl" style={{ color: 'var(--ink-muted)' }}>Pantau langganan digital. Tandai &ldquo;Cabut&rdquo; buat yang jarang kepakai biar gak bocor halus tiap bulan.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" onClick={audit}><ScanLine className="h-4 w-4" /> Audit pemakaian</Button>
          <Button onClick={openAdd}><Plus className="h-4 w-4" /> Tambah langganan</Button>
        </div>
      </div>

      {!tableReady && (
        <div className="s-card p-4 flex items-start gap-3" style={{ borderColor: `${AMBER}55`, background: `${AMBER}0F` }}>
          <ScanLine className="size-4 mt-0.5 shrink-0" style={{ color: AMBER }} />
          <p className="text-[13px]" style={{ color: 'var(--ink)' }}>Tabel <code>subscriptions</code> belum ada. Jalankan <strong>migration 036</strong> di Supabase SQL Editor dulu, terus reload.</p>
        </div>
      )}

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

          {subs.length === 0 ? (
            <div className="s-card p-12 text-center">
              <div className="size-12 rounded-2xl grid place-items-center mx-auto" style={{ background: 'var(--surface-2)' }}><CircleDollarSign className="size-6" style={{ color: 'var(--ink-soft)' }} /></div>
              <p className="font-semibold mt-3" style={{ color: 'var(--ink)' }}>Belum ada langganan</p>
              <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>Tambah Spotify, Netflix, ChatGPT, iCloud… biar kelihatan total bocor halusnya.</p>
              <Button className="mt-4" onClick={openAdd}><Plus className="h-4 w-4" /> Tambah langganan</Button>
            </div>
          ) : (
            <>
              {/* Tabel */}
              <div className="s-card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b" style={{ borderColor: 'var(--border-soft)' }}>
                  <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Semua Langganan</p>
                  <div className="flex flex-wrap gap-1.5">
                    {([['all', 'Semua'], ['active', 'Aktif'], ['consider', 'Pertimbangkan'], ['cancel', 'Cabut']] as const).map(([f, lbl]) => (
                      <button key={f} onClick={() => setFilter(f)} className="rounded-full px-2.5 py-1 text-[11px] font-medium transition" style={{ background: filter === f ? 'var(--ink)' : 'var(--surface-2)', color: filter === f ? 'var(--surface)' : 'var(--ink-muted)' }}>{lbl}</button>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                        <th className="text-left font-medium px-4 py-2.5">Layanan</th>
                        <th className="text-left font-medium px-3 py-2.5">Pemakaian</th>
                        <th className="text-left font-medium px-3 py-2.5">Status</th>
                        <th className="text-right font-medium px-3 py-2.5">Tagihan</th>
                        <th className="text-right font-medium px-3 py-2.5">Harga</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((s) => {
                        const sm = STATUS_META[s.status as Status] ?? STATUS_META.active
                        const due = nextBilling(s.billing_day)
                        const cancelled = s.status === 'cancel'
                        return (
                          <tr key={s.id} className="group border-t" style={{ borderColor: 'var(--border-soft)', opacity: cancelled ? 0.6 : 1 }}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="size-9 rounded-xl grid place-items-center shrink-0 text-white font-bold" style={{ background: monoColor(s.name), fontSize: 14 }}>{(s.name[0] || '?').toUpperCase()}</div>
                                <div className="min-w-0">
                                  <p className="font-medium truncate" style={{ color: 'var(--ink)' }}>{s.name}</p>
                                  <p className="text-[11px] truncate" style={{ color: 'var(--ink-soft)' }}>{s.provider || CYCLE_LABEL[s.cycle as Cycle]}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-[13px]" style={{ color: 'var(--ink-muted)' }}>{s.usage_note || '—'}</td>
                            <td className="px-3 py-3"><span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span></td>
                            <td className="px-3 py-3 text-right num text-[13px]" style={{ color: 'var(--ink-muted)' }}>{cancelled ? '—' : dmy(due)}</td>
                            <td className="px-3 py-3 text-right"><span className="num font-semibold tabular" style={{ color: 'var(--ink)' }}>{formatCurrency(s.price)}</span><span className="text-[10px] block" style={{ color: 'var(--ink-soft)' }}>{CYCLE_LABEL[s.cycle as Cycle]}</span></td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-0.5">
                                <Button variant="outline" size="sm" onClick={() => openEdit(s)}>Atur</Button>
                                <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100 transition" onClick={() => remove(s.id)}><Trash2 className="h-3 w-3" style={{ color: 'var(--danger)' }} /></Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bisa Hemat + Jatuh Tempo */}
              <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
                <div className="s-card p-5" style={{ background: trimmable.length ? `${AMBER}0A` : 'var(--surface)', borderColor: trimmable.length ? `${AMBER}33` : 'var(--border-soft)' }}>
                  <p className="text-[11px] font-semibold tracking-[0.14em] uppercase flex items-center gap-1.5" style={{ color: AMBER }}><Scissors className="size-3.5" /> Bisa Hemat {formatCurrency(Math.round(trimMonthly))} / bulan</p>
                  {trimmable.length > 0 ? (
                    <>
                      <p className="text-sm mt-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>Atau {formatCurrency(Math.round(trimMonthly * 12))} setahun dengan mencabut {trimmable.length} langganan.</p>
                      <div className="mt-3 space-y-2">
                        {trimmable.map((s) => (
                          <button key={s.id} type="button" onClick={() => openEdit(s)} className="w-full flex items-center justify-between gap-3 rounded-xl border-l-4 px-3 py-2.5 text-left" style={{ borderColor: s.status === 'cancel' ? CORAL : AMBER, background: 'var(--surface)' }}>
                            <div className="min-w-0"><p className="font-medium truncate" style={{ color: 'var(--ink)' }}>{s.name}</p><p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{s.usage_note || STATUS_META[s.status as Status].label}</p></div>
                            <span className="num font-semibold shrink-0" style={{ color: s.status === 'cancel' ? CORAL : AMBER }}>{formatCurrency(s.price)}/{s.cycle === 'yearly' ? 'thn' : 'bln'}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : <p className="text-sm mt-2" style={{ color: 'var(--ink-muted)' }}>Semua langganan kepakai. Tandai status &ldquo;Pertimbangkan/Cabut&rdquo; di yang jarang dipakai biar muncul di sini.</p>}
                </div>

                <div className="s-card p-5">
                  <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Jatuh Tempo Terdekat</p>
                  <div className="mt-3 space-y-2.5">
                    {upcoming.length > 0 ? upcoming.map(({ s, due }) => {
                      const days = Math.round((due.getTime() - today0.getTime()) / DAY)
                      return (
                        <div key={s.id} className="flex items-center gap-3">
                          <div className="size-9 rounded-lg grid place-items-center shrink-0" style={{ background: 'var(--surface-2)' }}>
                            <span className="text-[8px] uppercase leading-none" style={{ color: 'var(--ink-soft)' }}>{due.toLocaleDateString('id-ID', { month: 'short' })}</span>
                            <span className="num text-sm font-bold leading-none" style={{ color: 'var(--ink)' }}>{due.getDate()}</span>
                          </div>
                          <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{s.name}</p><p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{days} hari lagi</p></div>
                          <span className="num font-semibold text-sm shrink-0" style={{ color: 'var(--ink)' }}>{formatCurrency(s.price)}</span>
                        </div>
                      )
                    }) : <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>Belum ada langganan aktif.</p>}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl grid place-items-center shrink-0" style={{ background: 'rgba(139,92,246,0.12)' }}><CircleDollarSign className="size-5" style={{ color: VIOLET }} /></div>
              <div className="min-w-0">
                <DialogTitle className="text-lg" style={{ fontFamily: 'var(--font-display)' }}>{form.id ? 'Atur Langganan' : 'Tambah Langganan'}</DialogTitle>
                <DialogDescription>Catat langganan digital + status pemakaiannya.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Nama</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Spotify Premium" /></div>
              <div className="grid gap-1.5"><Label>Provider</Label><Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="Spotify" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Harga (Rp)</Label><NumberInput value={form.price} onChange={(n) => setForm({ ...form, price: n })} placeholder="0" /></div>
              <div className="grid gap-1.5"><Label>Siklus</Label>
                <Select value={form.cycle} onValueChange={(v) => v && setForm({ ...form, cycle: v as Cycle })}>
                  <SelectTrigger><SelectValue>{(v) => CYCLE_LABEL[v as Cycle] ?? 'Pilih'}</SelectValue></SelectTrigger>
                  <SelectContent>{(Object.keys(CYCLE_LABEL) as Cycle[]).map((k) => <SelectItem key={k} value={k}>{CYCLE_LABEL[k]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Tgl Tagihan (1–31)</Label><Input type="number" min={1} max={31} value={form.billing_day} onChange={(e) => setForm({ ...form, billing_day: Number(e.target.value) || 1 })} /></div>
              <div className="grid gap-1.5"><Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => v && setForm({ ...form, status: v as Status })}>
                  <SelectTrigger><SelectValue>{(v) => STATUS_META[v as Status]?.label ?? 'Pilih'}</SelectValue></SelectTrigger>
                  <SelectContent>{(Object.keys(STATUS_META) as Status[]).map((k) => <SelectItem key={k} value={k}>{STATUS_META[k].label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5"><Label>Catatan pemakaian</Label><Input value={form.usage_note} onChange={(e) => setForm({ ...form, usage_note: e.target.value })} placeholder="Sangat aktif / Jarang / Tidak dipakai 90 hari…" /></div>
            <div className="grid gap-1.5"><Label>Dibayar dari (opsional)</Label>
              <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v ?? '' })}>
                <SelectTrigger><SelectValue placeholder="Pilih akun">{(v) => accounts.find((a) => a.id === v)?.name || 'Pilih akun'}</SelectValue></SelectTrigger>
                <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving || !form.name}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
