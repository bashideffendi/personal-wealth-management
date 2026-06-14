'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Debt } from '@/types'
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
import { Plus, Loader2, Receipt, Trash2, BadgeDollarSign, CalendarDays } from 'lucide-react'
import { QuietPageHeader } from '@/components/layout/quiet-page-header'
import { useT } from '@/lib/i18n/context'

interface DebtPayment {
  id: string
  debt_id: string
  amount: number
  date: string
  notes: string
}

export default function DebtPaymentsPage() {
  const t = useT()
  const supabase = createClient()
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    debt_id: '', amount: 0, date: new Date().toISOString().split('T')[0], notes: '',
  })
  const [saving, setSaving] = useState(false)

  const pageQuery = useQuery({
    queryKey: ['debt-payments'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('unauthenticated')
      const [dR, pR] = await Promise.all([
        supabase.from('debts').select('*').eq('user_id', user.id),
        supabase.from('debt_payments').select('*').eq('user_id', user.id).order('date', { ascending: false }),
      ])
      if (dR.error) throw dR.error
      if (pR.error) throw pR.error
      return { debts: (dR.data ?? []) as Debt[], payments: (pR.data ?? []) as DebtPayment[] }
    },
  })
  const loading = pageQuery.isLoading
  const debts = pageQuery.data?.debts ?? []
  const payments = pageQuery.data?.payments ?? []
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['debt-payments'] })
    qc.invalidateQueries({ queryKey: ['debts-page'] }) // saldo utang di halaman utama ikut segar
  }

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    // Dua langkah: catat log dulu, baru kurangi saldo — berhenti + toast di
    // langkah yang gagal biar gak ada log tanpa efek saldo (torn state).
    const { error: insErr } = await supabase.from('debt_payments').insert({
      user_id: user.id, debt_id: form.debt_id, amount: form.amount, date: form.date, notes: form.notes,
    })
    if (insErr) { setSaving(false); toast.error(t('common.mutation_failed')); return }
    const d = debts.find((x) => x.id === form.debt_id)
    if (d) {
      const { error: updErr } = await supabase.from('debts').update({ remaining: Math.max(0, d.remaining - form.amount) }).eq('id', d.id)
      if (updErr) { setSaving(false); toast.error(t('common.mutation_failed')); refresh(); return }
    }
    setSaving(false)
    setDialogOpen(false)
    setForm({ debt_id: '', amount: 0, date: new Date().toISOString().split('T')[0], notes: '' })
    toast.success(t('debts_payments.saved_toast'))
    refresh()
  }

  // Hapus pembayaran = batalkan efeknya juga: saldo utang DIKEMBALIKAN
  // (pelajaran dari bug dana darurat — log hilang tapi saldo gak di-reverse).
  async function removePayment(p: DebtPayment) {
    if (!confirm(t('debts_payments.confirm_delete'))) return
    const { error: delErr } = await supabase.from('debt_payments').delete().eq('id', p.id)
    if (delErr) { toast.error(t('common.delete_failed')); return }
    const d = debts.find((x) => x.id === p.debt_id)
    if (d) {
      const { error: updErr } = await supabase.from('debts').update({ remaining: d.remaining + p.amount }).eq('id', d.id)
      if (updErr) toast.error(t('common.mutation_failed'))
    }
    refresh()
  }

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0)
  const thisMonth = payments.filter((p) => {
    const d = new Date(p.date)
    const n = new Date()
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth()
  }).reduce((s, p) => s + p.amount, 0)

  return (
    <div className="space-y-6">
      <QuietPageHeader
        title={t('debts_payments.page_title')}
        info={t('debts_payments.subtitle')}
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> {t('debts_payments.record_payment')}
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : pageQuery.isError ? (
        <div className="s-card flex flex-col items-center text-center py-14 px-8 gap-3">
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>{t('common.load_failed')}</p>
          <Button variant="outline" onClick={() => pageQuery.refetch()}>{t('common.retry')}</Button>
        </div>
      ) : (
        <>
          {/* Stat row — pola KPI tile app-wide */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="s-card p-5">
              <div className="flex items-start justify-between">
                <p className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>{t('debts_payments.eyebrow')}</p>
                <div className="size-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--c-mint-soft)' }}>
                  <BadgeDollarSign className="size-4" style={{ color: 'var(--c-mint-ink)' }} />
                </div>
              </div>
              <p className="num tabular text-xl sm:text-2xl font-bold mt-3 leading-none" style={{ color: 'var(--ink)' }}>{formatCurrency(totalPaid)}</p>
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--ink-soft)' }}>{payments.length} {t('debts_payments.transactions')}</p>
            </div>
            <div className="s-card p-5">
              <div className="flex items-start justify-between">
                <p className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>{t('debts_payments.this_month')}</p>
                <div className="size-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--surface-2)' }}>
                  <CalendarDays className="size-4" style={{ color: 'var(--ink)' }} />
                </div>
              </div>
              <p className="num tabular text-xl sm:text-2xl font-bold mt-3 leading-none" style={{ color: 'var(--ink)' }}>{formatCurrency(thisMonth)}</p>
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--ink-soft)' }}>
                {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          {payments.length === 0 ? (
            <div className="s-card p-12 text-center">
              <Receipt className="size-12 mx-auto" style={{ color: 'var(--ink-soft)' }} />
              <p className="mt-3 font-semibold" style={{ color: 'var(--ink)' }}>{t('debts_payments.empty_title')}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>{t('debts_payments.empty_subtitle')}</p>
            </div>
          ) : (
            <div className="s-card overflow-hidden">
              <div className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
                {payments.map((p) => {
                  const d = debts.find((x) => x.id === p.debt_id)
                  return (
                    <div key={p.id} className="group flex items-center gap-4 px-5 py-4 hover:bg-[var(--surface-2)]/60 transition-colors">
                      <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: 'var(--c-mint)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate" style={{ color: 'var(--ink)' }}>{d?.name ?? '—'}</p>
                        <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                          {formatDate(p.date)}{p.notes ? ` · ${p.notes}` : ''}
                        </p>
                      </div>
                      <p className="num font-semibold tabular shrink-0" style={{ color: 'var(--ink)' }}>{formatCurrency(p.amount)}</p>
                      <Button
                        variant="ghost" size="icon-sm"
                        className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition shrink-0"
                        aria-label={t('debts_payments.delete_aria')}
                        onClick={() => removePayment(p)}
                      >
                        <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('debts_payments.dialog_title')}</DialogTitle>
            <DialogDescription>{t('debts_payments.dialog_description')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>{t('debts_payments.field_debt')}</Label>
              <Select value={form.debt_id} onValueChange={(v) => setForm({ ...form, debt_id: v ?? '' })}>
                <SelectTrigger><SelectValue placeholder={t('debts_payments.select_debt_placeholder')} /></SelectTrigger>
                <SelectContent>
                  {debts.filter((d) => d.is_active).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} — {t('debts_payments.remaining_label')} {formatCurrency(d.remaining)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t('debts_payments.field_amount')}</Label>
                <NumberInput value={form.amount} onChange={(n) => setForm({ ...form, amount: n })} placeholder="0" />
              </div>
              <div className="grid gap-1.5">
                <Label>{t('debts_payments.field_date')}</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>{t('debts_payments.field_notes')}</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t('debts_payments.notes_placeholder')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('debts_payments.cancel')}</Button>
            <Button onClick={save} disabled={saving || !form.debt_id || form.amount <= 0}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('debts_payments.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
