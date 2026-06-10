'use client'

import { useEffect, useMemo, useState } from 'react'
import { useT } from '@/lib/i18n/context'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import type { Contract, ContractCategory, ContractFrequency } from '@/types'
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
import {
  Plus, Pencil, Trash2, Loader2, Archive, ArchiveRestore, Search, Check,
  Shield, Landmark, Briefcase, Building2, KeyRound, Clock, Package, FileText,
  ShieldCheck, RefreshCw, CalendarClock, type LucideIcon,
} from 'lucide-react'

const MINT = '#10B981', AMBER = '#F59E0B', VIOLET = '#8B5CF6', CORAL = '#F43F5E', INDIGO = '#6366F1', SKY = '#0EA5E9'

const CAT: Record<ContractCategory, { label: string; icon: LucideIcon; color: string }> = {
  insurance: { label: 'Asuransi', icon: Shield, color: MINT },
  loan: { label: 'Pinjaman', icon: Landmark, color: AMBER },
  work: { label: 'Pekerjaan', icon: Briefcase, color: VIOLET },
  property: { label: 'Properti', icon: Building2, color: INDIGO },
  lease: { label: 'Sewa', icon: KeyRound, color: SKY },
  subscription: { label: 'Langganan', icon: Clock, color: VIOLET },
  warranty: { label: 'Garansi', icon: Package, color: MINT },
  other: { label: 'Lainnya', icon: FileText, color: '#64748B' },
}
const FREQ: Record<ContractFrequency, string> = {
  monthly: 'Bulanan', quarterly: 'Triwulan', yearly: 'Tahunan', one_time: 'Sekali Bayar',
}

interface FormState {
  id: string | null
  name: string; category: ContractCategory; provider: string; policy_number: string
  start_date: string; end_date: string; cost: number | null; coverage: number
  frequency: ContractFrequency | ''; auto_renew: boolean; reminder_days_before: number; notes: string
}
const EMPTY: FormState = {
  id: null, name: '', category: 'insurance', provider: '', policy_number: '',
  start_date: '', end_date: '', cost: null, coverage: 0, frequency: 'yearly',
  auto_renew: false, reminder_days_before: 30, notes: '',
}

const DAY = 86_400_000
function daysUntil(iso: string, today: Date) {
  const e = new Date(iso); e.setHours(0, 0, 0, 0)
  const t = new Date(today); t.setHours(0, 0, 0, 0)
  return Math.round((e.getTime() - t.getTime()) / DAY)
}
type Status = 'overdue' | 'expiring' | 'upcoming' | 'archived'
function getStatus(c: Contract, today: Date): Status {
  if (c.is_archived) return 'archived'
  const d = daysUntil(c.end_date, today)
  if (d < 0) return 'overdue'
  if (d <= Math.max(c.reminder_days_before, 90)) return 'expiring'
  return 'upcoming'
}
function humanizeSisa(iso: string, today: Date): string {
  const d = daysUntil(iso, today)
  if (d < 0) return 'Lewat'
  const months = Math.round(d / 30.44)
  if (months >= 360) return 'Permanen'
  const y = Math.floor(months / 12), m = months % 12
  if (y >= 1) return `${y} thn${m ? ` ${m} bln` : ''}`
  if (months >= 1) return `${months} bulan`
  return `${d} hari`
}
const monthlyOf = (c: Contract) => !c.cost || !c.frequency ? 0 : c.frequency === 'monthly' ? c.cost : c.frequency === 'quarterly' ? c.cost / 3 : c.frequency === 'yearly' ? c.cost / 12 : 0
const fullDate = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

