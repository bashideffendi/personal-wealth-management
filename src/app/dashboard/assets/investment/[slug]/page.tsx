'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { INVESTMENT_SUBCATS, INVESTMENT_SLUG_TO_CATEGORY } from '@/lib/constants'
import type { Investment, Quote } from '@/types'
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
import {
  Loader2, Plus, Pencil, Trash2, RefreshCw, TrendingUp, TrendingDown,
} from 'lucide-react'

interface FormState {
  id: string | null
  name: string
  ticker: string
  platform: string
  quantity: number
  avg_cost: number
  current_price: number
  sector: string
  notes: string
}
const EMPTY: FormState = {
  id: null, name: '', ticker: '', platform: '',
  quantity: 0, avg_cost: 0, current_price: 0, sector: '', notes: '',
}

export default function InvestmentCategoryPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const supabase = createClient()

  const slug = params.slug
  const subcat = INVESTMENT_SUBCATS.find((s) => s.slug === slug)
  const category = INVESTMENT_SLUG_TO_CATEGORY[slug] ?? 'stock'

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [items, setItems] = useState<Investment[]>([])
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!subcat) { router.push('/dashboard/assets/investment'); return }
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('investments')
      .select('*')
      .eq('user_id', user.id)
      .eq('category', category)
      .order('total_value', { ascending: false })
    const list = (data ?? []) as Investment[]
    setItems(list)
    setLoading(false)
    void refreshQuotes(list)
  }

  async function refreshQuotes(list: Investment[] = items) {
    const tickers = Array.from(new Set(list.map((i) => i.ticker).filter(Boolean) as string[]))
    if (tickers.length === 0) return
    setRefreshing(true)
    try {
      const res = await fetch(`/api/quotes?tickers=${encodeURIComponent(tickers.join(','))}`)
      if (!res.ok) return
      const json = (await res.json()) as { quotes: Quote[] }
      const map: Record<string, Quote> = {}
      for (const q of json.quotes) map[q.ticker] = q
      setQuotes(map)
    } finally {
      setRefreshing(false)
    }
  }

  function openCreate() {
    setForm(EMPTY)
    setDialogOpen(true)
  }
  function openEdit(inv: Investment) {
    setForm({
      id: inv.id, name: inv.name, ticker: inv.ticker ?? '',
      platform: inv.platform ?? '', quantity: inv.quantity,
      avg_cost: inv.avg_cost, current_price: inv.current_price || inv.avg_cost,
      sector: (inv as Investment & { sector?: string }).sector ?? '',
      notes: inv.notes ?? '',
    })
    setDialogOpen(true)
  }
  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const type = category === 'stock' || category === 'mutual_fund' || category === 'crypto'
      ? 'variable_income'
      : category === 'business'
        ? 'business'
        : 'fixed_income'
    const payload = {
      user_id: user.id,
      category,
      name: form.name,
      ticker: form.ticker.trim().toUpperCase() || null,
      platform: form.platform,
      quantity: form.quantity,
      avg_cost: form.avg_cost,
      current_price: form.current_price || form.avg_cost,
      total_value: Math.round(form.quantity * (form.current_price || form.avg_cost)),
      type,
      sector: form.sector,
      notes: form.notes,
    }
    if (form.id) await supabase.from('investments').update(payload).eq('id', form.id)
    else await supabase.from('investments').insert(payload)
    setSaving(false)
    setDialogOpen(false)
    void load()
  }
  async function remove(id: string) {
    if (!confirm('Hapus posisi ini?')) return
    await supabase.from('investments').delete().eq('id', id)
    void load()
  }

  const enriched = useMemo(() => {
    return items.map((i) => {
      const q = i.ticker ? quotes[i.ticker.toUpperCase()] : undefined
      const live = q?.price ?? i.current_price ?? i.avg_cost ?? 0
      const shares = i.quantity || 0
      const invested = shares * (i.avg_cost || 0)
      const market = shares * live
      const pl = market - invested
      const plPct = invested > 0 ? (pl / invested) * 100 : 0
      return { i, q, live, shares, invested, market, pl, plPct }
    })
  }, [items, quotes])

  const totals = useMemo(() => {
    const invested = enriched.reduce((s, x) => s + x.invested, 0)
    const market = enriched.reduce((s, x) => s + x.market, 0)
    const pl = market - invested
    const plPct = invested > 0 ? (pl / invested) * 100 : 0
    return { invested, market, pl, plPct }
  }, [enriched])

  if (!subcat) return null

  const up = totals.pl >= 0

  return (
    <div className="space-y-6">
      <div className="dark-card p-6 sm:p-8">
        <p className="caps">{subcat.label}</p>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <p className="num tabular text-4xl sm:text-5xl lg:text-6xl font-semibold" style={{ color: 'var(--ink)' }}>
            {formatCurrency(totals.market)}
          </p>
          {totals.invested > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold"
              style={{
                background: 'var(--black)',
                color: up ? 'var(--lime-400)' : '#F87171',
              }}
            >
              {up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {up ? '+' : ''}{totals.plPct.toFixed(2)}%
            </span>
          )}
        </div>
        <p className="text-sm mt-2" style={{ color: 'var(--on-black-mut)' }}>
          {items.length} posisi · Modal <span className="num">{formatCurrency(totals.invested)}</span>
          {' · '}
          P/L <span className="num">{formatCurrency(totals.pl)}</span>
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {category === 'stock'
            ? 'Saham IDX & US — pakai ticker .JK untuk IDX (contoh: BBCA.JK) atau simbol langsung (AAPL).'
            : category === 'crypto'
              ? 'Format Yahoo: BTC-USD, ETH-USD, SOL-USD.'
              : 'Kelola posisi ' + subcat.label.toLowerCase() + ' Anda.'}
        </p>
        <div className="flex gap-2">
          {(category === 'stock' || category === 'crypto') && (
            <Button
              variant="outline"
              onClick={() => refreshQuotes()}
              disabled={refreshing || !items.some((i) => i.ticker)}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh Harga
            </Button>
          )}
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Tambah
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--indigo-600)' }} /></div>
      ) : items.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-5xl">{subcat.emoji}</p>
          <p className="mt-3 font-semibold">Belum ada posisi {subcat.label}</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>Klik Tambah untuk memulai.</p>
        </div>
      ) : category === 'stock' ? (
        // Stock sheet
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniStat label="Modal" value={formatCurrency(totals.invested)} glow="glow-indigo" />
            <MiniStat label="Nilai Pasar" value={formatCurrency(totals.market)} glow="glow-violet" />
            <MiniStat
              label="P/L"
              value={formatCurrency(totals.pl)}
              glow={up ? 'glow-emerald' : 'glow-rose'}
              accent={up ? '#059669' : '#E11D48'}
            />
            <MiniStat
              label="Return"
              value={`${up ? '+' : ''}${totals.plPct.toFixed(2)}%`}
              glow={up ? 'glow-emerald' : 'glow-rose'}
              accent={up ? '#059669' : '#E11D48'}
            />
          </div>

          <div className="glass-card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border-soft)' }}>
                  <Th>Ticker</Th>
                  <Th>Perusahaan</Th>
                  <Th>Sektor</Th>
                  <Th className="text-right">Shares</Th>
                  <Th className="text-right">Avg Cost</Th>
                  <Th className="text-right">Invested</Th>
                  <Th className="text-right">Harga</Th>
                  <Th className="text-right">Market Value</Th>
                  <Th className="text-right">P/L</Th>
                  <Th className="text-right">%P/L</Th>
                  <Th>Sekuritas</Th>
                  <Th className="text-right"></Th>
                </tr>
              </thead>
              <tbody>
                {enriched.map((e) => {
                  const pos = e.pl >= 0
                  return (
                    <tr key={e.i.id} className="border-b hover:bg-[var(--surface-alt)]/50 transition-colors" style={{ borderColor: 'var(--border-soft)' }}>
                      <Td>
                        <Badge className="rounded-full px-2 py-0.5 text-[11px] font-semibold border-0" style={{ background: 'var(--indigo-50)', color: 'var(--indigo-700)' }}>
                          {e.i.ticker ?? '—'}
                        </Badge>
                      </Td>
                      <Td className="font-medium" style={{ color: 'var(--ink)' }}>{e.i.name}</Td>
                      <Td style={{ color: 'var(--ink-muted)' }}>
                        {(e.i as Investment & { sector?: string }).sector ?? '—'}
                      </Td>
                      <Td className="text-right tabular" style={{ color: 'var(--ink-muted)' }}>
                        {e.shares.toLocaleString('id-ID')}
                      </Td>
                      <Td className="text-right tabular" style={{ color: 'var(--ink-muted)' }}>{formatCurrency(e.i.avg_cost)}</Td>
                      <Td className="text-right tabular" style={{ color: 'var(--ink-muted)' }}>{formatCurrency(e.invested)}</Td>
                      <Td className="text-right tabular">
                        <div style={{ color: 'var(--ink)' }}>{formatCurrency(e.live)}</div>
                        {e.q?.changePct !== null && e.q?.changePct !== undefined && (
                          <div className="text-[10px] tabular" style={{ color: e.q.changePct >= 0 ? 'var(--emerald-600)' : 'var(--danger)' }}>
                            {formatPercent(e.q.changePct)}
                          </div>
                        )}
                      </Td>
                      <Td className="text-right tabular font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(e.market)}</Td>
                      <Td className="text-right tabular font-medium" style={{ color: pos ? 'var(--emerald-600)' : 'var(--danger)' }}>
                        {formatCurrency(e.pl)}
                      </Td>
                      <Td className="text-right tabular" style={{ color: pos ? 'var(--emerald-600)' : 'var(--danger)' }}>
                        {pos ? '+' : ''}{e.plPct.toFixed(2)}%
                      </Td>
                      <Td style={{ color: 'var(--ink-muted)' }}>{e.i.platform || '—'}</Td>
                      <Td>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(e.i)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => remove(e.i.id)}>
                            <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} />
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // Card list for non-stock categories
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {enriched.map((e) => {
            const pos = e.pl >= 0
            return (
              <div
                key={e.i.id}
                className="group relative rounded-lg p-5 bg-white border border-[var(--border-soft)] hover:border-[var(--ink)] transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--ink)' }}>{e.i.name}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                      {e.i.platform || '—'} {e.i.ticker ? `· ${e.i.ticker}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(e.i)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => remove(e.i.id)}>
                      <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} />
                    </Button>
                  </div>
                </div>
                <p className="num text-2xl mt-4 tabular font-semibold" style={{ color: 'var(--ink)' }}>
                  {formatCurrency(e.market)}
                </p>
                <div className="mt-1.5 flex items-center justify-between text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                  <span>{e.shares.toLocaleString('id-ID')} × {formatCurrency(e.i.avg_cost)}</span>
                  {e.invested > 0 && (
                    <span className="num font-medium" style={{ color: pos ? 'var(--lime-700)' : 'var(--danger)' }}>
                      {pos ? '+' : ''}{e.plPct.toFixed(2)}%
                    </span>
                  )}
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
            <DialogTitle>{form.id ? `Edit ${subcat.label}` : `Tambah ${subcat.label}`}</DialogTitle>
            <DialogDescription>
              {category === 'stock'
                ? 'IDX: BBCA.JK, TLKM.JK · US: AAPL, GOOGL'
                : category === 'crypto'
                  ? 'Format Yahoo: BTC-USD, ETH-USD, SOL-USD'
                  : 'Isi detail posisi investasi Anda.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Nama</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Ticker (opsional)</Label>
                <Input value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} placeholder="BBCA.JK" />
              </div>
            </div>
            {category === 'stock' && (
              <div className="grid gap-1.5">
                <Label>Sektor</Label>
                <Input value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} placeholder="Finansial, Teknologi, ..." />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>Platform / Sekuritas</Label>
              <Input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} placeholder="Stockbit, Ajaib, Bibit, Pintu..." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Qty</Label>
                <Input type="number" step="any" value={form.quantity || ''} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) || 0 })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Avg Cost</Label>
                <Input type="number" value={form.avg_cost || ''} onChange={(e) => setForm({ ...form, avg_cost: Number(e.target.value) || 0 })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Harga Saat Ini</Label>
                <Input type="number" value={form.current_price || ''} onChange={(e) => setForm({ ...form, current_price: Number(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Catatan</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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

function Th({ children = null, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider ${className}`}
      style={{ color: 'var(--ink-muted)', letterSpacing: '0.06em', background: 'var(--surface-alt)' }}
    >
      {children}
    </th>
  )
}
function Td({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <td className={`px-3 py-2.5 ${className}`} style={style}>{children}</td>
}

function MiniStat({
  label, value, glow, accent,
}: {
  label: string
  value: string
  glow?: string
  accent?: string
}) {
  return (
    <div className={`glass-card p-4 ${glow ?? ''}`}>
      <p className="caps">{label}</p>
      <p className="font-display text-xl mt-2 tabular font-bold" style={{ color: accent ?? 'var(--ink)' }}>
        {value}
      </p>
    </div>
  )
}
