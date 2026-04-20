'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Dividend, Investment } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface FormState {
  id: string | null
  investment_id: string
  ticker: string
  amount: number
  shares: number
  ex_date: string
  pay_date: string
  notes: string
}
const EMPTY: FormState = {
  id: null, investment_id: '', ticker: '', amount: 0, shares: 0,
  ex_date: '', pay_date: new Date().toISOString().split('T')[0], notes: '',
}

export default function DividendsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Dividend[]>([])
  const [stocks, setStocks] = useState<Investment[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [dR, iR] = await Promise.all([
      supabase.from('dividends').select('*').eq('user_id', user.id).order('pay_date', { ascending: false }),
      supabase.from('investments').select('*').eq('user_id', user.id).eq('category', 'stock'),
    ])
    setItems((dR.data ?? []) as Dividend[])
    setStocks((iR.data ?? []) as Investment[])
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const payload = {
      user_id: user.id,
      investment_id: form.investment_id || null,
      ticker: form.ticker || null,
      amount: form.amount,
      shares: form.shares,
      ex_date: form.ex_date || null,
      pay_date: form.pay_date,
      notes: form.notes,
    }
    if (form.id) await supabase.from('dividends').update(payload).eq('id', form.id)
    else await supabase.from('dividends').insert(payload)
    setSaving(false)
    setDialogOpen(false)
    void load()
  }

  async function remove(id: string) {
    if (!confirm('Hapus catatan dividen?')) return
    await supabase.from('dividends').delete().eq('id', id)
    void load()
  }

  // Aggregates
  const stats = useMemo(() => {
    const year = new Date().getFullYear()
    const ytd = items.filter((d) => new Date(d.pay_date).getFullYear() === year).reduce((s, d) => s + d.amount, 0)
    const total = items.reduce((s, d) => s + d.amount, 0)
    const avgMonthly = items.length > 0 ? total / Math.max(1, months(items)) : 0
    return { ytd, total, avgMonthly, count: items.length }
  }, [items])

  const monthlyData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const d of items) {
      const dd = new Date(d.pay_date)
      const key = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}`
      map[key] = (map[key] || 0) + d.amount
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => {
      const [y, m] = k.split('-')
      return { month: `${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][Number(m) - 1]}'${y.slice(2)}`, value: v }
    })
  }, [items])

  return (
    <div className="space-y-6">
      <div className="dark-card p-6 sm:p-7">
        <p className="caps">Dividen Diterima</p>
        <p className="num tabular mt-3 text-4xl sm:text-5xl font-semibold" style={{ color: 'var(--ink)' }}>
          {formatCurrency(stats.ytd)}
        </p>
        <p className="text-sm mt-2" style={{ color: '#4B5E14' }}>
          YTD · Total all-time <span className="num">{formatCurrency(stats.total)}</span>
          {' · '}Rata-rata <span className="num">{formatCurrency(stats.avgMonthly)}</span>/bln
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {stats.count} catatan · dari {stocks.length} saham aktif
        </p>
        <Button onClick={() => { setForm(EMPTY); setDialogOpen(true) }}>
          <Plus className="h-4 w-4" /> Catat Dividen
        </Button>
      </div>

      {/* Monthly chart */}
      {monthlyData.length > 0 && (
        <div className="s-card p-5">
          <p className="caps">Riwayat Pembayaran</p>
          <h3 className="text-lg font-semibold mt-0.5">Per Bulan</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
              <XAxis dataKey="month" fontSize={11} tick={{ fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
              <YAxis fontSize={11} tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}jt`} tick={{ fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: unknown) => formatCurrency(Number(v) || 0)}
                contentStyle={{ background: 'var(--black)', color: 'var(--on-black)', border: '1px solid var(--black-line)', borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="value" fill="#A3E635" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="s-card p-12 text-center">
          <p className="font-semibold">Belum ada catatan dividen</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>Mulai catat dividen dari saham-saham Anda.</p>
        </div>
      ) : (
        <div className="s-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border-soft)', background: 'var(--surface-2)' }}>
                <Th>Pay Date</Th>
                <Th>Ticker</Th>
                <Th className="text-right">Shares</Th>
                <Th className="text-right">Jumlah</Th>
                <Th className="text-right">Per Share</Th>
                <Th>Catatan</Th>
                <Th className="text-right"></Th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => {
                const s = stocks.find((x) => x.id === d.investment_id)
                const perShare = d.shares > 0 ? d.amount / d.shares : 0
                return (
                  <tr key={d.id} className="border-b" style={{ borderColor: 'var(--border-soft)' }}>
                    <Td>{formatDate(d.pay_date)}</Td>
                    <Td>
                      <span className="rounded-sm px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: 'var(--indigo-100)', color: 'var(--lime-700)' }}>
                        {d.ticker ?? s?.ticker ?? '—'}
                      </span>
                    </Td>
                    <Td className="text-right num">{d.shares.toLocaleString('id-ID')}</Td>
                    <Td className="text-right num font-semibold" style={{ color: 'var(--lime-700)' }}>
                      {formatCurrency(d.amount)}
                    </Td>
                    <Td className="text-right num" style={{ color: 'var(--ink-muted)' }}>
                      {formatCurrency(perShare)}
                    </Td>
                    <Td style={{ color: 'var(--ink-muted)' }}>{d.notes}</Td>
                    <Td className="text-right">
                      <Button variant="ghost" size="icon-sm" onClick={() => remove(d.id)}>
                        <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} />
                      </Button>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Catat Dividen</DialogTitle>
            <DialogDescription>Pembayaran dividen dari saham holdings.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Saham</Label>
              <Select
                value={form.investment_id}
                onValueChange={(v) => {
                  const s = stocks.find((x) => x.id === v)
                  setForm({ ...form, investment_id: v ?? '', ticker: s?.ticker ?? '', shares: s?.quantity ?? 0 })
                }}
              >
                <SelectTrigger><SelectValue placeholder="Pilih saham" /></SelectTrigger>
                <SelectContent>
                  {stocks.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.ticker ?? s.name} — {s.quantity.toLocaleString('id-ID')} shares
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Jumlah Dividen (Rp)</Label>
                <Input type="number" min={0} value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Shares saat itu</Label>
                <Input type="number" min={0} value={form.shares || ''} onChange={(e) => setForm({ ...form, shares: Number(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Ex-Date</Label>
                <Input type="date" value={form.ex_date} onChange={(e) => setForm({ ...form, ex_date: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Pay-Date</Label>
                <Input type="date" value={form.pay_date} onChange={(e) => setForm({ ...form, pay_date: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Catatan</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Interim/Final/Q1..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving || !form.investment_id || form.amount <= 0}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function months(items: Dividend[]): number {
  if (items.length === 0) return 1
  const dates = items.map((d) => new Date(d.pay_date).getTime())
  const min = Math.min(...dates)
  const max = Math.max(...dates)
  return Math.max(1, Math.round((max - min) / (30 * 86_400_000)))
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
