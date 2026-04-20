'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  INCOME_CATEGORIES, EXPENSE_CATEGORIES, SAVING_CATEGORIES, INVESTMENT_CATEGORIES,
} from '@/lib/constants'
import type { Account, RecurringTransaction } from '@/types'
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
import { Plus, Pencil, Trash2, Loader2, Play, Pause } from 'lucide-react'

type TxType = 'income' | 'expense' | 'saving' | 'investment'
type Freq = 'daily' | 'weekly' | 'monthly' | 'yearly'

const TYPE_LABELS: Record<TxType, string> = {
  income: 'Pemasukan', expense: 'Pengeluaran', saving: 'Tabungan', investment: 'Investasi',
}
const FREQ_LABELS: Record<Freq, string> = {
  daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan', yearly: 'Tahunan',
}

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

function addMonths(date: Date, n: number) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}

function nextRunDate(r: RecurringTransaction): Date {
  const today = new Date()
  const dayOfPeriod = r.day_of_period
  if (r.frequency === 'monthly') {
    const next = new Date(today.getFullYear(), today.getMonth(), dayOfPeriod)
    if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      return addMonths(next, 1)
    }
    return next
  }
  if (r.frequency === 'yearly') {
    const next = new Date(today.getFullYear(), 0, dayOfPeriod)
    if (next < today) return new Date(today.getFullYear() + 1, 0, dayOfPeriod)
    return next
  }
  if (r.frequency === 'weekly') {
    const next = new Date(today)
    next.setDate(today.getDate() + 7)
    return next
  }
  const next = new Date(today)
  next.setDate(today.getDate() + 1)
  return next
}

