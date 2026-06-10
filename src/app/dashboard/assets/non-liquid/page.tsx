'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import type { AssetNonLiquid } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Plus, Pencil, Trash2, Loader2, MapPin, ExternalLink, Home, Car, Gem,
  RefreshCw, TrendingUp, TrendingDown, ShieldCheck, LayoutGrid, List, ArrowUpDown,
  type LucideIcon,
} from 'lucide-react'
import { LeafletMap } from '@/components/map/map-client'
import { WealthHeader } from '@/components/wealth/wealth-ui'
import { depreciate, METODE_LABEL, type MetodePenyusutan } from '@/lib/depreciation'
import { useT } from '@/lib/i18n/context'

type Category = 'property' | 'vehicle' | 'personal_item'

const CAT: Record<Category, { label: string; note: string; icon: LucideIcon; color: string }> = {
  property:      { label: 'Properti',          note: 'Rumah, apartemen, tanah',     icon: Home, color: '#8B5CF6' },
  vehicle:       { label: 'Kendaraan',         note: 'Mobil, motor, dll',           icon: Car,  color: '#F59E0B' },
  personal_item: { label: 'Pribadi & Lainnya', note: 'Elektronik, perhiasan, seni', icon: Gem,  color: '#10B981' },
}

// Tipe preset per kategori (Elektronik/Koleksi masuk "Pribadi & Lainnya" —
// model cuma punya 3 kategori; biar gak butuh migration + gak rusak Net Worth).
const TYPE_PILLS: Record<Category, string[]> = {
  property: ['Rumah', 'Apartemen', 'Ruko', 'Tanah', 'Villa'],
  vehicle: ['Mobil', 'Motor', 'Sepeda', 'Lainnya'],
  personal_item: ['Elektronik', 'Perhiasan', 'Koleksi', 'Seni', 'Lainnya'],
}

// Placeholder contoh per-kategori (jangan pakai contoh rumah buat kendaraan/pribadi).
const PLACEHOLDERS: Record<Category, { name: string; note: string }> = {
  property:      { name: 'mis. Rumah Bintaro Permai', note: 'mis. SHM, hadap timur, bebas banjir' },
  vehicle:       { name: 'mis. Toyota Avanza 2021',   note: 'mis. pajak Mei, KIR, servis rutin' },
  personal_item: { name: 'mis. Rolex Submariner',     note: 'mis. box & surat lengkap, kondisi mint' },
}

const monthYear = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }) : '—'

interface AssetDetails {
  // kendaraan
  plate?: string; engine?: string; color?: string; year?: string
  // penyusutan (kendaraan & pribadi)
  metode?: MetodePenyusutan; masaManfaat?: number; residu?: number; deprOverride?: boolean
  // properti
  luasTanah?: string; luasBangunan?: string; spesifikasi?: string
}
type WithDetails = { details?: AssetDetails | null }

interface FormState {
  id: string | null
  name: string
  category: Category
  type: string
  purchase_value: number
  current_value: number
  purchase_date: string
  notes: string
  latitude: number | null
  longitude: number | null
  address: string
  // kendaraan
  plate: string
  engine: string
  color: string
  year: string
  // penyusutan
  metode: MetodePenyusutan
  masaManfaat: number
  residu: number
  deprOverride: boolean
  // properti
  luasTanah: string
  luasBangunan: string
  spesifikasi: string
}
const EMPTY: FormState = {
  id: null, name: '', category: 'property', type: '',
  purchase_value: 0, current_value: 0,
  purchase_date: new Date().toISOString().split('T')[0], notes: '',
  latitude: null, longitude: null, address: '',
  plate: '', engine: '', color: '', year: '',
  metode: 'garis_lurus', masaManfaat: 8, residu: 0, deprOverride: false,
  luasTanah: '', luasBangunan: '', spesifikasi: '',
}