export default function ContractsPage() {
  const t = useT()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Contract[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | ContractCategory>('all')
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const today = useMemo(() => new Date(), [])


  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase.from('contracts').select('*').eq('user_id', user.id).order('end_date', { ascending: true })
    setItems((data ?? []) as Contract[])
    setLoading(false)
  }

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const base = {
      user_id: user.id, name: form.name, category: form.category, provider: form.provider,
      policy_number: form.policy_number, start_date: form.start_date || null, end_date: form.end_date,
      cost: form.cost, frequency: form.frequency || null, auto_renew: form.auto_renew,
      reminder_days_before: form.reminder_days_before, notes: form.notes,
    }
    const withCov: Record<string, unknown> = { ...base, coverage: form.coverage || 0 }
    const write = (p: Record<string, unknown>) => form.id
      ? supabase.from('contracts').update(p).eq('id', form.id as string)
      : supabase.from('contracts').insert(p)
    let { error } = await write(withCov)
    if (error && /coverage/i.test(error.message || '')) ({ error } = await write(base)) // migration 037 belum jalan
    setSaving(false); setDialogOpen(false); void load()
  }
  async function remove(id: string) {
    if (!confirm(t('contracts.confirm_delete'))) return
    await supabase.from('contracts').delete().eq('id', id); void load()
  }
  async function toggleArchive(c: Contract) {
    await supabase.from('contracts').update({ is_archived: !c.is_archived }).eq('id', c.id); void load()
  }
  function openEdit(c: Contract) {
    setForm({
      id: c.id, name: c.name, category: c.category, provider: c.provider, policy_number: c.policy_number,
      start_date: c.start_date ?? '', end_date: c.end_date, cost: c.cost, coverage: c.coverage ?? 0,
      frequency: c.frequency ?? '', auto_renew: c.auto_renew, reminder_days_before: c.reminder_days_before, notes: c.notes,
    })
    setDialogOpen(true)
  }
  function openAdd() { setForm({ ...EMPTY }); setDialogOpen(true) }

  // ---- Derived ----
  const active = useMemo(() => items.filter((c) => !c.is_archived), [items])
  const catsPresent = useMemo(() => Array.from(new Set(active.map((c) => c.category))), [active])
  const expiring = active.filter((c) => getStatus(c, today) === 'expiring' || getStatus(c, today) === 'overdue')
  const coverageTotal = active.filter((c) => c.category === 'insurance').reduce((s, c) => s + (c.coverage || 0), 0)
  const monthlyCost = Math.round(active.reduce((s, c) => s + monthlyOf(c), 0))

  const big = formatCurrency
  const stats = [
    { label: t('contracts.stat_active_total'), value: `${active.length} ${t('contracts.unit_item')}`, sub: `${t('contracts.stat_active_sub')} ${catsPresent.length} ${t('contracts.unit_category')}`, icon: ShieldCheck, color: INDIGO, tint: 'rgba(99,102,241,0.12)' },
    { label: t('contracts.stat_renewing'), value: `${expiring.length} ${t('contracts.unit_item')}`, sub: t('contracts.stat_renewing_sub'), icon: RefreshCw, color: AMBER, tint: 'rgba(245,158,11,0.12)' },
    { label: t('contracts.stat_coverage_total'), value: big(coverageTotal), sub: t('contracts.stat_coverage_sub'), icon: Shield, color: VIOLET, tint: 'rgba(139,92,246,0.12)' },
    { label: t('contracts.stat_premium'), value: big(monthlyCost), sub: t('contracts.stat_premium_sub'), icon: CalendarClock, color: MINT, tint: 'rgba(16,185,129,0.12)' },
  ]

  const visible = active
    .filter((c) => filter === 'all' || c.category === filter)
    .filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase()) || c.provider.toLowerCase().includes(query.toLowerCase()))

  const timeline = useMemo(() => [...active]
    .filter((c) => daysUntil(c.end_date, today) >= -30)
    .sort((a, b) => (a.end_date || '').localeCompare(b.end_date || ''))
    .slice(0, 6), [active, today])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="eyebrow mb-1.5">{items.length} {t('contracts.eyebrow_recorded')}</p>
          <h1 className="leading-none" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,38px)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>{t('contracts.page_title')}</h1>
          <p className="text-sm mt-2 max-w-xl" style={{ color: 'var(--ink-muted)' }}>{t('contracts.page_subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" onClick={() => setSearchOpen((v) => !v)}><Search className="h-4 w-4" /> {t('contracts.btn_search')}</Button>
          <Button onClick={openAdd}><Plus className="h-4 w-4" /> {t('contracts.btn_add')}</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--ink-soft)' }} /></div>
      ) : (
        <>
          {/* Stat strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="s-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium flex items-center gap-1.5" style={{ color: 'var(--ink-soft)' }}><span className="size-1.5 rounded-full" style={{ background: s.color }} />{s.label}</p>
                    <p className="num tabular text-2xl font-bold mt-1.5 whitespace-nowrap" style={{ color: 'var(--ink)' }}>{s.value}</p>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--ink-soft)' }}>{s.sub}</p>
                  </div>
                  <div className="size-8 rounded-lg grid place-items-center shrink-0" style={{ background: s.tint }}><s.icon className="size-4" style={{ color: s.color }} /></div>
                </div>
              </div>
            ))}
          </div>

          {items.length === 0 ? (
            <div className="s-card p-12 text-center">
              <div className="size-12 rounded-2xl grid place-items-center mx-auto" style={{ background: 'var(--surface-2)' }}><ShieldCheck className="size-6" style={{ color: 'var(--ink-soft)' }} /></div>
              <p className="font-semibold mt-3" style={{ color: 'var(--ink)' }}>{t('contracts.empty_title')}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>{t('contracts.empty_desc')}</p>
              <Button className="mt-4" onClick={openAdd}><Plus className="h-4 w-4" /> {t('contracts.btn_add')}</Button>
            </div>
          ) : (
            <>
              {/* Tabel */}
              <div className="s-card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b" style={{ borderColor: 'var(--border-soft)' }}>
                  <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>{t('contracts.table_title')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setFilter('all')} className="rounded-full px-2.5 py-1 text-[11px] font-medium transition" style={{ background: filter === 'all' ? 'var(--ink)' : 'var(--surface-2)', color: filter === 'all' ? 'var(--surface)' : 'var(--ink-muted)' }}>{t('contracts.filter_all')}</button>
                    {catsPresent.map((c) => (
                      <button key={c} onClick={() => setFilter(c)} className="rounded-full px-2.5 py-1 text-[11px] font-medium transition" style={{ background: filter === c ? 'var(--ink)' : 'var(--surface-2)', color: filter === c ? 'var(--surface)' : 'var(--ink-muted)' }}>{CAT[c].label}</button>
                    ))}
                  </div>
                </div>
                {searchOpen && (
                  <div className="px-4 py-2.5 border-b" style={{ borderColor: 'var(--border-soft)' }}>
                    <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('contracts.search_placeholder')} />
                  </div>
                )}
                <div className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
                  {visible.map((c) => {
                    const meta = CAT[c.category]
                    const Icon = meta.icon
                    const st = getStatus(c, today)
                    const sub = c.category === 'insurance' && c.coverage > 0 ? `UP ${big(c.coverage)}`
                      : c.provider ? c.provider
                      : c.policy_number || meta.label
                    const badge = st === 'overdue' ? { t: t('contracts.badge_overdue'), c: CORAL } : st === 'expiring' ? { t: t('contracts.badge_renewal'), c: AMBER } : { t: t('contracts.badge_active'), c: MINT }
                    return (
                      <div key={c.id} className="group flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--surface-2)] transition-colors">
                        <div className="size-9 rounded-xl grid place-items-center shrink-0" style={{ background: `${meta.color}1A` }}><Icon className="size-4" style={{ color: meta.color }} /></div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate" style={{ color: 'var(--ink)' }}>{c.name}</p>
                          <p className="text-[11px] truncate" style={{ color: 'var(--ink-soft)' }}>{sub}</p>
                        </div>
                        <span className="hidden sm:inline-block rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>{meta.label}</span>
                        <div className="hidden md:block text-right w-24 shrink-0">
                          <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{t('contracts.col_remaining')}</p>
                          <p className="num text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{humanizeSisa(c.end_date, today)}</p>
                        </div>
                        <div className="text-right w-28 shrink-0">
                          {c.cost ? <><p className="num text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(c.cost)}</p><p className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>{c.frequency ? FREQ[c.frequency] : ''}</p></> : <p className="text-[13px]" style={{ color: 'var(--ink-soft)' }}>{c.frequency ? FREQ[c.frequency] : '—'}</p>}
                        </div>
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0" style={{ background: `${badge.c}1A`, color: badge.c }}>{badge.t}</span>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(c)}><Pencil className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => toggleArchive(c)} title={c.is_archived ? t('contracts.tip_unarchive') : t('contracts.tip_archive')}>{c.is_archived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}</Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => remove(c.id)}><Trash2 className="h-3 w-3" style={{ color: 'var(--danger)' }} /></Button>
                        </div>
                      </div>
                    )
                  })}
                  {visible.length === 0 && <p className="px-4 py-8 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>{t('contracts.no_match')}</p>}
                </div>
              </div>

              {/* Timeline tanggal kunci */}
              {timeline.length > 0 && (
                <div className="s-card p-5">
                  <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>{t('contracts.timeline_title')}</p>
                  <p className="text-base mt-0.5" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>{expiring.length} {t('contracts.timeline_subtitle')}</p>
                  <div className="mt-4 space-y-3">
                    {timeline.map((c) => {
                      const st = getStatus(c, today)
                      const color = st === 'overdue' ? CORAL : st === 'expiring' ? AMBER : MINT
                      return (
                        <div key={c.id} className="flex items-start gap-4 rounded-xl px-3 py-2.5" style={{ background: 'var(--surface-2)' }}>
                          <span className="num text-[12px] font-semibold w-24 shrink-0" style={{ color }}>{fullDate(c.end_date)}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{c.name}{c.auto_renew ? ` · ${t('contracts.auto_renew_suffix')}` : ''}</p>
                            <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{CAT[c.category].label}{c.cost ? ` · ${formatCurrency(c.cost)}/${c.frequency ? FREQ[c.frequency].toLowerCase() : ''}` : ''}{c.notes ? ` · ${c.notes}` : ''}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl grid place-items-center shrink-0" style={{ background: 'rgba(99,102,241,0.12)' }}><ShieldCheck className="size-5" style={{ color: INDIGO }} /></div>
              <div className="min-w-0">
                <DialogTitle className="text-lg" style={{ fontFamily: 'var(--font-display)' }}>{form.id ? t('contracts.dialog_title_edit') : t('contracts.dialog_title_add')}</DialogTitle>
                <DialogDescription>{t('contracts.dialog_desc')}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5"><Label>{t('contracts.field_name')}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('contracts.ph_name')} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>{t('contracts.field_category')}</Label>
                <Select value={form.category} onValueChange={(v) => v && setForm({ ...form, category: v as ContractCategory })}>
                  <SelectTrigger><SelectValue>{(v) => CAT[v as ContractCategory]?.label ?? t('contracts.select_placeholder')}</SelectValue></SelectTrigger>
                  <SelectContent>{(Object.keys(CAT) as ContractCategory[]).map((k) => <SelectItem key={k} value={k}>{CAT[k].label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5"><Label>{t('contracts.field_provider')}</Label><Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder={t('contracts.ph_provider')} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>{t('contracts.field_start')}</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>{t('contracts.field_end')}</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>{t('contracts.field_cost')}</Label><NumberInput value={form.cost ?? 0} onChange={(n) => setForm({ ...form, cost: n || null })} placeholder="0" /></div>
              <div className="grid gap-1.5"><Label>{t('contracts.field_frequency')}</Label>
                <Select value={form.frequency || ''} onValueChange={(v) => setForm({ ...form, frequency: (v || '') as ContractFrequency | '' })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{(Object.keys(FREQ) as ContractFrequency[]).map((k) => <SelectItem key={k} value={k}>{FREQ[k]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {(form.category === 'insurance' || form.category === 'property') && (
              <div className="grid gap-1.5"><Label>{t('contracts.field_coverage')}</Label><NumberInput value={form.coverage} onChange={(n) => setForm({ ...form, coverage: n })} placeholder="0" /></div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>{t('contracts.field_policy')}</Label><Input value={form.policy_number} onChange={(e) => setForm({ ...form, policy_number: e.target.value })} placeholder={t('contracts.ph_optional')} /></div>
              <div className="grid gap-1.5"><Label>{t('contracts.field_reminder')}</Label><Input type="number" min={1} max={365} value={form.reminder_days_before} onChange={(e) => setForm({ ...form, reminder_days_before: Math.max(1, Number(e.target.value) || 1) })} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
              <input type="checkbox" checked={form.auto_renew} onChange={(e) => setForm({ ...form, auto_renew: e.target.checked })} className="h-4 w-4" /> {t('contracts.field_auto_renew')}
            </label>
            <div className="grid gap-1.5"><Label>{t('contracts.field_notes')}</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t('contracts.ph_notes')} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('contracts.btn_cancel')}</Button>
            <Button onClick={save} disabled={saving || !form.name || !form.end_date}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{t('contracts.btn_save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
