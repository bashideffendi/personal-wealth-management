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
  type CatTarget,
  type BudgetType,
  newId,
  subKey,
  isEnabled,
  BUDGET_TYPES,
} from '@/lib/budget-categories'
import { CategoryIcon, CATEGORY_COLORS, CATEGORY_ICON_CHOICES } from '@/components/transactions/category-icon'
import { useT } from '@/lib/i18n/context'

const TYPE_META: Record<BudgetType, { labelKey: string; accent: string }> = {
  income: { labelKey: 'type_income', accent: 'var(--c-mint)' },
  expense: { labelKey: 'type_expense', accent: 'var(--c-coral)' },
  saving: { labelKey: 'type_saving', accent: 'var(--c-amber)' },
  investment: { labelKey: 'type_investment', accent: 'var(--c-violet)' },
}

interface PendingDelete {
  label: string
  count: number
  oldKeys: string[]
  targets: { key: string; label: string }[]
  nextNodes: CatNode[]
}

export interface CategoryManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tree: CategoryTree
  dbSynced: boolean
  /** Jumlah transaksi per kategori, key `${type}::${category}`. Buat badge + reassign. */
  usage?: Record<string, number>
  onCommit: (next: CategoryTree, renames?: { type: BudgetType; pairs: [string, string][] }) => void
}

