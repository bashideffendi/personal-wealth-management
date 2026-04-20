'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { StockTransaction, Investment } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Loader2, TrendingUp, TrendingDown } from 'lucide-react'

interface FormState {
  id: string | null
  investment_id: string
  ticker: string
  side: 'buy' | 'sell'
  shares: number
  price: number
  fee: number
  broker: string
  date: string
  notes: string
}
const EMPTY: FormState = {
  id: null, investment_id: '', ticker: '', side: 'buy',
  shares: 0, price: 0, fee: 0, broker: '',
  date: new Date().toISOString().split('T')[0], notes: '',
}

// FIFO realized P/L computation
function computeRealizedPL(txs: StockTransaction[]): number {
  // Group by ticker
  const byTicker: Record<string, StockTransaction[]> = {}
  for (const t of txs) {
    const k = t.ticker ?? 'unknown'
    if (!byTicker[k]) byTicker[k] = []
    byTicker[k].push(t)
  }
  let total = 0
  for (const group of Object.values(byTicker)) {
    // Sort by date asc
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date))
    const lots: { shares: number; cost: number }[] = []
    for (const t of sorted) {
      if (t.side === 'buy') {
        lots.push({ shares: t.shares, cost: t.price })
      } else {
        // sell — match against lots FIFO
        let remaining = t.shares
        while (remaining > 0 && lots.length > 0) {
          const lot = lots[0]
          const take = Math.min(lot.shares, remaining)
          total += take * (t.price - lot.cost) - (t.fee * (take / t.shares))
          lot.shares -= take
          remaining -= take
          if (lot.shares <= 0) lots.shift()
        }
      }
    }
  }
  return total
}

