'use client'

/**
 * Account Allocations Dialog
 *
 * Lets the user say "Rp X of this account's balance is reserved for Y."
 * Goals + Emergency Fund pages then sum these allocations across all
 * accounts to compute current_amount automatically.
 *
 * UX:
 *   - List of current allocations on this account
 *   - "Tambah alokasi" form: purpose dropdown → amount
 *   - Sum-vs-balance bar with warning if over-allocated
 *   - Save = upsert all in one batch (delete-and-reinsert is simpler than diff)
 */

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NumberInput } from '@/components/ui/number-input'
import { Loader2, Plus, Trash2, Shield, Target, PiggyBank, MoreHorizontal } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useT } from '@/lib/i18n/context'
import type { Account, AllocationPurpose } from '@/types'

interface Allocation {
  id?: string  // undefined for new rows that haven't been saved yet
  purpose_kind: AllocationPurpose
  emergency_fund_id: string | null
  goal_id: string | null
  custom_label: string
  amount: number
  notes: string
}

interface Goal {
  id: string
  name: string
}

interface EmergencyFund {
  id: string
}

interface Props {
  open: boolean
  onClose: () => void
  account: Account | null
  onSaved: () => void
}

const PURPOSE_LABELS: Record<AllocationPurpose, string> = {
  emergency_fund: 'Dana Darurat',
  goal:           'Goal / Tujuan',
  sinking_fund:   'Sinking Fund',
  other:          'Lainnya',
}

const PURPOSE_ICONS: Record<AllocationPurpose, React.ComponentType<{ className?: string }>> = {
  emergency_fund: Shield,
  goal:           Target,
  sinking_fund:   PiggyBank,
  other:          MoreHorizontal,
}

