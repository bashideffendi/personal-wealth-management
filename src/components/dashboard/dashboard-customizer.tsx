'use client'

/**
 * DashboardCustomizer — "Atur Dashboard" ala Monarch.
 *
 * Prinsip (belajar dari kejadian tab): DEFAULT SEMUA TAMPIL + urutan default.
 * User yang milih sembunyiin / geser urutan — gak ada yang ke-hide atau pindah
 * sepihak. Implementasi gak ngerombak JSX dashboard: tiap section cuma dikasih
 * `data-block="id"`. Sembunyiin = display:none; urutan = CSS `order` (wrapper
 * dashboard dibikin flex-column; section fixed gak punya order → tetap di atas).
 * Zero perubahan nesting = zero risiko regresi.
 *
 * Prefs di localStorage (instant render) + mirror ke DB (lintas-perangkat).
 */

import { useEffect, useRef, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Settings2, X, Eye, EyeOff, RotateCcw, GripVertical } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { loadUiPrefs, saveUiPref } from '@/lib/ui-prefs'

export interface DashBlock {
  id: string
  label: string
}

const LS_HIDDEN = 'pwm.dashboard.hidden'
const LS_ORDER = 'pwm.dashboard.order'

/** Section dashboard yang bisa di-toggle/diurutkan. id HARUS sama dgn data-block di page. */
export const DASHBOARD_BLOCKS: DashBlock[] = [
  { id: 'kpi', label: 'Ringkasan KPI (Pemasukan / Pengeluaran / dll)' },
  { id: 'ai-insights', label: 'Insight AI' },
  { id: 'aliran', label: 'Aliran Uang (Sankey)' },
  { id: 'aktivitas', label: 'Transaksi · Tagihan · Tujuan' },
  { id: 'kalender', label: 'Kalender Aktivitas & Progress Anggaran' },
  { id: 'grafik', label: 'Grafik (Kategori / Hari / Saving Rate)' },
  { id: 'insights', label: 'Insight & Peringatan' },
  { id: 'investasi', label: 'Grafik Bulanan & Alokasi Investasi' },
]

const DEFAULT_ORDER = DASHBOARD_BLOCKS.map((b) => b.id)
const BLOCK_LABEL: Record<string, string> = Object.fromEntries(
  DASHBOARD_BLOCKS.map((b) => [b.id, b.label]),
)

