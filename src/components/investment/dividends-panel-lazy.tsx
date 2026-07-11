'use client'

/**
 * Lazy boundary for DividendsPanel — defers recharts out of the investment
 * detail route's initial JS until the dividends chart mounts. See
 * stock-price-chart-lazy for rationale.
 */

import dynamic from 'next/dynamic'

export const DividendsPanel = dynamic(
  () => import('@/components/charts/chart-modules').then((m) => m.DividendsPanel),
  {
    ssr: false,
    loading: () => (
      <div
        className="animate-pulse rounded-xl"
        style={{ height: 280, background: 'var(--surface-2)' }}
        aria-hidden="true"
      />
    ),
  },
)
