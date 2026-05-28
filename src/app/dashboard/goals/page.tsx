'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import type { Goal } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil, Trash2, Loader2, TrendingUp } from 'lucide-react'
import { EduTip } from '@/components/edu/edu-tip'
import { GoalPyramid, GoalLayerBadge } from '@/components/goals/goal-pyramid'
import { GoalProbabilityMeter } from '@/components/goals/goal-probability-meter'

const GOAL_CATEGORIES: Record<string, string> = {
  property: 'Properti',
  vehicle: 'Kendaraan',
  travel: 'Liburan',
  education: 'Pendidikan',
  gadget: 'Gadget',
  wedding: 'Pernikahan',
  emergency: 'Darurat',
  retirement: 'Pensiun',
  business: 'Bisnis',
  other: 'Lainnya',
}

interface FormState {
  id: string | null
  name: string
  category: string
  target_amount: number
  current_amount: number
  deadline: string
  notes: string
}
const EMPTY: FormState = {
  id: null, name: '', category: 'other',
  target_amount: 0, current_amount: 0, deadline: '', notes: '',
}

export default function GoalsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [goals, setGoals] = useState<Goal[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('goals').select('*').eq('user_id', user.id).order('deadline', { ascending: true })
    setGoals((data ?? []) as Goal[])
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const payload = {
      user_id: user.id,
      name: form.name,
      category: form.category,
      target_amount: form.target_amount,
      current_amount: form.current_amount,
      deadline: form.deadline || null,
      notes: form.notes,
      is_active: true,
    }
    if (form.id) await supabase.from('goals').update(payload).eq('id', form.id)
    else await supabase.from('goals').insert(payload)
    setSaving(false)
    setDialogOpen(false)
    void load()
  }

  async function remove(id: string) {
    if (!confirm('Hapus goal ini?')) return
    await supabase.from('goals').delete().eq('id', id)
    void load()
  }

  function openEdit(g: Goal) {
    setForm({
      id: g.id, name: g.name, category: g.category,
      target_amount: g.target_amount, current_amount: g.current_amount,
      deadline: g.deadline ?? '', notes: g.notes,
    })
    setDialogOpen(true)
  }

  const totals = useMemo(() => {
    const target = goals.reduce((s, g) => s + g.target_amount, 0)
    const current = goals.reduce((s, g) => s + g.current_amount, 0)
    return { target, current, pct: target > 0 ? (current / target) * 100 : 0 }
  }, [goals])

  function monthsUntil(deadline: string | null): number | null {
    if (!deadline) return null
    const d = new Date(deadline)
    const now = new Date()
    return (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth())
  }

  return (
    <div className="space-y-6">
      <div className="kl-card p-6 sm:p-9">
        <p className="kl-eyebrow">Tujuan Keuangan</p>
        <p
          className="kl-display kl-num mt-3"
          style={{
            color: 'var(--ink)',
            fontSize: 'clamp(40px, 6vw, 64px)',
            lineHeight: 1,
          }}
        >
          {formatCurrency(totals.current)}
        </p>
        <p className="text-sm mt-3" style={{ color: 'var(--text-mute)' }}>
          dari target{' '}
          <span className="kl-num font-semibold" style={{ color: 'var(--ink)' }}>
            {formatCurrency(totals.target)}
          </span>
          {' · '}
          <span className="kl-num" style={{ color: 'var(--c-mint)', fontWeight: 700 }}>
            {totals.pct.toFixed(1)}%
          </span>
          {' tercapai · '}{goals.length} goal
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm flex items-center gap-1.5" style={{ color: 'var(--ink-muted)' }}>
          Set target, pantau progres, dan lihat berapa per bulan yang perlu ditabung.
          <EduTip topic="mental-accounting" side="bottom" />
        </p>
        <Button onClick={() => { setForm(EMPTY); setDialogOpen(true) }}>
          <Plus className="h-4 w-4" /> Tambah Goal
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : goals.length === 0 ? (
        // Empty state — clean centered card with icon + headline + sub
        <div className="kl-card flex flex-col items-center text-center py-16 px-8">
          <div
            className="size-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'var(--c-primary-soft)' }}
          >
            <TrendingUp className="size-7" style={{ color: 'var(--c-primary)' }} />
          </div>
          <h3 className="text-2xl font-semibold tracking-tight mb-2" style={{ color: 'var(--ink)' }}>
            Belum ada tujuan
          </h3>
          <p className="text-sm max-w-xs" style={{ color: 'var(--ink-muted)' }}>
            Liburan? Beli rumah? Apapun, kita bantu sampai kesana.
          </p>
        </div>
      ) : (
        <>
          {/* BPT pyramid view — group goals by risk/horizon layer */}
          <GoalPyramid goals={goals.filter((g) => g.is_active)} />

        <div className="grid gap-3 sm:grid-cols-2">
          {goals.map((g) => {
            const pct = g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0
            const remaining = Math.max(0, g.target_amount - g.current_amount)
            const months = monthsUntil(g.deadline)
            const perMonth = months && months > 0 ? Math.ceil(remaining / months) : null
            const done = pct >= 100
            return (
              <div
                key={g.id}
                className="group rounded-xl p-5 bg-white border border-[var(--border-soft)] hover:border-[var(--ink)] transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold" style={{ color: 'var(--ink)' }}>{g.name}</p>
                      <GoalLayerBadge category={g.category} />
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                      {GOAL_CATEGORIES[g.category] ?? g.category}
                      {g.deadline && ` · deadline ${new Date(g.deadline).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}`}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(g)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => remove(g.id)}>
                      <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between">
                  <p className="num text-2xl tabular font-semibold" style={{ color: 'var(--ink)' }}>
                    {formatCurrency(g.current_amount)}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                    / <span className="num">{formatCurrency(g.target_amount)}</span>
                  </p>
                </div>

                <div className="mt-2">
                  <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        background: done ? 'var(--lime-400)' : 'var(--ink)',
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] mt-1.5">
                    <span className="num" style={{ color: done ? 'var(--lime-700)' : 'var(--ink-muted)' }}>
                      {pct.toFixed(1)}% {done ? '(Tercapai 🎯)' : 'tercapai'}
                    </span>
                    {perMonth !== null && !done && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
                        style={{ background: 'var(--lime-100)', color: 'var(--lime-700)' }}
                      >
                        <TrendingUp className="h-2.5 w-2.5" />
                        Tabung <span className="num">{formatCurrency(perMonth)}</span>/bln
                      </span>
                    )}
                  </div>
                </div>

                {/* Goal probability meter — Monte Carlo of hitting target by deadline */}
                {g.deadline && g.target_amount > 0 && !done && (
                  <GoalProbabilityMeter
                    current={g.current_amount}
                    target={g.target_amount}
                    deadline={g.deadline}
                    category={g.category}
                  />
                )}

                {g.notes && (
                  <p className="mt-3 pt-3 border-t text-[11px]" style={{ color: 'var(--ink-soft)', borderColor: 'var(--border-soft)' }}>
                    {g.notes}
                  </p>
                )}
              </div>
            )
          })}
        </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit Goal' : 'Tambah Goal'}</DialogTitle>
            <DialogDescription>Set target keuangan dengan deadline opsional.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Nama Goal</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="DP Rumah, Liburan Bali..." />
            </div>
            <div className="grid gap-1.5">
              <Label>Kategori</Label>
              <Select value={form.category} onValueChange={(v) => v && setForm({ ...form, category: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori">
                    {(v) => GOAL_CATEGORIES[v] ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(GOAL_CATEGORIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Target (Rp)</Label>
                <NumberInput value={form.target_amount} onChange={(n) => setForm({ ...form, target_amount: n })} placeholder="0" />
              </div>
              <div className="grid gap-1.5">
                <Label>Terkumpul (Rp)</Label>
                <NumberInput value={form.current_amount} onChange={(n) => setForm({ ...form, current_amount: n })} placeholder="0" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Deadline (opsional)</Label>
              <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Catatan</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving || !form.name}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.id ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
