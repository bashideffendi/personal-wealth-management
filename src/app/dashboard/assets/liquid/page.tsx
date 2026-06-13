'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import {
  fetchLiquidEntries,
  sumLiquid,
  findDuplicates,
  type UnifiedLiquidEntry,
} from '@/lib/liquid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Plus, Pencil, Trash2, Loader2, AlertTriangle, RefreshCw,
  Landmark, TrendingUp, Banknote, Smartphone, HandCoins, Wallet,
  Zap, Clock, LayoutGrid, List, ArrowUpDown, type LucideIcon,
} from 'lucide-react'
import { InstitutionLogo } from '@/components/accounts/institution-logo'
import { WealthHeader } from '@/components/wealth/wealth-ui'
import { useT } from '@/lib/i18n/context'

const MINT = 'var(--c-mint)', VIOLET = 'var(--c-violet)', AMBER = 'var(--c-amber)', CORAL = 'var(--c-coral)'
const MINT_INK = 'var(--c-mint-ink)', VIOLET_INK = 'var(--c-violet-ink)', AMBER_INK = 'var(--c-amber-ink)', CORAL_INK = 'var(--c-coral-ink)'
const tint = (c: string, p: number) => `color-mix(in srgb, ${c} ${p}%, transparent)`

// Likuiditas tier (perkiraan dari jenis aset — model belum simpan per-aset).
type Tier = 'instan' | 't1' | 't30' | 't90'
const TIER_META: Record<Tier, { label: string; bar: string }> = {
  instan: { label: 'Instan', bar: MINT },
  t1:     { label: 'T+1',    bar: VIOLET },
  t30:    { label: 'T+30',   bar: AMBER },
  t90:    { label: 'T+60–90', bar: CORAL },
}
const TIER_ORDER: Tier[] = ['instan', 't1', 't30', 't90']

// Perkiraan jenis · likuiditas berdasarkan tipe.
const TYPE_META: Record<string, { jenis: string; tier: Tier; icon: LucideIcon; color: string }> = {
  bank:           { jenis: 'Tabungan',   tier: 'instan', icon: Landmark,   color: MINT },
  investment:     { jenis: 'Reksa Dana', tier: 't1',     icon: TrendingUp, color: VIOLET },
  rdn:            { jenis: 'RDN',        tier: 't1',     icon: TrendingUp, color: 'var(--ink)' },
  cash:           { jenis: 'Kas',        tier: 'instan', icon: Banknote,   color: AMBER },
  digital_wallet: { jenis: 'E-Wallet',   tier: 'instan', icon: Smartphone, color: 'var(--ink-soft)' },
  receivable:     { jenis: 'Piutang',    tier: 't30',    icon: HandCoins,  color: CORAL },
}
// Fallback tipe gak dikenal: jangan tampil mentah — UPPERCASE biar gak keliatan kayak bug.
const metaFor = (type: string) => TYPE_META[type] ?? { jenis: type.toUpperCase(), tier: 'instan' as Tier, icon: Wallet, color: 'var(--ink-soft)' }


interface FormState {
  id: string | null
  name: string
  type: 'receivable' | 'cash' | 'bank' | 'digital_wallet'
  balance: number
}
const EMPTY: FormState = { id: null, name: '', type: 'receivable', balance: 0 }

