'use client'

/**
 * SortableSection — bungkus tiap card dashboard biar bisa di-DRAG (Monarch/bento).
 * Root bawa `data-block={id}` (hide-CSS dari DashboardCustomizer tetap nutup) +
 * `className` asli (col-span/row-span dipatok desain di page.tsx).
 *
 * BENTO: tiap card ngisi penuh sel grid-nya (items-stretch + h-full) — child
 * pertama (kartu s-card) dipaksa h-full/w-full biar gak ada ruang kosong di dalam.
 * `overflow` ngatur perilaku konten: chart fill, list scroll, atau fit.
 *
 * DRAG: gak ada transform in-place lagi (itu biang "kartu ngambang numpuk"). Pas
 * di-drag, sel-nya tetap di tempat tapi jadi dropzone dashed yg redup; visual yg
 * gerak = <DragOverlay> (di page.tsx) yg ngambang di atas semua lewat portal.
 *
 * Cuma grip handle (muncul pas hover, kanan-atas) yg narik.
 */

import type { CSSProperties, ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { GripVertical } from 'lucide-react'

export type CardOverflow = 'fill-chart' | 'scroll-list' | 'fit-static' | 'clip'

// Per-overflow: child pertama (kartu) jadi flex-col + overflow diatur. Body yg
// scroll/fill diurus di dalam masing-masing kartu (flex-1 min-h-0 overflow-y-auto).
const OVERFLOW_CLASS: Record<CardOverflow, string> = {
  'fill-chart': '[&>*:first-child]:flex [&>*:first-child]:flex-col [&>*:first-child]:overflow-hidden',
  'scroll-list': '[&>*:first-child]:flex [&>*:first-child]:flex-col [&>*:first-child]:overflow-hidden',
  'fit-static': '[&>*:first-child]:overflow-hidden',
  'clip': 'overflow-hidden',
}

export function SortableSection({
  id,
  order,
  className,
  overflow = 'fit-static',
  children,
}: {
  id: string
  order: string[]
  className?: string
  overflow?: CardOverflow
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id })
  const idx = order.indexOf(id)
  // NB: NO transform/transition — DragOverlay handles the moving visual; the
  // source must stay put (as a dashed placeholder) so layout tidak reflow.
  const style: CSSProperties = {
    order: idx >= 0 ? idx + 1 : undefined,
    position: 'relative',
    opacity: isDragging ? 0.4 : undefined,
  }
  return (
    <div
      ref={setNodeRef}
      data-block={id}
      className={`group relative flex h-full min-h-0 ${className ?? ''} [&>*:first-child]:h-full [&>*:first-child]:min-h-0 [&>*:first-child]:w-full ${OVERFLOW_CLASS[overflow]}`}
      style={style}
    >
      {children}
      {isDragging && (
        <div
          className="pointer-events-none absolute inset-0 z-10 rounded-2xl border-2 border-dashed"
          style={{ borderColor: 'var(--c-mint)', background: 'color-mix(in srgb, var(--surface-2) 55%, transparent)' }}
        />
      )}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Tarik untuk pindah posisi kartu"
        title="Tarik untuk pindah posisi"
        className="absolute top-2 right-2 z-20 grid size-7 place-items-center rounded-lg border opacity-100 lg:opacity-0 transition lg:group-hover:opacity-100 focus-visible:opacity-100 cursor-grab active:cursor-grabbing touch-none"
        style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--text-mute)' }}
      >
        <GripVertical className="size-4" />
      </button>
    </div>
  )
}
