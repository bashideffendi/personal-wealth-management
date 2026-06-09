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
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${className}`}
      style={{
        background: 'var(--c-amber-soft)',
        borderColor: 'color-mix(in srgb, var(--c-amber) 28%, transparent)',
        color: 'var(--ink-muted)',
      }}
    >
      <Info className="size-3.5 shrink-0 mt-0.5" style={{ color: 'var(--c-amber-ink)' }} />
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
