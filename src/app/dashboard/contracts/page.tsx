'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Contract, ContractCategory, ContractFrequency } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Plus, Pencil, Trash2, Loader2, Archive, ArchiveRestore,
  Shield, Clock, Landmark, Package, KeyRound, FileText,
  AlertTriangle, CalendarClock, type LucideIcon,
} from 'lucide-react'

const CAT: Record<ContractCategory, { label: string; icon: LucideIcon; accent: string }> = {
  insurance:    { label: 'Asuransi',     icon: Shield,    accent: 'var(--c-mint)' },
  subscription: { label: 'Langganan',    icon: Clock,     accent: 'var(--c-mint)' },
  loan:         { label: 'Kredit/KPR',   icon: Landmark,  accent: 'var(--c-amber)' },
  warranty:     { label: 'Garansi',      icon: Package,   accent: 'var(--c-mint)' },
  lease:        { label: 'Sewa',         icon: KeyRound,  accent: 'var(--c-mint)' },
  other:        { label: 'Lainnya',      icon: FileText,  accent: 'var(--surface-3)' },
}

const FREQ: Record<ContractFrequency, string> = {
  monthly:   'Bulanan',
  quarterly: 'Triwulan',
  yearly:    'Tahunan',
  one_time:  'Sekali Bayar',
}

interface FormState {
  id: string | null
  name: string
  category: ContractCategory
  provider: string
  policy_number: string
  start_date: string
  end_date: string
  cost: number | null
  frequency: ContractFrequency | ''
  auto_renew: boolean
  reminder_days_before: number
  notes: string
}

const EMPTY: FormState = {
  id: null, name: '', category: 'insurance', provider: '', policy_number: '',
  start_date: '', end_date: '', cost: null, frequency: 'yearly',
  auto_renew: false, reminder_days_before: 30, notes: '',
}

type Status = 'overdue' | 'expiring' | 'upcoming' | 'archived'

function getStatus(c: Contract, today: Date): Status {
  if (c.is_archived) return 'archived'
  const days = daysUntil(c.end_date, today)
  if (days < 0) return 'overdue'
  if (days <= c.reminder_days_before) return 'expiring'
  return 'upcoming'
}

function daysUntil(isoDate: string, today: Date): number {
  const end = new Date(isoDate)
  end.setHours(0, 0, 0, 0)
  const t = new Date(today)
  t.setHours(0, 0, 0, 0)
  return Math.round((end.getTime() - t.getTime()) / 86_400_000)
}