export default function LiquidAssetsPage() {
  const t = useT()
  const supabase = createClient()
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<string>('Semua')
  const [view, setView] = useState<'card' | 'table'>('card')
  const [sortKey, setSortKey] = useState<'saldo'>('saldo')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const pageQuery = useQuery({
    queryKey: ['liquid-assets'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('unauthenticated')
      return fetchLiquidEntries(supabase, user.id, { strict: true })
    },
  })
  const loading = pageQuery.isLoading
  const entries = useMemo(() => pageQuery.data ?? [], [pageQuery.data])
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['liquid-assets'] })
    qc.invalidateQueries({ queryKey: ['net-worth'] }) // kekayaan bersih baca likuid
    qc.invalidateQueries({ queryKey: ['debts-page'] }) // rasio utang pakai aset likuid
  }
  useEffect(() => {
    const v = typeof window !== 'undefined' ? localStorage.getItem('pwm.liquid.view') : null
    if (v === 'table' || v === 'card') setView(v)
  }, [])
  function changeView(v: 'card' | 'table') { setView(v); try { localStorage.setItem('pwm.liquid.view', v) } catch { /* ignore */ } }
  function toggleSort(k: 'saldo') {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(k); setSortDir('desc') }
  }

  async function save() {
    if (!form.name.trim()) { toast.error(t('assets_liquid.alert_name_required')); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const now = new Date()
    const payload = {
      user_id: user.id, name: form.name.trim(), type: form.type, balance: form.balance,
      month: now.getMonth() + 1, year: now.getFullYear(),
    }
    const op = form.id
      ? supabase.from('assets_liquid').update(payload).eq('id', form.id)
      : supabase.from('assets_liquid').insert(payload)
    const { error } = await op
    setSaving(false)
    if (error) { toast.error(t('common.mutation_failed')); return }
    setDialogOpen(false)
    refresh()
  }

  async function remove(id: string) {
    if (!confirm(t('assets_liquid.confirm_delete'))) return
    const { error } = await supabase.from('assets_liquid').delete().eq('id', id)
    if (error) { toast.error(t('common.delete_failed')); return }
    refresh()
  }

  const total = sumLiquid(entries)
  const duplicates = findDuplicates(entries)
  const accountCount = entries.length

  const stats = useMemo(() => {
    let instan = 0, fast = 0, piutang = 0
    for (const e of entries) {
      const m = metaFor(e.type)
      if (m.tier === 'instan') instan += e.balance
      if (m.tier === 'instan' || m.tier === 't1') fast += e.balance
      if (e.type === 'receivable') piutang += e.balance
    }
    return { instan, fast, piutang }
  }, [entries])

  // Tangga likuiditas — bucket saldo per tier.
  const ladder = useMemo(() => {
    const buckets: Record<Tier, number> = { instan: 0, t1: 0, t30: 0, t90: 0 }
    for (const e of entries) buckets[metaFor(e.type).tier] += e.balance
    return TIER_ORDER.map((t) => ({ tier: t, amount: buckets[t] })).filter((b) => b.amount > 0)
  }, [entries])

  const jenisPresent = useMemo(() => {
    const set = new Set(entries.map((e) => metaFor(e.type).jenis))
    return ['Semua', ...Array.from(set)]
  }, [entries])

  const visible = filter === 'Semua' ? entries : entries.filter((e) => metaFor(e.type).jenis === filter)

  // Grouping per jenis (buat kartu + allocation bar) + sorting (buat tabel).
  const grouped = useMemo(() => {
    const g: Record<string, UnifiedLiquidEntry[]> = {}
    for (const e of entries) (g[e.type] ??= []).push(e)
    return g
  }, [entries])
  const typeSum = (t: string) => (grouped[t] ?? []).reduce((s, e) => s + e.balance, 0)
  const typesPresent = Object.keys(grouped).sort((a, b) => typeSum(b) - typeSum(a))
  const sorted = [...visible].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    return (a.balance - b.balance) * dir
  })

  function renderCard(e: UnifiedLiquidEntry) {
    const m = metaFor(e.type)
    const Icon = m.icon
    const isAccount = e.source === 'account'
    return (
      <div key={`${e.source}-${e.id}`} className="group relative overflow-hidden rounded-xl bg-[var(--surface)] border-[length:var(--outline-w)] border-[var(--outline)] shadow-[var(--card-shadow)] p-5 transition-all hover:border-[var(--ink)] hover:shadow-lg">
        {e.source === 'asset_liquid' && (
          <div className="absolute top-2.5 right-2.5 z-10 flex gap-0.5 rounded-lg p-0.5 opacity-0 shadow-[var(--card-shadow)] transition group-hover:opacity-100" style={{ background: 'var(--surface)' }}>
            <Button variant="ghost" size="icon-sm" onClick={() => { setForm({ id: e.id, name: e.name, type: e.type as FormState['type'], balance: e.balance }); setDialogOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon-sm" onClick={() => remove(e.id)}><Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} /></Button>
          </div>
        )}
        <div className="flex items-center gap-3">
          {isAccount
            ? <InstitutionLogo accountName={e.name} size={40} shape="circle" />
            : <div className="size-10 rounded-xl grid place-items-center shrink-0" style={{ background: tint(m.color, 10) }}><Icon className="size-5" style={{ color: m.color }} /></div>}
          <div className="min-w-0">
            <p className="font-semibold truncate" style={{ color: 'var(--ink)' }}>{e.name}</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>{isAccount ? t('assets_liquid.auto_from_account') : t('assets_liquid.source_manual')}</p>
          </div>
        </div>
        <p className="num text-2xl mt-3 tabular font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(e.balance)}</p>
        <div className="mt-4 pt-3 border-t text-[11px]" style={{ borderColor: 'var(--outline)' }}>
          <span style={{ color: 'var(--ink-soft)' }}>
            {TIER_META[m.tier].label}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <WealthHeader
        eyebrow={`${accountCount} ${t('assets_liquid.eyebrow_liquid_assets')}`}
        title={t('assets_liquid.title')}
        subtitle={t('assets_liquid.subtitle')}
      >
        <Button variant="outline" onClick={() => refresh()}><RefreshCw className="h-4 w-4" /> {t('assets_liquid.btn_sync')}</Button>
        <Button onClick={() => { setForm(EMPTY); setDialogOpen(true) }}><Plus className="h-4 w-4" /> {t('assets_liquid.btn_add_asset')}</Button>
      </WealthHeader>

      {duplicates.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl p-4" style={{ background: tint(AMBER, 8), border: `1px solid ${tint(AMBER, 20)}` }}>
          <AlertTriangle className="size-5 shrink-0 mt-0.5" style={{ color: AMBER_INK }} />
          <div className="flex-1 text-sm" style={{ color: 'var(--ink)' }}>
            <p className="font-medium">{t('assets_liquid.dup_title')}</p>
            <p className="mt-1" style={{ color: 'var(--ink-muted)' }}>
              {t('assets_liquid.dup_desc_before')}
              <span className="font-semibold"> {duplicates.map((d) => d.name).join(', ')}</span>.
              {' '}{t('assets_liquid.dup_desc_after')}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : pageQuery.isError ? (
        <div className="s-card flex flex-col items-center text-center py-14 px-8 gap-3">
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>{t('common.load_failed')}</p>
          <Button variant="outline" onClick={() => pageQuery.refetch()}>{t('common.retry')}</Button>
        </div>
      ) : (
        <>
          {/* Stat strip — ikut Aset Non-Likuid (ikon + sel kosong di-mute) */}
          <div className="s-card grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 overflow-hidden" style={{ borderColor: 'var(--outline)' }}>
            <div className="p-5">
              <p className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: 'var(--ink-soft)' }}>{t('assets_liquid.stat_total')}</p>
              <p className="num tabular text-3xl sm:text-4xl font-bold mt-2 leading-none" style={{ color: 'var(--ink)' }}>{formatCurrency(total)}</p>
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--ink-muted)' }}>{accountCount} {t('assets_liquid.stat_total_sub')}</p>
            </div>
            {([
              { id: 'instant', label: t('assets_liquid.card_instant'), val: stats.instan, color: MINT_INK, icon: Zap, sub: total > 0 ? `${((stats.instan / total) * 100).toFixed(0)}% ${t('assets_liquid.card_instant_sub')}` : '—' },
              { id: 't1', label: t('assets_liquid.card_t1'), val: stats.fast, color: VIOLET_INK, icon: Clock, sub: total > 0 ? `${((stats.fast / total) * 100).toFixed(0)}% ${t('assets_liquid.card_t1_sub')}` : '—' },
              { id: 'receivable', label: t('assets_liquid.card_receivable'), val: stats.piutang, color: CORAL_INK, icon: HandCoins, sub: t('assets_liquid.card_receivable_sub') },
            ] as const).map((c) => {
              const CIcon = c.icon
              const empty = c.val <= 0
              return (
                <div key={c.id} className="p-5" style={{ opacity: empty ? 0.5 : 1 }}>
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase" style={{ color: c.color }}><CIcon className="size-3" />{c.label}</p>
                  <p className="num tabular text-xl font-bold mt-2 leading-none" style={{ color: 'var(--ink)' }}>{formatCurrency(c.val)}</p>
                  <p className="text-[11px] mt-1.5" style={{ color: 'var(--ink-muted)' }}>{c.sub}</p>
                </div>
              )
            })}
          </div>

          {/* Allocation bar — komposisi per jenis (muncul kalau >=2 jenis) */}
          {total > 0 && typesPresent.length >= 2 && (
            <div className="s-card p-4">
              <div className="flex h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                {typesPresent.map((t) => (typeSum(t) > 0 ? <div key={t} title={metaFor(t).jenis} style={{ width: `${(typeSum(t) / total) * 100}%`, background: metaFor(t).color }} /> : null))}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
                {typesPresent.map((t) => (typeSum(t) > 0 ? (
                  <span key={t} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                    <span className="size-2 rounded-full" style={{ background: metaFor(t).color }} />{metaFor(t).jenis}
                    <span className="num font-semibold" style={{ color: 'var(--ink)' }}>{((typeSum(t) / total) * 100).toFixed(0)}%</span>
                  </span>
                ) : null))}
              </div>
            </div>
          )}

          {/* Toolbar — label + filter pills + toggle ikon (ikut saham/non-likuid) */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>{t('assets_liquid.detail_heading')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1.5">
                {jenisPresent.map((j) => (
                  <button key={j} onClick={() => setFilter(j)} className="rounded-full px-2.5 py-1 text-[11px] font-medium transition" style={{ background: filter === j ? 'var(--ink)' : 'var(--surface-2)', color: filter === j ? 'var(--surface)' : 'var(--ink-muted)' }}>{j}</button>
                ))}
              </div>
              <div className="flex items-center rounded-md border overflow-hidden" style={{ borderColor: 'var(--outline)' }}>
                <button type="button" onClick={() => changeView('card')} className="size-8 flex items-center justify-center transition" style={{ background: view === 'card' ? 'var(--ink)' : 'var(--surface)', color: view === 'card' ? 'var(--surface)' : 'var(--ink-muted)' }} title={t('assets_liquid.view_card')} aria-label={t('assets_liquid.view_card')}><LayoutGrid className="size-4" /></button>
                <button type="button" onClick={() => changeView('table')} className="size-8 flex items-center justify-center transition" style={{ background: view === 'table' ? 'var(--ink)' : 'var(--surface)', color: view === 'table' ? 'var(--surface)' : 'var(--ink-muted)' }} title={t('assets_liquid.view_table')} aria-label={t('assets_liquid.view_table')}><List className="size-4" /></button>
              </div>
            </div>
          </div>

          {/* Data — Tabel (datar, sortable) atau Kartu (grouped per jenis) */}
          {view === 'table' ? (
            <div className="overflow-x-auto rounded-xl border bg-[var(--surface)]" style={{ borderColor: 'var(--outline)' }}>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--outline)', color: 'var(--ink-soft)' }}>
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium">{t('assets_liquid.col_asset')}</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium">{t('assets_liquid.col_type')}</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium">{t('assets_liquid.col_source')}</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium">{t('assets_liquid.col_liquidity')}</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-medium"><button onClick={() => toggleSort('saldo')} className="ml-auto inline-flex items-center gap-1 transition-colors hover:text-[var(--ink)]">{t('assets_liquid.col_balance')} {sortKey === 'saldo' && <ArrowUpDown className="size-3" />}</button></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((e) => {
                    const m = metaFor(e.type)
                    const Icon = m.icon
                    const isAccount = e.source === 'account'
                    return (
                      <tr key={`${e.source}-${e.id}`} className="group border-b last:border-b-0 transition-colors hover:bg-[var(--surface-2)]" style={{ borderColor: 'var(--outline)' }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {isAccount ? <InstitutionLogo accountName={e.name} size={32} shape="circle" /> : <div className="size-8 rounded-lg grid place-items-center shrink-0" style={{ background: tint(m.color, 10) }}><Icon className="size-4" style={{ color: m.color }} /></div>}
                            <p className="font-medium truncate" style={{ color: 'var(--ink)' }}>{e.name}</p>
                          </div>
                        </td>
                        <td className="px-3 py-3"><span className="inline-flex items-center gap-1.5 whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}><span className="size-1.5 rounded-full" style={{ background: m.color }} />{m.jenis}</span></td>
                        <td className="px-3 py-3 whitespace-nowrap" style={{ color: 'var(--ink-soft)' }}>{isAccount ? t('assets_liquid.source_account') : t('assets_liquid.source_manual')}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap" style={{ color: m.tier === 'instan' ? MINT_INK : 'var(--ink-muted)' }}>{TIER_META[m.tier].label}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-3">
                            {e.source === 'asset_liquid' && (
                              <div className="flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                                <Button variant="ghost" size="icon-sm" onClick={() => { setForm({ id: e.id, name: e.name, type: e.type as FormState['type'], balance: e.balance }); setDialogOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon-sm" onClick={() => remove(e.id)}><Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} /></Button>
                              </div>
                            )}
                            <span className="num font-semibold whitespace-nowrap" style={{ color: 'var(--ink)' }}>{formatCurrency(e.balance)}</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-8">
              {typesPresent.map((typeKey) => {
                const list = visible.filter((e) => e.type === typeKey)
                if (!list.length) return null
                const m = metaFor(typeKey)
                const SIcon = m.icon
                const sub = list.reduce((s, e) => s + e.balance, 0)
                return (
                  <section key={typeKey}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="size-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: tint(m.color, 10) }}><SIcon className="size-4" style={{ color: m.color }} /></div>
                      <h3 className="font-semibold" style={{ color: 'var(--ink)' }}>{m.jenis}</h3>
                      <span className="text-[12px]" style={{ color: 'var(--ink-soft)' }}>{list.length} {t('assets_liquid.asset_count_suffix')}</span>
                      <span className="text-[12px]" style={{ color: 'var(--ink-soft)' }}>·</span>
                      <span className="num text-[12px] font-medium" style={{ color: 'var(--ink-muted)' }}>{formatCurrency(sub)}</span>
                      <div className="flex-1 h-px ml-1.5" style={{ background: 'var(--border-soft)' }} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {list.map(renderCard)}
                    </div>
                  </section>
                )
              })}
            </div>
          )}

          {/* Footnote */}
          <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
            {t('assets_liquid.footnote')} <Link href="/dashboard/accounts" className="hover:underline" style={{ color: 'var(--ink-muted)' }}>{t('assets_liquid.footnote_link')}</Link>
          </p>

          {/* Tangga likuiditas */}
            <div className="s-card p-5">
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>{t('assets_liquid.ladder_heading')}</p>
              <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                {ladder.map((b) => (
                  <div key={b.tier} style={{ width: `${total > 0 ? (b.amount / total) * 100 : 0}%`, background: TIER_META[b.tier].bar }} />
                ))}
              </div>
              <div className="mt-3 space-y-2">
                {ladder.map((b) => (
                  <div key={b.tier} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2" style={{ color: 'var(--ink-muted)' }}>
                      <span className="size-2 rounded-full" style={{ background: TIER_META[b.tier].bar }} />
                      {TIER_META[b.tier].label}
                    </span>
                    <span className="num font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(b.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl grid place-items-center shrink-0" style={{ background: 'var(--c-mint-soft)' }}><Wallet className="size-5" style={{ color: MINT_INK }} /></div>
              <div className="min-w-0">
                <DialogTitle className="text-lg" style={{ fontFamily: 'var(--font-display)' }}>{form.id ? t('assets_liquid.dialog_title_edit') : t('assets_liquid.dialog_title_add')}</DialogTitle>
                <DialogDescription>
                  {t('assets_liquid.dialog_desc_before')}{' '}
                  <Link href="/dashboard/accounts" className="font-semibold hover:underline" style={{ color: 'var(--c-mint)' }}>{t('assets_liquid.dialog_desc_link')}</Link>
                  {' '}{t('assets_liquid.dialog_desc_after')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>{t('assets_liquid.label_name')}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('assets_liquid.placeholder_name')} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('assets_liquid.label_type')}</Label>
              <Select value={form.type} onValueChange={(v) => v && setForm({ ...form, type: v as FormState['type'] })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('assets_liquid.type_placeholder')}>
                    {(v) => ({
                      receivable: t('assets_liquid.type_receivable'), cash: t('assets_liquid.type_cash'),
                      bank: t('assets_liquid.type_bank'), digital_wallet: t('assets_liquid.type_digital_wallet'),
                    } as Record<string, string>)[v] ?? t('assets_liquid.type_placeholder')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receivable">{t('assets_liquid.type_receivable')}</SelectItem>
                  <SelectItem value="cash">{t('assets_liquid.type_cash')}</SelectItem>
                  <SelectItem value="bank">{t('assets_liquid.type_bank')}</SelectItem>
                  <SelectItem value="digital_wallet">{t('assets_liquid.type_digital_wallet')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t('assets_liquid.label_balance')}</Label>
              <NumberInput value={form.balance} onChange={(n) => setForm({ ...form, balance: n })} placeholder="0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('assets_liquid.btn_cancel')}</Button>
            <Button onClick={save} disabled={saving || !form.name}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.id ? t('assets_liquid.btn_save') : t('assets_liquid.btn_add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
