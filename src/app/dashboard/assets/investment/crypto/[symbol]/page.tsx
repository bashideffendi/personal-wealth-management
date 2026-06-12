'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import type { Investment } from '@/types'
import { FX_FALLBACK_USDIDR } from '@/lib/constants'
import { CryptoLogo } from '@/components/investment/crypto-logo'
import { StockPriceChart } from '@/components/investment/stock-price-chart-lazy'
import { ArrowLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/context'

/** Normalize any stored/URL form (BTC, BTC-USD, BTCUSDT) → base symbol (BTC). */
function toBase(raw: string): string {
  return (raw ?? '')
    .toUpperCase()
    .replace(/[-_]?(USDT|USD)$/i, '')
    .replace(/[-_]+$/, '')
}

export default function CryptoCoinPage() {
  const t = useT()
  const params = useParams<{ symbol: string }>()
  const supabase = createClient()

  const base = toBase(params.symbol ?? '')
  const pair = `${base}-USD`

  const [loading, setLoading] = useState(true)
  const [holding, setHolding] = useState<Investment | null>(null)
  const [name, setName] = useState<string>(base)
  const [price, setPrice] = useState<number | null>(null) // USD
  const [changePct, setChangePct] = useState<number | null>(null)
  const [usdIdr, setUsdIdr] = useState<number>(FX_FALLBACK_USDIDR)

  // Holding kamu di coin ini (kalau ada).
  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('investments').select('*').eq('user_id', user.id).eq('category', 'crypto')
      const match = ((data ?? []) as Investment[]).find((i) => toBase(i.ticker ?? '') === base)
      if (!active) return
      setHolding(match ?? null)
      if (match?.name) setName(match.name)
      setLoading(false)
    })()
    return () => { active = false }
  }, [supabase, base])

  // Harga live (Binance USD) + kurs USDIDR (buat konversi ke IDR).
  useEffect(() => {
    let active = true
    ;(async () => {
      const [pRes, fxRes] = await Promise.all([
        fetch(`/api/crypto-price?symbols=${encodeURIComponent(base + 'USDT')}`),
        fetch('/api/quotes?tickers=USDIDR%3DX'),
      ])
      if (pRes.ok) {
        const j = (await pRes.json()) as { tickers?: Array<{ symbol: string; lastPrice: number; priceChangePercent: number }> }
        const t = j.tickers?.[0]
        if (active && t) { setPrice(t.lastPrice); setChangePct(t.priceChangePercent) }
      }
      if (fxRes.ok) {
        const j = (await fxRes.json()) as { quotes?: Array<{ ticker: string; price: number }> }
        const fx = j.quotes?.find((q) => q.ticker === 'USDIDR=X')
        if (active && fx?.price && fx.price > 0) setUsdIdr(fx.price)
      }
    })()
    return () => { active = false }
  }, [base])

  const priceIdr = price != null ? price * usdIdr : null

  const pos = useMemo(() => {
    if (!holding) return null
    const qty = holding.quantity || 0
    const avg = holding.avg_cost || 0
    const invested = qty * avg
    const liveIdr = priceIdr ?? holding.current_price ?? avg
    const market = qty * liveIdr
    const pl = market - invested
    const plPct = invested > 0 ? (pl / invested) * 100 : 0
    return { qty, avg, invested, market, pl, plPct }
  }, [holding, priceIdr])

  const up24 = changePct == null ? true : changePct >= 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/assets/investment/crypto"
          className="inline-flex items-center gap-1.5 text-xs font-medium mb-3 rounded-md px-2 py-1 -ml-2 transition-colors hover:bg-[var(--surface-2)]"
          style={{ color: 'var(--ink-muted)' }}
        >
          <ArrowLeft className="size-3.5" /> {t('crypto_detail.back')}
        </Link>
        <div className="flex items-center gap-3">
          <CryptoLogo symbol={pair} size={48} shape="circle" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate" style={{ color: 'var(--ink)' }}>{name}</h1>
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
              <span className="font-mono font-semibold">{base}</span> · {t('crypto_detail.asset_type')}
            </p>
          </div>
        </div>
      </div>

      {/* Stats: harga USD + IDR + posisi kamu */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label={t('crypto_detail.price_usd')}
          value={price != null ? `$ ${price.toLocaleString('id-ID', { maximumFractionDigits: 2 })}` : '—'}
          sub={changePct != null ? `${up24 ? '+' : ''}${changePct.toFixed(2)}% · ${t('crypto_detail.window_24h')}` : undefined}
          accent={changePct != null ? (up24 ? 'var(--c-mint)' : 'var(--c-coral)') : undefined}
        />
        <Stat
          label={t('crypto_detail.price_idr')}
          value={priceIdr != null ? formatCurrency(priceIdr) : '—'}
          sub={`${t('crypto_detail.rate')} ${formatCurrency(usdIdr)}/$`}
        />
        {loading ? (
          <Stat label={t('crypto_detail.your_position')} value="…" />
        ) : pos ? (
          <Stat
            label={t('crypto_detail.your_position')}
            value={formatCurrency(pos.market)}
            sub={`${pos.qty.toLocaleString('id-ID')} ${t('crypto_detail.unit')} · ${pos.plPct >= 0 ? '+' : ''}${pos.plPct.toFixed(2)}%`}
            accent={pos.pl >= 0 ? 'var(--c-mint)' : 'var(--c-coral)'}
          />
        ) : (
          <div className="s-card p-4 flex flex-col justify-between">
            <p className="eyebrow">{t('crypto_detail.your_position')}</p>
            <p className="text-sm mt-2" style={{ color: 'var(--ink-soft)' }}>{t('crypto_detail.no_holding')} {base}.</p>
            <Link href="/dashboard/assets/investment/crypto" className="mt-2">
              <Button variant="outline" size="sm" className="w-full">
                <Plus className="size-3.5" /> {t('crypto_detail.add_in_crypto')}
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Grafik harga — Binance (realtime), bukan Yahoo */}
      <div className="s-card overflow-hidden">
        <StockPriceChart ticker={pair} chartApi="crypto" fallbackCurrency="USD" />
      </div>
    </div>
  )
}

function Stat({
  label, value, sub, accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: string
}) {
  return (
    <div className="s-card p-4">
      <p className="eyebrow">{label}</p>
      <p className="num text-xl mt-2 tabular font-bold" style={{ color: accent ?? 'var(--ink)' }}>
        {value}
      </p>
      {sub && <p className="text-[11px] mt-1" style={{ color: 'var(--ink-soft)' }}>{sub}</p>}
    </div>
  )
}
