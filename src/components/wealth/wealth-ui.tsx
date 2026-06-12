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

/**
 * Premium hero buat halaman Kekayaan — anchor 1 angka gede + stat pendukung,
 * BUKAN 4 card kosong. Header (judul serif) + eyebrow + actions nyatu di sini,
 * jadi gak ada judul dobel. Glow halus + hierarki kuat = kesan premium.
 */
export function WealthHero({
  eyebrow, title, headline, secondary = [], actions, accent = '#7C5FD3',
}: {
  eyebrow?: string
  title: string
  headline: { label: string; value: string; sub?: ReactNode; color?: string }
  secondary?: { label: string; value: ReactNode; color?: string }[]
  actions?: ReactNode
  accent?: string
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl p-6 sm:p-7 bg-[var(--surface)] border-[length:var(--outline-w)] border-[var(--outline)] shadow-[var(--card-shadow)]">
      <div className="absolute pointer-events-none" style={{ top: -110, right: -70, width: 340, height: 340, borderRadius: '50%', background: `radial-gradient(circle, ${accent}1F, transparent 65%)` }} />
      <div className="relative flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          {eyebrow && <p className="text-[11px] font-semibold tracking-[0.16em] uppercase" style={{ color: 'var(--ink-soft)' }}>{eyebrow}</p>}
          <h1 className="mt-0.5 text-2xl sm:text-3xl leading-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{title}</h1>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      <div className="relative mt-5">
        <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{headline.label}</p>
        <p className="num tabular font-bold leading-none mt-1.5 whitespace-nowrap" style={{ fontSize: 'clamp(34px,5vw,52px)', letterSpacing: '-0.03em', color: headline.color ?? 'var(--ink)' }}>{headline.value}</p>
        {headline.sub && <p className="text-sm mt-2" style={{ color: 'var(--ink-muted)' }}>{headline.sub}</p>}
      </div>
      {secondary.length > 0 && (
        <div className="relative mt-5 pt-4 border-t flex flex-wrap gap-x-10 gap-y-3" style={{ borderColor: 'var(--outline)' }}>
          {secondary.map((s, i) => (
            <div key={i}>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{s.label}</p>
              <p className="num tabular font-semibold mt-0.5 text-[15px]" style={{ color: s.color ?? 'var(--ink)' }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}
    </section>
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
