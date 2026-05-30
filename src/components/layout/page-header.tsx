import * as React from 'react'

/**
 * PageHeader — light, functional page header for work/list pages
 * (Transaksi, Anggaran, Rules, Contracts, etc).
 *
 * Per design decision 2026-05-29 (Hybrid headers): the dark gradient
 * hero is reserved for "big number" summary pages (Dashboard, Kekayaan,
 * Investasi). Working pages use this lighter header so content rises to
 * the top instead of being pushed down by a decorative dark block.
 *
 * Title is ink, subtitle muted. Optional actions slot sits right-aligned
 * on the same baseline as the title.
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
}: {
  title: string
  subtitle?: React.ReactNode
  eyebrow?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1
          className="font-bold tracking-tight"
          style={{
            fontSize: 'clamp(24px, 3vw, 30px)',
            color: 'var(--ink)',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm mt-1.5 max-w-2xl" style={{ color: 'var(--ink-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  )
}