export function CategoryManager({ open, onOpenChange, tree, dbSynced, usage = {}, onCommit }: CategoryManagerProps) {
  const t = useT()
  const [type, setType] = useState<BudgetType>('expense')
  const [draft, setDraft] = useState<CategoryTree>(tree)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null)
  const [newCat, setNewCat] = useState('')
  const [newSub, setNewSub] = useState<Record<string, string>>({})
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [appearanceId, setAppearanceId] = useState<string | null>(null)

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

  // Berapa transaksi pakai kategori/subkategori ini (buat badge + warning hapus).
  const subUsage = (cat: CatNode, subName: string) => usage[`${type}::${subKey(cat.name, subName)}`] ?? 0
  const catUsage = (cat: CatNode) =>
    (usage[`${type}::${cat.name}`] ?? 0) + cat.subs.reduce((n, s) => n + subUsage(cat, s.name), 0)

  function updateType(nextNodes: CatNode[], renames?: [string, string][]) {
    const next = { ...draft, [type]: nextNodes }
    setDraft(next)
    onCommit(next, renames ? { type, pairs: renames } : undefined)
  }

  function addCategory() {
    const name = newCat.trim()
    if (!name) return
    if (nodes.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`${t('category_manager.cat_prefix')} "${name}" ${t('category_manager.already_exists')}`)
      return
    }
    updateType([...nodes, { id: newId(), name, subs: [] }])
    setNewCat('')
  }

  function addSub(cat: CatNode) {
    const name = (newSub[cat.id] ?? '').trim()
    if (!name) return
    if (cat.subs.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`"${name}" ${t('category_manager.already_exists_in')} ${cat.name}`)
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
    const nextNodes = nodes.filter((c) => c.id !== cat.id)
    const count = catUsage(cat)
    if (count === 0) {
      updateType(nextNodes) // gak ada transaksi → hapus langsung
      return
    }
    // Masih kepake → tawarin pindahin transaksinya dulu (anti data-yatim).
    const oldKeys = [cat.name, ...cat.subs.map((s) => subKey(cat.name, s.name))]
    const targets = nodes.filter((c) => c.id !== cat.id).map((c) => ({ key: c.name, label: c.name }))
    setPendingDelete({ label: cat.name, count, oldKeys, targets, nextNodes })
  }

  function deleteSub(cat: CatNode, subId: string) {
    const sub = cat.subs.find((s) => s.id === subId)
    if (!sub) return
    const nextNodes = nodes.map((c) =>
      c.id === cat.id ? { ...c, subs: c.subs.filter((s) => s.id !== subId) } : c,
    )
    const count = subUsage(cat, sub.name)
    if (count === 0) {
      updateType(nextNodes)
      return
    }
    const oldKeys = [subKey(cat.name, sub.name)]
    const targets = [
      { key: cat.name, label: `${cat.name} · induk` },
      ...cat.subs
        .filter((s) => s.id !== subId)
        .map((s) => ({ key: subKey(cat.name, s.name), label: `${cat.name} › ${s.name}` })),
      ...nodes.filter((c) => c.id !== cat.id).map((c) => ({ key: c.name, label: c.name })),
    ]
    setPendingDelete({ label: `${cat.name} › ${sub.name}`, count, oldKeys, targets, nextNodes })
  }

  function confirmDelete(targetKey: string | null) {
    if (!pendingDelete) return
    const pairs: [string, string][] | undefined = targetKey
      ? pendingDelete.oldKeys.map((k) => [k, targetKey] as [string, string])
      : undefined
    updateType(pendingDelete.nextNodes, pairs)
    if (targetKey) {
      const tgt = pendingDelete.targets.find((t) => t.key === targetKey)
      toast.success(`${pendingDelete.count} ${t('category_manager.tx_moved_to')} ${tgt?.label ?? targetKey}`)
    }
    setPendingDelete(null)
  }

  function toggleEnabled(cat: CatNode) {
    const willEnable = !isEnabled(cat)
    // willEnable → buang flag (default aktif); nonaktif → simpan enabled:false.
    updateType(nodes.map((c) => (c.id === cat.id ? { ...c, enabled: willEnable ? undefined : false } : c)))
  }

  function setAppearance(
    catId: string,
    patch: { color?: string; icon?: string; target?: CatTarget; clearColor?: boolean; clearIcon?: boolean; clearTarget?: boolean },
  ) {
    updateType(
      nodes.map((c) => {
        if (c.id !== catId) return c
        const next: CatNode = { ...c }
        if (patch.clearColor) delete next.color
        else if (patch.color) next.color = patch.color
        if (patch.clearIcon) delete next.icon
        else if (patch.icon) next.icon = patch.icon
        if (patch.clearTarget) delete next.target
        else if (patch.target) next.target = patch.target
        return next
      }),
    )
  }

  function commitRenameCategory(cat: CatNode, raw: string) {
    const next = raw.trim()
    setEditing(null)
    if (!next || next === cat.name) return
    if (nodes.some((c) => c.id !== cat.id && c.name.toLowerCase() === next.toLowerCase())) {
      toast.error(`${t('category_manager.cat_prefix')} "${next}" ${t('category_manager.already_exists')}`)
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
      toast.error(`"${next}" ${t('category_manager.already_exists_in')} ${cat.name}`)
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
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('category_manager.title')}
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium"
              style={{
                background: dbSynced ? 'color-mix(in srgb, var(--c-mint) 14%, transparent)' : 'var(--surface-2)',
                color: dbSynced ? 'var(--c-mint-ink)' : 'var(--ink-soft)',
              }}
              title={dbSynced ? t('category_manager.synced_tooltip') : t('category_manager.local_tooltip')}
            >
              {dbSynced ? <Cloud className="size-3" /> : <CloudOff className="size-3" />}
              {dbSynced ? t('category_manager.synced') : t('category_manager.local')}
            </span>
          </DialogTitle>
          <DialogDescription>
            {t('category_manager.description')}
          </DialogDescription>
        </DialogHeader>

        {/* Type tabs — segmented control */}
        <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--surface-2)' }}>
          {BUDGET_TYPES.map((bt) => {
            const m = TYPE_META[bt]
            const active = bt === type
            return (
              <button
                key={bt}
                type="button"
                onClick={() => setType(bt)}
                className="flex-1 rounded-lg px-2 py-2 text-[13px] font-semibold transition-colors whitespace-nowrap"
                style={{
                  background: active ? m.accent : 'transparent',
                  color: active ? '#FFF' : 'var(--ink-muted)',
                }}
              >
                {t(`category_manager.${m.labelKey}`)}
                <span className="ml-1.5 opacity-70 num text-[11px]">{draft[bt].length}</span>
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
                    count={catUsage(cat)}
                    subCounts={Object.fromEntries(cat.subs.map((s) => [s.id, subUsage(cat, s.name)]))}
                    enabled={isEnabled(cat)}
                    onToggleEnabled={() => toggleEnabled(cat)}
                    onOpenAppearance={() => setAppearanceId(cat.id)}
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
                    {t('category_manager.empty')}
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
            placeholder={`${t('category_manager.add_cat_placeholder')} ${t(`category_manager.${meta.labelKey}`).toLowerCase()}…`}
            className="h-10 flex-1 rounded-lg border px-3.5 text-sm outline-none transition-colors focus:border-[var(--ink)] focus:ring-2 focus:ring-[var(--ink)]/10"
            style={{ borderColor: 'var(--border-soft)', background: 'var(--surface)', color: 'var(--ink)' }}
          />
          <button
            type="submit"
            disabled={!newCat.trim()}
            className="inline-flex h-10 items-center gap-1 rounded-lg px-4 text-sm font-semibold text-white transition disabled:opacity-40"
            style={{ background: meta.accent }}
          >
            <Plus className="size-4" /> {t('category_manager.add')}
          </button>
        </form>
      </DialogContent>
    </Dialog>

    <ReassignDialog
      pending={pendingDelete}
      accent={meta.accent}
      onCancel={() => setPendingDelete(null)}
      onConfirm={confirmDelete}
    />

    <AppearanceDialog
      cat={nodes.find((c) => c.id === appearanceId) ?? null}
      accent={meta.accent}
      onPick={(patch) => appearanceId && setAppearance(appearanceId, patch)}
      onClose={() => setAppearanceId(null)}
    />
    </>
  )
}

function AppearanceDialog({
  cat,
  accent,
  onPick,
  onClose,
}: {
  cat: CatNode | null
  accent: string
  onPick: (patch: { color?: string; icon?: string; target?: CatTarget; clearColor?: boolean; clearIcon?: boolean; clearTarget?: boolean }) => void
  onClose: () => void
}) {
  const t = useT()
  const [tMode, setTMode] = useState<CatTarget['mode'] | 'none'>('none')
  const [tAmount, setTAmount] = useState('')
  const [tBy, setTBy] = useState('')
  const [tPercent, setTPercent] = useState('')
  useEffect(() => {
    const tg = cat?.target
    setTMode(tg?.mode ?? 'none')
    setTAmount(tg && (tg.mode === 'fixed' || tg.mode === 'byDate') ? String(tg.amount) : '')
    setTBy(tg && tg.mode === 'byDate' ? tg.by : '')
    setTPercent(tg && tg.mode === 'percentIncome' ? String(tg.percent) : '')
  }, [cat])
  if (!cat) return null
  const activeColor = cat.color ?? accent
  const isLeaf = cat.subs.length === 0
  function saveTarget() {
    if (tMode === 'none') return onPick({ clearTarget: true })
    const amount = Math.round(Number(tAmount.replace(/[^0-9]/g, '')) || 0)
    if (tMode === 'fixed') return onPick(amount > 0 ? { target: { mode: 'fixed', amount } } : { clearTarget: true })
    if (tMode === 'average') return onPick({ target: { mode: 'average', months: 3 } })
    if (tMode === 'percentIncome') {
      const percent = Number(tPercent) || 0
      return onPick(percent > 0 ? { target: { mode: 'percentIncome', percent } } : { clearTarget: true })
    }
    if (tMode === 'byDate') return onPick(amount > 0 && tBy ? { target: { mode: 'byDate', amount, by: tBy } } : { clearTarget: true })
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o) { saveTarget(); onClose() } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div
              className="grid size-10 shrink-0 place-items-center rounded-xl"
              style={{ background: `color-mix(in srgb, ${activeColor} 14%, transparent)`, color: activeColor }}
            >
              <CategoryIcon category={cat.name} iconKey={cat.icon} className="size-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg" style={{ fontFamily: 'var(--font-display)' }}>
                {t('category_manager.appearance_title')} “{cat.name}”
              </DialogTitle>
              <DialogDescription>{t('category_manager.appearance_desc')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-xs font-medium" style={{ color: 'var(--ink-muted)' }}>
            {t('category_manager.color')}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORY_COLORS.map((hex) => {
              const sel = cat.color === hex
              return (
                <button
                  key={hex}
                  type="button"
                  onClick={() => onPick({ color: hex })}
                  className="grid size-7 place-items-center rounded-full transition hover:scale-105"
                  style={{ background: hex, outline: sel ? `2px solid ${hex}` : 'none', outlineOffset: 2 }}
                  aria-label={`${t('category_manager.color')} ${hex}`}
                >
                  {sel && <Check className="size-3.5 text-white" />}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => onPick({ clearColor: true })}
              className="rounded-lg px-2.5 py-1 text-xs font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}
            >
              {t('category_manager.default')}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium" style={{ color: 'var(--ink-muted)' }}>
            {t('category_manager.icon')}
          </p>
          <div className="grid grid-cols-8 gap-1.5">
            {CATEGORY_ICON_CHOICES.map(({ key, Icon }) => {
              const sel = cat.icon === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onPick({ icon: key })}
                  className="grid aspect-square place-items-center rounded-lg border transition"
                  style={{
                    borderColor: sel ? activeColor : 'var(--border-soft)',
                    background: sel ? `color-mix(in srgb, ${activeColor} 12%, transparent)` : 'var(--surface)',
                    color: sel ? activeColor : 'var(--ink-muted)',
                  }}
                  aria-label={key}
                >
                  <Icon className="size-4" />
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => onPick({ clearIcon: true })}
            className="text-xs font-medium underline-offset-2 hover:underline"
            style={{ color: 'var(--ink-soft)' }}
          >
            {t('category_manager.use_auto_icon')}
          </button>
        </div>

        {/* Target anggaran — leaf only (kategori tanpa subkategori) */}
        <div className="space-y-2">
          <p className="text-xs font-medium" style={{ color: 'var(--ink-muted)' }}>{t('category_manager.budget_target')}</p>
          {isLeaf ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {([
                  ['none', t('category_manager.target_none')],
                  ['fixed', t('category_manager.target_fixed')],
                  ['byDate', t('category_manager.target_by_date')],
                  ['percentIncome', t('category_manager.target_percent_income')],
                  ['average', t('category_manager.target_average')],
                ] as const).map(([m, label]) => {
                  const sel = tMode === m
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setTMode(m)}
                      className="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors"
                      style={{ background: sel ? activeColor : 'var(--surface-2)', color: sel ? '#fff' : 'var(--ink-muted)' }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              {(tMode === 'fixed' || tMode === 'byDate') && (
                <input
                  inputMode="numeric"
                  value={tAmount}
                  onChange={(e) => setTAmount(e.target.value)}
                  placeholder={tMode === 'byDate' ? t('category_manager.target_total_placeholder') : t('category_manager.target_monthly_placeholder')}
                  className="h-9 w-full rounded-lg border px-3 text-sm outline-none focus:border-[var(--ink)]"
                  style={{ borderColor: 'var(--border-soft)', background: 'var(--surface)', color: 'var(--ink)' }}
                />
              )}
              {tMode === 'byDate' && (
                <input
                  type="month"
                  value={tBy}
                  onChange={(e) => setTBy(e.target.value)}
                  className="h-9 w-full rounded-lg border px-3 text-sm outline-none focus:border-[var(--ink)]"
                  style={{ borderColor: 'var(--border-soft)', background: 'var(--surface)', color: 'var(--ink)' }}
                />
              )}
              {tMode === 'percentIncome' && (
                <input
                  inputMode="numeric"
                  value={tPercent}
                  onChange={(e) => setTPercent(e.target.value)}
                  placeholder={t('category_manager.target_percent_placeholder')}
                  className="h-9 w-full rounded-lg border px-3 text-sm outline-none focus:border-[var(--ink)]"
                  style={{ borderColor: 'var(--border-soft)', background: 'var(--surface)', color: 'var(--ink)' }}
                />
              )}
              <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                {t('category_manager.target_hint')}
              </p>
            </>
          ) : (
            <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
              {t('category_manager.target_subcat_note')}
            </p>
          )}
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => { saveTarget(); onClose() }}
            className="h-9 rounded-lg px-4 text-sm font-semibold text-white"
            style={{ background: activeColor }}
          >
            {t('category_manager.done')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ReassignDialog({
  pending,
  accent,
  onCancel,
  onConfirm,
}: {
  pending: PendingDelete | null
  accent: string
  onCancel: () => void
  onConfirm: (targetKey: string | null) => void
}) {
  const t = useT()
  const [target, setTarget] = useState<string>('')
  useEffect(() => {
    setTarget(pending?.targets[0]?.key ?? '')
  }, [pending])
  if (!pending) return null
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div
              className="grid size-10 shrink-0 place-items-center rounded-xl"
              style={{ background: 'color-mix(in srgb, var(--c-coral) 12%, transparent)' }}
            >
              <Trash2 className="size-5" style={{ color: 'var(--c-coral-ink)' }} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg" style={{ fontFamily: 'var(--font-display)' }}>
                {t('category_manager.delete_title')} “{pending.label}”?
              </DialogTitle>
              <DialogDescription>
                {t('category_manager.delete_desc_prefix')} <strong className="num" style={{ color: 'var(--ink)' }}>{pending.count}</strong>{' '}
                {t('category_manager.delete_desc_suffix')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {pending.targets.length > 0 ? (
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--ink-muted)' }}>
              {t('category_manager.move_tx_to')}
            </label>
            <div
              className="max-h-[38vh] overflow-y-auto rounded-xl border"
              style={{ borderColor: 'var(--border-soft)' }}
            >
              {pending.targets.map((tg) => {
                const sel = target === tg.key
                return (
                  <button
                    key={tg.key}
                    type="button"
                    onClick={() => setTarget(tg.key)}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors"
                    style={{ background: sel ? 'var(--surface-2)' : 'transparent', color: 'var(--ink)' }}
                  >
                    <span
                      className="grid size-4 shrink-0 place-items-center rounded-full border"
                      style={{ borderColor: sel ? accent : 'var(--border-soft)' }}
                    >
                      {sel && <span className="size-2 rounded-full" style={{ background: accent }} />}
                    </span>
                    <span className="truncate">{tg.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            {t('category_manager.no_targets_prefix')}
            “{pending.label}”{t('category_manager.no_targets_suffix')}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => onConfirm(null)}
            className="text-xs font-medium underline-offset-2 hover:underline"
            style={{ color: 'var(--ink-soft)' }}
          >
            {t('category_manager.delete_without_move')}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-9 rounded-lg px-3 text-sm font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}
            >
              {t('category_manager.cancel')}
            </button>
            <button
              type="button"
              disabled={!target}
              onClick={() => onConfirm(target)}
              className="h-9 rounded-lg px-4 text-sm font-semibold text-white transition disabled:opacity-40"
              style={{ background: accent }}
            >
              {t('category_manager.move_and_delete')}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface SortableCategoryProps {
  cat: CatNode
  accent: string
  count: number
  subCounts: Record<string, number>
  enabled: boolean
  onToggleEnabled: () => void
  onOpenAppearance: () => void
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
  const t = useT()
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
          aria-label={t('category_manager.drag')}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>

        <button
          type="button"
          onClick={props.onToggleExpand}
          className="rounded p-0.5 text-[var(--ink-soft)] hover:bg-[var(--surface-2)]"
          aria-label={expanded ? t('category_manager.collapse') : t('category_manager.expand')}
        >
          <ChevronRight
            className="size-4 transition-transform"
            style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
          />
        </button>

        {(() => {
          const dotColor = enabled ? cat.color ?? accent : 'var(--ink-soft)'
          return (
            <button
              type="button"
              onClick={props.onOpenAppearance}
              className="grid size-6 shrink-0 place-items-center rounded-lg transition hover:opacity-80"
              style={{
                background: `color-mix(in srgb, ${dotColor} 14%, transparent)`,
                color: dotColor,
                opacity: enabled ? 1 : 0.55,
              }}
              title={t('category_manager.set_color_icon')}
            >
              {cat.icon ? (
                <CategoryIcon category={cat.name} iconKey={cat.icon} className="size-3.5" />
              ) : (
                <span className="size-2 rounded-full" style={{ background: dotColor }} />
              )}
            </button>
          )
        })()}

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
            title={t('category_manager.click_to_rename')}
          >
            {cat.name}
            {cat.subs.length > 0 && (
              <span className="ml-1.5 num text-[11px] font-medium" style={{ color: 'var(--ink-soft)' }}>
                {cat.subs.length} {t('category_manager.sub')}
              </span>
            )}
            {props.count > 0 && (
              <span
                className="ml-1.5 num text-[11px] font-medium"
                style={{ color: 'var(--ink-soft)' }}
                title={`${props.count} ${t('category_manager.tx_using_cat')}`}
              >
                · {props.count} {t('category_manager.tx')}
              </span>
            )}
            {!enabled && (
              <span
                className="ml-1.5 rounded px-1 py-0.5 align-middle text-[9px] font-semibold uppercase tracking-wide"
                style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}
              >
                {t('category_manager.inactive')}
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={props.onToggleEnabled}
          className="rounded p-1 text-[var(--ink-soft)] transition hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
          aria-label={enabled ? `${t('category_manager.disable')} ${cat.name}` : `${t('category_manager.enable')} ${cat.name}`}
          title={enabled ? t('category_manager.disable_tooltip') : t('category_manager.enable_tooltip')}
        >
          {enabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </button>

        <button
          type="button"
          onClick={props.onDeleteCat}
          className="rounded p-1 text-[var(--ink-soft)] transition hover:bg-[color:color-mix(in_srgb,var(--c-coral)_14%,transparent)] hover:text-[var(--c-coral-ink)]"
          aria-label={`${t('category_manager.delete')} ${cat.name}`}
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
                    count={props.subCounts[sub.id] ?? 0}
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
              placeholder={t('category_manager.add_sub_placeholder')}
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
  count: number
  isEditing: boolean
  editingValue: string
  onStartEdit: () => void
  onEditChange: (v: string) => void
  onCommit: (raw: string) => void
  onCancel: () => void
  onDelete: () => void
}

function SortableSub(props: SortableSubProps) {
  const t = useT()
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
        aria-label={t('category_manager.drag')}
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
          title={t('category_manager.click_to_rename')}
        >
          {props.name}
          {props.count > 0 && (
            <span className="ml-1.5 num text-[10.5px]" style={{ color: 'var(--ink-soft)' }}>
              · {props.count} {t('category_manager.tx')}
            </span>
          )}
        </button>
      )}
      <button
        type="button"
        onClick={props.onDelete}
        className="rounded p-1 text-[var(--ink-soft)] transition hover:text-[var(--c-coral-ink)]"
        aria-label={`${t('category_manager.delete')} ${props.name}`}
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
  const t = useT()
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
        className="rounded p-1 text-[var(--c-mint-ink)] hover:bg-[var(--surface-2)]"
        aria-label={t('category_manager.save')}
      >
        <Check className="size-4" />
      </button>
    </div>
  )
}
