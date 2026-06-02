'use client'

import { useEffect, useState } from 'react'
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
import {
  GripVertical,
  Plus,
  Trash2,
  ChevronRight,
  Check,
  Cloud,
  CloudOff,
  CornerDownRight,
  Eye,
  EyeOff,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  type CategoryTree,
  type CatNode,
  type BudgetType,
  newId,
  subKey,
  isEnabled,
  BUDGET_TYPES,
} from '@/lib/budget-categories'

const TYPE_META: Record<BudgetType, { label: string; accent: string }> = {
  income: { label: 'Pendapatan', accent: 'var(--c-mint)' },
  expense: { label: 'Pengeluaran', accent: 'var(--c-coral)' },
  saving: { label: 'Tabungan', accent: 'var(--c-amber)' },
  investment: { label: 'Investasi', accent: 'var(--c-violet)' },
}

export interface CategoryManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tree: CategoryTree
  dbSynced: boolean
  onCommit: (next: CategoryTree, renames?: { type: BudgetType; pairs: [string, string][] }) => void
}

export function CategoryManager({ open, onOpenChange, tree, dbSynced, onCommit }: CategoryManagerProps) {
  const [type, setType] = useState<BudgetType>('expense')
  const [draft, setDraft] = useState<CategoryTree>(tree)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null)
  const [newCat, setNewCat] = useState('')
  const [newSub, setNewSub] = useState<Record<string, string>>({})

  // Sync working copy from prop on open (avoids clobbering in-progress edits mid-session).
  useEffect(() => {
    if (open) setDraft(tree)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const meta = TYPE_META[type]
  const nodes = draft[type]

  function updateType(nextNodes: CatNode[], renames?: [string, string][]) {
    const next = { ...draft, [type]: nextNodes }
    setDraft(next)
    onCommit(next, renames ? { type, pairs: renames } : undefined)
  }

  function addCategory() {
    const name = newCat.trim()
    if (!name) return
    if (nodes.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`Kategori "${name}" sudah ada`)
      return
    }
    updateType([...nodes, { id: newId(), name, subs: [] }])
    setNewCat('')
  }

  function addSub(cat: CatNode) {
    const name = (newSub[cat.id] ?? '').trim()
    if (!name) return
    if (cat.subs.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`"${name}" sudah ada di ${cat.name}`)
      return
    }
    const next = nodes.map((c) =>
      c.id === cat.id ? { ...c, subs: [...c.subs, { id: newId(), name }] } : c,
    )
    updateType(next)
    setNewSub((p) => ({ ...p, [cat.id]: '' }))
    setExpanded((p) => ({ ...p, [cat.id]: true }))
  }

  function deleteCategory(cat: CatNode) {
    updateType(nodes.filter((c) => c.id !== cat.id))
  }

  function deleteSub(cat: CatNode, subId: string) {
    updateType(nodes.map((c) => (c.id === cat.id ? { ...c, subs: c.subs.filter((s) => s.id !== subId) } : c)))
  }

  function toggleEnabled(cat: CatNode) {
    const willEnable = !isEnabled(cat)
    // willEnable → buang flag (default aktif); nonaktif → simpan enabled:false.
    updateType(nodes.map((c) => (c.id === cat.id ? { ...c, enabled: willEnable ? undefined : false } : c)))
  }

  function commitRenameCategory(cat: CatNode, raw: string) {
    const next = raw.trim()
    setEditing(null)
    if (!next || next === cat.name) return
    if (nodes.some((c) => c.id !== cat.id && c.name.toLowerCase() === next.toLowerCase())) {
      toast.error(`Kategori "${next}" sudah ada`)
      return
    }
    const pairs: [string, string][] = [[cat.name, next]]
    for (const s of cat.subs) pairs.push([subKey(cat.name, s.name), subKey(next, s.name)])
    updateType(nodes.map((c) => (c.id === cat.id ? { ...c, name: next } : c)), pairs)
  }

  function commitRenameSub(cat: CatNode, subId: string, raw: string) {
    const next = raw.trim()
    setEditing(null)
    const sub = cat.subs.find((s) => s.id === subId)
    if (!sub || !next || next === sub.name) return
    if (cat.subs.some((s) => s.id !== subId && s.name.toLowerCase() === next.toLowerCase())) {
      toast.error(`"${next}" sudah ada di ${cat.name}`)
      return
    }
    const pairs: [string, string][] = [[subKey(cat.name, sub.name), subKey(cat.name, next)]]
    updateType(
      nodes.map((c) =>
        c.id === cat.id ? { ...c, subs: c.subs.map((s) => (s.id === subId ? { ...s, name: next } : s)) } : c,
      ),
      pairs,
    )
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const catIdx = nodes.findIndex((c) => c.id === active.id)
    if (catIdx !== -1) {
      const overIdx = nodes.findIndex((c) => c.id === over.id)
      if (overIdx === -1) return
      updateType(arrayMove(nodes, catIdx, overIdx))
      return
    }
    const parentIdx = nodes.findIndex((c) => c.subs.some((s) => s.id === active.id))
    if (parentIdx === -1) return
    const parent = nodes[parentIdx]
    const from = parent.subs.findIndex((s) => s.id === active.id)
    const to = parent.subs.findIndex((s) => s.id === over.id)
    if (to === -1) return
    const next = [...nodes]
    next[parentIdx] = { ...parent, subs: arrayMove(parent.subs, from, to) }
    updateType(next)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Kelola Kategori
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium"
              style={{
                background: dbSynced ? 'color-mix(in srgb, var(--c-mint) 14%, transparent)' : 'var(--surface-2)',
                color: dbSynced ? '#047857' : 'var(--ink-soft)',
              }}
              title={dbSynced ? 'Tersinkron ke semua device' : 'Tersimpan di device ini (apply migration 031 buat sync)'}
            >
              {dbSynced ? <Cloud className="size-3" /> : <CloudOff className="size-3" />}
              {dbSynced ? 'Tersinkron' : 'Lokal'}
            </span>
          </DialogTitle>
          <DialogDescription>
            Tambah, ubah nama, hapus, atau seret buat atur urutan. Kategori dengan subkategori jadi total
            otomatis di tabel anggaran.
          </DialogDescription>
        </DialogHeader>

        {/* Type tabs — segmented control */}
        <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--surface-2)' }}>
          {BUDGET_TYPES.map((t) => {
            const m = TYPE_META[t]
            const active = t === type
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className="flex-1 rounded-lg px-2 py-2 text-[13px] font-semibold transition-colors whitespace-nowrap"
                style={{
                  background: active ? m.accent : 'transparent',
                  color: active ? '#FFF' : 'var(--ink-muted)',
                }}
              >
                {m.label}
                <span className="ml-1.5 opacity-70 num text-[11px]">{draft[t].length}</span>
              </button>
            )
          })}
        </div>

        {/* Category list */}
        <div className="max-h-[62vh] min-h-[280px] overflow-y-auto pr-1 -mr-1">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={nodes.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {nodes.map((cat) => (
                  <SortableCategory
                    key={cat.id}
                    cat={cat}
                    accent={meta.accent}
                    enabled={isEnabled(cat)}
                    onToggleEnabled={() => toggleEnabled(cat)}
                    expanded={!!expanded[cat.id]}
                    editing={editing}
                    newSubValue={newSub[cat.id] ?? ''}
                    sensors={sensors}
                    onToggleExpand={() => setExpanded((p) => ({ ...p, [cat.id]: !p[cat.id] }))}
                    onStartEdit={(id, value) => setEditing({ id, value })}
                    onEditChange={(value) => setEditing((e) => (e ? { ...e, value } : e))}
                    onCommitCatName={(raw) => commitRenameCategory(cat, raw)}
                    onCommitSubName={(subId, raw) => commitRenameSub(cat, subId, raw)}
                    onCancelEdit={() => setEditing(null)}
                    onDeleteCat={() => deleteCategory(cat)}
                    onDeleteSub={(subId) => deleteSub(cat, subId)}
                    onNewSubChange={(v) => setNewSub((p) => ({ ...p, [cat.id]: v }))}
                    onAddSub={() => addSub(cat)}
                    onSubDragEnd={handleDragEnd}
                  />
                ))}
                {!nodes.length && (
                  <p className="py-6 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>
                    Belum ada kategori. Tambah di bawah.
                  </p>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Add category */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            addCategory()
          }}
          className="flex items-center gap-2 border-t pt-3"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder={`Tambah kategori ${meta.label.toLowerCase()}…`}
            className="h-10 flex-1 rounded-lg border px-3.5 text-sm outline-none transition-colors focus:border-[var(--ink)] focus:ring-2 focus:ring-[var(--ink)]/10"
            style={{ borderColor: 'var(--border-soft)', background: 'var(--surface)', color: 'var(--ink)' }}
          />
          <button
            type="submit"
            disabled={!newCat.trim()}
            className="inline-flex h-10 items-center gap-1 rounded-lg px-4 text-sm font-semibold text-white transition disabled:opacity-40"
            style={{ background: meta.accent }}
          >
            <Plus className="size-4" /> Tambah
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface SortableCategoryProps {
  cat: CatNode
  accent: string
  enabled: boolean
  onToggleEnabled: () => void
  expanded: boolean
  editing: { id: string; value: string } | null
  newSubValue: string
  sensors: ReturnType<typeof useSensors>
  onToggleExpand: () => void
  onStartEdit: (id: string, value: string) => void
  onEditChange: (value: string) => void
  onCommitCatName: (raw: string) => void
  onCommitSubName: (subId: string, raw: string) => void
  onCancelEdit: () => void
  onDeleteCat: () => void
  onDeleteSub: (subId: string) => void
  onNewSubChange: (v: string) => void
  onAddSub: () => void
  onSubDragEnd: (e: DragEndEvent) => void
}

function SortableCategory(props: SortableCategoryProps) {
  const { cat, accent, enabled, expanded, editing } = props
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 20 : undefined,
  }
  const isEditingCat = editing?.id === cat.id

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border"
    >
      <div
        className="flex items-center gap-2 px-3 py-2.5"
        style={{ background: 'var(--surface)', borderRadius: 12 }}
      >
        <button
          type="button"
          className="cursor-grab touch-none rounded p-1 text-[var(--ink-soft)] hover:bg-[var(--surface-2)] active:cursor-grabbing"
          aria-label="Seret"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>

        <button
          type="button"
          onClick={props.onToggleExpand}
          className="rounded p-0.5 text-[var(--ink-soft)] hover:bg-[var(--surface-2)]"
          aria-label={expanded ? 'Tutup' : 'Buka'}
        >
          <ChevronRight
            className="size-4 transition-transform"
            style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
          />
        </button>

        <span className="inline-block size-2 shrink-0 rounded-full" style={{ background: enabled ? accent : 'var(--ink-soft)', opacity: enabled ? 1 : 0.5 }} />

        {isEditingCat ? (
          <NameInput
            value={editing.value}
            onChange={props.onEditChange}
            onCommit={() => props.onCommitCatName(editing.value)}
            onCancel={props.onCancelEdit}
          />
        ) : (
          <button
            type="button"
            onClick={() => props.onStartEdit(cat.id, cat.name)}
            className="flex-1 truncate rounded px-1 py-0.5 text-left text-sm font-semibold hover:bg-[var(--surface-2)]"
            style={{ color: enabled ? 'var(--ink)' : 'var(--ink-soft)' }}
            title="Klik buat ubah nama"
          >
            {cat.name}
            {cat.subs.length > 0 && (
              <span className="ml-1.5 num text-[11px] font-medium" style={{ color: 'var(--ink-soft)' }}>
                {cat.subs.length} sub
              </span>
            )}
            {!enabled && (
              <span
                className="ml-1.5 rounded px-1 py-0.5 align-middle text-[9px] font-semibold uppercase tracking-wide"
                style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}
              >
                nonaktif
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={props.onToggleEnabled}
          className="rounded p-1 text-[var(--ink-soft)] transition hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
          aria-label={enabled ? `Nonaktifkan ${cat.name}` : `Aktifkan ${cat.name}`}
          title={enabled ? 'Nonaktifkan — sembunyikan dari tabel anggaran (data tetap disimpan)' : 'Aktifkan — tampilkan lagi di tabel'}
        >
          {enabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </button>

        <button
          type="button"
          onClick={props.onDeleteCat}
          className="rounded p-1 text-[var(--ink-soft)] transition hover:bg-[color:color-mix(in_srgb,var(--c-coral)_14%,transparent)] hover:text-[var(--c-coral)]"
          aria-label={`Hapus ${cat.name}`}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="px-2 pb-2 pl-8">
          <DndContext sensors={props.sensors} collisionDetection={closestCenter} onDragEnd={props.onSubDragEnd}>
            <SortableContext items={cat.subs.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-1">
                {cat.subs.map((sub) => (
                  <SortableSub
                    key={sub.id}
                    id={sub.id}
                    name={sub.name}
                    isEditing={editing?.id === sub.id}
                    editingValue={editing?.value ?? ''}
                    onStartEdit={() => props.onStartEdit(sub.id, sub.name)}
                    onEditChange={props.onEditChange}
                    onCommit={(raw) => props.onCommitSubName(sub.id, raw)}
                    onCancel={props.onCancelEdit}
                    onDelete={() => props.onDeleteSub(sub.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              props.onAddSub()
            }}
            className="mt-1.5 flex items-center gap-1.5"
          >
            <CornerDownRight className="size-3.5 shrink-0" style={{ color: 'var(--ink-soft)' }} />
            <input
              value={props.newSubValue}
              onChange={(e) => props.onNewSubChange(e.target.value)}
              placeholder="Tambah subkategori…"
              className="h-8 flex-1 rounded-md border px-2 text-[13px] outline-none focus:border-[var(--ink)]"
              style={{ borderColor: 'var(--border-soft)', background: 'var(--surface)', color: 'var(--ink)' }}
            />
            <button
              type="submit"
              disabled={!props.newSubValue.trim()}
              className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition disabled:opacity-40"
              style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}
            >
              <Plus className="size-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

interface SortableSubProps {
  id: string
  name: string
  isEditing: boolean
  editingValue: string
  onStartEdit: () => void
  onEditChange: (v: string) => void
  onCommit: (raw: string) => void
  onCancel: () => void
  onDelete: () => void
}

function SortableSub(props: SortableSubProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 20 : undefined,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1.5 rounded-lg px-1.5 py-1"
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-0.5 text-[var(--ink-soft)] hover:bg-[var(--surface-2)] active:cursor-grabbing"
        aria-label="Seret"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>
      {props.isEditing ? (
        <NameInput
          value={props.editingValue}
          onChange={props.onEditChange}
          onCommit={() => props.onCommit(props.editingValue)}
          onCancel={props.onCancel}
          small
        />
      ) : (
        <button
          type="button"
          onClick={props.onStartEdit}
          className="flex-1 truncate rounded px-1 py-0.5 text-left text-[13px] hover:bg-[var(--surface-2)]"
          style={{ color: 'var(--ink-muted)' }}
          title="Klik buat ubah nama"
        >
          {props.name}
        </button>
      )}
      <button
        type="button"
        onClick={props.onDelete}
        className="rounded p-1 text-[var(--ink-soft)] transition hover:text-[var(--c-coral)]"
        aria-label={`Hapus ${props.name}`}
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  )
}

function NameInput({
  value,
  onChange,
  onCommit,
  onCancel,
  small,
}: {
  value: string
  onChange: (v: string) => void
  onCommit: () => void
  onCancel: () => void
  small?: boolean
}) {
  return (
    <div className="flex flex-1 items-center gap-1">
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onCommit()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          }
        }}
        onBlur={onCommit}
        className={`flex-1 rounded-md border px-2 outline-none focus:border-[var(--ink)] ${small ? 'h-7 text-[13px]' : 'h-8 text-sm font-semibold'}`}
        style={{ borderColor: 'var(--ink)', background: 'var(--surface)', color: 'var(--ink)' }}
      />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onCommit}
        className="rounded p-1 text-[var(--c-mint)] hover:bg-[var(--surface-2)]"
        aria-label="Simpan"
      >
        <Check className="size-4" />
      </button>
    </div>
  )
}
