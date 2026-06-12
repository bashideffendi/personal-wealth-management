'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useCategoryOptions } from '@/lib/use-category-options'
import type { CategorizationRule } from '@/types'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/page-header'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil, Trash2, Loader2, Sparkles } from 'lucide-react'
import { useT } from '@/lib/i18n/context'

type TxType = 'income' | 'expense' | 'saving' | 'investment'

interface FormState {
  id: string | null
  match_text: string
  type: TxType
  category: string
  priority: number
}
const EMPTY: FormState = {
  id: null, match_text: '', type: 'expense', category: 'Makanan', priority: 1,
}

export default function RulesPage() {
  const supabase = createClient()
  const t = useT()
  const { optionsForType, firstOf } = useCategoryOptions()
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  const TYPE_LABEL: Record<string, string> = {
    expense: t('rules.type_expense'), income: t('rules.type_income'),
    saving: t('rules.type_saving'), investment: t('rules.type_investment'),
  }

  const pageQuery = useQuery({
    queryKey: ['rules'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('unauthenticated')
      const { data, error } = await supabase
        .from('categorization_rules')
        .select('*')
        .eq('user_id', user.id)
        .order('priority', { ascending: false })
      if (error) throw error
      return (data ?? []) as CategorizationRule[]
    },
  })
  const loading = pageQuery.isLoading
  const rules = pageQuery.data ?? []
  const refresh = () => qc.invalidateQueries({ queryKey: ['rules'] })

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const payload = {
      user_id: user.id,
      match_text: form.match_text.trim().toUpperCase(),
      type: form.type,
      category: form.category,
      priority: form.priority,
      is_active: true,
    }
    const { error } = form.id
      ? await supabase.from('categorization_rules').update(payload).eq('id', form.id)
      : await supabase.from('categorization_rules').insert(payload)
    setSaving(false)
    if (error) { toast.error(t('common.mutation_failed')); return }
    setDialogOpen(false)
    refresh()
  }

  async function remove(id: string) {
    if (!confirm(t('rules.confirm_delete'))) return
    const { error } = await supabase.from('categorization_rules').delete().eq('id', id)
    if (error) { toast.error(t('common.delete_failed')); return }
    refresh()
  }

  async function toggle(r: CategorizationRule) {
    const { error } = await supabase.from('categorization_rules').update({ is_active: !r.is_active }).eq('id', r.id)
    if (error) { toast.error(t('common.mutation_failed')); return }
    refresh()
  }

  function openEdit(r: CategorizationRule) {
    setForm({ id: r.id, match_text: r.match_text, type: r.type as TxType, category: r.category, priority: r.priority ?? 1 })
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('rules.eyebrow')}
        title={t('rules.page_title')}
        subtitle={t('rules.page_subtitle')}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {rules.filter((r) => r.is_active).length} {t('rules.active_count')} · {t('rules.total_count')} {rules.length}
        </p>
        <Button onClick={() => { setForm(EMPTY); setDialogOpen(true) }}>
          <Plus className="h-4 w-4" /> {t('rules.add_rule')}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : pageQuery.isError ? (
        <div className="s-card flex flex-col items-center text-center py-14 px-8 gap-3">
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>{t('common.load_failed')}</p>
          <Button variant="outline" onClick={() => pageQuery.refetch()}>{t('common.retry')}</Button>
        </div>
      ) : rules.length === 0 ? (
        <div className="s-card p-12 text-center">
          <Sparkles className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--ink-soft)' }} />
          <p className="font-semibold">{t('rules.empty_title')}</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>
            {t('rules.empty_body')}
          </p>
        </div>
      ) : (
        <div className="s-card overflow-hidden">
          <div className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
            {rules.map((r) => (
              <div key={r.id} className="flex items-center gap-4 px-5 py-3" style={{ opacity: r.is_active ? 1 : 0.4 }}>
                <input
                  type="checkbox"
                  checked={r.is_active}
                  onChange={() => toggle(r)}
                  className="h-4 w-4"
                  style={{ accentColor: 'var(--c-mint)' }}
                />
                <div className="flex-1 flex items-center gap-2 min-w-0 flex-wrap">
                  <span className="num text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>
                    &ldquo;{r.match_text}&rdquo;
                  </span>
                  <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>→</span>
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}>
                    {TYPE_LABEL[r.type] ?? r.type}
                  </span>
                  <span className="text-xs font-semibold">{r.category}</span>
                  {r.priority > 1 && (
                    <span className="text-[10px] px-1.5 rounded font-semibold" style={{ background: 'color-mix(in srgb, var(--c-mint) 14%, transparent)', color: 'var(--c-mint-ink)' }}>
                      P{r.priority}
                    </span>
                  )}
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => openEdit(r)} title={t('rules.edit_rule')} aria-label={t('rules.edit_rule')}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => remove(r.id)} title={t('rules.delete_rule')} aria-label={t('rules.delete_rule')}>
                  <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? t('rules.dialog_title_edit') : t('rules.dialog_title')}</DialogTitle>
            <DialogDescription>
              {t('rules.dialog_description')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>{t('rules.label_match_text')}</Label>
              <Input
                value={form.match_text}
                onChange={(e) => setForm({ ...form, match_text: e.target.value })}
                placeholder="GRAB, INDOMARET, NETFLIX..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t('rules.label_type')}</Label>
                <Select value={form.type} onValueChange={(v) => v && setForm({ ...form, type: v as TxType, category: firstOf(v as TxType) })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('rules.type_placeholder')}>
                      {(v) => ({
                        expense: t('rules.type_expense'),
                        income: t('rules.type_income'),
                        saving: t('rules.type_saving'),
                        investment: t('rules.type_investment'),
                      } as Record<string, string>)[v] ?? t('rules.type_placeholder')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">{t('rules.type_expense')}</SelectItem>
                    <SelectItem value="income">{t('rules.type_income')}</SelectItem>
                    <SelectItem value="saving">{t('rules.type_saving')}</SelectItem>
                    <SelectItem value="investment">{t('rules.type_investment')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>{t('rules.label_category')}</Label>
                <Select value={form.category} onValueChange={(v) => v && setForm({ ...form, category: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('rules.category_placeholder')}>
                      {(v) => v || t('rules.category_placeholder')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {optionsForType(form.type).map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.depth > 0 ? (
                          <span className="pl-3.5" style={{ color: 'var(--ink-muted)' }}>↳ {o.label}</span>
                        ) : (
                          o.label
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>{t('rules.label_priority')}</Label>
              <Input type="number" min={1} max={10} value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 1 })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('rules.cancel')}</Button>
            <Button onClick={save} disabled={saving || !form.match_text.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('rules.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
