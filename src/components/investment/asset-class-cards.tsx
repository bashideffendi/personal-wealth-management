'use client'

/**
 * AssetClassCards — drill-down cards per asset class (click → per-slug page).
 *
 * Neutral cards (surface + border-soft) with the class color confined to a
 * 32px soft-tint icon box; ONE canonical palette from ASSET_CLASS_META so the
 * cards match the donut/chips/movers on the same screen. Only classes with
 * positions render by default; a dashed ghost card expands the rest. The
 * expander state lives here so toggling never re-renders the page.
 */

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Plus } from 'lucide-react'
import { INVESTMENT_SUBCATS } from '@/lib/constants'
import { getInvestmentVisual } from '@/lib/investment-visual'
import { ASSET_CLASS_META, type AssetClassKey } from '@/lib/invest/asset-class'
import { formatCurrency } from '@/lib/utils'
import { useT } from '@/lib/i18n/context'

type ClassAgg = { invested: number; market: number; count: number }

export interface AssetClassCardsProps {
  byClass: Partial<Record<AssetClassKey, ClassAgg>>
  byCategory: Record<string, ClassAgg>
}

export function AssetClassCards({ byClass, byCategory }: AssetClassCardsProps) {
  const t = useT()
  const [showAllClasses, setShowAllClasses] = useState(false)

  const allCards = INVESTMENT_SUBCATS.flatMap((sc) => {
    // Saham dipecah jadi 2 kartu (IDX & US) -> nge-link ke halaman terpisah.
    const Icon = getInvestmentVisual(sc.slug).icon
    return sc.slug === 'stock'
      ? [
          { key: 'stock-idx', classKey: 'stock_idx' as AssetClassKey, label: t('investment.stock_idx'), href: '/dashboard/assets/investment/stock-idx', d: byClass.stock_idx, Icon },
          { key: 'stock-us', classKey: 'stock_us' as AssetClassKey, label: t('investment.stock_us'), href: '/dashboard/assets/investment/stock-us', d: byClass.stock_us, Icon },
        ]
      : [{
          key: sc.slug,
          classKey: sc.slug.replace(/-/g, '_') as AssetClassKey,
          label: sc.label,
          href: `/dashboard/assets/investment/${sc.slug}`,
          d: byCategory[sc.slug === 'mutual-fund' ? 'mutual_fund' : sc.slug === 'time-deposit' ? 'time_deposit' : sc.slug],
          Icon,
        }]
  })
  const hasAny = allCards.some((c) => (c.d?.count ?? 0) > 0)
  // Pengguna tanpa posisi tetap lihat kelas starter buat onboarding.
  const STARTERS = ['stock-idx', 'mutual-fund', 'crypto', 'gold', 'sbn', 'time-deposit']
  const visibleCards = showAllClasses
    ? allCards
    : hasAny
      ? allCards.filter((c) => (c.d?.count ?? 0) > 0)
      : allCards.filter((c) => STARTERS.includes(c.key))
  const hiddenCount = allCards.length - visibleCards.length

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="eyebrow">{t('investment.asset_classes')}</h2>
        <span className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{t('investment.asset_classes_hint')}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {visibleCards.map((c) => {
          const data = c.d ?? { invested: 0, market: 0, count: 0 }
          const pl = data.market - data.invested
          const pct = data.invested > 0 ? (pl / data.invested) * 100 : 0
          const plUp = pl >= 0
          const hasPosition = data.count > 0
          const color = ASSET_CLASS_META[c.classKey].color
          const CardIcon = c.Icon
          return (
            <Link
              key={c.key}
              href={c.href}
              className="group rounded-xl border p-4 transition-all hover:shadow-md hover:-translate-y-0.5"
              style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)' }}
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className="grid place-items-center shrink-0"
                  style={{ width: 32, height: 32, borderRadius: 9, background: `color-mix(in srgb, ${color} 15%, var(--surface))`, color }}
                >
                  <CardIcon className="size-4" strokeWidth={2} />
                </div>
                <ArrowUpRight
                  className="size-4 opacity-30 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition shrink-0 mt-1"
                  style={{ color: 'var(--ink-soft)' }}
                />
              </div>
              <p className="font-semibold text-sm mt-3 tracking-tight" style={{ color: 'var(--ink)' }}>
                {c.label}
              </p>
              <p className="num text-lg mt-1 tabular font-semibold" style={{ color: 'var(--ink)' }}>
                {formatCurrency(data.market)}
              </p>
              <div className="mt-1.5 flex items-center justify-between text-[11px]">
                <span style={{ color: 'var(--ink-soft)' }}>
                  {hasPosition ? `${data.count} ${t('investment.positions')}` : t('investment.no_position')}
                </span>
                {data.invested > 0 && (
                  <span
                    className="num font-semibold tabular px-1.5 py-0.5 rounded"
                    data-loss={plUp ? undefined : 'true'}
                    style={{
                      color: plUp ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)',
                      background: plUp ? 'var(--c-mint-soft)' : 'var(--c-coral-soft)',
                    }}
                  >
                    {plUp ? '+' : ''}{pct.toFixed(2)}%
                  </span>
                )}
              </div>
            </Link>
          )
        })}
        {(hiddenCount > 0 || showAllClasses) && (
          <button
            type="button"
            onClick={() => setShowAllClasses((v) => !v)}
            className="rounded-xl border border-dashed p-4 flex flex-col items-center justify-center gap-1.5 text-xs font-medium transition hover:bg-[var(--surface-2)] min-h-[120px]"
            style={{ borderColor: 'var(--border)', color: 'var(--ink-soft)' }}
          >
            <Plus className="size-4" />
            {showAllClasses
              ? t('investment.show_less_classes')
              : `${t('investment.show_all_classes')} (${hiddenCount})`}
          </button>
        )}
      </div>
    </div>
  )
}
