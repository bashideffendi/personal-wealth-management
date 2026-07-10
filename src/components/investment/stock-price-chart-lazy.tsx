'use client'

/**
 * Lazy boundary for StockPriceChart. recharts (+ its d3 deps) is heavy and only
 * needed once the price chart actually mounts — defer it out of the route's
 * initial JS. Works from both client and server parents (this wrapper is a
 * client component, so `ssr: false` is valid here). Skeleton matches the chart
 * height to avoid layout shift.
 */

import dynamic from 'next/dynamic'

export const StockPriceChart = dynamic(
  () => import('@/components/charts/chart-modules').then((m) => m.StockPriceChart),
  {
    ssr: false,
    loading: () => (
      <div
        className="animate-pulse rounded-xl"
        style={{ height: 320, background: 'var(--surface-2)' }}
        aria-hidden="true"
      />
    ),
  },
)
