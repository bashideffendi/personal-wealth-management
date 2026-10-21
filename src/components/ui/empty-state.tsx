import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * EmptyState — keadaan kosong standar (docs/DESIGN_LANGUAGE.md): ikon garis
 * kecil di lingkaran netral, judul, satu kalimat, maksimal satu aksi.
 * Pakai ini, jangan render angka 0 palsu.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string }>
  title: string
  body?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      {Icon && (
        <span
          className="mb-3 grid size-11 place-items-center rounded-full"
          style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}
          aria-hidden
        >
          <Icon className="size-5" />
        </span>
      )}
      <p className="text-body font-semibold" style={{ color: 'var(--ink)' }}>{title}</p>
      {body && (
        <p className="mt-1 max-w-xs text-ui leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{body}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
