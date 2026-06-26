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
  actions,
}: {
  title: string
  subtitle?: React.ReactNode
  /** Tidak dirender lagi (app-bar minimalis) — disimpan biar pemanggil lama gak error. */
  eyebrow?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h1
          className="font-semibold tracking-tight truncate"
          style={{
            fontSize: 20,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-[12.5px] mt-0.5 max-w-xl" style={{ color: 'var(--ink-soft)' }}>
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
