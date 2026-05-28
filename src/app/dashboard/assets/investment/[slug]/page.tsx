'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { INVESTMENT_SUBCATS, INVESTMENT_SLUG_TO_CATEGORY } from '@/lib/constants'
import type { Investment, Quote } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { StockLogo } from '@/components/investment/stock-logo'
import { StockTickerSearch } from '@/components/investment/stock-ticker-search'
import { IDX_BROKERS } from '@/lib/idx-brokers'
import { CryptoLogo } from '@/components/investment/crypto-logo'
import { CryptoSearch } from '@/components/investment/crypto-search'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Loader2, Plus, Pencil, Trash2, RefreshCw, TrendingUp, TrendingDown,
  LineChart, Coins, LayoutGrid, List, Star, FileSearch, GitCompare, Calendar,
} from 'lucide-react'
import { NumberInput } from '@/components/ui/number-input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StockLogPanel } from '@/components/investment/stock-log-panel'
import { DividendsPanel } from '@/components/investment/dividends-panel'
import { StockWatchlistTab } from '@/components/investment/stock-watchlist-tab'
import { StockResearchTab } from '@/components/investment/stock-research-tab'
import { StockCompareTab } from '@/components/investment/stock-compare-tab'
import { StockDividendCalendar } from '@/components/investment/stock-dividend-calendar'
import { EduTip } from '@/components/edu/edu-tip'
import { CalmModeToggle } from '@/components/investment/calm-mode-toggle'
import { getCategoryFormConfig } from '@/lib/investment-forms'

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
  const category: Investment['category'] = (INVESTMENT_SLUG_TO_CATEGORY[slug] ?? 'stock') as Investment['category']

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [items, setItems] = useState<Investment[]>([])

  // View toggle (card | list) — persisted per category in localStorage so
  // user's preference survives page reloads. Default: list for stock (table
  // with detail columns is more useful for active traders), card for everything
  // else (crypto/gold/etc don't have as many columns to show).
  const [view, setView] = useState<'card' | 'list'>('card')
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`pwm.investmentView.${slug}`)
      if (stored === 'card' || stored === 'list') setView(stored)
      else setView(category === 'stock' ? 'list' : 'card')
    } catch {
      setView(category === 'stock' ? 'list' : 'card')
    }
  }, [slug, category])
  function changeView(next: 'card' | 'list') {
    setView(next)
    try { localStorage.setItem(`pwm.investmentView.${slug}`, next) } catch {}
  }
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  // Declared as useCallback before the useEffect that triggers it so the
  // hook deps lint rule is happy without disabling it. Both `load` and
  // `refreshQuotes` are stable as long as `category` doesn't change.
  const refreshQuotes = useCallback(async (list: Investment[]) => {
    const tickers = Array.from(new Set(list.map((i) => i.ticker).filter(Boolean) as string[]))
    if (tickers.length === 0) return
    setRefreshing(true)
    try {
      // Crypto holdings: prefer Binance public market data (more reliable from
      // Indonesian ISPs than Yahoo's crypto endpoints which often geoblock).
      // Convert Yahoo-style "BTC-USD" → Binance "BTCUSDT" before sending.
      //
      // CRITICAL: Binance returns USD prices, but the rest of the app
      // (avg_cost, totals, formatCurrency) is all in IDR. Without converting,
      // BTC at $80k would render as Rp 80k → fake -99.99% loss. We fetch
      // USDIDR=X from Yahoo in parallel and multiply before storing.
      if (category === 'crypto') {
        const binanceTickers = tickers
          .map((t) => t.replace(/-USD$/i, 'USDT').toUpperCase())
        const [priceRes, fxRes] = await Promise.all([
          fetch(`/api/crypto-price?symbols=${encodeURIComponent(binanceTickers.join(','))}`),
          fetch(`/api/quotes?tickers=USDIDR%3DX`),
        ])
        if (!priceRes.ok) return
        const priceJson = (await priceRes.json()) as {
          tickers: Array<{ symbol: string; lastPrice: number; priceChangePercent: number }>
        }
        // Default fallback rate if Yahoo FX endpoint fails — better to show a
        // ballpark IDR value than a 13000× wrong one. Updated periodically.
        let usdIdr = 16500
        if (fxRes.ok) {
          const fxJson = (await fxRes.json()) as { quotes?: Array<{ ticker: string; price: number }> }
          const fx = fxJson.quotes?.find((q) => q.ticker === 'USDIDR=X')
          if (fx && fx.price > 0) usdIdr = fx.price
        }
        const map: Record<string, Quote> = {}
        for (const t of priceJson.tickers) {
          // Map Binance symbol back to user's stored ticker (BTCUSDT → BTC-USD)
          const userTicker = t.symbol.replace(/USDT$/, '-USD')
          map[userTicker] = {
            ticker: userTicker,
            // Convert USD → IDR so downstream math (invested vs market) is
            // apples-to-apples with avg_cost which user enters in IDR.
            price: t.lastPrice * usdIdr,
            currency: 'IDR',
            changePct: t.priceChangePercent,
            marketState: null,
          }
        }
        setQuotes(map)
        return
      }

      // Stocks / etc: Yahoo Finance via existing /api/quotes
      const res = await fetch(`/api/quotes?tickers=${encodeURIComponent(tickers.join(','))}`)
      if (!res.ok) return
      const json = (await res.json()) as { quotes: Quote[] }
      const map: Record<string, Quote> = {}
      for (const q of json.quotes) map[q.ticker] = q
      setQuotes(map)
    } finally {
      setRefreshing(false)
    }
  }, [category])

  const load = useCallback(async () => {
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
  }, [supabase, category, refreshQuotes])

  useEffect(() => {
    if (!subcat) { router.push('/dashboard/assets/investment'); return }
    void load()
  }, [slug, subcat, router, load])

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
      <section
        className="relative overflow-hidden rounded-3xl"
        style={{
          background: 'linear-gradient(135deg, #0A0A0F 0%, #14141A 50%, #0F1F1A 100%)',
          color: '#F5F5F7',
          boxShadow: '0 24px 60px -20px rgba(0,0,0,0.40)',
        }}
      >
        <div
          className="absolute pointer-events-none"
          style={{
            top: -100, right: -60, width: 360, height: 360,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${up ? 'rgba(16, 185, 129, 0.18)' : 'rgba(251, 113, 133, 0.16)'}, transparent 65%)`,
          }}
        />
        <div className="relative p-6 sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <p
            className="text-[11px] font-semibold tracking-[0.18em] uppercase inline-flex items-center gap-1.5"
            style={{ color: up ? '#6EE7B7' : '#FDA4AF' }}
          >
            {subcat.label}
            {(category === 'stock' || category === 'crypto' || category === 'mutual_fund') && (
              <EduTip topic="dca" side="bottom" />
            )}
          </p>
          {(category === 'stock' || category === 'crypto' || category === 'mutual_fund') && (
            <CalmModeToggle compact />
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <p
            className="num tabular font-bold leading-none whitespace-nowrap"
            style={{
              fontSize: 'clamp(40px, 6vw, 64px)',
              color: '#FFFFFF',
              letterSpacing: '-0.04em',
            }}
          >
            {formatCurrency(totals.market)}
          </p>
          {totals.invested > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold mb-2"
              style={{
                background: up ? 'rgba(16,185,129,0.18)' : 'rgba(251,113,133,0.18)',
                color: up ? '#6EE7B7' : '#FDA4AF',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {up ? '+' : ''}{totals.plPct.toFixed(2)}%
            </span>
          )}
        </div>
        <p className="text-sm mt-2 inline-flex items-center gap-1.5 flex-wrap" style={{ color: 'rgba(255,255,255,0.55)' }}>
          <span>{items.length} posisi · Modal <span className="num font-semibold" style={{ color: '#FFFFFF' }}>{formatCurrency(totals.invested)}</span>
          {' · '}
          P/L <span className="num font-semibold" style={{ color: up ? '#6EE7B7' : '#FDA4AF' }}>{formatCurrency(totals.pl)}</span></span>
          {(category === 'stock' || category === 'crypto' || category === 'mutual_fund') && totals.invested > 0 && (
            <EduTip topic="loss-aversion" side="bottom" />
          )}
        </p>
        </div>
      </section>

      <Tabs defaultValue="holdings" className="w-full">
        {category === 'stock' && (
          <div className="overflow-x-auto -mx-1 px-1 pb-1">
            <TabsList className="inline-flex gap-1 w-auto">
              <TabsTrigger value="holdings"><TrendingUp className="size-3.5 mr-1.5" />Posisi</TabsTrigger>
              <TabsTrigger value="watchlist"><Star className="size-3.5 mr-1.5" />Watchlist</TabsTrigger>
              <TabsTrigger value="research"><FileSearch className="size-3.5 mr-1.5" />Research</TabsTrigger>
              <TabsTrigger value="compare"><GitCompare className="size-3.5 mr-1.5" />Compare</TabsTrigger>
              <TabsTrigger value="dividen-pro"><Calendar className="size-3.5 mr-1.5" />Dividen</TabsTrigger>
              <TabsTrigger value="log"><LineChart className="size-3.5 mr-1.5" />Log Manual</TabsTrigger>
              <TabsTrigger value="dividen"><Coins className="size-3.5 mr-1.5" />Log Dividen</TabsTrigger>
            </TabsList>
          </div>
        )}

        <TabsContent value="holdings" className="space-y-6 mt-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {category === 'stock'
            ? 'Saham IDX & US — pakai ticker .JK untuk IDX (contoh: BBCA.JK) atau simbol langsung (AAPL).'
            : category === 'crypto'
              ? 'Harga real-time dari Binance · Format ticker: BTC-USD, ETH-USD, SOL-USD.'
              : 'Kelola posisi ' + subcat.label.toLowerCase() + ' Anda.'}
        </p>
        <div className="flex gap-2 items-center">
          {/* View toggle — Card / List. Hidden when no positions yet. */}
          {items.length > 0 && (
            <div
              className="flex items-center rounded-md border overflow-hidden"
              style={{ borderColor: 'var(--border-soft)' }}
            >
              <button
                type="button"
                onClick={() => changeView('card')}
                className="size-8 flex items-center justify-center transition"
                style={{
                  background: view === 'card' ? 'var(--ink)' : 'var(--surface)',
                  color: view === 'card' ? 'var(--surface)' : 'var(--ink-muted)',
                }}
                title="Tampilan kartu"
                aria-label="Tampilan kartu"
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => changeView('list')}
                className="size-8 flex items-center justify-center transition"
                style={{
                  background: view === 'list' ? 'var(--ink)' : 'var(--surface)',
                  color: view === 'list' ? 'var(--surface)' : 'var(--ink-muted)',
                }}
                title="Tampilan tabel"
                aria-label="Tampilan tabel"
              >
                <List className="size-4" />
              </button>
            </div>
          )}
          {(category === 'stock' || category === 'crypto') && (
            <Button
              variant="outline"
              onClick={() => refreshQuotes(items)}
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
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--c-mint)' }} /></div>
      ) : items.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-5xl">{subcat.emoji}</p>
          <p className="mt-3 font-semibold">Belum ada posisi {subcat.label}</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>Klik Tambah untuk memulai.</p>
        </div>
      ) : view === 'list' ? (
        // ─── LIST VIEW ─── shared by all categories. Logo column adapts:
        // stock → StockLogo, crypto → CryptoLogo, others → no logo cell.
        <div className="space-y-4">
          {category === 'stock' && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MiniStat label="Modal" value={formatCurrency(totals.invested)} glow="glow-indigo" />
              <MiniStat label="Nilai Pasar" value={formatCurrency(totals.market)} glow="glow-violet" />
              <MiniStat
                label="P/L"
                value={formatCurrency(totals.pl)}
                glow={up ? 'glow-emerald' : 'glow-rose'}
                accent={up ? '#10B981' : '#F43F5E'}
              />
              <MiniStat
                label="Return"
                value={`${up ? '+' : ''}${totals.plPct.toFixed(2)}%`}
                glow={up ? 'glow-emerald' : 'glow-rose'}
                accent={up ? '#10B981' : '#F43F5E'}
              />
            </div>
          )}

          <div className="glass-card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border-soft)' }}>
                  <Th>{category === 'stock' ? 'Ticker' : 'Coin'}</Th>
                  <Th>{category === 'stock' ? 'Perusahaan' : 'Nama'}</Th>
                  {category === 'stock' && <Th>Sektor</Th>}
                  <Th className="text-right">{category === 'stock' ? 'Shares' : 'Qty'}</Th>
                  <Th className="text-right">Avg Cost</Th>
                  <Th className="text-right">Invested</Th>
                  <Th className="text-right">Harga</Th>
                  <Th className="text-right">Market Value</Th>
                  <Th className="text-right">P/L</Th>
                  <Th className="text-right">%P/L</Th>
                  <Th>Platform</Th>
                  <Th className="text-right"></Th>
                </tr>
              </thead>
              <tbody>
                {enriched.map((e) => {
                  const pos = e.pl >= 0
                  return (
                    <tr key={e.i.id} className="border-b hover:bg-[var(--surface-alt)]/50 transition-colors" style={{ borderColor: 'var(--border-soft)' }}>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          {category === 'stock' ? (
                            <StockLogo ticker={e.i.ticker} size={36} />
                          ) : category === 'crypto' ? (
                            <CryptoLogo symbol={e.i.ticker} size={36} />
                          ) : null}
                          <Badge
                            className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold border-0 tabular"
                            style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}
                          >
                            {e.i.ticker ?? '—'}
                          </Badge>
                        </div>
                      </Td>
                      <Td className="font-medium" style={{ color: 'var(--ink)' }}>{e.i.name}</Td>
                      {category === 'stock' && (
                        <Td style={{ color: 'var(--ink-muted)' }}>
                          {(e.i as Investment & { sector?: string }).sector ?? '—'}
                        </Td>
                      )}
                      <Td className="text-right tabular" style={{ color: 'var(--ink-muted)' }}>
                        {e.shares.toLocaleString('id-ID')}
                      </Td>
                      <Td className="text-right tabular" style={{ color: 'var(--ink-muted)' }}>{formatCurrency(e.i.avg_cost)}</Td>
                      <Td className="text-right tabular" style={{ color: 'var(--ink-muted)' }}>{formatCurrency(e.invested)}</Td>
                      <Td className="text-right tabular">
                        <div style={{ color: 'var(--ink)' }}>{formatCurrency(e.live)}</div>
                        {e.q?.changePct !== null && e.q?.changePct !== undefined && (
                          <div className="text-[10px] tabular" style={{ color: e.q.changePct >= 0 ? 'var(--c-mint)' : 'var(--danger)' }}>
                            {formatPercent(e.q.changePct)}
                          </div>
                        )}
                      </Td>
                      <Td className="text-right tabular font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(e.market)}</Td>
                      <Td className="text-right tabular font-medium" style={{ color: pos ? 'var(--c-mint)' : 'var(--danger)' }}>
                        {formatCurrency(e.pl)}
                      </Td>
                      <Td className="text-right tabular" style={{ color: pos ? 'var(--c-mint)' : 'var(--danger)' }}>
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
                className="group relative rounded-xl p-4 bg-white border transition-all hover:shadow-md hover:-translate-y-0.5"
                style={{ borderColor: 'var(--border-soft)' }}
              >
                <div className="flex items-start gap-3">
                  {/* Logo by category — stock from IDX library, crypto from
                      spothq. Other categories (gold/bond/etc) skip the logo
                      slot to keep cards clean. */}
                  {category === 'stock' ? (
                    <StockLogo ticker={e.i.ticker} size={40} shape="circle" />
                  ) : category === 'crypto' ? (
                    <CryptoLogo symbol={e.i.ticker} size={40} shape="circle" />
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: 'var(--ink)' }}>{e.i.name}</p>
                        <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--ink-muted)' }}>
                          {e.i.platform || '—'} {e.i.ticker ? `· ${e.i.ticker}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(e.i)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => remove(e.i.id)}>
                          <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="num text-2xl mt-4 tabular font-semibold" style={{ color: 'var(--ink)' }}>
                  {formatCurrency(e.market)}
                </p>
                <div className="mt-1.5 flex items-center justify-between text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                  <span>{e.shares.toLocaleString('id-ID')} × {formatCurrency(e.i.avg_cost)}</span>
                  {e.invested > 0 && (
                    <span className="num font-medium" style={{ color: pos ? 'var(--c-mint)' : 'var(--danger)' }}>
                      {pos ? '+' : ''}{e.plPct.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
        </TabsContent>

        {category === 'stock' && (
          <>
            <TabsContent value="watchlist" className="mt-6">
              <StockWatchlistTab />
            </TabsContent>
            <TabsContent value="research" className="mt-6">
              <StockResearchTab />
            </TabsContent>
            <TabsContent value="compare" className="mt-6">
              <StockCompareTab />
            </TabsContent>
            <TabsContent value="dividen-pro" className="mt-6">
              <StockDividendCalendar />
            </TabsContent>
            <TabsContent value="log" className="mt-6">
              <StockLogPanel />
            </TabsContent>
            <TabsContent value="dividen" className="mt-6">
              <DividendsPanel />
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? `Edit ${subcat.label}` : `Tambah ${subcat.label}`}</DialogTitle>
            <DialogDescription>
              {category === 'stock'
                ? 'IDX: BBCA.JK, TLKM.JK · US: AAPL, GOOGL'
                : category === 'crypto'
                  ? 'Cari coin dari Binance · Format ticker: BTC-USD, ETH-USD, SOL-USD'
                  : 'Isi detail posisi investasi Anda.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {/* Stock-only: ticker autocomplete from IDX catalog auto-fills name + sector */}
            {category === 'stock' ? (
              <>
                <div className="grid gap-1.5">
                  <Label>Cari Saham</Label>
                  <StockTickerSearch
                    value={form.ticker?.split('.')[0] ?? ''}
                    onSelect={(s) =>
                      setForm({
                        ...form,
                        // Yahoo Finance uses .JK suffix for IDX
                        ticker: `${s.t}.JK`,
                        name: s.n,
                        sector: s.s,
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Nama</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="auto dari pencarian"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Ticker</Label>
                    <Input
                      value={form.ticker}
                      onChange={(e) => setForm({ ...form, ticker: e.target.value })}
                      placeholder="BBCA.JK"
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Sektor</Label>
                  <Input
                    value={form.sector}
                    onChange={(e) => setForm({ ...form, sector: e.target.value })}
                    placeholder="auto dari pencarian"
                  />
                </div>
              </>
            ) : category === 'crypto' ? (
              <>
                {/* Crypto category: searchable coin catalog auto-fills name + ticker */}
                <div className="grid gap-1.5">
                  <Label>Cari Coin</Label>
                  <CryptoSearch
                    value={form.ticker?.split(/[-_]/)[0] ?? ''}
                    onSelect={(c) =>
                      setForm({
                        ...form,
                        // Yahoo-style ticker so /api/quotes (or our crypto-price endpoint) understands it
                        ticker: `${c.s}-USD`,
                        name: c.n ?? c.s, // fallback to symbol if no full name
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Nama</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="auto dari pencarian"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Ticker</Label>
                    <Input
                      value={form.ticker}
                      onChange={(e) => setForm({ ...form, ticker: e.target.value })}
                      placeholder="BTC-USD"
                    />
                  </div>
                </div>
              </>
            ) : (() => {
              // Per-category form using INVESTMENT_FORM_CONFIGS — each
              // asset class (mutual_fund, gold, bond, sbn, time_deposit,
              // forex, p2p, pension, business) has unique field semantics.
              const cfg = getCategoryFormConfig(category)
              if (!cfg) return null
              return (
                <>
                  {cfg.topHint && (
                    <p
                      className="text-xs leading-relaxed rounded-lg p-2.5"
                      style={{
                        color: 'var(--ink-muted)',
                        background: 'var(--surface-2)',
                      }}
                    >
                      💡 {cfg.topHint}
                    </p>
                  )}
                  <div className={cfg.showTicker ? 'grid grid-cols-2 gap-3' : 'grid gap-3'}>
                    <div className="grid gap-1.5">
                      <Label>{cfg.name.label}</Label>
                      <Input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder={cfg.name.placeholder}
                      />
                      {cfg.name.help && (
                        <p className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>{cfg.name.help}</p>
                      )}
                    </div>
                    {cfg.showTicker && cfg.ticker && (
                      <div className="grid gap-1.5">
                        <Label>{cfg.ticker.label}</Label>
                        <Input
                          value={form.ticker}
                          onChange={(e) => setForm({ ...form, ticker: e.target.value })}
                          placeholder={cfg.ticker.placeholder}
                        />
                        {cfg.ticker.help && (
                          <p className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>{cfg.ticker.help}</p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )
            })()}

            {/* Platform / Sekuritas — per-category dropdown with curated
                Indonesian platforms (APERD, banks, OJK-licensed P2P, etc.) */}
            {(() => {
              const cfg = getCategoryFormConfig(category)
              const platformLabel = cfg?.platform.label ?? 'Platform / Sekuritas'
              const platformHelp = cfg?.platform.help
              const platformPlaceholder = cfg?.platform.placeholder ?? 'Bibit, Pintu, ...'
              const platformOptions = cfg?.platform.options
              return (
                <div className="grid gap-1.5">
                  <Label>{platformLabel}</Label>
                  {category === 'stock' ? (
                    <Select
                      value={form.platform || ''}
                      onValueChange={(v) => setForm({ ...form, platform: v ?? '' })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih sekuritas">
                          {(v) => {
                            const broker = IDX_BROKERS.find((b) => b.short === v || b.name === v)
                            if (!broker) return v || 'Pilih sekuritas'
                            return broker.code ? `${broker.short} (${broker.code})` : broker.short
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
                                  Beli {(b.buyRate * 100).toFixed(2)}% · Jual {(b.sellRate * 100).toFixed(2)}%
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : platformOptions ? (
                    /* Per-category curated dropdown (mutual_fund, gold,
                       bond, sbn, time_deposit, p2p, pension) */
                    <Select
                      value={form.platform || ''}
                      onValueChange={(v) => setForm({ ...form, platform: v ?? '' })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={platformPlaceholder}>
                          {(v) => v || platformPlaceholder}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="min-w-[260px]">
                        {platformOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex flex-col py-0.5 gap-0.5 min-w-0">
                              <span className="text-sm truncate">{opt.label}</span>
                              {opt.sub && (
                                <span className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>
                                  {opt.sub}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={form.platform}
                      onChange={(e) => setForm({ ...form, platform: e.target.value })}
                      placeholder={platformPlaceholder}
                    />
                  )}
                  {platformHelp && (
                    <p className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>{platformHelp}</p>
                  )}
                </div>
              )
            })()}

            {/* Qty / Cost / Price — labels + placeholders per category config */}
            {(() => {
              const cfg = getCategoryFormConfig(category)
              const qtyCfg = cfg?.quantity ?? { label: 'Qty', placeholder: '0' }
              const costCfg = cfg?.avgCost ?? { label: 'Avg Cost', placeholder: '0' }
              const priceCfg = cfg?.currentPrice ?? { label: 'Harga Saat Ini', placeholder: '0' }
              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="grid gap-1.5">
                    <Label>{qtyCfg.label}</Label>
                    <Input
                      type="number"
                      step={qtyCfg.step ?? 'any'}
                      value={form.quantity || ''}
                      onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) || 0 })}
                      placeholder={qtyCfg.placeholder}
                    />
                    {qtyCfg.help && (
                      <p className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>{qtyCfg.help}</p>
                    )}
                  </div>
                  <div className="grid gap-1.5">
                    <Label>{costCfg.label}</Label>
                    <NumberInput
                      value={form.avg_cost}
                      onChange={(n) => setForm({ ...form, avg_cost: n })}
                      placeholder={costCfg.placeholder ?? '0'}
                    />
                    {costCfg.help && (
                      <p className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>{costCfg.help}</p>
                    )}
                  </div>
                  <div className="grid gap-1.5">
                    <Label>{priceCfg.label}</Label>
                    <NumberInput
                      value={form.current_price}
                      onChange={(n) => setForm({ ...form, current_price: n })}
                      placeholder={priceCfg.placeholder ?? '0'}
                    />
                    {priceCfg.help && (
                      <p className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>{priceCfg.help}</p>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Notes — category-specific helper text */}
            {(() => {
              const cfg = getCategoryFormConfig(category)
              return (
                <div className="grid gap-1.5">
                  <Label>Catatan</Label>
                  <Input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder={cfg?.notesHelp ?? 'Catatan tambahan'}
                  />
                  {cfg?.notesHelp && (
                    <p className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>{cfg.notesHelp}</p>
                  )}
                </div>
              )
            })()}
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
      <p className="eyebrow">{label}</p>
      <p className="num text-xl mt-2 tabular font-bold" style={{ color: accent ?? 'var(--ink)' }}>
        {value}
      </p>
    </div>
  )
}
