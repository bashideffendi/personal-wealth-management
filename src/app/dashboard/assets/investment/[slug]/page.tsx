'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { INVESTMENT_SUBCATS, INVESTMENT_SLUG_TO_CATEGORY, FX_FALLBACK_USDIDR } from '@/lib/constants'
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
  Lightbulb, Newspaper, ArrowLeft,
} from 'lucide-react'
import { NumberInput } from '@/components/ui/number-input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StockLogPanel } from '@/components/investment/stock-log-panel'
import { DividendsPanel } from '@/components/investment/dividends-panel-lazy'
import { StockWatchlistTab } from '@/components/investment/stock-watchlist-tab'
import { StockResearchTab } from '@/components/investment/stock-research-tab'
import { StockCompareTab } from '@/components/investment/stock-compare-tab'
import { StockDividendCalendar } from '@/components/investment/stock-dividend-calendar'
import { NewsTab } from '@/components/investment/news-tab'
import { EduTip } from '@/components/edu/edu-tip'
import { CalmModeToggle } from '@/components/investment/calm-mode-toggle'
import { getCategoryFormConfig } from '@/lib/investment-forms'
import { useT } from '@/lib/i18n/context'

// Yahoo IDX pakai suffix .JK. Helper lokal — emitten.ts `server-only`, gak bisa di client.
function toYahooTicker(t: string): string {
  const u = t.trim().toUpperCase()
  return u.endsWith('.JK') ? u : `${u}.JK`
}
function fromYahooTicker(t: string): string {
  return t.trim().toUpperCase().replace(/\.JK$/, '')
}
// Crypto: normalisasi ticker tersimpan (BTC-USD / BTC / BTCUSDT) -> base (BTC) buat URL per-coin.
function cryptoBase(t?: string | null): string {
  return (t ?? '').toUpperCase().replace(/[-_]?(USDT|USD)$/i, '').replace(/[-_]+$/, '')
}

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
  const t = useT()

  const slug = params.slug
  // Virtual slugs stock-idx / stock-us = category `stock` filtered by market.
  const marketFilter: 'idx' | 'us' | null = slug === 'stock-us' ? 'us' : slug === 'stock-idx' ? 'idx' : null
  // US saham mirror IDX KECUALI fitur yang butuh data fundamental/emiten IDX
  // (Research/Compare/Watchlist + link research per-baris). Endpoint2 itu
  // IDX-only (`/api/idx-emiten`, `.JK`) -> 404/empty buat US.
  const isUS = marketFilter === 'us'
  // useMemo penting: fallback object harus stabil identity-nya, kalau nggak
  // `subcat` berubah tiap render -> useEffect(load) loop -> refresh harga terus.
  const subcat = useMemo(
    () =>
      INVESTMENT_SUBCATS.find((s) => s.slug === slug) ??
      (marketFilter ? { slug, label: marketFilter === 'us' ? t('investment_detail.market_us_stock') : t('investment_detail.market_idx_stock'), emoji: '📈' } : undefined),
    [slug, marketFilter, t],
  )
  const category: Investment['category'] = (INVESTMENT_SLUG_TO_CATEGORY[slug] ?? 'stock') as Investment['category']
  // Fitur fundamental hanya untuk saham IDX (bukan US).
  const showStockResearch = category === 'stock' && !isUS
  // Tab Berita: agregator RSS finansial Indonesia. Relevan buat saham IDX
  // (view "Semua" + "IHSG"), gak relevan buat saham US -> sembunyikan di US.
  const showNews = category === 'stock' && marketFilter !== 'us'

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
  const [quotesUpdatedAt, setQuotesUpdatedAt] = useState<Date | null>(null)
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
        let usdIdr = FX_FALLBACK_USDIDR
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
      setQuotesUpdatedAt(new Date())
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
    const all = (data ?? []) as Investment[]
    const list = marketFilter
      ? all.filter((i) => (((i.currency ?? '').toUpperCase() === 'USD') ? 'us' : 'idx') === marketFilter)
      : all
    setItems(list)
    setLoading(false)
    void refreshQuotes(list)
  }, [supabase, category, refreshQuotes, marketFilter])

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
      id: inv.id, name: inv.name, ticker: fromYahooTicker(inv.ticker ?? ''),
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
      ticker: (() => {
        const raw = form.ticker.trim().toUpperCase()
        if (!raw) return null
        // Saham: simpan format Yahoo (IDX -> .JK, US -> apa adanya). Selain itu apa adanya.
        if (category === 'stock') return marketFilter === 'us' ? raw : toYahooTicker(raw)
        return raw
      })(),
      platform: form.platform,
      quantity: form.quantity,
      avg_cost: form.avg_cost,
      current_price: form.current_price || form.avg_cost,
      total_value: Math.round(form.quantity * (form.current_price || form.avg_cost)),
      type,
      sector: form.sector,
      notes: form.notes,
      // On the IDX/US pages, stamp currency so the new holding lands in the
      // right market bucket (overview split + this page's filter).
      ...(marketFilter ? { currency: marketFilter === 'us' ? 'USD' : 'IDR' } : {}),
    }
    if (form.id) await supabase.from('investments').update(payload).eq('id', form.id)
    else await supabase.from('investments').insert(payload)
    setSaving(false)
    setDialogOpen(false)
    void load()
  }
  async function remove(id: string) {
    if (!confirm(t('investment_detail.confirm_delete'))) return
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

  // Kelas aset yang punya harga live (stock & crypto pakai quote endpoint).
  // Sisanya (emas/deposito/obligasi/sbn/forex/p2p/pensiun/usaha/reksadana)
  // gak ada feed harian -> "Hari Ini" tampil "—".
  const hasLivePrices = category === 'stock' || category === 'crypto'

  // P/L hari ini = selisih nilai pasar vs nilai penutupan kemarin, dihitung
  // dari changePct tiap quote: prior = market / (1 + pct/100). Hanya holding
  // yang punya quote dengan changePct yang dihitung; null kalau belum ada data.
  const todayPL = useMemo(() => {
    if (!hasLivePrices) return null
    let sum = 0
    let counted = 0
    for (const e of enriched) {
      const pct = e.q?.changePct
      if (pct == null || !Number.isFinite(pct)) continue
      const prior = e.market / (1 + pct / 100)
      sum += e.market - prior
      counted += 1
    }
    if (counted === 0) return null
    const priorTotal = totals.market - sum
    const pct = priorTotal > 0 ? (sum / priorTotal) * 100 : 0
    return { value: sum, pct }
  }, [hasLivePrices, enriched, totals.market])

  if (!subcat) return null

  const up = totals.pl >= 0

  return (
    <div className="space-y-6">
      <section
        className="relative overflow-hidden rounded-3xl"
        style={{
          background: 'linear-gradient(135deg, #0A0A0F 0%, #14141A 50%, #1C1C24 100%)',
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
        <Link
          href="/dashboard/assets/investment"
          className="inline-flex items-center gap-1.5 text-xs font-medium mb-4 rounded-md px-2 py-1 -ml-2 transition-colors hover:bg-white/10"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          <ArrowLeft className="size-3.5" /> {t('investment_detail.back_all_investments')}
        </Link>
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
        {category === 'stock' && (
          <div className="mt-3 flex gap-1.5">
            {[
              { key: 'stock', label: t('investment_detail.market_all'), href: '/dashboard/assets/investment/stock' },
              { key: 'stock-idx', label: 'IHSG', href: '/dashboard/assets/investment/stock-idx' },
              { key: 'stock-us', label: 'US', href: '/dashboard/assets/investment/stock-us' },
            ].map((m) => {
              const active = slug === m.key
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => router.push(m.href)}
                  className="px-3 py-1 rounded-full text-xs font-semibold transition"
                  style={active
                    ? { background: 'rgba(255,255,255,0.18)', color: '#fff' }
                    : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)' }}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
        )}
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
          <span>{items.length} {t('investment_detail.positions')} · {t('investment_detail.capital')} <span className="num font-semibold" style={{ color: '#FFFFFF' }}>{formatCurrency(totals.invested)}</span>
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
            <TabsList variant="pill" className="inline-flex gap-1.5 w-auto">
              <TabsTrigger value="holdings"><TrendingUp className="size-3.5 mr-1.5" />{t('investment_detail.tab_positions')}</TabsTrigger>
              {/* Watchlist/Research/Compare butuh data emiten + fundamental IDX -> US off */}
              {showStockResearch && (
                <>
                  <TabsTrigger value="watchlist"><Star className="size-3.5 mr-1.5" />Watchlist</TabsTrigger>
                  <TabsTrigger value="research"><FileSearch className="size-3.5 mr-1.5" />Research</TabsTrigger>
                  <TabsTrigger value="compare"><GitCompare className="size-3.5 mr-1.5" />Compare</TabsTrigger>
                </>
              )}
              <TabsTrigger value="dividen-pro"><Calendar className="size-3.5 mr-1.5" />{t('investment_detail.tab_dividend')}</TabsTrigger>
              <TabsTrigger value="log"><LineChart className="size-3.5 mr-1.5" />{t('investment_detail.tab_manual_log')}</TabsTrigger>
              <TabsTrigger value="dividen"><Coins className="size-3.5 mr-1.5" />{t('investment_detail.tab_dividend_log')}</TabsTrigger>
              {/* Berita: agregator RSS finansial ID — IDX-only (US gak relevan) */}
              {showNews && (
                <TabsTrigger value="berita"><Newspaper className="size-3.5 mr-1.5" />{t('investment_detail.tab_news')}</TabsTrigger>
              )}
            </TabsList>
          </div>
        )}

        <TabsContent value="holdings" className="space-y-6 mt-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {(category === 'stock' || category === 'crypto')
            ? (quotesUpdatedAt
                ? `${t('investment_detail.price_updated_at')} ${quotesUpdatedAt.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${t('investment_detail.price_not_realtime_suffix')}`
                : t('investment_detail.price_not_realtime'))
            : `${t('investment_detail.manage_positions')} ${subcat.label.toLowerCase()}.`}
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
                title={t('investment_detail.view_card')}
                aria-label={t('investment_detail.view_card')}
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
                title={t('investment_detail.view_table')}
                aria-label={t('investment_detail.view_table')}
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
              {t('investment_detail.refresh_price')}
            </Button>
          )}
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> {t('investment_detail.add')}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--c-mint)' }} /></div>
      ) : items.length === 0 ? (
        <div className="s-card p-12 text-center">
          <p className="text-5xl">{subcat.emoji}</p>
          <p className="mt-3 font-semibold">{t('investment_detail.empty_no_positions')} {subcat.label}</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>{t('investment_detail.empty_hint')}</p>
        </div>
      ) : (
      <>
        {/* Ringkasan posisi — tampil untuk SEMUA kelas aset (Nilai/Modal/
            Untung-Rugi/Hari Ini). "Hari Ini" cuma real buat kelas ber-harga
            live (saham & kripto); sisanya "—". */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniStat label={t('investment_detail.stat_value')} value={formatCurrency(totals.market)} glow="glow-violet" />
          <MiniStat label={t('investment_detail.stat_invested')} value={formatCurrency(totals.invested)} glow="glow-indigo" />
          <MiniStat
            label={t('investment_detail.stat_profit_loss')}
            value={`${formatCurrency(totals.pl)}${totals.invested > 0 ? `  ·  ${up ? '+' : ''}${totals.plPct.toFixed(2)}%` : ''}`}
            glow={up ? 'glow-emerald' : 'glow-rose'}
            accent={up ? '#10B981' : '#F43F5E'}
          />
          <MiniStat
            label={t('investment_detail.stat_today')}
            value={
              todayPL
                ? `${todayPL.value >= 0 ? '+' : ''}${formatCurrency(todayPL.value)}  ·  ${todayPL.pct >= 0 ? '+' : ''}${todayPL.pct.toFixed(2)}%`
                : '—'
            }
            glow={todayPL ? (todayPL.value >= 0 ? 'glow-emerald' : 'glow-rose') : undefined}
            accent={todayPL ? (todayPL.value >= 0 ? '#10B981' : '#F43F5E') : undefined}
          />
        </div>

        {view === 'list' ? (
        // ─── LIST VIEW ─── shared by all categories. Logo column adapts:
        // stock → StockLogo, crypto → CryptoLogo, others → no logo cell.
        <div className="space-y-4">
          <div className="s-card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border-soft)' }}>
                  <Th>{category === 'stock' ? t('investment_detail.th_ticker') : t('investment_detail.th_coin')}</Th>
                  <Th>{category === 'stock' ? t('investment_detail.th_company') : t('investment_detail.th_name')}</Th>
                  {category === 'stock' && <Th>{t('investment_detail.th_sector')}</Th>}
                  <Th className="text-right">{category === 'stock' ? t('investment_detail.th_shares') : t('investment_detail.th_qty')}</Th>
                  <Th className="text-right">{t('investment_detail.th_avg_cost')}</Th>
                  <Th className="text-right">{t('investment_detail.th_invested')}</Th>
                  <Th className="text-right">{t('investment_detail.th_price')}</Th>
                  <Th className="text-right">{t('investment_detail.th_market_value')}</Th>
                  <Th className="text-right">{t('investment_detail.th_pl')}</Th>
                  <Th className="text-right">{t('investment_detail.th_pl_pct')}</Th>
                  <Th>{t('investment_detail.th_platform')}</Th>
                  <Th className="text-right"></Th>
                </tr>
              </thead>
              <tbody>
                {enriched.map((e) => {
                  const pos = e.pl >= 0
                  return (
                    <tr key={e.i.id} className="border-b hover:bg-[var(--surface-alt)]/50 transition-colors" style={{ borderColor: 'var(--border-soft)' }}>
                      <Td>
                        {showStockResearch && e.i.ticker ? (
                          <Link
                            href={`/dashboard/assets/investment/stock/research/${fromYahooTicker(e.i.ticker)}`}
                            className="flex items-center gap-2.5 group/row"
                            title={`${t('investment_detail.view_research')} ${fromYahooTicker(e.i.ticker)}`}
                          >
                            <StockLogo ticker={e.i.ticker} size={36} />
                            <Badge
                              className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold border-0 tabular group-hover/row:underline"
                              style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}
                            >
                              {fromYahooTicker(e.i.ticker)}
                            </Badge>
                          </Link>
                        ) : category === 'crypto' && e.i.ticker ? (
                          <Link
                            href={`/dashboard/assets/investment/crypto/${cryptoBase(e.i.ticker)}`}
                            className="flex items-center gap-2.5 group/row"
                            title={`${t('investment_detail.view_coin')} ${cryptoBase(e.i.ticker)}`}
                          >
                            <CryptoLogo symbol={e.i.ticker} size={36} />
                            <Badge
                              className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold border-0 tabular group-hover/row:underline"
                              style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}
                            >
                              {cryptoBase(e.i.ticker)}
                            </Badge>
                          </Link>
                        ) : (
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
                              {category === 'stock' && e.i.ticker ? fromYahooTicker(e.i.ticker) : (e.i.ticker ?? '—')}
                            </Badge>
                          </div>
                        )}
                      </Td>
                      <Td className="font-medium" style={{ color: 'var(--ink)' }}>
                        {showStockResearch && e.i.ticker ? (
                          <Link
                            href={`/dashboard/assets/investment/stock/research/${fromYahooTicker(e.i.ticker)}`}
                            className="hover:underline"
                          >
                            {e.i.name}
                          </Link>
                        ) : category === 'crypto' && e.i.ticker ? (
                          <Link
                            href={`/dashboard/assets/investment/crypto/${cryptoBase(e.i.ticker)}`}
                            className="hover:underline"
                          >
                            {e.i.name}
                          </Link>
                        ) : (
                          e.i.name
                        )}
                      </Td>
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
                          <Button variant="ghost" size="icon-sm" aria-label={t('investment_detail.aria_edit_position')} onClick={() => openEdit(e.i)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" aria-label={t('investment_detail.aria_delete_position')} onClick={() => remove(e.i.id)}>
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
                className="group relative rounded-xl p-4 bg-[var(--surface)] border transition-all hover:shadow-md hover:-translate-y-0.5"
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
                        {category === 'crypto' && e.i.ticker ? (
                          <Link href={`/dashboard/assets/investment/crypto/${cryptoBase(e.i.ticker)}`} className="font-semibold text-sm truncate hover:underline block" style={{ color: 'var(--ink)' }}>{e.i.name}</Link>
                        ) : (
                          <p className="font-semibold text-sm truncate" style={{ color: 'var(--ink)' }}>{e.i.name}</p>
                        )}
                        <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--ink-muted)' }}>
                          {e.i.platform || '—'} {e.i.ticker ? `· ${e.i.ticker}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                        <Button variant="ghost" size="icon-sm" aria-label={t('investment_detail.aria_edit_position')} onClick={() => openEdit(e.i)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label={t('investment_detail.aria_delete_position')} onClick={() => remove(e.i.id)}>
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
      </>
      )}
        </TabsContent>

        {category === 'stock' && (
          <>
            {/* Fundamental/emiten-bound tabs: IDX-only (US gak punya data) */}
            {showStockResearch && (
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
              </>
            )}
            <TabsContent value="dividen-pro" className="mt-6">
              <StockDividendCalendar />
            </TabsContent>
            <TabsContent value="log" className="mt-6">
              <StockLogPanel />
            </TabsContent>
            <TabsContent value="dividen" className="mt-6">
              <DividendsPanel />
            </TabsContent>
            {showNews && (
              <TabsContent value="berita" className="mt-6">
                <NewsTab />
              </TabsContent>
            )}
          </>
        )}
      </Tabs>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? `${t('investment_detail.dialog_edit')} ${subcat.label}` : `${t('investment_detail.dialog_add')} ${subcat.label}`}</DialogTitle>
            <DialogDescription>
              {category === 'stock'
                ? t('investment_detail.dialog_desc_stock')
                : category === 'crypto'
                  ? t('investment_detail.dialog_desc_crypto')
                  : t('investment_detail.dialog_desc_default')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {/* Stock-only: ticker autocomplete from IDX catalog auto-fills name + sector */}
            {category === 'stock' ? (
              <>
                <div className="grid gap-1.5">
                  <Label>{t('investment_detail.label_search_stock')}</Label>
                  <StockTickerSearch
                    value={form.ticker ?? ''}
                    onSelect={(s) =>
                      setForm({
                        ...form,
                        // simpan ticker polos (tanpa .JK); suffix .JK ditambah otomatis saat simpan
                        ticker: s.t,
                        name: s.n,
                        sector: s.s,
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>{t('investment_detail.label_name')}</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder={t('investment_detail.placeholder_auto_search')}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>{t('investment_detail.label_ticker')}</Label>
                    <Input
                      value={form.ticker}
                      onChange={(e) => setForm({ ...form, ticker: e.target.value })}
                      placeholder="BBCA"
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>{t('investment_detail.label_sector')}</Label>
                  <Input
                    value={form.sector}
                    onChange={(e) => setForm({ ...form, sector: e.target.value })}
                    placeholder={t('investment_detail.placeholder_auto_search')}
                  />
                </div>
              </>
            ) : category === 'crypto' ? (
              <>
                {/* Crypto category: searchable coin catalog auto-fills name + ticker */}
                <div className="grid gap-1.5">
                  <Label>{t('investment_detail.label_search_coin')}</Label>
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
                    <Label>{t('investment_detail.label_name')}</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder={t('investment_detail.placeholder_auto_search')}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>{t('investment_detail.label_ticker')}</Label>
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
                      className="text-xs leading-relaxed rounded-lg p-2.5 flex items-start gap-2"
                      style={{
                        color: 'var(--ink-muted)',
                        background: 'var(--surface-2)',
                      }}
                    >
                      <Lightbulb className="size-3.5 shrink-0 mt-0.5" style={{ color: 'var(--c-amber, #F59E0B)' }} />
                      <span>{cfg.topHint}</span>
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
              const platformLabel = cfg?.platform.label ?? t('investment_detail.platform_label_default')
              const platformHelp = cfg?.platform.help
              const platformPlaceholder = cfg?.platform.placeholder ?? t('investment_detail.platform_placeholder_default')
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
                        <SelectValue placeholder={t('investment_detail.select_brokerage')}>
                          {(v) => {
                            const broker = IDX_BROKERS.find((b) => b.short === v || b.name === v)
                            if (!broker) return v || t('investment_detail.select_brokerage')
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
                                  {t('investment_detail.fee_buy')} {(b.buyRate * 100).toFixed(2)}% · {t('investment_detail.fee_sell')} {(b.sellRate * 100).toFixed(2)}%
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
              const priceCfg = cfg?.currentPrice ?? { label: t('investment_detail.label_current_price'), placeholder: '0' }
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
                  <Label>{t('investment_detail.label_notes')}</Label>
                  <Input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder={cfg?.notesHelp ?? t('investment_detail.placeholder_notes')}
                  />
                  {cfg?.notesHelp && (
                    <p className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>{cfg.notesHelp}</p>
                  )}
                </div>
              )
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('investment_detail.cancel')}</Button>
            <Button onClick={save} disabled={saving || !form.name}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.id ? t('investment_detail.save') : t('investment_detail.add')}
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
    <div className={`s-card p-4 ${glow ?? ''}`}>
      <p className="eyebrow">{label}</p>
      <p className="num text-xl mt-2 tabular font-bold" style={{ color: accent ?? 'var(--ink)' }}>
        {value}
      </p>
    </div>
  )
}