export default function RecurringPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<RecurringTransaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
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
      user_id: user.id,
      name: form.name, type: form.type, category: form.category,
      amount: form.amount, account_id: form.account_id || null,
      frequency: form.frequency, day_of_period: form.day_of_period,
      start_date: form.start_date, end_date: form.end_date || null,
      is_active: form.is_active, notes: form.notes,
    }
    if (form.id) await supabase.from('recurring_transactions').update(payload).eq('id', form.id)
    else await supabase.from('recurring_transactions').insert(payload)
    setSaving(false)
    setDialogOpen(false)
    void load()
  }

  async function remove(id: string) {
    if (!confirm('Hapus recurring ini?')) return
    await supabase.from('recurring_transactions').delete().eq('id', id)
    void load()
  }

  async function toggleActive(r: RecurringTransaction) {
    await supabase.from('recurring_transactions').update({ is_active: !r.is_active }).eq('id', r.id)
    void load()
  }

  async function runNow(r: RecurringTransaction) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('transactions').insert({
      user_id: user.id,
      date: new Date().toISOString().split('T')[0],
      account_id: r.account_id,
      type: r.type,
      category: r.category,
      description: `[Auto] ${r.name}`,
      amount: r.amount,
    })
    await supabase.from('recurring_transactions')
      .update({ last_run_date: new Date().toISOString().split('T')[0] })
      .eq('id', r.id)
    void load()
  }

  function openEdit(r: RecurringTransaction) {
    setForm({
      id: r.id, name: r.name, type: r.type, category: r.category,
      amount: r.amount, account_id: r.account_id ?? '',
      frequency: r.frequency, day_of_period: r.day_of_period,
      start_date: r.start_date, end_date: r.end_date ?? '',
      is_active: r.is_active, notes: r.notes,
    })
    setDialogOpen(true)
  }

  const totals = useMemo(() => {
    const active = items.filter((r) => r.is_active)
    const monthlyIn = active.filter((r) => r.type === 'income' && r.frequency === 'monthly').reduce((s, r) => s + r.amount, 0)
    const monthlyOut = active.filter((r) => r.type !== 'income' && r.frequency === 'monthly').reduce((s, r) => s + r.amount, 0)
    return { active: active.length, monthlyIn, monthlyOut, monthlyNet: monthlyIn - monthlyOut }
  }, [items])

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="dark-card p-6 sm:p-8">
        <p className="caps">Transaksi Berulang</p>
        <div className="mt-3 grid grid-cols-3 gap-4">
          <div>
            <p className="caps" style={{ fontSize: '0.625rem' }}>Masuk/bln</p>
            <p className="num tabular text-2xl font-semibold" style={{ color: 'var(--ink)' }}>
              {formatCurrency(totals.monthlyIn)}
            </p>
          </div>
          <div>
            <p className="caps" style={{ fontSize: '0.625rem' }}>Keluar/bln</p>
            <p className="num tabular text-2xl font-semibold" style={{ color: 'var(--ink)' }}>
              {formatCurrency(totals.monthlyOut)}
            </p>
          </div>
          <div>
            <p className="caps" style={{ fontSize: '0.625rem' }}>Net/bln</p>
            <p className="num tabular text-2xl font-semibold" style={{ color: 'var(--ink)' }}>
              {formatCurrency(totals.monthlyNet)}
            </p>
          </div>
        </div>
        <p className="text-sm mt-3" style={{ color: 'var(--on-black-mut)' }}>
          {totals.active} recurring aktif — otomatis generate transaksi sesuai jadwal.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          Gaji, cicilan, subscription — set sekali, auto-generate tiap periode.
        </p>
        <Button onClick={() => { setForm(EMPTY); setDialogOpen(true) }}>
          <Plus className="h-4 w-4" /> Tambah Recurring
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="s-card p-12 text-center">
          <p className="font-semibold">Belum ada recurring transaction</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>Tambahkan gaji, cicilan, atau subscription.</p>
        </div>
      ) : (
        <div className="s-card overflow-hidden">
          <div className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
            {items.map((r) => {
              const acc = accounts.find((a) => a.id === r.account_id)
              const next = nextRunDate(r)
              return (
                <div key={r.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--surface-2)]/60 transition-colors">
                  <span
                    className="inline-block h-2 w-2 rounded-full shrink-0"
                    style={{ background: r.is_active ? 'var(--lime-400)' : 'var(--ink-soft)' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate" style={{ color: 'var(--ink)' }}>{r.name}</p>
                      <Badge
                        className="rounded-sm px-1.5 py-0 text-[10px] font-medium border-0"
                        style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}
                      >
                        {TYPE_LABELS[r.type]}
                      </Badge>
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                      {FREQ_LABELS[r.frequency]} · tgl {r.day_of_period}
                      {acc && ` · ${acc.name}`}
                      {r.is_active && ` · next ${formatDate(next.toISOString())}`}
                      {!r.is_active && ' · paused'}
                    </p>
                  </div>
                  <p className="num font-semibold tabular" style={{ color: 'var(--ink)' }}>
                    {formatCurrency(r.amount)}
                  </p>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => runNow(r)} title="Run sekarang" disabled={!r.is_active}>
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => toggleActive(r)} title={r.is_active ? 'Pause' : 'Resume'}>
                      <Pause className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(r)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => remove(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit Recurring' : 'Tambah Recurring'}</DialogTitle>
            <DialogDescription>Transaksi ini akan otomatis di-generate sesuai jadwal.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Nama</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Netflix, Gaji Bulanan, KPR..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Tipe</Label>
                <Select value={form.type} onValueChange={(v) => v && setForm({ ...form, type: v as TxType, category: categoriesFor(v as TxType)[0] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABELS) as TxType[]).map((k) => (
                      <SelectItem key={k} value={k}>{TYPE_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Kategori</Label>
                <Select value={form.category} onValueChange={(v) => v && setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categoriesFor(form.type).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Jumlah (Rp)</Label>
                <Input type="number" min={0} value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Akun</Label>
                <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v ?? '' })}>
                  <SelectTrigger><SelectValue placeholder="Pilih akun" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Frekuensi</Label>
                <Select value={form.frequency} onValueChange={(v) => v && setForm({ ...form, frequency: v as Freq })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FREQ_LABELS) as Freq[]).map((k) => <SelectItem key={k} value={k}>{FREQ_LABELS[k]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Tanggal {form.frequency === 'monthly' ? '(1-31)' : form.frequency === 'yearly' ? 'DOY' : ''}</Label>
                <Input type="number" min={1} max={31} value={form.day_of_period} onChange={(e) => setForm({ ...form, day_of_period: Number(e.target.value) || 1 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Mulai</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Berakhir (opsional)</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Catatan</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving || !form.name || !form.account_id}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.id ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