export default function ContractsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Contract[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const today = useMemo(() => new Date(), [])

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('contracts')
      .select('*')
      .eq('user_id', user.id)
      .order('end_date', { ascending: true })
    setItems((data ?? []) as Contract[])
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
      provider: form.provider,
      policy_number: form.policy_number,
      start_date: form.start_date || null,
      end_date: form.end_date,
      cost: form.cost,
      frequency: form.frequency || null,
      auto_renew: form.auto_renew,
      reminder_days_before: form.reminder_days_before,
      notes: form.notes,
    }
    if (form.id) await supabase.from('contracts').update(payload).eq('id', form.id)
    else await supabase.from('contracts').insert(payload)
    setSaving(false)
    setDialogOpen(false)
    void load()
  }

  async function remove(id: string) {
    if (!confirm('Hapus kontrak ini? Tidak bisa dikembalikan.')) return
    await supabase.from('contracts').delete().eq('id', id)
    void load()
  }

  async function toggleArchive(c: Contract) {
    await supabase.from('contracts').update({ is_archived: !c.is_archived }).eq('id', c.id)
    void load()
  }

  const grouped = useMemo(() => {
    const out: Record<Status, Contract[]> = {
      overdue: [], expiring: [], upcoming: [], archived: [],
    }
    for (const c of items) out[getStatus(c, today)].push(c)
    return out
  }, [items, today])

  const summary = useMemo(() => {
    const active = items.filter((c) => !c.is_archived)
    const monthlyCost = active.reduce((s, c) => {
      if (!c.cost || !c.frequency) return s
      switch (c.frequency) {
        case 'monthly':   return s + c.cost
        case 'quarterly': return s + c.cost / 3
        case 'yearly':    return s + c.cost / 12
        case 'one_time':  return s
      }
    }, 0)
    return {
      total: active.length,
      overdue: grouped.overdue.length,
      expiring: grouped.expiring.length,
      monthlyCost: Math.round(monthlyCost),
    }
  }, [items, grouped])

  return (
    <div className="space-y-6">
      <section
        className="relative overflow-hidden rounded-3xl"
        style={{
          background: 'linear-gradient(135deg, #0A0A0F 0%, #14141A 50%, #1C1C24 100%)',
          color: '#F5F5F7',
          boxShadow: '0 24px 60px -20px rgba(0,0,0,0.40)',
        }}
      >
        <div
          className="absolute pointer-events-none"
          style={{
            top: -100, right: -60, width: 360, height: 360,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.05), transparent 65%)',
          }}
        />
        <div className="relative p-6 sm:p-7">
        <p
          className="text-[11px] font-semibold tracking-[0.18em] uppercase"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          Langganan & Kontrak
        </p>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="num tabular font-bold" style={{ fontSize: 36, color: '#FFFFFF', letterSpacing: '-0.04em' }}>
              {summary.total}
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>Kontrak aktif</p>
          </div>
          <div>
            <p className="num tabular font-bold" style={{ fontSize: 36, color: summary.overdue > 0 ? '#FDA4AF' : '#FFFFFF', letterSpacing: '-0.04em' }}>
              {summary.overdue}
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>Lewat jatuh tempo</p>
          </div>
          <div>
            <p className="num tabular font-bold" style={{ fontSize: 36, color: summary.expiring > 0 ? '#FCD34D' : '#FFFFFF', letterSpacing: '-0.04em' }}>
              {summary.expiring}
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>Segera jatuh tempo</p>
          </div>
          <div>
            <p className="num tabular font-bold" style={{ fontSize: 26, color: '#FFFFFF', letterSpacing: '-0.04em' }}>
              {formatCurrency(summary.monthlyCost)}
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>Beban/bulan rata²</p>
          </div>
        </div>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          Pantau tanggal habis kontrak asuransi, langganan, KPR, garansi, dll.
        </p>
        <Button onClick={() => { setForm({ ...EMPTY }); setDialogOpen(true) }}>
          <Plus className="h-4 w-4" /> Tambah Kontrak
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="s-card p-12 text-center">
          <CalendarClock className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--ink-soft)' }} />
          <p className="font-semibold">Belum ada kontrak</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>
            Tambahkan polis asuransi, langganan, atau kontrak lainnya untuk dipantau.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          <StatusSection
            status="overdue"
            title="Lewat Jatuh Tempo"
            note="Perlu perhatian segera"
            icon={AlertTriangle}
            accent="var(--danger)"
            items={grouped.overdue}
            today={today}
            onEdit={openEdit}
            onRemove={remove}
            onToggleArchive={toggleArchive}
          />
          <StatusSection
            status="expiring"
            title="Segera Jatuh Tempo"
            note="Dalam rentang pengingat"
            icon={Clock}
            accent="var(--c-amber)"
            items={grouped.expiring}
            today={today}
            onEdit={openEdit}
            onRemove={remove}
            onToggleArchive={toggleArchive}
          />
          <StatusSection
            status="upcoming"
            title="Aktif"
            note="Masih jauh dari jatuh tempo"
            icon={CalendarClock}
            accent="var(--c-mint)"
            items={grouped.upcoming}
            today={today}
            onEdit={openEdit}
            onRemove={remove}
            onToggleArchive={toggleArchive}
          />
          <StatusSection
            status="archived"
            title="Arsip"
            note="Tidak dipantau"
            icon={Archive}
            accent="var(--surface-3)"
            items={grouped.archived}
            today={today}
            onEdit={openEdit}
            onRemove={remove}
            onToggleArchive={toggleArchive}
          />
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit Kontrak' : 'Tambah Kontrak'}</DialogTitle>
            <DialogDescription>Catat kontrak yang perlu dipantau jatuh temponya.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Nama Kontrak</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Asuransi Mobil Allianz, Netflix, KPR BCA..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Kategori</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => v && setForm({ ...form, category: v as ContractCategory })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kategori">
                      {(v) => CAT[v as ContractCategory]?.label ?? 'Pilih kategori'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CAT) as ContractCategory[]).map((k) => (
                      <SelectItem key={k} value={k}>{CAT[k].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Provider</Label>
                <Input
                  value={form.provider}
                  onChange={(e) => setForm({ ...form, provider: e.target.value })}
                  placeholder="Allianz, Netflix, BCA..."
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>No. Polis / Nomor Referensi</Label>
              <Input
                value={form.policy_number}
                onChange={(e) => setForm({ ...form, policy_number: e.target.value })}
                placeholder="Opsional"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Tanggal Mulai</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Tanggal Jatuh Tempo *</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Biaya</Label>
                <NumberInput
                  value={form.cost ?? 0}
                  onChange={(n) => setForm({ ...form, cost: n || null })}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Frekuensi</Label>
                <Select
                  value={form.frequency || ''}
                  onValueChange={(v) => setForm({ ...form, frequency: (v || '') as ContractFrequency | '' })}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FREQ) as ContractFrequency[]).map((k) => (
                      <SelectItem key={k} value={k}>{FREQ[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Ingatkan (hari sebelumnya)</Label>
                <Input
                  type="number"
                  value={form.reminder_days_before}
                  onChange={(e) => setForm({ ...form, reminder_days_before: Math.max(1, Number(e.target.value) || 1) })}
                  min={1}
                  max={365}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Auto-perpanjang</Label>
                <div className="flex items-center h-9 gap-2">
                  <input
                    id="auto_renew"
                    type="checkbox"
                    checked={form.auto_renew}
                    onChange={(e) => setForm({ ...form, auto_renew: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <label htmlFor="auto_renew" className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                    Ya, diperpanjang otomatis
                  </label>
                </div>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Catatan</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Detail tambahan (opsional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving || !form.name || !form.end_date}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.id ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )

  function openEdit(c: Contract) {
    setForm({
      id: c.id,
      name: c.name,
      category: c.category,
      provider: c.provider,
      policy_number: c.policy_number,
      start_date: c.start_date ?? '',
      end_date: c.end_date,
      cost: c.cost,
      frequency: c.frequency ?? '',
      auto_renew: c.auto_renew,
      reminder_days_before: c.reminder_days_before,
      notes: c.notes,
    })
    setDialogOpen(true)
  }
}

interface SectionProps {
  status: Status
  title: string
  note: string
  icon: LucideIcon
  accent: string
  items: Contract[]
  today: Date
  onEdit: (c: Contract) => void
  onRemove: (id: string) => void
  onToggleArchive: (c: Contract) => void
}

function StatusSection({
  status, title, note, icon: Icon, accent, items, today,
  onEdit, onRemove, onToggleArchive,
}: SectionProps) {
  if (items.length === 0) return null
  const totalCost = items.reduce((s, c) => s + (c.cost ?? 0), 0)
  return (
    <section>
      <div className="relative mb-5">
        <div
          className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2"
          style={{ background: 'var(--border)' }}
          aria-hidden
        />
        <div
          className="relative flex items-center justify-between gap-3 pl-1 pr-4 py-1"
        >
          <div className="flex items-center gap-3 pr-4" style={{ background: 'var(--bg)' }}>
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
              style={{ background: accent, color: 'var(--ink)' }}
            >
              <Icon className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
                {title}
              </h3>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                {note}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0 pl-4" style={{ background: 'var(--bg)' }}>
            <p className="num text-base font-semibold tabular leading-tight" style={{ color: 'var(--ink)' }}>
              {items.length} kontrak
            </p>
            {totalCost > 0 && (
              <p className="text-[11px] mt-0.5 num" style={{ color: 'var(--ink-soft)' }}>
                {formatCurrency(totalCost)} total
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <ContractCard
            key={c.id}
            contract={c}
            status={status}
            today={today}
            onEdit={onEdit}
            onRemove={onRemove}
            onToggleArchive={onToggleArchive}
          />
        ))}
      </div>
    </section>
  )
}

interface CardProps {
  contract: Contract
  status: Status
  today: Date
  onEdit: (c: Contract) => void
  onRemove: (id: string) => void
  onToggleArchive: (c: Contract) => void
}

function ContractCard({ contract: c, status, today, onEdit, onRemove, onToggleArchive }: CardProps) {
  const cat = CAT[c.category]
  const Icon = cat.icon
  const days = daysUntil(c.end_date, today)

  const statusBadge = (() => {
    if (status === 'overdue') {
      return { text: `${Math.abs(days)} hari lewat`, bg: '#FBE5E1', color: 'var(--danger)' }
    }
    if (status === 'expiring') {
      return { text: days === 0 ? 'Hari ini' : `${days} hari lagi`, bg: 'var(--c-amber)', color: 'var(--c-amber)' }
    }
    if (status === 'upcoming') {
      return { text: `${days} hari lagi`, bg: 'var(--c-mint)', color: 'var(--c-mint)' }
    }
    return { text: 'Diarsip', bg: 'var(--surface-2)', color: 'var(--ink-muted)' }
  })()

  return (
    <div
      className={`group relative overflow-hidden rounded-lg bg-[var(--surface)] border border-[var(--border-soft)] hover:border-[var(--ink)] transition-colors ${c.is_archived ? 'opacity-60' : ''}`}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0 mt-0.5"
              style={{ background: cat.accent, color: 'var(--ink)' }}
            >
              <Icon className="h-4 w-4" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate" style={{ color: 'var(--ink)' }}>{c.name}</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                {cat.label}{c.provider && ` · ${c.provider}`}
              </p>
            </div>
          </div>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
            <Button variant="ghost" size="icon-sm" onClick={() => onEdit(c)} title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => onToggleArchive(c)} title={c.is_archived ? 'Keluarkan dari arsip' : 'Arsipkan'}>
              {c.is_archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => onRemove(c.id)} title="Hapus">
              <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} />
            </Button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>Jatuh Tempo</p>
            <p className="num text-sm font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
              {formatDate(c.end_date)}
            </p>
          </div>
          <Badge
            className="rounded-sm px-1.5 py-0.5 border-0 font-semibold text-[11px]"
            style={{ background: statusBadge.bg, color: statusBadge.color }}
          >
            {statusBadge.text}
          </Badge>
        </div>

        {c.cost != null && c.cost > 0 && (
          <div
            className="mt-3 pt-3 flex items-center justify-between text-[11px] border-t"
            style={{ borderColor: 'var(--border-soft)', color: 'var(--ink-muted)' }}
          >
            <span>
              {c.frequency ? FREQ[c.frequency] : 'Biaya'}
              {c.auto_renew && ' · auto'}
            </span>
            <span className="num font-semibold" style={{ color: 'var(--ink)' }}>
              {formatCurrency(c.cost)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
