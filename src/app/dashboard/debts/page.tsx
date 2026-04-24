'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Debt } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil, Trash2, Loader2, ArrowUpRight } from 'lucide-react'

const DEBT_CATEGORY_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  consumer:  { label: 'Konsumer',       emoji: '💳', color: '#F43F5E' },
  cash_loan: { label: 'Pinjaman Tunai', emoji: '💵', color: '#F59E0B' },
  long_term: { label: 'Jangka Panjang', emoji: '🏠', color: '#8B5CF6' },
}

const DEBT_TYPE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  consumer: [
    { value: 'kartu_kredit', label: 'Kartu Kredit' },
    { value: 'paylater', label: 'Paylater' },
    { value: 'kta', label: 'KTA' },
    { value: 'pembiayaan_konsumer', label: 'Pembiayaan Konsumer' },
  ],
  cash_loan: [
    { value: 'pinjaman_pribadi', label: 'Pinjaman Pribadi' },
    { value: 'pinjaman_dana_tunai', label: 'Pinjaman Dana Tunai' },
  ],
  long_term: [
    { value: 'kpr', label: 'KPR' }, { value: 'kpa', label: 'KPA' },
    { value: 'kpt', label: 'KPT' }, { value: 'hutang_kendaraan', label: 'Hutang Kendaraan' },
    { value: 'pinjaman_bisnis', label: 'Pinjaman Bisnis' },
  ],
}

function getDebtTypeLabel(type: string): string {
  for (const types of Object.values(DEBT_TYPE_OPTIONS)) {
    const f = types.find((t) => t.value === type)
    if (f) return f.label
  }
  return type
}

const emptyForm = {
  id: null as string | null,
  name: '', category: 'consumer', type: '',
  principal: 0, remaining: 0, interest_rate: 0, monthly_payment: 0,
  due_date: new Date().toISOString().split('T')[0], is_active: true,
}

