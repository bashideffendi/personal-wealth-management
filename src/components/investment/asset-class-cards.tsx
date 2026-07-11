'use client'

/**
 * AssetClassCards — drill-down cards per asset class (click → per-slug page).
 *
 * Grid kartu .s-card seragam (2/3/4 kolom) dengan warna kelas terkurung di
 * icon tile 36px soft-tint; ONE canonical palette from ASSET_CLASS_META so the
 * cards match the donut/chips/movers on the same screen. Only classes with
 * positions render by default; toggle di header expands the rest (kelas kosong
 * dirender redup biar tidak bersaing). The expander state lives here so
 * toggling never re-renders the page.
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
      {/* Grid kartu seragam (bukan list baris) — tiap kelas = .s-card klik-able:
          icon tile soft-tint + nama/posisi di atas, nilai market + chip P/L%
          nempel bawah (mt-auto) biar baseline nilai sejajar antar kartu.
          Kelas kosong (0 posisi) dirender redup (ink-soft) biar gak bersaing. */}
      <div className="grid grid-cols-2 gap-2.5 md:gap-3 lg:grid-cols-3 xl:grid-cols-4">
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
              className="s-card flex flex-col p-3 md:p-4 transition-colors duration-[120ms] hover:border-[var(--line-strong)]"
            >
              <div className="flex items-start gap-2.5">
                <div
                  className="grid size-9 shrink-0 place-items-center rounded-lg"
                  style={hasPosition
                    ? { background: `color-mix(in srgb, ${color} 15%, var(--surface))`, color }
                    : { background: 'var(--surface-2)', color: 'var(--ink-soft)' }}
                >
                  <CardIcon className="size-4" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold leading-tight" style={{ color: hasPosition ? 'var(--ink)' : 'var(--ink-soft)' }}>{c.label}</p>
                  <p className="mt-0.5 text-[11px] leading-tight" style={{ color: 'var(--ink-soft)' }}>
                    {hasPosition ? `${data.count} ${t('investment.positions')}` : t('investment.no_position')}
                  </p>
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                <p className="num tabular min-w-0 truncate text-[15px] font-bold leading-tight" style={{ color: hasPosition ? 'var(--ink)' : 'var(--ink-soft)' }}>{formatCurrency(data.market)}</p>
                {data.invested > 0 && (
                  <span
                    className="num tabular shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold leading-tight"
                    data-calm-hide="" data-loss={plUp ? undefined : 'true'}
                    style={{
                      background: plUp ? 'var(--c-mint-soft)' : 'var(--c-coral-soft)',
                      color: plUp ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)',
                    }}
                  >
                    {plUp ? '+' : ''}{pct.toFixed(2)}%
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
