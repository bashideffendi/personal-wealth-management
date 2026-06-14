'use client'

/**
 * Dividend Calendar Pro — upcoming + historical dividends untuk semua
 * emiten IDX (~3000 events). Replace tab "Dividen" lama yang cuma manual entry.
 *
 * Tab 1: "Mendatang" — ex-date >= today, sorted ascending
 * Tab 2: "Holdings" — dividen untuk saham yang user own (link ke existing
 *   manual entries di profile)
 * Tab 3: "Watchlist" — dividen untuk saham di watchlist user
 *
 * Source: /api/idx-dividends + Klunting watchlist table.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Calendar, Loader2, Star, ArrowUpRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { formatPrice, formatIDXDate, parseIDXShortDate } from '@/lib/invest/format'
import { useT } from '@/lib/i18n/context'

interface DividendEvent {
  ticker: string
  period: string
  dividend: number
  exDate: string | null
  payDate: string | null
}

export function StockDividendCalendar() {
  const t = useT()
  const supabase = createClient()
  const [upcoming, setUpcoming] = useState<DividendEvent[]>([])
  const [watchlistTickers, setWatchlistTickers] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [divRes, wlRes] = await Promise.all([
        fetch('/api/idx-dividends')
          .then((r) => r.json())
          .catch(() => ({})) as Promise<{ upcoming?: DividendEvent[] }>,
        supabase.auth.getUser().then(async ({ data }: { data: { user: { id: string } | null } }) => {
          if (!data.user) return { data: [] as { ticker: string }[] }
          return supabase.from('watchlist').select('ticker').eq('user_id', data.user.id)
        }),
      ])
      if (cancelled) return
      setUpcoming(divRes.upcoming ?? [])
      const tickers = new Set<string>()
      for (const r of ((wlRes as { data?: { ticker: string }[] }).data ?? [])) {
        tickers.add(r.ticker)
      }
      setWatchlistTickers(tickers)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const watchlistDividends = useMemo(
    () => upcoming.filter((d) => watchlistTickers.has(d.ticker.toUpperCase())),
    [upcoming, watchlistTickers],
  )

  if (loading) {
    return (
      <div className="py-16 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
        <Loader2 className="size-5 mx-auto animate-spin mb-2" />
        {t('dividend_calendar.loading')}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="upcoming">
            <Calendar className="size-3.5 mr-1.5" />
            {t('dividend_calendar.tab_upcoming')} ({upcoming.length})
          </TabsTrigger>
          <TabsTrigger value="watchlist">
            <Star className="size-3.5 mr-1.5" />
            {t('dividend_calendar.tab_watchlist')} ({watchlistDividends.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4">
          <DividendList events={upcoming.slice(0, 100)} />
          {upcoming.length > 100 && (
            <p className="text-xs text-center mt-3" style={{ color: 'var(--ink-soft)' }}>
              {t('dividend_calendar.showing_limit_prefix')} {upcoming.length} {t('dividend_calendar.showing_limit_suffix')}
            </p>
          )}
        </TabsContent>

        <TabsContent value="watchlist" className="mt-4">
          {watchlistDividends.length === 0 ? (
            <div
              className="rounded-2xl border p-8 text-center"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <p className="text-sm" style={{ color: 'var(--ink)' }}>
                {t('dividend_calendar.empty_watchlist_title')}
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--ink-muted)' }}>
                {t('dividend_calendar.empty_watchlist_hint')}
              </p>
            </div>
          ) : (
            <DividendList events={watchlistDividends} />
          )}
        </TabsContent>
      </Tabs>

      <div
        className="rounded-lg border p-3 text-[11px] flex items-start gap-2"
        style={{
          boxShadow: 'var(--card-shadow)', background: 'var(--surface-2)',
          borderColor: 'var(--border-soft)',
          color: 'var(--ink-muted)',
        }}
      >
        <Calendar className="size-3.5 shrink-0 mt-0.5" style={{ color: 'var(--c-mint-ink)' }} />
        <span>
          {t('dividend_calendar.footer_note')}
        </span>
      </div>
    </div>
  )
}

function DividendList({ events }: { events: DividendEvent[] }) {
  const t = useT()
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-left text-[10px] uppercase tracking-[0.08em] font-semibold border-b"
              style={{ color: 'var(--ink-soft)', borderColor: 'var(--border-soft)' }}
            >
              <th className="px-3 py-2.5">{t('dividend_calendar.col_ex_date')}</th>
              <th className="px-3 py-2.5">{t('dividend_calendar.col_ticker')}</th>
              <th className="px-3 py-2.5 text-right">{t('dividend_calendar.col_per_share')}</th>
              <th className="px-3 py-2.5">{t('dividend_calendar.col_pay_date')}</th>
              <th className="px-3 py-2.5">{t('dividend_calendar.col_period')}</th>
              <th className="px-3 py-2.5 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev, i) => {
              const exDate = ev.exDate ? parseIDXShortDate(ev.exDate) : null
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              const daysUntil = exDate
                ? Math.round((exDate.getTime() - today.getTime()) / 86_400_000)
                : null
              const urgency =
                daysUntil != null && daysUntil >= 0 && daysUntil <= 3
                  ? 'critical'
                  : daysUntil != null && daysUntil >= 0 && daysUntil <= 7
                    ? 'warn'
                    : 'normal'

              return (
                <tr
                  key={`${ev.ticker}-${ev.exDate}-${i}`}
                  className="border-t"
                  style={{ borderColor: 'var(--border-soft)' }}
                >
                  <td className="px-3 py-2.5 text-xs">
                    <div className="font-medium" style={{ color: 'var(--ink)' }}>
                      {exDate ? formatIDXDate(exDate.toISOString()) : ev.exDate}
                    </div>
                    {daysUntil != null && daysUntil >= 0 && (
                      <div
                        className="text-[10px] mt-0.5"
                        style={{
                          color:
                            urgency === 'critical' ? 'var(--c-coral)'
                            : urgency === 'warn' ? 'var(--amber-700)'
                            : 'var(--ink-soft)',
                        }}
                      >
                        {daysUntil === 0 ? t('dividend_calendar.due_today') : daysUntil === 1 ? t('dividend_calendar.due_tomorrow') : `${daysUntil} ${t('dividend_calendar.due_days_suffix')}`}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono font-semibold text-sm" style={{ color: 'var(--ink)' }}>
                    <Link
                      href={`/dashboard/assets/investment/stock/research/${ev.ticker}`}
                      className="hover:underline inline-flex items-center gap-1"
                    >
                      {ev.ticker}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right num tabular text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                    Rp {formatPrice(ev.dividend)}
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--ink-muted)' }}>
                    {ev.payDate || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--ink-soft)' }}>
                    {ev.period}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/dashboard/assets/investment/stock/research/${ev.ticker}`}
                      className="inline-flex items-center text-[var(--ink-soft)] hover:text-[var(--c-mint-ink)]"
                    >
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
