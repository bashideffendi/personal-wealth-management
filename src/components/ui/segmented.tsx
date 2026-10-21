'use client'

import { cn } from '@/lib/utils'

/**
 * Segmented — kontrol 2–4 pilihan (docs/DESIGN_LANGUAGE.md): wadah pill netral,
 * pilihan aktif terisi --c-primary (ikut mode gelap). Tinggi 44px (target sentuh HP).
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: readonly (readonly [T, string])[]
  ariaLabel: string
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn('inline-flex h-11 items-center rounded-full p-1', className)}
      style={{ background: 'var(--surface-2)' }}
    >
      {options.map(([v, label]) => {
        const active = v === value
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={active}
            className="h-full rounded-full px-4 text-ui font-semibold transition-colors"
            style={active
              ? { background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }
              : { color: 'var(--ink-muted)' }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
