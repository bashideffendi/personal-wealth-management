'use client'

/**
 * SortableSection — bungkus tiap section dashboard biar bisa di-DRAG langsung
 * di tempat (Monarch-style). Root-nya bawa `data-block={id}` (jadi hide-CSS dari
 * DashboardCustomizer tetap nutup section ini) + `className` asli section.
 *
 * Urutan visual via CSS `order` (index di array `order`) — section fixed (tanpa
 * data-block) gak punya order → tetap 0 di atas. Karena visual order == array
 * `order` == SortableContext items, dnd-kit ngitung posisi dari rect yg bener
 * (gak ada mismatch DOM-vs-visual).
 *
 * Cuma grip handle (muncul pas hover, pojok kanan-atas) yg narik — klik di mana
 * pun di kartu (tombol/link) tetap normal.
 */

import type { CSSProperties, ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

export function SortableSection({
  id,
  order,
  className,
  children,
}: {
  id: string
  order: string[]
  className?: string
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const idx = order.indexOf(id)
  const style: CSSProperties = {
    order: idx >= 0 ? idx + 1 : undefined,
    transform: CSS.Transform.toString(transform),
    transition,
    position: 'relative',
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.85 : undefined,
  }
  return (
    <div ref={setNodeRef} data-block={id} className={`group ${className ?? ''}`} style={style}>
      {children}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Tarik untuk pindah posisi section"
        title="Tarik untuk pindah posisi"
        className="absolute top-2 right-2 z-20 grid size-7 place-items-center rounded-lg border opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 cursor-grab active:cursor-grabbing touch-none"
        style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--text-mute)' }}
      >
        <GripVertical className="size-4" />
      </button>
    </div>
  )
}