export function AccountAllocationsDialog({ open, onClose, account, onSaved }: Props) {
  const t = useT()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [emergencyFund, setEmergencyFund] = useState<EmergencyFund | null>(null)

  useEffect(() => {
    if (!open || !account) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, account?.id])

  async function load() {
    if (!account) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [allocRes, goalsRes, efRes] = await Promise.all([
      supabase
        .from('account_allocations')
        .select('id, purpose_kind, emergency_fund_id, goal_id, custom_label, amount, notes')
        .eq('account_id', account.id),
      supabase
        .from('goals')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('emergency_funds')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    setAllocations(((allocRes.data ?? []) as Allocation[]).map((a) => ({
      ...a,
      notes: a.notes ?? '',
      custom_label: a.custom_label ?? '',
    })))
    setGoals((goalsRes.data ?? []) as Goal[])
    setEmergencyFund((efRes.data as EmergencyFund | null) ?? null)
    setLoading(false)
  }

  const totalAllocated = useMemo(
    () => allocations.reduce((s, a) => s + (a.amount || 0), 0),
    [allocations],
  )
  const balance = account?.current_balance ?? 0
  const free = balance - totalAllocated
  const overAllocated = totalAllocated > balance

  function addAllocation() {
    setAllocations((prev) => [
      ...prev,
      {
        purpose_kind: 'sinking_fund',
        emergency_fund_id: null,
        goal_id: null,
        custom_label: '',
        amount: 0,
        notes: '',
      },
    ])
  }

  function updateAllocation(idx: number, patch: Partial<Allocation>) {
    setAllocations((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)))
  }

  function removeAllocation(idx: number) {
    setAllocations((prev) => prev.filter((_, i) => i !== idx))
  }

  function handlePurposeChange(idx: number, kind: AllocationPurpose) {
    // Reset incompatible FKs when kind changes
    updateAllocation(idx, {
      purpose_kind: kind,
      emergency_fund_id: kind === 'emergency_fund' ? emergencyFund?.id ?? null : null,
      goal_id: kind === 'goal' ? (goals[0]?.id ?? null) : null,
      custom_label: kind === 'sinking_fund' || kind === 'other' ? '' : '',
    })
  }

  async function handleSave() {
    if (!account) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    // Validate: each allocation must have a target
    for (const a of allocations) {
      if (a.amount <= 0) continue // ignore empty rows
      if (a.purpose_kind === 'emergency_fund' && !a.emergency_fund_id) {
        alert(t('allocations.alert_setup_ef'))
        setSaving(false)
        return
      }
      if (a.purpose_kind === 'goal' && !a.goal_id) {
        alert(t('allocations.alert_pick_goal'))
        setSaving(false)
        return
      }
      if ((a.purpose_kind === 'sinking_fund' || a.purpose_kind === 'other') && !a.custom_label.trim()) {
        alert(t('allocations.alert_label_required'))
        setSaving(false)
        return
      }
    }

    // Strategy: delete all existing for this account, reinsert all current.
    // Simpler than computing diffs and the volume is tiny (< 10 rows).
    const { error: delErr } = await supabase
      .from('account_allocations')
      .delete()
      .eq('account_id', account.id)
    if (delErr) {
      alert(`${t('allocations.alert_delete_failed')}: ${delErr.message}`)
      setSaving(false)
      return
    }

    const toInsert = allocations
      .filter((a) => a.amount > 0)
      .map((a) => ({
        user_id: user.id,
        account_id: account.id,
        purpose_kind: a.purpose_kind,
        emergency_fund_id: a.emergency_fund_id,
        goal_id: a.goal_id,
        custom_label: a.custom_label,
        amount: a.amount,
        notes: a.notes,
      }))

    if (toInsert.length > 0) {
      const { error } = await supabase.from('account_allocations').insert(toInsert)
      if (error) {
        alert(`${t('allocations.alert_save_failed')}: ${error.message}`)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('allocations.title')} · {account?.name ?? t('allocations.account_fallback')}</DialogTitle>
          <DialogDescription>
            {t('allocations.description')}
          </DialogDescription>
        </DialogHeader>

        {/* Balance summary */}
        <div
          className="rounded-lg border p-4"
          style={{
            boxShadow: 'var(--card-shadow)', background: overAllocated ? 'rgba(239,68,68,0.06)' : 'var(--surface-2)',
            borderColor: overAllocated ? 'rgba(239,68,68,0.30)' : 'var(--border-soft)',
          }}
        >
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                {t('allocations.account_balance')}
              </p>
              <p className="num tabular text-xl font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
                {formatCurrency(balance)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                {overAllocated ? t('allocations.over_allocated_label') : t('allocations.free_label')}
              </p>
              <p
                className="num tabular text-xl font-semibold mt-0.5"
                style={{ color: overAllocated ? 'var(--c-coral)' : 'var(--c-mint)' }}
              >
                {overAllocated ? '−' : ''}{formatCurrency(Math.abs(free))}
              </p>
            </div>
          </div>
          {/* Allocation bar */}
          {balance > 0 && (
            <div className="mt-3 flex quest-track" style={{ ['--bar-h' as string]: '9px' }}>
              <div
                className="h-full"
                style={{
                  width: `${Math.min(100, (totalAllocated / balance) * 100)}%`,
                  background: overAllocated
                    ? 'linear-gradient(90deg, var(--c-amber), var(--c-coral))'
                    : 'var(--c-primary)',
                }}
              />
            </div>
          )}
          {overAllocated && (
            <p className="text-[11px] mt-2" style={{ color: 'var(--c-coral)' }}>
              {t('allocations.over_allocated_warning')}
            </p>
          )}
        </div>

        {/* Allocations list */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin" style={{ color: 'var(--ink-soft)' }} />
          </div>
        ) : (
          <div className="space-y-2">
            {allocations.length === 0 && (
              <p className="text-sm text-center py-8" style={{ color: 'var(--ink-soft)' }}>
                {t('allocations.empty')}
              </p>
            )}
            {allocations.map((a, idx) => {
              const Icon = PURPOSE_ICONS[a.purpose_kind]
              return (
                <div
                  key={idx}
                  className="rounded-lg border p-3 space-y-2"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)' }}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="size-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px]">{t('allocations.purpose')}</Label>
                        <Select
                          value={a.purpose_kind}
                          onValueChange={(v) => v && handlePurposeChange(idx, v as AllocationPurpose)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue>{(v) => PURPOSE_LABELS[v as AllocationPurpose] ?? t('allocations.select')}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="emergency_fund">{t('allocations.purpose_emergency_fund')}</SelectItem>
                            <SelectItem value="goal">{t('allocations.purpose_goal')}</SelectItem>
                            <SelectItem value="sinking_fund">{t('allocations.purpose_sinking_fund')}</SelectItem>
                            <SelectItem value="other">{t('allocations.purpose_other')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Conditional second field based on purpose */}
                      {a.purpose_kind === 'goal' && (
                        <div>
                          <Label className="text-[11px]">{t('allocations.goal')}</Label>
                          {goals.length === 0 ? (
                            <p className="text-[11px] mt-1.5" style={{ color: 'var(--ink-soft)' }}>
                              {t('allocations.no_active_goals')}
                            </p>
                          ) : (
                            <Select
                              value={a.goal_id ?? ''}
                              onValueChange={(v) => updateAllocation(idx, { goal_id: v ?? null })}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder={t('allocations.pick_goal')}>
                                  {(v) => goals.find((g) => g.id === v)?.name ?? t('allocations.pick_goal')}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {goals.map((g) => (
                                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}

                      {a.purpose_kind === 'emergency_fund' && (
                        <div>
                          <Label className="text-[11px]">{t('allocations.status')}</Label>
                          {emergencyFund ? (
                            <p className="text-[12px] mt-1.5 font-medium" style={{ color: 'var(--c-mint)' }}>
                              ✓ {t('allocations.connected')}
                            </p>
                          ) : (
                            <p className="text-[11px] mt-1.5" style={{ color: 'var(--ink-soft)' }}>
                              {t('allocations.setup_ef_hint')}
                            </p>
                          )}
                        </div>
                      )}

                      {(a.purpose_kind === 'sinking_fund' || a.purpose_kind === 'other') && (
                        <div>
                          <Label className="text-[11px]">{t('allocations.label')}</Label>
                          <Input
                            value={a.custom_label}
                            onChange={(e) => updateAllocation(idx, { custom_label: e.target.value })}
                            placeholder={t('allocations.label_placeholder')}
                            className="h-8 text-sm"
                          />
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => removeAllocation(idx)}
                      className="size-8 rounded-md flex items-center justify-center transition hover:bg-[rgba(239,68,68,0.10)]"
                      style={{ color: 'var(--ink-soft)' }}
                      aria-label={t('allocations.remove')}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  <div>
                    <Label className="text-[11px]">{t('allocations.amount')}</Label>
                    <NumberInput
                      value={a.amount}
                      onChange={(n) => updateAllocation(idx, { amount: n })}
                      placeholder="0"
                      className="h-8"
                    />
                  </div>
                </div>
              )
            })}

            <Button
              variant="outline"
              onClick={addAllocation}
              className="w-full"
            >
              <Plus className="size-4 mr-1" />
              {t('allocations.add')}
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('allocations.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
            {t('allocations.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
