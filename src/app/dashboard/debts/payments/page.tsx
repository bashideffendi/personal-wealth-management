'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Debt } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Loader2 } from 'lucide-react'

interface DebtPayment {
  id: string
  debt_id: string
  amount: number
  date: string
  notes: string
}

export default function DebtPaymentsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [debts, setDebts] = useState<Debt[]>([])
  const [payments, setPayments] = useState<DebtPayment[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    debt_id: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [dR, pR] = await Promise.all([
      supabase.from('debts').select('*').eq('user_id', user.id),
      supabase.from('debt_payments').select('*').eq('user_id', user.id).order('date', { ascending: false }),
    ])
    setDebts((dR.data ?? []) as Debt[])
    setPayments((pR.data ?? []) as DebtPayment[])
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    await supabase.from('debt_payments').insert({
      user_id: user.id,
      debt_id: form.debt_id,
      amount: form.amount,
      date: form.date,
      notes: form.notes,
    })
    const d = debts.find((x) => x.id === form.debt_id)
    if (d) {
      await supabase.from('debts').update({ remaining: Math.max(0, d.remaining - form.amount) }).eq('id', d.id)
    }
    setSaving(false)
    setDialogOpen(false)
    setForm({ debt_id: '', amount: 0, date: new Date().toISOString().split('T')[0], notes: '' })
    void load()
  }

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0)
  const thisMonth = payments.filter((p) => {
    const d = new Date(p.date)
    const n = new Date()
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth()
  }).reduce((s, p) => s + p.amount, 0)

  return (
    <div className="space-y-6">
      <div className="dark-card p-6 sm:p-7">
        <p className="caps">Pembayaran Utang</p>
        <p className="num tabular mt-3 text-4xl sm:text-5xl font-semibold" style={{ color: 'var(--ink)' }}>
          {formatCurrency(totalPaid)}
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm" style={{ color: 'var(--on-black-mut)' }}>
          <span>{payments.length} transaksi</span>
          <span>·</span>
          <span>Bulan ini: <span className="num">{formatCurrency(thisMonth)}</span></span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          Catat setiap pembayaran — otomatis mengurangi saldo utang.
        </p>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Catat Pembayaran
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--indigo-600)' }} /></div>
      ) : payments.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-5xl">✅</p>
          <p className="mt-3 font-semibold">Belum ada riwayat pembayaran</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>Mulai catat pembayaran pertama Anda.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
            {payments.map((p) => {
              const d = debts.find((x) => x.id === p.debt_id)
              return (
                <div key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--surface-2)]/60 transition-colors">
                  <span
                    className="inline-block h-2 w-2 rounded-full shrink-0"
                    style={{ background: 'var(--lime-400)' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" style={{ color: 'var(--ink)' }}>
                      {d?.name ?? '—'}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                      {formatDate(p.date)}{p.notes ? ` · ${p.notes}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="num font-semibold tabular" style={{ color: 'var(--ink)' }}>
                      {formatCurrency(p.amount)}
                    </p>
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
            <DialogTitle>Catat Pembayaran Utang</DialogTitle>
            <DialogDescription>Transaksi ini akan langsung mengurangi saldo utang.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Utang</Label>
              <Select value={form.debt_id} onValueChange={(v) => setForm({ ...form, debt_id: v ?? '' })}>
                <SelectTrigger><SelectValue placeholder="Pilih utang" /></SelectTrigger>
                <SelectContent>
                  {debts.filter((d) => d.is_active).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} — sisa {formatCurrency(d.remaining)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Jumlah</Label>
                <Input type="number" min={0} value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Tanggal</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Catatan</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Opsional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving || !form.debt_id || form.amount <= 0}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
