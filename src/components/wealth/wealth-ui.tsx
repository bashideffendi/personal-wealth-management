import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

/**
 * Header serif buat halaman Kekayaan (Net Worth / Aset / Utang / Dana Darurat).
 * Eyebrow uppercase + judul serif (Instrument Serif via --font-display, momen
 * personality) + subtitle + slot actions kanan. Token Klunting, BUKAN krem/indigo.
 */
export function WealthHeader({
  eyebrow, title, subtitle, children,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-semibold tracking-[0.18em] uppercase" style={{ color: 'var(--ink-soft)' }}>
            {eyebrow}
          </p>
        )}
        <h1
          className="mt-1 text-3xl sm:text-4xl leading-tight"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm mt-1.5 max-w-2xl" style={{ color: 'var(--ink-muted)' }}>{subtitle}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </div>
  )
}

/** Stat tile (4-up) — label + ikon ber-chip + angka gede + sub. */
export function StatCard({
  label, value, sub, subColor = 'var(--ink-soft)', icon: Icon, color = 'var(--ink)', chip = 'var(--surface-2)',
}: {
  label: string
  value: string
  sub?: ReactNode
  subColor?: string
  icon?: LucideIcon
  color?: string
  chip?: string
}) {
  return (
    <div className="s-card p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>{label}</p>
        {Icon && (
          <div className="size-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: chip }}>
            <Icon className="size-4" style={{ color }} />
          </div>
        )}
      </div>
      <p className="num tabular text-xl sm:text-2xl font-bold mt-3 leading-none" style={{ color: 'var(--ink)' }}>
        {value}
      </p>
      {sub != null && <p className="text-[11px] mt-1.5" style={{ color: subColor }}>{sub}</p>}
    </div>
  )
}