export default function StockLogPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<StockTransaction[]>([])
  const [stocks, setStocks] = useState<Investment[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [filterTicker, setFilterTicker] = useState<string>('all')

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [sR, iR] = await Promise.all([
      supabase.from('stock_transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }),
      supabase.from('investments').select('*').eq('user_id', user.id).eq('category', 'stock'),
    ])
    setItems((sR.data ?? []) as StockTransaction[])
    setStocks((iR.data ?? []) as Investment[])
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const total = form.shares * form.price + (form.side === 'buy' ? form.fee : -form.fee)
    const payload = {
      user_id: user.id,
      investment_id: form.investment_id || null,
      ticker: form.ticker || null,
      side: form.side,
      shares: form.shares,
      price: form.price,
      fee: form.fee,
      total,
      broker: form.broker,
      date: form.date,
      notes: form.notes,
    }
    if (form.id) await supabase.from('stock_transactions').update(payload).eq('id', form.id)
    else await supabase.from('stock_transactions').insert(payload)
    setSaving(false)
    setDialogOpen(false)
    void load()
  }

  async function remove(id: string) {
    if (!confirm('Hapus transaksi saham?')) return
    await supabase.from('stock_transactions').delete().eq('id', id)
    void load()
  }

  const filtered = useMemo(() => {
    if (filterTicker === 'all') return items
    return items.filter((t) => t.ticker === filterTicker)
  }, [items, filterTicker])

  const stats = useMemo(() => {
    const totalBuys = items.filter((t) => t.side === 'buy').reduce((s, t) => s + t.total, 0)
    const totalSells = items.filter((t) => t.side === 'sell').reduce((s, t) => s + t.total, 0)
    const realizedPL = computeRealizedPL(items)
    return { totalBuys, totalSells, realizedPL, count: items.length }
  }, [items])

  const tickers = Array.from(new Set(items.map((t) => t.ticker).filter(Boolean) as string[]))

  const plPositive = stats.realizedPL >= 0

  return (
    <div className="space-y-6">
      <div className="dark-card p-6 sm:p-7">
        <p className="caps">Stock Transaction Log</p>
        <div className="mt-3 grid grid-cols-3 gap-4">
          <div>
            <p className="caps" style={{ fontSize: '0.625rem' }}>Total Buy</p>
            <p className="num tabular text-xl sm:text-2xl font-semibold" style={{ color: 'var(--ink)' }}>
              {formatCurrency(stats.totalBuys)}
            </p>
          </div>
          <div>
            <p className="caps" style={{ fontSize: '0.625rem' }}>Total Sell</p>
            <p className="num tabular text-xl sm:text-2xl font-semibold" style={{ color: 'var(--ink)' }}>
              {formatCurrency(stats.totalSells)}
            </p>
          </div>
          <div>
            <p className="caps" style={{ fontSize: '0.625rem' }}>Realized P/L (FIFO)</p>
            <p className="num tabular text-xl sm:text-2xl font-semibold flex items-center gap-1" style={{ color: plPositive ? 'var(--lime-700)' : 'var(--danger)' }}>
              {plPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {formatCurrency(stats.realizedPL)}
            </p>
          </div>
        </div>
        <p className="text-sm mt-3" style={{ color: 'var(--on-black-mut)' }}>
          {stats.count} transaksi · data untuk lapor SPT tahunan
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--ink-muted)' }}>Filter ticker:</span>
          <Select value={filterTicker} onValueChange={(v) => setFilterTicker(v ?? 'all')}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {tickers.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { setForm(EMPTY); setDialogOpen(true) }}>
          <Plus className="h-4 w-4" /> Tambah Transaksi
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="s-card p-12 text-center">
          <p className="font-semibold">Belum ada transaksi saham</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>Mulai catat buy/sell per saham.</p>
        </div>
      ) : (
        <div className="s-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border-soft)', background: 'var(--surface-2)' }}>
                <Th>Tanggal</Th>
                <Th>Ticker</Th>
                <Th>Side</Th>
                <Th className="text-right">Shares</Th>
                <Th className="text-right">Harga</Th>
                <Th className="text-right">Fee</Th>
                <Th className="text-right">Total</Th>
                <Th>Broker</Th>
                <Th className="text-right"></Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b" style={{ borderColor: 'var(--border-soft)' }}>
                  <Td>{formatDate(t.date)}</Td>
                  <Td>
                    <span className="num font-semibold text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}>
                      {t.ticker ?? '—'}
                    </span>
                  </Td>
                  <Td>
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase"
                      style={{
                        background: t.side === 'buy' ? 'var(--lime-100)' : 'var(--danger-bg)',
                        color: t.side === 'buy' ? 'var(--lime-700)' : 'var(--danger)',
                      }}
                    >
                      {t.side}
                    </span>
                  </Td>
                  <Td className="text-right num">{t.shares.toLocaleString('id-ID')}</Td>
                  <Td className="text-right num">{formatCurrency(t.price)}</Td>
                  <Td className="text-right num" style={{ color: 'var(--ink-muted)' }}>{formatCurrency(t.fee)}</Td>
                  <Td className="text-right num font-semibold">{formatCurrency(t.total)}</Td>
                  <Td style={{ color: 'var(--ink-muted)' }}>{t.broker || '—'}</Td>
                  <Td className="text-right">
                    <Button variant="ghost" size="icon-sm" onClick={() => remove(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} />
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit Transaksi' : 'Tambah Transaksi Saham'}</DialogTitle>
            <DialogDescription>Buy / Sell untuk hitung realized P/L FIFO.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Saham</Label>
              <Select
                value={form.investment_id}
                onValueChange={(v) => {
                  const s = stocks.find((x) => x.id === v)
                  setForm({ ...form, investment_id: v ?? '', ticker: s?.ticker ?? '' })
                }}
              >
                <SelectTrigger><SelectValue placeholder="Pilih saham" /></SelectTrigger>
                <SelectContent>
                  {stocks.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.ticker ?? s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Side</Label>
                <Select value={form.side} onValueChange={(v) => v && setForm({ ...form, side: v as 'buy' | 'sell' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy">BUY</SelectItem>
                    <SelectItem value="sell">SELL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Tanggal</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Shares</Label>
                <Input type="number" step="any" min={0} value={form.shares || ''} onChange={(e) => setForm({ ...form, shares: Number(e.target.value) || 0 })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Harga/share</Label>
                <Input type="number" min={0} value={form.price || ''} onChange={(e) => setForm({ ...form, price: Number(e.target.value) || 0 })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Fee</Label>
                <Input type="number" min={0} value={form.fee || ''} onChange={(e) => setForm({ ...form, fee: Number(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Broker / Sekuritas</Label>
              <Input value={form.broker} onChange={(e) => setForm({ ...form, broker: e.target.value })} placeholder="Stockbit, Ajaib, IBKR..." />
            </div>
            <div className="grid gap-1.5">
              <Label>Catatan</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            {form.shares > 0 && form.price > 0 && (
              <p className="text-xs p-2 rounded" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
                Total: <span className="num font-semibold" style={{ color: 'var(--ink)' }}>
                  {formatCurrency(form.shares * form.price + (form.side === 'buy' ? form.fee : -form.fee))}
                </span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving || !form.investment_id || form.shares <= 0 || form.price <= 0}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider ${className}`} style={{ color: 'var(--ink-muted)' }}>
      {children}
    </th>
  )
}
function Td({ children, className = '', style }: { children?: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <td className={`px-3 py-2.5 ${className}`} style={style}>{children}</td>
}
