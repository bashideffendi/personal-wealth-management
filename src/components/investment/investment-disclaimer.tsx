'use client'

import { Info } from 'lucide-react'
import { useT } from '@/lib/i18n/context'

/**
 * In-context "bukan nasihat investasi" + data-provenance notice for investment
 * surfaces (portfolio hub, research, valuation). Keeps Klunting framed as an
 * information/education tool — not a licensed investment advisor — and is honest
 * that public/market data can be delayed or wrong.
 *
 * Pass `asOf` (a formatted date string) to append a data-freshness line.
 */
export function InvestmentDisclaimer({
  asOf,
  className = '',
}: {
  asOf?: string
  className?: string
}) {
  const t = useT()
  return (
    <div
      role="note"
      // Caption abu, bukan kotak kuning (bahasa desain: tanpa spanduk peringatan).
      className={`hidden md:flex items-start gap-2 text-2xs leading-relaxed ${className}`}
      style={{ color: 'var(--ink-soft)' }}
    >
      <Info className="size-3.5 shrink-0 mt-0.5" style={{ color: 'var(--ink-soft)' }} />
      <span>
        {t('investment.disclaimer_banner')}
        {asOf ? (
          <span style={{ color: 'var(--ink-soft)' }}>
            {' '}
            {t('investment.data_as_of')} {asOf}.
          </span>
        ) : null}
      </span>
    </div>
  )
}