export default function NonLiquidAssetsPage() {
  const t = useT()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<AssetNonLiquid[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [revalOpen, setRevalOpen] = useState(false)
  const [revalValues, setRevalValues] = useState<Record<string, number>>({})
  const [revalSaving, setRevalSaving] = useState(false)
  const [view, setView] = useState<'card' | 'table'>('card')
  const [sortKey, setSortKey] = useState<'value' | 'gain' | 'date'>('value')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  // Snapshot waktu render-stabil — Date.now() langsung di render dilarang purity rule.
  const [nowMs] = useState(() => Date.now())

  useEffect(() => {
    const v = typeof window !== 'undefined' ? localStorage.getItem('pwm.nonliquid.view') : null
    if (v === 'table' || v === 'card') setView(v)
  }, [])

  function changeView(v: 'card' | 'table') { setView(v); try { localStorage.setItem('pwm.nonliquid.view', v) } catch { /* ignore */ } }
  function toggleSort(k: 'value' | 'gain' | 'date') {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(k); setSortDir('desc') }
  }

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase.from('assets_non_liquid').select('*').eq('user_id', user.id).order('current_value', { ascending: false })
    const rows = (data ?? []) as AssetNonLiquid[]
    // Penyusutan jalan terus seiring waktu → hitung ulang nilai buku aset yang
    // menyusut (non-override) tiap load + tulis balik ke DB (best-effort) biar
    // Net Worth di halaman lain ikut fresh.
    const now = new Date()
    const writeback: { id: string; current_value: number }[] = []
    const fresh = rows.map((a) => {
      const d = (a as WithDetails).details
      if (d?.metode && d.metode !== 'none' && (d.masaManfaat ?? 0) > 0 && !d.deprOverride) {
        const bv = Math.round(depreciate({ cost: a.purchase_value, residu: d.residu ?? 0, masaManfaat: d.masaManfaat ?? 0, metode: d.metode, start: a.purchase_date, asOf: now }).bookValue)
        if (Math.abs(bv - a.current_value) > 1) { writeback.push({ id: a.id, current_value: bv }); return { ...a, current_value: bv } }
      }
      return a
    })
    setItems(fresh)
    setLoading(false)
    for (const w of writeback) void supabase.from('assets_non_liquid').update({ current_value: w.current_value }).eq('id', w.id)
  }

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    // Aset yang menyusut (non-override) → nilai sekarang = nilai buku otomatis.
    const isDepr = form.category !== 'property' && form.metode !== 'none' && form.masaManfaat > 0
    const computed = isDepr
      ? depreciate({ cost: form.purchase_value, residu: form.residu, masaManfaat: form.masaManfaat, metode: form.metode, start: form.purchase_date })
      : null
    const effectiveCurrent = isDepr && !form.deprOverride && computed ? Math.round(computed.bookValue) : form.current_value
    const payload = {
      user_id: user.id, name: form.name, category: form.category, type: form.type,
      purchase_value: form.purchase_value, current_value: effectiveCurrent,
      purchase_date: form.purchase_date, notes: form.notes,
      latitude: form.category === 'property' ? form.latitude : null,
      longitude: form.category === 'property' ? form.longitude : null,
      address: form.category === 'property' ? form.address : '',
    }
    let id = form.id
    if (form.id) {
      await supabase.from('assets_non_liquid').update(payload).eq('id', form.id)
    } else {
      const { data: ins } = await supabase.from('assets_non_liquid').insert(payload).select('id').single()
      id = (ins as { id: string } | null)?.id ?? null
    }
    // Detail per-kategori → JSONB `details`. Best-effort: kalau kolom belum ada
    // (migration 033 belum di-apply), error diabaikan biar save utama gak gagal.
    if (id) {
      const details: AssetDetails | null =
        form.category === 'vehicle'
          ? { plate: form.plate, engine: form.engine, color: form.color, year: form.year, metode: form.metode, masaManfaat: form.masaManfaat, residu: form.residu, deprOverride: form.deprOverride }
          : form.category === 'personal_item'
            ? { metode: form.metode, masaManfaat: form.masaManfaat, residu: form.residu, deprOverride: form.deprOverride }
            : { luasTanah: form.luasTanah, luasBangunan: form.luasBangunan, spesifikasi: form.spesifikasi }
      await supabase.from('assets_non_liquid').update({ details }).eq('id', id)
    }
    setSaving(false)
    setDialogOpen(false)
    void load()
  }

  async function remove(id: string) {
    if (!confirm(t('assets_nonliquid.confirm_delete'))) return
    await supabase.from('assets_non_liquid').delete().eq('id', id)
    void load()
  }

  function openEdit(a: AssetNonLiquid) {
    const d = (a as WithDetails).details ?? {}
    setForm({
      id: a.id, name: a.name, category: a.category as Category, type: a.type,
      purchase_value: a.purchase_value, current_value: a.current_value,
      purchase_date: a.purchase_date, notes: a.notes,
      latitude: a.latitude ?? null, longitude: a.longitude ?? null, address: a.address ?? '',
      plate: d.plate ?? '', engine: d.engine ?? '', color: d.color ?? '', year: d.year ?? '',
      metode: d.metode ?? (a.category === 'property' ? 'none' : 'garis_lurus'),
      masaManfaat: d.masaManfaat ?? 8, residu: d.residu ?? 0, deprOverride: d.deprOverride ?? false,
      luasTanah: d.luasTanah ?? '', luasBangunan: d.luasBangunan ?? '', spesifikasi: d.spesifikasi ?? '',
    })
    setDialogOpen(true)
  }

  function openReval() {
    const init: Record<string, number> = {}
    for (const a of items) init[a.id] = a.current_value
    setRevalValues(init)
    setRevalOpen(true)
  }
  async function saveReval() {
    setRevalSaving(true)
    for (const a of items.filter((x) => revalValues[x.id] !== x.current_value)) {
      // Aset menyusut → tandai deprOverride biar nilai revaluasi manual gak
      // ketimpa hitung-ulang nilai buku pas load().
      const d = (a as WithDetails).details
      const patch = d?.metode && d.metode !== 'none'
        ? { current_value: revalValues[a.id], details: { ...d, deprOverride: true } }
        : { current_value: revalValues[a.id] }
      await supabase.from('assets_non_liquid').update(patch).eq('id', a.id)
    }
    setRevalSaving(false); setRevalOpen(false); void load()
  }

  const total = useMemo(() => items.reduce((s, a) => s + a.current_value, 0), [items])
  const totalPurchase = useMemo(() => items.reduce((s, a) => s + a.purchase_value, 0), [items])
  const totalDelta = total - totalPurchase

  const grouped = useMemo(() => {
    const out: Record<Category, AssetNonLiquid[]> = { property: [], vehicle: [], personal_item: [] }
    for (const a of items) if (a.category in out) out[a.category as Category].push(a)
    return out
  }, [items])

  function catStat(cat: Category) {
    const list = grouped[cat]
    const cur = list.reduce((s, a) => s + a.current_value, 0)
    const buy = list.reduce((s, a) => s + a.purchase_value, 0)
    return { cur, count: list.length, pct: buy > 0 ? ((cur - buy) / buy) * 100 : 0 }
  }

  // Daftar datar terurut buat tampilan Tabel (kartu tetap grouped per kategori).
  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...items].sort((a, b) => {
      if (sortKey === 'value') return (a.current_value - b.current_value) * dir
      if (sortKey === 'gain') {
        const ga = a.purchase_value > 0 ? (a.current_value - a.purchase_value) / a.purchase_value : 0
        const gb = b.purchase_value > 0 ? (b.current_value - b.purchase_value) / b.purchase_value : 0
        return (ga - gb) * dir
      }
      return (a.purchase_date || '').localeCompare(b.purchase_date || '') * dir
    })
  }, [items, sortKey, sortDir])

  function renderCard(a: AssetNonLiquid) {
    const cat = (a.category in CAT ? a.category : 'personal_item') as Category
    const meta = CAT[cat]
    const Icon = meta.icon
    const dd = (a as WithDetails).details
    const deprLabel = dd?.metode && dd.metode !== 'none' ? METODE_LABEL[dd.metode] : null
    const delta = a.current_value - a.purchase_value
    const pct = a.purchase_value > 0 ? (delta / a.purchase_value) * 100 : 0
    const up = delta >= 0
    const hasMap = cat === 'property' && a.latitude != null && a.longitude != null
    const subtitle = cat === 'vehicle' && dd
      ? [a.type, dd.plate, dd.year].filter(Boolean).join(' · ') || meta.note
      : a.type || meta.note
    const body = (
      <>
        <p className="num text-2xl mt-3 tabular font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(a.current_value)}</p>
        <div className="mt-1.5 flex items-center gap-2 text-[11px]">
          <span className="num px-1.5 py-0.5 rounded font-semibold" style={{ background: `${up ? '#10B981' : '#F43F5E'}1A`, color: up ? '#10B981' : '#F43F5E' }}>{up ? '+' : ''}{pct.toFixed(1)}%</span>
          <span style={{ color: 'var(--ink-muted)' }}>{t('assets_nonliquid.from')} <span className="num">{formatCurrency(a.purchase_value)}</span></span>
        </div>
        <div className="mt-4 pt-3 border-t flex items-center justify-between text-[11px]" style={{ borderColor: 'var(--border-soft)' }}>
          <span style={{ color: 'var(--ink-soft)' }}>{t('assets_nonliquid.bought')} {monthYear(a.purchase_date)}{deprLabel ? ` · ${deprLabel}` : ''}</span>
          {hasMap && (
            <a href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline" style={{ color: 'var(--ink-muted)' }}>
              {t('assets_nonliquid.open_maps')} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </>
    )
    return (
      <div key={a.id} className="group relative overflow-hidden rounded-xl bg-[var(--surface)] border border-[var(--border-soft)] transition-all hover:border-[var(--ink)] hover:shadow-lg">
        {/* Edit/hapus — toolbar ngambang kanan-atas (kebaca di atas peta maupun konten) */}
        <div className="absolute top-2.5 right-2.5 z-10 flex gap-0.5 rounded-lg p-0.5 opacity-0 shadow-sm transition group-hover:opacity-100" style={{ background: 'var(--surface)' }}>
          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon-sm" onClick={() => remove(a.id)}><Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} /></Button>
        </div>

        {hasMap ? (
          <>
            <div className="relative h-28 w-full">
              <LeafletMap lat={a.latitude!} lng={a.longitude!} readOnly height={112} />
              {/* badge kategori ngambang di pojok peta */}
              <div className="absolute -bottom-5 left-5 z-[2] size-10 rounded-xl grid place-items-center shadow-md ring-2 ring-[var(--surface)]" style={{ background: meta.color }}>
                <Icon className="size-5" style={{ color: '#fff' }} />
              </div>
            </div>
            <div className="px-5 pb-5 pt-8">
              <p className="font-semibold truncate" style={{ color: 'var(--ink)' }}>{a.name}</p>
              <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--ink-muted)' }}>{subtitle}</p>
              {a.address && (
                <p className="text-[11px] mt-1 flex items-start gap-1" style={{ color: 'var(--ink-soft)' }}>
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0" /><span className="truncate">{a.address}</span>
                </p>
              )}
              {body}
            </div>
          </>
        ) : (
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl grid place-items-center shrink-0" style={{ background: `${meta.color}1A` }}>
                <Icon className="size-5" style={{ color: meta.color }} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate" style={{ color: 'var(--ink)' }}>{a.name}</p>
                <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--ink-muted)' }}>{subtitle}</p>
              </div>
            </div>
            {body}
          </div>
        )}
      </div>
    )
  }

  // Allocation bar cuma berguna kalau ada >=2 kelas aset (1 kelas = 100%, gak informatif).
  const activeCatCount = (Object.keys(CAT) as Category[]).filter((c) => catStat(c).cur > 0).length

  // Penyusutan live buat form (kendaraan & pribadi).
  const isDeprForm = form.category !== 'property' && form.metode !== 'none' && (form.masaManfaat ?? 0) > 0
  const deprPreview = useMemo(
    () =>
      form.category !== 'property' && form.metode !== 'none' && (form.masaManfaat ?? 0) > 0
        ? depreciate({ cost: form.purchase_value, residu: form.residu, masaManfaat: form.masaManfaat, metode: form.metode, start: form.purchase_date })
        : null,
    [form.category, form.metode, form.masaManfaat, form.residu, form.purchase_value, form.purchase_date],
  )
  const shownCurrent = isDeprForm && !form.deprOverride && deprPreview ? Math.round(deprPreview.bookValue) : form.current_value

  return (
    <div className="space-y-6">
      <WealthHeader
        eyebrow={`${items.length} ${t('assets_nonliquid.eyebrow_suffix')}`}
        title={t('assets_nonliquid.title')}
        subtitle={t('assets_nonliquid.subtitle')}
      >
        {items.length > 0 && <Button variant="outline" onClick={openReval}><RefreshCw className="h-4 w-4" /> {t('assets_nonliquid.revalue_all')}</Button>}
        <Button onClick={() => { setForm(EMPTY); setDialogOpen(true) }}><Plus className="h-4 w-4" /> {t('assets_nonliquid.add_asset')}</Button>
      </WealthHeader>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="s-card p-12 text-center">
          <p className="font-semibold" style={{ color: 'var(--ink)' }}>{t('assets_nonliquid.empty_title')}</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>{t('assets_nonliquid.empty_desc')}</p>
        </div>
      ) : (
        <>
          {/* Strip stat 4-sel (ikut mock) */}
          <div className="s-card grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 overflow-hidden" style={{ borderColor: 'var(--border-soft)' }}>
            <div className="p-5">
              <p className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: 'var(--ink-soft)' }}>{t('assets_nonliquid.market_value_now')}</p>
              <p className="num tabular text-3xl sm:text-4xl font-bold mt-2 leading-none" style={{ color: 'var(--ink)' }}>{formatCurrency(total)}</p>
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--ink-muted)' }}>
                {t('assets_nonliquid.initial_capital')} <span className="num">{formatCurrency(totalPurchase)}</span>{' · '}
                <span className="num font-semibold" style={{ color: totalDelta >= 0 ? '#10B981' : '#F43F5E' }}>{totalDelta >= 0 ? '+' : ''}{formatCurrency(totalDelta)}</span>
              </p>
            </div>
            {(Object.keys(CAT) as Category[]).map((cat) => {
              const s = catStat(cat)
              const CatIcon = CAT[cat].icon
              const empty = s.cur <= 0
              return (
                <div key={cat} className="p-5" style={{ opacity: empty ? 0.5 : 1 }}>
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase" style={{ color: CAT[cat].color }}><CatIcon className="size-3" />{CAT[cat].label}</p>
                  <p className="num tabular text-xl font-bold mt-2 leading-none" style={{ color: 'var(--ink)' }}>{formatCurrency(s.cur)}</p>
                  <p className="text-[11px] mt-1.5" style={{ color: 'var(--ink-muted)' }}>
                    {s.count} {t('assets_nonliquid.item')}{s.count > 0 && <>{' · '}<span style={{ color: s.pct >= 0 ? '#10B981' : '#F43F5E' }}>{s.pct >= 0 ? `${t('assets_nonliquid.appreciation')} +` : `${t('assets_nonliquid.depreciation')} `}{s.pct.toFixed(1)}%</span></>}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Allocation bar — komposisi kelas aset (porto glance). Cuma muncul kalau >=2 kelas. */}
          {total > 0 && activeCatCount >= 2 && (
            <div className="s-card p-4">
              <div className="flex h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                {(Object.keys(CAT) as Category[]).map((cat) => {
                  const s = catStat(cat)
                  return s.cur > 0 ? <div key={cat} title={CAT[cat].label} style={{ width: `${(s.cur / total) * 100}%`, background: CAT[cat].color }} /> : null
                })}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
                {(Object.keys(CAT) as Category[]).map((cat) => {
                  const s = catStat(cat)
                  if (s.cur <= 0) return null
                  return (
                    <span key={cat} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                      <span className="size-2 rounded-full" style={{ background: CAT[cat].color }} />
                      {CAT[cat].label}
                      <span className="num font-semibold" style={{ color: 'var(--ink)' }}>{((s.cur / total) * 100).toFixed(0)}%</span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Toolbar — judul + toggle Kartu/Tabel */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>{t('assets_nonliquid.asset_details')}</p>
            <div className="flex items-center rounded-md border overflow-hidden" style={{ borderColor: 'var(--border-soft)' }}>
              <button type="button" onClick={() => changeView('card')} className="size-8 flex items-center justify-center transition" style={{ background: view === 'card' ? 'var(--ink)' : 'var(--surface)', color: view === 'card' ? 'var(--surface)' : 'var(--ink-muted)' }} title={t('assets_nonliquid.card_view')} aria-label={t('assets_nonliquid.card_view')}>
                <LayoutGrid className="size-4" />
              </button>
              <button type="button" onClick={() => changeView('table')} className="size-8 flex items-center justify-center transition" style={{ background: view === 'table' ? 'var(--ink)' : 'var(--surface)', color: view === 'table' ? 'var(--surface)' : 'var(--ink-muted)' }} title={t('assets_nonliquid.table_view')} aria-label={t('assets_nonliquid.table_view')}>
                <List className="size-4" />
              </button>
            </div>
          </div>

          {/* Data — Tabel (datar, sortable) atau Kartu (grouped per kategori) */}
          {view === 'table' ? (
            <div className="overflow-x-auto rounded-xl border bg-[var(--surface)]" style={{ borderColor: 'var(--border-soft)' }}>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border-soft)', color: 'var(--ink-soft)' }}>
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium">{t('assets_nonliquid.col_asset')}</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium">{t('assets_nonliquid.col_type')}</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium"><button onClick={() => toggleSort('date')} className="inline-flex items-center gap-1 transition-colors hover:text-[var(--ink)]">{t('assets_nonliquid.col_bought')} {sortKey === 'date' && <ArrowUpDown className="size-3" />}</button></th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium">{t('assets_nonliquid.col_age')}</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium">{t('assets_nonliquid.col_initial_capital')}</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium"><button onClick={() => toggleSort('value')} className="ml-auto inline-flex items-center gap-1 transition-colors hover:text-[var(--ink)]">{t('assets_nonliquid.col_current_value')} {sortKey === 'value' && <ArrowUpDown className="size-3" />}</button></th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium">{t('assets_nonliquid.col_diff')}</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium"><button onClick={() => toggleSort('gain')} className="ml-auto inline-flex items-center gap-1 transition-colors hover:text-[var(--ink)]">Δ% {sortKey === 'gain' && <ArrowUpDown className="size-3" />}</button></th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium">{t('assets_nonliquid.col_method')}</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((a) => {
                    const cat = (a.category in CAT ? a.category : 'personal_item') as Category
                    const meta = CAT[cat]
                    const Icon = meta.icon
                    const dd = (a as WithDetails).details
                    const delta = a.current_value - a.purchase_value
                    const pct = a.purchase_value > 0 ? (delta / a.purchase_value) * 100 : 0
                    const up = delta >= 0
                    const tipe = a.type || '—'
                    const ageYears = a.purchase_date ? (nowMs - new Date(a.purchase_date).getTime()) / (365.25 * 86400000) : 0
                    const statusLabel = cat === 'property' ? t('assets_nonliquid.status_appreciation') : dd?.metode ? METODE_LABEL[dd.metode] : up ? t('assets_nonliquid.status_no_depreciation') : t('assets_nonliquid.status_depreciation')
                    return (
                      <tr key={a.id} className="group border-b last:border-b-0 transition-colors hover:bg-[var(--surface-2)]" style={{ borderColor: 'var(--border-soft)' }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="size-8 rounded-lg grid place-items-center shrink-0" style={{ background: `${meta.color}1A` }}><Icon className="size-4" style={{ color: meta.color }} /></div>
                            <p className="font-medium truncate" style={{ color: 'var(--ink)' }}>{a.name}</p>
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>{tipe}</td>
                        <td className="px-3 py-3 num whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>{monthYear(a.purchase_date)}</td>
                        <td className="px-3 py-3 text-right num whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>{ageYears > 0 ? `${ageYears.toFixed(1)} ${t('assets_nonliquid.unit_years')}` : '—'}</td>
                        <td className="px-3 py-3 text-right num whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>{formatCurrency(a.purchase_value)}</td>
                        <td className="px-3 py-3 text-right num font-semibold whitespace-nowrap" style={{ color: 'var(--ink)' }}>{formatCurrency(a.current_value)}</td>
                        <td className="px-3 py-3 text-right num whitespace-nowrap" style={{ color: up ? '#10B981' : '#F43F5E' }}>{delta >= 0 ? '+' : '−'}{formatCurrency(Math.abs(delta))}</td>
                        <td className="px-3 py-3 text-right num font-semibold whitespace-nowrap" style={{ color: up ? '#10B981' : '#F43F5E' }}>{up ? '+' : ''}{pct.toFixed(1)}%</td>
                        <td className="px-3 py-3 whitespace-nowrap" style={{ color: 'var(--ink-soft)' }}>{statusLabel}</td>
                        <td className="px-3 py-3">
                          <div className="flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                            <Button variant="ghost" size="icon-sm" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => remove(a.id)}><Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} /></Button>
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
              {(Object.keys(CAT) as Category[]).map((cat) => {
                const list = grouped[cat]
                if (list.length === 0) return null
                const meta = CAT[cat]
                const Icon = meta.icon
                const s = catStat(cat)
                return (
                  <section key={cat}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="size-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${meta.color}1A` }}><Icon className="size-4" style={{ color: meta.color }} /></div>
                      <h3 className="font-semibold" style={{ color: 'var(--ink)' }}>{meta.label}</h3>
                      <span className="text-[12px]" style={{ color: 'var(--ink-soft)' }}>{s.count} {t('assets_nonliquid.item')}</span>
                      <span className="text-[12px]" style={{ color: 'var(--ink-soft)' }}>·</span>
                      <span className="num text-[12px] font-medium" style={{ color: 'var(--ink-muted)' }}>{formatCurrency(s.cur)}</span>
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
        </>
      )}

      {/* Add / Edit dialog — desain mock: kategori-kartu + tipe-pill + Rp prefix + apresiasi + map */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={`max-h-[92vh] overflow-y-auto ${form.category === 'property' ? 'sm:max-w-4xl' : 'sm:max-w-xl'}`}>
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl grid place-items-center shrink-0" style={{ background: '#8B5CF61A' }}>
                {(() => { const I = CAT[form.category].icon; return <I className="size-5" style={{ color: '#8B5CF6' }} /> })()}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg" style={{ fontFamily: 'var(--font-display)' }}>{form.id ? t('assets_nonliquid.dialog_title_edit') : t('assets_nonliquid.dialog_title_add')}</DialogTitle>
                <DialogDescription>{t('assets_nonliquid.dialog_desc')}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className={form.category === 'property' ? 'grid sm:grid-cols-2 gap-6 py-2 items-start' : 'grid gap-5 py-2'}>
            {/* LEFT — form */}
            <div className="space-y-5">
              <div>
                <StepLabel n={1} text={t('assets_nonliquid.step_category')} />
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {(Object.keys(CAT) as Category[]).map((c) => {
                    const m = CAT[c]; const Icon = m.icon; const on = form.category === c
                    return (
                      <button key={c} type="button" onClick={() => setForm({ ...form, category: c, type: '' })}
                        className="rounded-xl border p-3 flex flex-col items-center gap-1.5 transition"
                        style={{ borderColor: on ? '#8B5CF6' : 'var(--border-soft)', background: on ? '#8B5CF60F' : 'var(--surface)' }}>
                        <div className="size-9 rounded-lg grid place-items-center" style={{ background: on ? '#8B5CF61A' : 'var(--surface-2)' }}>
                          <Icon className="size-4" style={{ color: on ? '#8B5CF6' : 'var(--ink-muted)' }} />
                        </div>
                        <span className="text-[12px] font-medium text-center leading-tight" style={{ color: on ? 'var(--ink)' : 'var(--ink-muted)' }}>{m.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <StepLabel n={2} text={t('assets_nonliquid.step_asset_name')} />
                <Input className="mt-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={PLACEHOLDERS[form.category].name} />
              </div>

              <div>
                <Label className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{t('assets_nonliquid.label_type')}</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {TYPE_PILLS[form.category].map((tp) => {
                    const on = form.type === tp
                    return (
                      <button key={tp} type="button" onClick={() => setForm({ ...form, type: tp })}
                        className="rounded-full px-3 py-1.5 text-[12px] font-medium transition"
                        style={{ background: on ? 'var(--ink)' : 'var(--surface-2)', color: on ? 'var(--surface)' : 'var(--ink-muted)' }}>
                        {tp}
                      </button>
                    )
                  })}
                </div>
              </div>

              {form.category === 'vehicle' && (
                <div>
                  <Label className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{t('assets_nonliquid.label_vehicle_detail')}</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="grid gap-1.5"><Label className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{t('assets_nonliquid.label_plate')}</Label><Input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} placeholder="B 1234 XYZ" /></div>
                    <div className="grid gap-1.5"><Label className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{t('assets_nonliquid.label_year')}</Label><Input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="2022" inputMode="numeric" /></div>
                    <div className="grid gap-1.5"><Label className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{t('assets_nonliquid.label_color')}</Label><Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder={t('assets_nonliquid.ph_color')} /></div>
                    <div className="grid gap-1.5"><Label className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{t('assets_nonliquid.label_engine')}</Label><Input value={form.engine} onChange={(e) => setForm({ ...form, engine: e.target.value })} placeholder={t('assets_nonliquid.ph_optional')} /></div>
                  </div>
                </div>
              )}

              {form.category === 'property' && (
                <div>
                  <Label className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{t('assets_nonliquid.label_property_detail')}</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="grid gap-1.5"><Label className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{t('assets_nonliquid.label_land_area')}</Label><Input type="number" value={form.luasTanah} onChange={(e) => setForm({ ...form, luasTanah: e.target.value })} placeholder="144" inputMode="numeric" /></div>
                    <div className="grid gap-1.5"><Label className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{t('assets_nonliquid.label_building_area')}</Label><Input type="number" value={form.luasBangunan} onChange={(e) => setForm({ ...form, luasBangunan: e.target.value })} placeholder="90" inputMode="numeric" /></div>
                    <div className="grid gap-1.5 col-span-2"><Label className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{t('assets_nonliquid.label_specification')}</Label><Input value={form.spesifikasi} onChange={(e) => setForm({ ...form, spesifikasi: e.target.value })} placeholder={t('assets_nonliquid.ph_specification')} /></div>
                  </div>
                </div>
              )}

              {form.category !== 'property' && (
                <div>
                  <Label className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{t('assets_nonliquid.label_depreciation')}</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(['garis_lurus', 'saldo_menurun_ganda', 'none'] as MetodePenyusutan[]).map((m) => {
                      const on = form.metode === m
                      return (
                        <button key={m} type="button" onClick={() => setForm({ ...form, metode: m, deprOverride: false })}
                          className="rounded-full px-3 py-1.5 text-[12px] font-medium transition"
                          style={{ background: on ? 'var(--ink)' : 'var(--surface-2)', color: on ? 'var(--surface)' : 'var(--ink-muted)' }}>
                          {METODE_LABEL[m]}
                        </button>
                      )
                    })}
                  </div>
                  {form.metode !== 'none' && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div className="grid gap-1.5"><Label className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{t('assets_nonliquid.label_useful_life')}</Label><Input type="number" min={1} value={form.masaManfaat || ''} onChange={(e) => setForm({ ...form, masaManfaat: Number(e.target.value), deprOverride: false })} placeholder="8" inputMode="numeric" /></div>
                      <div className="grid gap-1.5"><Label className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{t('assets_nonliquid.label_residual')}</Label><RpField value={form.residu} onChange={(n) => setForm({ ...form, residu: n, deprOverride: false })} /></div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <StepLabel n={3} text={t('assets_nonliquid.step_asset_value')} />
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="grid gap-1.5">
                    <Label className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{t('assets_nonliquid.label_purchase_price')}</Label>
                    {/* Auto-mirror current←purchase until the user edits "current" — no typing the same big number twice. */}
                    <RpField value={form.purchase_value} onChange={(n) => setForm((f) => ({ ...f, purchase_value: n, current_value: (f.current_value === 0 || f.current_value === f.purchase_value) ? n : f.current_value }))} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[11px] flex items-center justify-between gap-2" style={{ color: 'var(--ink-muted)' }}>
                      <span>{isDeprForm ? t('assets_nonliquid.label_current_book') : t('assets_nonliquid.label_current')}</span>
                      {isDeprForm && (form.deprOverride
                        ? <button type="button" onClick={() => setForm({ ...form, deprOverride: false })} className="text-[10px] underline" style={{ color: 'var(--ink-soft)' }}>{t('assets_nonliquid.use_auto')}</button>
                        : <span className="text-[10px] font-semibold" style={{ color: '#10B981' }}>{t('assets_nonliquid.auto')}</span>)}
                    </Label>
                    <RpField value={shownCurrent} onChange={(n) => setForm({ ...form, current_value: n, deprOverride: true })} />
                  </div>
                </div>
                {isDeprForm && deprPreview ? (
                  <div className="mt-2.5 rounded-lg p-3" style={{ background: 'var(--surface-2)' }}>
                    <div className="grid grid-cols-3 gap-2 text-[12px]">
                      <div><p style={{ color: 'var(--ink-soft)' }}>{t('assets_nonliquid.depr_per_year')}</p><p className="num font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{formatCurrency(Math.round(deprPreview.perYearFirst))}</p></div>
                      <div><p style={{ color: 'var(--ink-soft)' }}>{t('assets_nonliquid.depr_accumulated')}</p><p className="num font-semibold mt-0.5" style={{ color: '#E11D48' }}>−{formatCurrency(Math.round(deprPreview.accumulated))}</p></div>
                      <div><p style={{ color: 'var(--ink-soft)' }}>{t('assets_nonliquid.depr_book_value')}</p><p className="num font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{formatCurrency(Math.round(deprPreview.bookValue))}</p></div>
                    </div>
                    <p className="text-[11px] mt-2" style={{ color: 'var(--ink-soft)' }}>
                      {t('assets_nonliquid.age')} {deprPreview.yearsElapsed.toFixed(1)} {t('assets_nonliquid.unit_years')} · {METODE_LABEL[form.metode]}
                      {deprPreview.fullyDepreciated ? ` · ${t('assets_nonliquid.fully_depreciated')}` : ''}
                      {form.deprOverride ? ` · ${t('assets_nonliquid.manually_overridden')}` : ''}
                    </p>
                  </div>
                ) : (form.purchase_value > 0 && form.current_value > 0 && (() => {
                  const d = form.current_value - form.purchase_value
                  const p = (d / form.purchase_value) * 100
                  const up = d >= 0
                  return (
                    <div className="mt-2.5 rounded-lg px-3 py-2 text-[12px] flex items-center gap-2" style={{ background: `${up ? '#10B981' : '#F43F5E'}14`, color: up ? '#059669' : '#E11D48' }}>
                      {up ? <TrendingUp className="size-3.5 shrink-0" /> : <TrendingDown className="size-3.5 shrink-0" />}
                      {up ? t('assets_nonliquid.status_appreciation') : t('assets_nonliquid.status_depreciation')} <span className="num font-semibold">{up ? '+' : ''}{formatCurrency(d)} ({up ? '+' : ''}{p.toFixed(1)}%)</span> {t('assets_nonliquid.since_bought')}
                    </div>
                  )
                })())}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{t('assets_nonliquid.label_purchase_date')}</Label><Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{t('assets_nonliquid.label_notes')}</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={PLACEHOLDERS[form.category].note} /></div>
              </div>
            </div>

            {/* RIGHT — map (properti aja) */}
            {form.category === 'property' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" style={{ color: '#8B5CF6' }} /> {t('assets_nonliquid.location_on_map')}</Label>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}>{t('assets_nonliquid.optional')}</span>
                </div>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder={t('assets_nonliquid.ph_full_address')} />
                <LeafletMap lat={form.latitude} lng={form.longitude} onPick={(lat, lng) => setForm({ ...form, latitude: lat, longitude: lng })} height={380} />
              </div>
            )}
          </div>

          <DialogFooter className="sm:justify-between sm:items-center">
            <p className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--ink-soft)' }}>
              <ShieldCheck className="size-3.5" style={{ color: '#10B981' }} /> {t('assets_nonliquid.encrypted_note')}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('assets_nonliquid.cancel')}</Button>
              <Button onClick={save} disabled={saving || !form.name}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}<Plus className="h-4 w-4" />{form.id ? t('assets_nonliquid.save') : t('assets_nonliquid.add_asset')}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revaluasi semua */}
      <Dialog open={revalOpen} onOpenChange={setRevalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('assets_nonliquid.reval_title')}</DialogTitle>
            <DialogDescription>{t('assets_nonliquid.reval_desc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {items.map((a) => (
              <div key={a.id} className="grid grid-cols-[1fr_auto] items-center gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{a.name}</p>
                  <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{t('assets_nonliquid.reval_old')} <span className="num">{formatCurrency(a.current_value)}</span></p>
                </div>
                <div className="w-40"><NumberInput value={revalValues[a.id] ?? a.current_value} onChange={(n) => setRevalValues((p) => ({ ...p, [a.id]: n }))} placeholder="0" /></div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevalOpen(false)}>{t('assets_nonliquid.cancel')}</Button>
            <Button onClick={saveReval} disabled={revalSaving}>{revalSaving && <Loader2 className="h-4 w-4 animate-spin" />}{t('assets_nonliquid.save_all')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StepLabel({ n, text }: { n: number; text: string }) {
  return (
    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
      <span className="size-4 rounded grid place-items-center text-[9px] num" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>{n}</span>
      {text}
    </p>
  )
}

function RpField({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-stretch rounded-md border overflow-hidden" style={{ borderColor: 'var(--border-soft)' }}>
      <span className="px-3 flex items-center text-sm font-medium border-r shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)', borderColor: 'var(--border-soft)' }}>Rp</span>
      <NumberInput value={value} onChange={onChange} placeholder="0" className="flex-1 border-0 rounded-none shadow-none focus-visible:ring-0" />
    </div>
  )
}
