'use client'

/**
 * Tombol "Catat Transaksi" di halaman riset saham — log beli/jual untuk
 * ticker yang sedang dibuka. Insert ke stock_transactions (sama seperti
 * tab Log Manual), ticker disimpan format Yahoo (.JK).
 */

import { useState } from 'react'
import { useT } from '@/lib/i18n/context'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NumberInput } from '@/components/ui/number-input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Loader2 } from 'lucide-react'

export function ResearchLogButton({ ticker, name }: { ticker: string; name: string }) {
  const t = useT()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [shares, setShares] = useState(0)
  const [price, setPrice] = useState(0)
  const [fee, setFee] = useState(0)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')

  async function save() {
    if (shares <= 0 || price <= 0) {
      toast.error(t('research_log.validation'))
      return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const total = shares * price + (side === 'buy' ? fee : -fee)
    const { error } = await supabase.from('stock_transactions').insert({
      user_id: user.id,
      investment_id: null,
      ticker: `${ticker}.JK`,
      side,
      shares,
      price,
      fee,
      total,
      broker: '',
      date,
      notes,
    })
    setSaving(false)
    if (error) { toast.error(t('research_log.saveError')); return }
    toast.success(`${t('research_log.savedPrefix')} ${side === 'buy' ? t('research_log.sideBuyLower') : t('research_log.sideSellLower')} ${ticker} ${t('research_log.savedSuffix')}`)
    setOpen(false)
    setShares(0); setPrice(0); setFee(0); setNotes('')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition hover:opacity-90"
        style={{ background: 'var(--c-primary)', color: 'var(--on-black)' }}
      >
        <Plus className="size-3.5" /> {t('research_log.trigger')}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('research_log.dialogTitlePrefix')} — {ticker}</DialogTitle>
            <DialogDescription>{name}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label>{t('research_log.labelAction')}</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['buy', 'sell'] as const).map((s) => {
                  const active = side === s
                  const c = s === 'buy' ? 'var(--c-mint)' : 'var(--c-coral)'
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSide(s)}
                      className="rounded-lg border py-2 text-sm font-semibold transition"
                      style={active
                        ? { background: s === 'buy' ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)', color: c, borderColor: c }
                        : { background: 'var(--surface)', color: 'var(--ink-muted)', borderColor: 'var(--border-soft)' }}
                    >
                      {s === 'buy' ? t('research_log.sideBuy') : t('research_log.sideSell')}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t('research_log.labelShares')}</Label>
                <Input
                  type="number"
                  value={shares || ''}
                  onChange={(e) => setShares(Number(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t('research_log.labelPrice')}</Label>
                <NumberInput value={price} onChange={setPrice} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t('research_log.labelFee')}</Label>
                <NumberInput value={fee} onChange={setFee} placeholder="0" />
              </div>
              <div className="grid gap-1.5">
                <Label>{t('research_log.labelDate')}</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>{t('research_log.labelNotes')}</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('research_log.notesPlaceholder')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('research_log.cancel')}</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin mr-1" />}{t('research_log.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
