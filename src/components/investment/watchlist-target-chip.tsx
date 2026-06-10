'use client'

/**
 * WatchlistTargetChip — surfaces "N saham incaranmu nyentuh target" on the
 * hub. The target-price data + reached logic already existed in the watchlist
 * tab, but sat three clicks deep; this is the moment the user actually set
 * the target FOR. Renders nothing when no target is hit (zero noise).
 */

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Star, ArrowUpRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/i18n/context'

export function WatchlistTargetChip() {
  const t = useT()
  const supabase = createClient()

  const hits = useQuery({
    queryKey: ['watchlist-target-hits'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('watchlist')
        .select('ticker, target_price')
        .not('target_price', 'is', null)
      if (error || !data || data.length === 0) return []
      const rows = data as { ticker: string; target_price: number }[]
      const res = await fetch(
        `/api/quotes?tickers=${encodeURIComponent(rows.map((r) => `${r.ticker.toUpperCase()}.JK`).join(','))}`,
      )
      if (!res.ok) return []
      const json = (await res.json()) as { quotes?: { ticker: string; price: number }[] }
      const priceMap = new Map(
        (json.quotes ?? []).map((q) => [q.ticker.replace(/\.JK$/i, '').toUpperCase(), Number(q.price) || 0]),
      )
      // Same semantics as the watchlist tab: reached = live price <= target.
      return rows.filter((r) => {
        const p = priceMap.get(r.ticker.toUpperCase())
        return p != null && p > 0 && p <= r.target_price
      }).map((r) => r.ticker.toUpperCase())
    },
  })

  const tickers = hits.data ?? []
  if (tickers.length === 0) return null

  return (
    <Link
      href="/dashboard/assets/investment/stock?tab=watchlist"
      className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition hover:shadow-sm"
      style={{ background: 'var(--c-amber-soft)', borderColor: 'color-mix(in srgb, var(--c-amber) 30%, transparent)', color: 'var(--c-amber-ink)' }}
    >
      <Star className="size-3.5" style={{ fill: 'currentColor' }} />
      <span>
        <span className="num tabular font-bold">{tickers.length}</span> {t('investment.watchlist_hit')}{' '}
        <span className="font-mono font-semibold">{tickers.slice(0, 3).join(', ')}{tickers.length > 3 ? '…' : ''}</span>
      </span>
      <ArrowUpRight className="size-3.5" />
    </Link>
  )
}
