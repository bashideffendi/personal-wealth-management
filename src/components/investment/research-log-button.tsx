'use client'

/**
 * Tombol "Catat Transaksi" di halaman riset saham — log beli/jual untuk
 * ticker yang sedang dibuka. Insert ke stock_transactions (sama seperti
 * tab Log Manual), ticker disimpan format Yahoo (.JK).
 */

import { useState } from 'react'
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
      toast.error('Isi jumlah lembar dan harga terlebih dahulu.')
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
    if (error) { toast.error('Gagal menyimpan transaksi.'); return }
    toast.success(`Transaksi ${side === 'buy' ? 'beli' : 'jual'} ${ticker} tercatat.`)
    setOpen(false)
    setShares(0); setPrice(0); setFee(0); setNotes('')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition hover:opacity-90"
        style={{ background: '#FFFFFF', color: '#0A0A0F' }}
      >
        <Plus className="size-3.5" /> Catat Transaksi
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Catat Transaksi — {ticker}</DialogTitle>
            <DialogDescription>{name}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label>Aksi</Label>
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
                      {s === 'buy' ? 'Beli' : 'Jual'}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Jumlah (lembar)</Label>
                <Input
                  type="number"
                  value={shares || ''}
                  onChange={(e) => setShares(Number(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Harga / lembar</Label>
                <NumberInput value={price} onChange={setPrice} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Biaya (fee)</Label>
                <NumberInput value={fee} onChange={setFee} placeholder="0" />
              </div>
              <div className="grid gap-1.5">
                <Label>Tanggal</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Catatan</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opsional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin mr-1" />}Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