function readHidden(): string[] {
  try {
    const raw = localStorage.getItem(LS_HIDDEN)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

// Rekonsiliasi urutan tersimpan sama daftar block terkini: block baru nempel di
// belakang, block usang dibuang. Selalu balikin SEMUA id (gak ada yg ilang).
function reconcileOrder(saved: string[]): string[] {
  const valid = saved.filter((id) => DEFAULT_ORDER.includes(id))
  const missing = DEFAULT_ORDER.filter((id) => !valid.includes(id))
  return [...valid, ...missing]
}

function readOrder(): string[] {
  let saved: string[] = []
  try {
    const raw = localStorage.getItem(LS_ORDER)
    const arr = raw ? JSON.parse(raw) : []
    if (Array.isArray(arr)) saved = arr.filter((x) => typeof x === 'string')
  } catch {
    /* ignore */
  }
  return reconcileOrder(saved)
}

export function DashboardCustomizer() {
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState<string[]>(() =>
    typeof window === 'undefined' ? [] : readHidden(),
  )
  const [order, setOrder] = useState<string[]>(() =>
    typeof window === 'undefined' ? DEFAULT_ORDER : readOrder(),
  )
  const [ready, setReady] = useState(false)
  const touchedRef = useRef(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    setReady(true)
    // Hydrate dari DB (lintas-perangkat) — best-effort, override localStorage.
    void (async () => {
      if (touchedRef.current) return // user udah interaksi → jangan ketimpa DB
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const prefs = await loadUiPrefs(supabase, user.id)
      if (!prefs || touchedRef.current) return
      if (Array.isArray(prefs.dashboardHidden)) {
        setHidden(prefs.dashboardHidden)
        try { localStorage.setItem(LS_HIDDEN, JSON.stringify(prefs.dashboardHidden)) } catch { /* ignore */ }
      }
      if (Array.isArray(prefs.dashboardOrder)) {
        const reconciled = reconcileOrder(prefs.dashboardOrder)
        setOrder(reconciled)
        try { localStorage.setItem(LS_ORDER, JSON.stringify(reconciled)) } catch { /* ignore */ }
      }
    })()
  }, [])

  function persistHidden(next: string[]) {
    touchedRef.current = true
    setHidden(next)
    try { localStorage.setItem(LS_HIDDEN, JSON.stringify(next)) } catch { /* ignore */ }
    void (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await saveUiPref(supabase, user.id, { dashboardHidden: next })
    })()
  }

  function persistOrder(next: string[]) {
    touchedRef.current = true
    setOrder(next)
    try { localStorage.setItem(LS_ORDER, JSON.stringify(next)) } catch { /* ignore */ }
    void (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await saveUiPref(supabase, user.id, { dashboardOrder: next })
    })()
  }

  function toggle(id: string) {
    persistHidden(hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id])
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = order.indexOf(active.id as string)
    const newIndex = order.indexOf(over.id as string)
    if (oldIndex < 0 || newIndex < 0) return
    persistOrder(arrayMove(order, oldIndex, newIndex))
  }

  function resetAll() {
    persistHidden([])
    persistOrder(DEFAULT_ORDER)
  }

  const hiddenCount = hidden.length
  const reordered = order.join(',') !== DEFAULT_ORDER.join(',')
  const dirty = hiddenCount > 0 || reordered

  // Sembunyiin block + atur urutan. order:i+1 → semua data-block di BAWAH section
  // fixed (yg order:0). Cuma render setelah mount (ready) biar gak flash.
  const css = [
    ...hidden.map((id) => `[data-block="${id}"]{display:none!important}`),
    ...order.map((id, i) => `[data-block="${id}"]{order:${i + 1}}`),
  ].join('')

  return (
    <>
      {/* Wrapper kosong (komponen self-hide / null) → collapse. Selalu aktif. */}
      <style dangerouslySetInnerHTML={{ __html: '[data-block]:empty{display:none!important}' }} />
      {ready && css && <style dangerouslySetInnerHTML={{ __html: css }} />}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-outline inline-flex items-center gap-1.5"
        style={{ padding: '7px 12px', fontSize: 13 }}
      >
        <Settings2 className="size-4" />
        Atur
        {dirty && <span className="num" style={{ color: 'var(--text-mute)' }}>· disesuaikan</span>}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="s-card w-full max-w-md p-5 sm:p-6"
            style={{ maxHeight: '82vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-1">
              <div>
                <p className="eyebrow" style={{ color: 'var(--c-primary)' }}>Atur Dashboard</p>
                <h2 className="t-h2" style={{ color: 'var(--ink)' }}>Susun &amp; tampilkan</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Tutup">
                <X className="size-5" style={{ color: 'var(--text-mute)' }} />
              </button>
            </div>
            <p className="t-sm mb-4" style={{ color: 'var(--ink-soft)' }}>
              Tarik <GripVertical className="inline size-3.5 align-text-bottom" /> buat ngatur urutan, klik mata
              buat sembunyiin. Default: semua tampil &amp; urutan asli — kamu yang kontrol, gak ada yang berubah
              diam-diam. Tersimpan di perangkat ini.
            </p>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={order} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {order.map((id) => (
                    <SortableBlockRow
                      key={id}
                      id={id}
                      label={BLOCK_LABEL[id] ?? id}
                      on={!hidden.includes(id)}
                      onToggle={() => toggle(id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {dirty && (
              <button
                type="button"
                onClick={resetAll}
                className="mt-4 inline-flex items-center gap-1.5 t-sm font-medium"
                style={{ color: 'var(--c-primary)' }}
              >
                <RotateCcw className="size-3.5" /> Reset ke default
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function SortableBlockRow({
  id, label, on, onToggle,
}: {
  id: string
  label: string
  on: boolean
  onToggle: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    background: on ? 'var(--c-primary-soft)' : 'var(--surface-2)',
    border: '1px solid var(--line)',
  }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-lg px-2 py-2.5">
      <button
        type="button"
        className="cursor-grab touch-none active:cursor-grabbing shrink-0"
        aria-label="Tarik untuk mengurutkan"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" style={{ color: 'var(--text-mute)' }} />
      </button>
      <span className="t-sm flex-1 min-w-0" style={{ color: on ? 'var(--ink)' : 'var(--text-mute)' }}>
        {label}
      </span>
      <button type="button" onClick={onToggle} aria-label={on ? 'Sembunyikan' : 'Tampilkan'} className="shrink-0">
        {on
          ? <Eye className="size-4" style={{ color: 'var(--c-primary)' }} />
          : <EyeOff className="size-4" style={{ color: 'var(--text-mute)' }} />}
      </button>
    </div>
  )
}
