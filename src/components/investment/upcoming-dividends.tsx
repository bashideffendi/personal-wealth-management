'use client'

/**
 * UpcomingDividends — next ex-dates for tickers the user actually HOLDS,
 * with an estimated payout (shares × DPS). Replaces the old "Pergerakan Hari
 * Ini" card: that one re-rendered the same day-change data already shown in
 * the hero stat and the holdings Δ column, and amplified exactly the daily
 * noise Calm Mode tries to damp. Dividends are forward-looking and actionable
 * (hold through the ex-date), which earns the slot.
 *
 * Falls back to the nearest market-wide ex-dates when no held ticker has a
 * scheduled dividend, so the card never renders empty-and-useless.
 */

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, CalendarDays } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useT } from '@/lib/i18n/context'
import { assetClassKey } from '@/lib/invest/asset-class'
import type { EnrichedHolding } from '@/lib/invest/enrich'

interface UpcomingEvent {
  ticker: string
  period: string
  dividend: number
  exDate: string | null
  payDate: string | null
}

export function UpcomingDividends({ enriched }: { enriched: EnrichedHolding[] }) {
  const t = useT()

  // Shares per held IDX ticker (quantity is stored as shares — market value
  // math is qty × per-share price app-wide).
  const heldShares = new Map<string, number>()
  for (const e of enriched) {
    if (assetClassKey(e.i) !== 'stock_idx') continue
    const bare = (e.i.ticker ?? '').replace(/\.JK$/i, '').trim().toUpperCase()
    if (!bare) continue
    heldShares.set(bare, (heldShares.get(bare) ?? 0) + (e.i.quantity || 0))
  }

  const upcoming = useQuery({
    queryKey: ['idx-upcoming-dividends'],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const res = await fetch('/api/idx-dividends')
      if (!res.ok) throw new Error('dividends')
      const json = (await res.json()) as { upcoming?: UpcomingEvent[] }
      return json.upcoming ?? []
    },
  })

  if (upcoming.isLoading || upcoming.isError) return null
  const events = upcoming.data ?? []
  if (events.length === 0) return null

  const mine = events.filter((ev) => heldShares.has(ev.ticker.toUpperCase())).slice(0, 5)
  const fallback = mine.length === 0 ? events.slice(0, 3) : []
  const rows = mine.length > 0 ? mine : fallback

  return (
    <div className="s-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="eyebrow">{t('investment.dividend')}</p>
          <h2 className="text-xl font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{t('investment.upcoming_div_title')}</h2>
        </div>
        <Link
          href="/dashboard/assets/investment/stock?tab=dividen-pro"
          className="inline-flex items-center gap-0.5 text-xs font-medium hover:underline shrink-0 mt-1"
          style={{ color: 'var(--c-mint-ink)' }}
        >
          {t('investment.upcoming_div_link')} <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
      {mine.length === 0 && (
        <p className="text-[11px] mt-1" style={{ color: 'var(--ink-soft)' }}>
          {t('investment.upcoming_div_market_note')}
        </p>
      )}
      <div className="mt-3">
        {rows.map((ev) => {
          const shares = heldShares.get(ev.ticker.toUpperCase()) ?? 0
          const estimate = shares > 0 ? shares * ev.dividend : null
          return (
            <div key={`${ev.ticker}-${ev.period}-${ev.exDate}`} className="flex items-center justify-between gap-3 py-2 border-b last:border-0" style={{ borderColor: 'var(--border-soft)' }}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="size-8 rounded-full grid place-items-center text-[10px] font-bold shrink-0" style={{ background: 'var(--c-mint-soft)', color: 'var(--c-mint-ink)' }}>
                  {ev.ticker.slice(0, 4)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm truncate" style={{ color: 'var(--ink)' }}>
                    <span className="num tabular font-semibold">Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(ev.dividend)}</span>
                    <span style={{ color: 'var(--ink-soft)' }}>{t('investment.upcoming_div_per_share')}</span>
                  </p>
                  <p className="text-[11px] inline-flex items-center gap-1" style={{ color: 'var(--ink-soft)' }}>
                    <CalendarDays className="size-3" /> Ex-date {ev.exDate ?? '—'}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                {estimate != null && estimate > 0 ? (
                  <>
                    <p className="num tabular text-sm font-semibold" style={{ color: 'var(--c-mint-ink)' }}>
                      ±{formatCurrency(estimate)}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>{t('investment.upcoming_div_estimate')}</p>
                  </>
                ) : (
                  <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{ev.period}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