export default function DebtsOverviewPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [debts, setDebts] = useState<Debt[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<typeof emptyForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('debts').select('*').eq('user_id', user.id).order('remaining', { ascending: false })
    setDebts((data ?? []) as Debt[])
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
    setSaving(false)
    setDialogOpen(false)
    void load()
  }
  async function remove(id: string) {
    if (!confirm('Hapus utang ini?')) return
    await supabase.from('debts').delete().eq('id', id)
    void load()
  }
  function openEdit(d: Debt) {
    setForm({ id: d.id, name: d.name, category: d.category, type: d.type,
      principal: d.principal, remaining: d.remaining,
      interest_rate: d.interest_rate, monthly_payment: d.monthly_payment,
      due_date: d.due_date, is_active: d.is_active })
    setDialogOpen(true)
  }

  const active = debts.filter((d) => d.is_active && d.remaining > 0)
  const totalRemaining = active.reduce((s, d) => s + d.remaining, 0)
  const totalPrincipal = active.reduce((s, d) => s + d.principal, 0)
  const totalMonthly = active.reduce((s, d) => s + d.monthly_payment, 0)
  const paidPct = totalPrincipal > 0 ? ((totalPrincipal - totalRemaining) / totalPrincipal) * 100 : 0
  const byCategory: Record<string, number> = {}
  for (const d of active) byCategory[d.category] = (byCategory[d.category] || 0) + d.remaining

  return (
    <div className="space-y-6">
      <div className="dark-card p-6 sm:p-8">
        <p className="caps">Utang Aktif</p>
        <p className="num tabular mt-3 text-4xl sm:text-5xl lg:text-6xl font-semibold" style={{ color: 'var(--ink)' }}>
          {formatCurrency(totalRemaining)}
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--on-black-mut)' }}>
          {active.length} utang aktif · cicilan <span className="num">{formatCurrency(totalMonthly)}</span>/bln
        </p>
        {totalPrincipal > 0 && (
          <div className="mt-5 max-w-md">
            <div className="flex items-center justify-between text-[11px] mb-1.5" style={{ color: 'var(--on-black-mut)' }}>
              <span>Progress pelunasan</span>
              <span className="num font-semibold">{paidPct.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <div className="h-full rounded-full" style={{ width: `${paidPct}%`, background: 'var(--butter-400)' }} />
            </div>
          </div>
        )}
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/dashboard/debts/strategy"
          className="group flex items-center justify-between rounded-lg p-4 bg-white border border-[var(--border-soft)] hover:border-[var(--ink)] transition-colors"
        >
          <div>
            <p className="font-semibold" style={{ color: 'var(--ink)' }}>Strategi Pelunasan</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ink-soft)' }}>Snowball / Avalanche</p>
          </div>
          <ArrowUpRight className="h-4 w-4 opacity-30 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
        </Link>
        <Link
          href="/dashboard/debts/payments"
          className="group flex items-center justify-between rounded-lg p-4 bg-white border border-[var(--border-soft)] hover:border-[var(--ink)] transition-colors"
        >
          <div>
            <p className="font-semibold" style={{ color: 'var(--ink)' }}>Pembayaran</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ink-soft)' }}>Log transaksi pelunasan</p>
          </div>
          <ArrowUpRight className="h-4 w-4 opacity-30 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
        </Link>
        <div className="relative overflow-hidden rounded-2xl p-5 bg-white border border-[var(--border-soft)]">
          <p className="caps">Breakdown Kategori</p>
          <div className="mt-2 space-y-1.5">
            {Object.entries(byCategory).length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>Tidak ada utang.</p>
            ) : (
              Object.entries(byCategory).map(([k, v]) => {
                const info = DEBT_CATEGORY_LABELS[k]
                const pct = totalRemaining > 0 ? (v / totalRemaining) * 100 : 0
                return (
                  <div key={k} className="flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--ink-muted)' }}>
                      {info.label}
                    </span>
                    <span className="num font-medium" style={{ color: 'var(--ink)' }}>{pct.toFixed(0)}%</span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Action */}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          Daftar semua utang Anda.
        </p>
        <Button onClick={() => { setForm(emptyForm); setDialogOpen(true) }}>
          <Plus className="h-4 w-4" /> Tambah Utang
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--indigo-600)' }} /></div>
      ) : debts.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-5xl">🎉</p>
          <p className="mt-3 font-semibold">Tidak ada utang tercatat</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>Selamat!</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {debts.map((d) => {
            const info = DEBT_CATEGORY_LABELS[d.category]
            const paid = d.principal - d.remaining
            const paidDebtPct = d.principal > 0 ? (paid / d.principal) * 100 : 0
            return (
              <div
                key={d.id}
                className="group relative rounded-lg p-5 bg-white border border-[var(--border-soft)] hover:border-[var(--ink)] transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--ink)' }}>{d.name}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                      {info.label} · {getDebtTypeLabel(d.type)}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(d)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => remove(d.id)}>
                      <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} />
                    </Button>
                  </div>
                </div>
                <p className="num text-2xl mt-4 tabular font-semibold" style={{ color: 'var(--ink)' }}>
                  {formatCurrency(d.remaining)}
                </p>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                    <span>Lunas <span className="num">{paidDebtPct.toFixed(0)}%</span></span>
                    <Badge
                      className="rounded-sm px-1.5 py-0 border-0 text-[10px] font-semibold"
                      style={{ background: 'var(--lime-100)', color: 'var(--lime-700)' }}
                    >
                      <span className="num">{d.interest_rate}%</span> bunga
                    </Badge>
                  </div>
                  <div className="h-1 w-full rounded-full bg-[var(--surface-2)] overflow-hidden mt-1">
                    <div className="h-full rounded-full" style={{ width: `${paidDebtPct}%`, background: 'var(--ink)' }} />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                  <span>Cicilan <span className="num">{formatCurrency(d.monthly_payment)}</span>/bln</span>
                  <span>Due {formatDate(d.due_date)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit Utang' : 'Tambah Utang'}</DialogTitle>
            <DialogDescription>Isi detail utang Anda.</DialogDescription>
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DEBT_CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.emoji} {v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Tipe</Label>
                <Select value={form.type} onValueChange={(v) => v && setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih tipe" /></SelectTrigger>
                  <SelectContent>
                    {(DEBT_TYPE_OPTIONS[form.category] ?? []).map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Pokok Awal</Label>
                <Input type="number" value={form.principal || ''} onChange={(e) => setForm({ ...form, principal: Number(e.target.value) || 0 })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Sisa</Label>
                <Input type="number" value={form.remaining || ''} onChange={(e) => setForm({ ...form, remaining: Number(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Bunga %</Label>
                <Input type="number" step="any" value={form.interest_rate || ''} onChange={(e) => setForm({ ...form, interest_rate: Number(e.target.value) || 0 })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Cicilan/bln</Label>
                <Input type="number" value={form.monthly_payment || ''} onChange={(e) => setForm({ ...form, monthly_payment: Number(e.target.value) || 0 })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Jatuh Tempo</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving || !form.name || !form.type}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.id ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
