'use client'

/**
 * Stock transaction log panel.
 * Used as a tab inside /dashboard/assets/investment/stock.
 * Was previously the standalone /dashboard/stock-log page.
 */

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
import { StockLogo } from '@/components/investment/stock-logo'
import { IDX_BROKERS, getBrokerByName, computeFee } from '@/lib/idx-brokers'
import { computeRealizedPL } from '@/lib/invest/fifo'
import { useT } from '@/lib/i18n/context'

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


export function StockLogPanel() {
  const t = useT()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<StockTransaction[]>([])
  const [stocks, setStocks] = useState<Investment[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [filterTicker, setFilterTicker] = useState<string>('all')

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const [sR, iR] = await Promise.all([
      supabase.from('stock_transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }),
      supabase.from('investments').select('*').eq('user_id', user.id).eq('category', 'stock'),
    ])
    setItems((sR.data ?? []) as StockTransaction[])
    setStocks((iR.data ?? []) as Investment[])
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [])

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
    if (!confirm(t('stock_log.confirm_delete'))) return
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
    <div className="space-y-5">
      {/* Stats inline (no dark hero — parent page already has one) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl border bg-[var(--surface)] p-5">
        <div>
          <p className="eyebrow" style={{ fontSize: '0.625rem' }}>{t('stock_log.total_buy')}</p>
          <p className="num tabular text-xl font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
            {formatCurrency(stats.totalBuys)}
          </p>
        </div>
        <div>
          <p className="eyebrow" style={{ fontSize: '0.625rem' }}>{t('stock_log.total_sell')}</p>
          <p className="num tabular text-xl font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
            {formatCurrency(stats.totalSells)}
          </p>
        </div>
        <div>
          <p className="eyebrow" style={{ fontSize: '0.625rem' }}>{t('stock_log.realized_pl')}</p>
          <p className="num tabular text-xl font-semibold flex items-center gap-1 mt-0.5" style={{ color: plPositive ? 'var(--c-mint)' : 'var(--danger)' }}>
            {plPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {formatCurrency(stats.realizedPL)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--ink-muted)' }}>{t('stock_log.filter_label')}</span>
          <Select value={filterTicker} onValueChange={(v) => setFilterTicker(v ?? 'all')}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('stock_log.all_tickers')}</SelectItem>
              {tickers.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { setForm(EMPTY); setDialogOpen(true) }}>
          <Plus className="h-4 w-4" /> {t('stock_log.add_transaction')}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="s-card p-12 text-center">
          <p className="font-semibold">{t('stock_log.empty_title')}</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>{t('stock_log.empty_desc')}</p>
        </div>
      ) : (
        <div className="s-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border-soft)', background: 'var(--surface-2)' }}>
                <Th>{t('stock_log.col_date')}</Th>
                <Th>{t('stock_log.col_ticker')}</Th>
                <Th>{t('stock_log.col_side')}</Th>
                <Th className="text-right">{t('stock_log.col_shares')}</Th>
                <Th className="text-right">{t('stock_log.col_price')}</Th>
                <Th className="text-right">{t('stock_log.col_fee')}</Th>
                <Th className="text-right">{t('stock_log.col_total')}</Th>
                <Th>{t('stock_log.col_broker')}</Th>
                <Th className="text-right"></Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b" style={{ borderColor: 'var(--border-soft)' }}>
                  <Td>{formatDate(t.date)}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <StockLogo ticker={t.ticker} size={28} shape="circle" />
                      <span className="num font-semibold text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}>
                        {t.ticker ?? '—'}
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase"
                      style={{
                        background: t.side === 'buy' ? 'var(--c-mint)' : 'var(--danger-bg)',
                        color: t.side === 'buy' ? 'var(--c-mint)' : 'var(--danger)',
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
                    <Button variant="ghost" size="icon-sm" aria-label="Hapus catatan transaksi" onClick={() => remove(t.id)}>
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
            <DialogTitle>{form.id ? t('stock_log.dialog_title_edit') : t('stock_log.dialog_title_add')}</DialogTitle>
            <DialogDescription>{t('stock_log.dialog_desc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>{t('stock_log.label_stock')}</Label>
              <Select
                value={form.investment_id}
                onValueChange={(v) => {
                  const s = stocks.find((x) => x.id === v)
                  setForm({ ...form, investment_id: v ?? '', ticker: s?.ticker ?? '' })
                }}
              >
                <SelectTrigger><SelectValue placeholder={t('stock_log.placeholder_stock')} /></SelectTrigger>
                <SelectContent>
                  {stocks.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.ticker ?? s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t('stock_log.label_side')}</Label>
                <Select value={form.side} onValueChange={(v) => v && setForm({ ...form, side: v as 'buy' | 'sell' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy">BUY</SelectItem>
                    <SelectItem value="sell">SELL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>{t('stock_log.label_date')}</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>{t('stock_log.label_shares')}</Label>
                <Input type="number" step="any" min={0} value={form.shares || ''} onChange={(e) => setForm({ ...form, shares: Number(e.target.value) || 0 })} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t('stock_log.label_price_per_share')}</Label>
                <Input type="number" min={0} value={form.price || ''} onChange={(e) => setForm({ ...form, price: Number(e.target.value) || 0 })} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t('stock_log.label_fee')}</Label>
                <Input type="number" min={0} value={form.fee || ''} onChange={(e) => setForm({ ...form, fee: Number(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>{t('stock_log.label_broker')}</Label>
              <Select
                value={form.broker || ''}
                onValueChange={(v) => {
                  // When broker picked, auto-compute fee from rate × transaction value
                  // (only fills if user hasn't manually set fee yet, else respect manual entry).
                  const broker = IDX_BROKERS.find((b) => b.short === v)
                  const txValue = form.shares * form.price
                  const autoFee =
                    broker && broker.code && txValue > 0
                      ? computeFee(broker.code, form.side, txValue) ?? 0
                      : form.fee
                  setForm({ ...form, broker: v ?? '', fee: form.fee || autoFee })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('stock_log.placeholder_broker')}>
                    {(v) => {
                      const b = getBrokerByName(v)
                      if (!b) return v || t('stock_log.placeholder_broker')
                      return b.code ? `${b.short} (${b.code})` : b.short
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="min-w-[280px]">
                  {IDX_BROKERS.map((b) => (
                    <SelectItem key={b.code || b.short} value={b.short}>
                      <div className="flex flex-col py-0.5 gap-0.5 min-w-0">
                        <span className="flex items-center gap-1.5 min-w-0">
                          {b.code && (
                            <span
                              className="font-mono text-[9px] px-1 py-0.5 rounded shrink-0"
                              style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}
                            >
                              {b.code}
                            </span>
                          )}
                          <span className="truncate text-sm">{b.short}</span>
                        </span>
                        {b.buyRate > 0 && (
                          <span className="text-[10px] tabular" style={{ color: 'var(--ink-soft)' }}>
                            {t('stock_log.rate_buy')} {(b.buyRate * 100).toFixed(2)}% · {t('stock_log.rate_sell')} {(b.sellRate * 100).toFixed(2)}%
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.broker && (() => {
                const b = getBrokerByName(form.broker)
                const txValue = form.shares * form.price
                if (!b || !b.code || txValue === 0) return null
                const fee = computeFee(b.code, form.side, txValue) ?? 0
                return (
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                    {t('stock_log.auto_fee')} {form.side === 'buy' ? t('stock_log.side_buy') : t('stock_log.side_sell')}: {formatCurrency(fee)}
                    {' '}({((form.side === 'buy' ? b.buyRate : b.sellRate) * 100).toFixed(2)}%)
                    {form.fee !== fee && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, fee })}
                        className="ml-1.5 underline hover:no-underline"
                        style={{ color: 'var(--c-mint-ink)' }}
                      >
                        {t('stock_log.use')}
                      </button>
                    )}
                  </p>
                )
              })()}
            </div>
            <div className="grid gap-1.5">
              <Label>{t('stock_log.label_notes')}</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            {form.shares > 0 && form.price > 0 && (
              <p className="text-xs p-2 rounded" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
                {t('stock_log.total_preview')} <span className="num font-semibold" style={{ color: 'var(--ink)' }}>
                  {formatCurrency(form.shares * form.price + (form.side === 'buy' ? form.fee : -form.fee))}
                </span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('stock_log.cancel')}</Button>
            <Button onClick={save} disabled={saving || !form.investment_id || form.shares <= 0 || form.price <= 0}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('stock_log.save')}
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
