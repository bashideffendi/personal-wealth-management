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
import { Eye, EyeOff } from 'lucide-react'
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
        {/* Toggle kelas kosong di header — bukan kartu dashed ber-icon "+"
            yang labelnya "sembunyikan" (kontradiksi). */}
        {hiddenCount > 0 || showAllClasses ? (
          <button
            type="button"
            onClick={() => setShowAllClasses((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium transition hover:opacity-70"
            style={{ color: 'var(--ink-soft)' }}
          >
            {showAllClasses
              ? <><EyeOff className="size-3.5" /> {t('investment.show_less_classes')}</>
              : <><Eye className="size-3.5" /> {t('investment.show_all_classes')} ({hiddenCount})</>}
          </button>
        ) : (
          <span className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{t('investment.asset_classes_hint')}</span>
        )}
      </div>
      {/* List baris ringkas (watchlist-style) — 1 kartu + divider, bukan kartu
          gede per kelas. ~52px/baris: icon + nama/posisi · nilai/% kanan. */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        {visibleCards.map((c, i) => {
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
              className="flex items-center gap-3 px-3.5 transition-colors hover:bg-[var(--surface-2)]"
              style={{ minHeight: 52, borderTop: i ? '1px solid var(--border-soft)' : 'none' }}
            >
              <div
                className="grid place-items-center shrink-0"
                style={{ width: 30, height: 30, borderRadius: 8, background: `color-mix(in srgb, ${color} 15%, var(--surface))`, color }}
              >
                <CardIcon className="size-[15px]" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[14px] truncate leading-tight" style={{ color: 'var(--ink)' }}>{c.label}</p>
                <p className="text-[11px] leading-tight mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                  {hasPosition ? `${data.count} ${t('investment.positions')}` : t('investment.no_position')}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="num tabular font-semibold text-[14px] leading-tight" style={{ color: 'var(--ink)' }}>{formatCurrency(data.market)}</p>
                {data.invested > 0 && (
                  <p
                    className="num tabular font-semibold text-[11.5px] leading-tight mt-0.5"
                    data-loss={plUp ? undefined : 'true'}
                    style={{ color: plUp ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}
                  >
                    {plUp ? '+' : ''}{pct.toFixed(2)}%
                  </p>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
